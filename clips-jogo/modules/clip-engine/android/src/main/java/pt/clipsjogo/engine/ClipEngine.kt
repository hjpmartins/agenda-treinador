package pt.clipsjogo.engine

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import pt.clipsjogo.engine.core.CutPlan
import pt.clipsjogo.engine.core.CutPlanner
import pt.clipsjogo.engine.core.RecordingClock
import pt.clipsjogo.engine.core.Timebase
import pt.clipsjogo.engine.media.AudioEncoder
import pt.clipsjogo.engine.media.CameraController
import pt.clipsjogo.engine.media.ClipCutter
import pt.clipsjogo.engine.media.SegmentMuxer
import pt.clipsjogo.engine.media.VideoConfig
import pt.clipsjogo.engine.media.VideoEncoder
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Motor de gravação contínua + cortes. Um único por processo.
 *
 * Threads:
 *  - câmara: abre/configura a Camera2;
 *  - encoder: callbacks do encoder de vídeo + escrita dos segmentos (SegmentMuxer);
 *  - áudio: leitura do microfone (dentro do AudioEncoder);
 *  - cutter: cortes de clips e vídeo final, um de cada vez;
 *  - io: escrita dos ficheiros JSON de estado.
 */
object ClipEngine {
  interface Listener {
    fun onStateChanged(state: String)
    fun onClipUpdated(sessionId: String, clip: ClipInfo)
    fun onFinalizeProgress(sessionId: String, progress: Float)
    fun onError(message: String)
  }

  const val STATE_IDLE = "idle"
  const val STATE_PREVIEW = "preview"
  const val STATE_RECORDING = "recording"
  const val STATE_FINALIZING = "finalizing"

  /** Jogos guardados no telemóvel (os mais antigos são apagados no fim de cada gravação). */
  const val KEEP_SESSIONS = 3

  private const val TAG = "ClipEngine"
  private const val SEGMENT_US = 2_000_000L
  private const val MAX_PART_BYTES = 3_500_000_000L

  private lateinit var appContext: Context
  private lateinit var storage: Storage
  private val cameraThread = HandlerThread("ClipEngine-camera").apply { start() }
  private val encoderThread = HandlerThread("ClipEngine-encoder").apply { start() }
  private val cameraHandler = Handler(cameraThread.looper)
  private val encoderHandler = Handler(encoderThread.looper)
  private val cutter = Executors.newSingleThreadExecutor { Thread(it, "ClipEngine-cutter") }
  private val io = Executors.newSingleThreadExecutor { Thread(it, "ClipEngine-io") }

  var listener: Listener? = null

  @Volatile var state: String = STATE_IDLE
    private set

  private var camera: CameraController? = null
  private var previewSurface: Surface? = null

  private val clock = RecordingClock()
  /** Detetado no primeiro frame de cada encoder (só usado na thread do encoder). */
  private var timebaseOffsetUs: Long? = null
  @Volatile private var session: SessionInfo? = null
  /** Segmentador ativo (só durante a gravação). Só usado na thread do encoder. */
  private var activeMuxer: SegmentMuxer? = null
  private var previewQuality = "1080p"

  /** Gravar som (escolha guardada no telemóvel; por defeito não — os clips são para ver). */
  var audioEnabled: Boolean
    get() = appContext.getSharedPreferences("clips_engine", Context.MODE_PRIVATE).getBoolean("audio", false)
    set(v) = appContext.getSharedPreferences("clips_engine", Context.MODE_PRIVATE).edit().putBoolean("audio", v).apply()

  /** Qualidade escolhida no ecrã Gravar (usada quando o tablet inicia a gravação). */
  val selectedQuality: String get() = previewQuality
  @Volatile private var videoEncoder: VideoEncoder? = null
  private var audioEncoder: AudioEncoder? = null
  @Volatile private var recordingDone = true
  private var lastSession: SessionInfo? = null

  @Synchronized
  fun init(context: Context) {
    if (::appContext.isInitialized) return
    appContext = context.applicationContext
    CrashLog.install(appContext)
    storage = Storage(appContext)
    // Sessões que ficaram a meio (app fechada à força, bateria, crash) ficam marcadas para recuperar.
    io.execute {
      storage.loadAll().filter {
        it.status == SessionInfo.STATUS_RECORDING || it.status == SessionInfo.STATUS_FINALIZING
      }.forEach {
        it.status = SessionInfo.STATUS_INTERRUPTED
        storage.saveSession(it)
      }
    }
  }

  private fun hasPermission(p: String) =
    appContext.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

  private fun cameraOrNull(): CameraController? {
    if (camera == null && hasPermission(Manifest.permission.CAMERA)) {
      camera = CameraController(appContext, cameraHandler) { msg -> emitError(msg) }
    }
    return camera
  }

  // ---------------------------------------------------------------- pré-visualização

  @Synchronized
  fun setPreviewSurface(surface: Surface?) {
    previewSurface = surface
    if (state == STATE_IDLE && surface != null) setState(STATE_PREVIEW)
    if (state == STATE_PREVIEW && surface == null) setState(STATE_IDLE)
    refreshPipeline()
  }

  /** Muda a qualidade antes de gravar (recria o encoder enquanto só há pré-visualização). */
  @Synchronized
  fun setQuality(quality: String) {
    if (state == STATE_RECORDING || state == STATE_FINALIZING) return
    if (quality == previewQuality && videoEncoder != null) return
    previewQuality = quality
    dropEncoder()
    refreshPipeline()
  }

  /**
   * Modo espera (antes do jogo, ecrã de repouso): câmara e encoder desligados para
   * poupar bateria e calor. O tablet continua a poder iniciar a gravação.
   */
  @Volatile var standby = false
    private set

  @Synchronized
  fun setStandby(on: Boolean) {
    if (standby == on) return
    standby = on
    if (state == STATE_RECORDING || state == STATE_FINALIZING) return
    if (on) dropEncoder()
    refreshPipeline()
  }

  private val encoderNeeded: Boolean
    get() = (previewSurface != null && !standby) || state == STATE_RECORDING || state == STATE_FINALIZING

  /**
   * Liga câmara → (pré-visualização + encoder). O encoder fica ligado durante a
   * pré-visualização para que começar a gravar não reconfigure a câmara.
   */
  private fun refreshPipeline() {
    val cam = cameraOrNull() ?: return
    if (encoderNeeded && videoEncoder == null) {
      var config = VideoConfig.forQuality(previewQuality)
      if (!VideoEncoder.isSupported(config)) config = VideoConfig.forQuality("720p")
      try {
        val enc = VideoEncoder(config, encoderHandler, onOutput = ::onVideoFrame, onError = ::emitError)
        encoderHandler.post { timebaseOffsetUs = null }
        videoEncoder = enc
      } catch (e: Exception) {
        emitError(e.message ?: "Não foi possível iniciar o encoder de vídeo.")
      }
    }
    if (!encoderNeeded) {
      cam.setSurfaces(emptyList())
      dropEncoder()
      return
    }
    cam.setSurfaces(listOfNotNull(previewSurface, videoEncoder?.inputSurface))
  }

  private fun dropEncoder() {
    val enc = videoEncoder ?: return
    videoEncoder = null
    // A câmara tem de largar a Surface do encoder antes de ele ser libertado.
    camera?.setSurfaces(listOfNotNull(previewSurface))
    encoderHandler.post { enc.release() }
  }

  /** Corre na thread do encoder, para cada frame codificado (a gravar ou não). */
  private fun onVideoFrame(buffer: java.nio.ByteBuffer, info: android.media.MediaCodec.BufferInfo) {
    val offset = timebaseOffsetUs ?: Timebase.offsetToBootUs(
      info.presentationTimeUs, SystemClock.elapsedRealtimeNanos() / 1000, System.nanoTime() / 1000
    ).also {
      timebaseOffsetUs = it
      Log.i(TAG, "Relógio da câmara: desvio para BOOTTIME = $it µs")
    }
    val m = activeMuxer ?: return
    if (!m.hasVideoFormat) videoEncoder?.outputFormat?.let { m.onVideoFormat(it) }
    m.writeVideo(buffer, info, info.presentationTimeUs + offset)
  }

  // ---------------------------------------------------------------- gravação

  @Synchronized
  fun startRecording(quality: String, displayRotationDegrees: Int): String {
    check(state != STATE_RECORDING && state != STATE_FINALIZING) { "Já está a gravar." }
    val cam = cameraOrNull() ?: throw IllegalStateException("Sem permissão para usar a câmara.")
    if (quality != previewQuality) setQuality(quality)
    if (standby) {
      // Sai do modo espera: liga a câmara e dá-lhe tempo para acertar foco e exposição.
      standby = false
      refreshPipeline()
      Thread.sleep(1800)
    }

    val rotation = cam.rotationFor(displayRotationDegrees)
    val prevState = state
    setState(STATE_RECORDING)
    refreshPipeline()
    val enc = videoEncoder ?: run {
      setState(prevState)
      throw IllegalStateException("Não foi possível iniciar o encoder de vídeo.")
    }
    val config = enc.config
    val s = storage.newSession(if (config.height >= 1080) "1080p" else "720p", config.width, config.height, rotation)

    clock.reset()
    recordingDone = false
    val withAudio = audioEnabled && hasPermission(Manifest.permission.RECORD_AUDIO)
    val m = SegmentMuxer(s.segmentsDir, SEGMENT_US, rotation, withAudio, clock) { seg -> onSegmentClosed(s, seg) }

    val audio = if (withAudio) {
      AudioEncoder(
        deliver = { data, bootUs -> encoderHandler.post { m.writeAudio(data, bootUs) } },
        onFormat = { f -> encoderHandler.post { m.onAudioFormat(f) } },
        onError = { msg -> emitError(msg) }
      )
    } else null
    try {
      audio?.start()
    } catch (e: Exception) {
      s.dir.deleteRecursively()
      setState(if (previewSurface != null) STATE_PREVIEW else STATE_IDLE)
      refreshPipeline()
      throw IllegalStateException("Não foi possível usar o microfone: ${e.message}")
    }

    session = s
    lastSession = s
    // Mantém câmara, microfone e servidor vivos com o ecrã bloqueado ou noutra app.
    RecordingService.start(appContext)
    audioEncoder = audio
    // A partir daqui os frames passam a ser guardados (a gravação começa no próximo keyframe).
    encoderHandler.post {
      activeMuxer = m
      enc.requestKeyFrame()
    }
    return s.id
  }

  /** Para a gravação. A finalização (vídeo completo) continua em segundo plano. */
  @Synchronized
  fun stopRecording() {
    if (state != STATE_RECORDING) return
    val s = session ?: return
    setState(STATE_FINALIZING)
    s.status = SessionInfo.STATUS_FINALIZING
    // Parar o áudio primeiro: o que ele já entregou fica na fila da thread do encoder, antes do fecho.
    audioEncoder?.stop()
    audioEncoder = null
    encoderHandler.post {
      val m = activeMuxer
      activeMuxer = null
      val end = m?.finish() ?: 0L
      s.durationUs = end
      recordingDone = true
      cutter.execute { finalizeSession(s) }
    }
  }

  private fun onSegmentClosed(s: SessionInfo, seg: pt.clipsjogo.engine.core.Segment) {
    s.segments.add(seg)
    s.durationUs = seg.endUs
    io.execute { storage.saveSession(s) }
    cutter.execute { processPendingClips(s) }
  }

  /** Instante (elapsedRealtime, ms) do primeiro frame da gravação em curso; null se não está a gravar. */
  fun recordingStartElapsedMs(): Double? =
    if (session != null && !recordingDone && clock.started) clock.t0BootUs / 1000.0 else null

  fun nowRecUs(): Long =
    if (state == STATE_RECORDING && clock.started) clock.toRecUs(SystemClock.elapsedRealtimeNanos() / 1000) else 0L

  // ---------------------------------------------------------------- clips

  fun requestClip(id: String?, startUs: Long, endUs: Long, name: String?): ClipInfo {
    val s = session ?: lastSession ?: throw IllegalStateException("Não há nenhuma gravação ativa.")
    s.clips.firstOrNull { it.id == id }?.let { return it } // pedido repetido (reenvio)
    val number = s.clips.size + 1
    val clip = ClipInfo(
      id = id ?: UUID.randomUUID().toString(),
      name = name?.takeIf { it.isNotBlank() } ?: "Clip $number",
      requestedStartUs = startUs,
      requestedEndUs = endUs,
      createdAtMs = System.currentTimeMillis()
    )
    s.clips.add(clip)
    io.execute { storage.saveClips(s) }
    listener?.onClipUpdated(s.id, clip)
    cutter.execute { processPendingClips(s) }
    return clip
  }

  /** Corre no cutter. */
  private fun processPendingClips(s: SessionInfo) {
    val done = recordingDone || s !== session
    for (clip in s.clips) {
      if (clip.status != ClipInfo.STATUS_PENDING) continue
      when (val plan = CutPlanner.plan(s.segments, clip.requestedStartUs, clip.requestedEndUs, done)) {
        is CutPlan.Waiting -> Unit
        is CutPlan.Invalid -> updateClip(s, clip) {
          status = ClipInfo.STATUS_FAILED
          error = plan.reason
        }
        is CutPlan.Ready -> {
          updateClip(s, clip) { status = ClipInfo.STATUS_CUTTING }
          val fileName = clipFileName(s, clip)
          try {
            val result = ClipCutter.cut(
              s.segmentsDir, plan.pieces.map { it.segment }, plan.startUs, plan.endUs,
              File(s.clipsDir, fileName), s.rotation
            )
            updateClip(s, clip) {
              status = ClipInfo.STATUS_READY
              this.fileName = fileName
              startUs = result.startUs
              endUs = result.endUs
              sizeBytes = result.sizeBytes
            }
          } catch (e: Exception) {
            Log.e(TAG, "Falha a cortar ${clip.id}", e)
            updateClip(s, clip) {
              status = ClipInfo.STATUS_FAILED
              error = e.message ?: "Erro a cortar o clip."
            }
          }
        }
      }
    }
  }

  private fun clipFileName(s: SessionInfo, clip: ClipInfo): String {
    val n = s.clips.indexOf(clip) + 1
    val slug = clip.name.lowercase()
      .replace(Regex("[^a-z0-9]+"), "-").trim('-').take(30)
    return String.format(java.util.Locale.US, "clip_%03d%s.mp4", n, if (slug.isEmpty()) "" else "_$slug")
  }

  private fun updateClip(s: SessionInfo, clip: ClipInfo, change: ClipInfo.() -> Unit) {
    clip.change()
    io.execute { storage.saveClips(s) }
    listener?.onClipUpdated(s.id, clip)
  }

  fun renameClip(sessionId: String, clipId: String, name: String) {
    val s = findSession(sessionId) ?: return
    val clip = s.clips.firstOrNull { it.id == clipId } ?: return
    updateClip(s, clip) { this.name = name }
  }

  fun deleteClip(sessionId: String, clipId: String) {
    val s = findSession(sessionId) ?: return
    val clip = s.clips.firstOrNull { it.id == clipId } ?: return
    clip.fileName?.let { File(s.clipsDir, it) }?.let { f ->
      f.delete()
      pt.clipsjogo.engine.media.LightCopies.fileFor(f).delete()
    }
    s.clips.remove(clip)
    io.execute { storage.saveClips(s) }
  }

  // ---------------------------------------------------------------- finalização

  /** Corre no cutter: acaba os clips pendentes e cria o vídeo completo. */
  private fun finalizeSession(s: SessionInfo) {
    try {
      processPendingClips(s)
      exportFullVideo(s)
    } catch (e: Exception) {
      Log.e(TAG, "Falha a finalizar", e)
      s.status = SessionInfo.STATUS_INTERRUPTED
      storage.saveSession(s)
      emitError("Não foi possível criar o vídeo completo: ${e.message}. Os segmentos ficaram guardados.")
    } finally {
      synchronized(this) {
        if (session === s) session = null
        RecordingService.stop(appContext)
        setState(if (previewSurface != null) STATE_PREVIEW else STATE_IDLE)
        refreshPipeline()
      }
      pruneOldSessions()
    }
  }

  private fun exportFullVideo(s: SessionInfo) {
    if (s.segments.isEmpty()) {
      s.status = SessionInfo.STATUS_DONE
      storage.saveSession(s)
      return
    }
    val needed = s.segments.sumOf { it.sizeBytes } + 200_000_000L
    if (StatFs(s.dir.absolutePath).availableBytes < needed) {
      throw IllegalStateException("Não há espaço livre suficiente")
    }
    val parts = CutPlanner.splitIntoParts(s.segments, MAX_PART_BYTES)
    val total = s.segments.last().endUs.toFloat()
    val names = mutableListOf<String>()
    for ((i, part) in parts.withIndex()) {
      val name = if (parts.size == 1) "jogo_${s.id}.mp4" else "jogo_${s.id}_parte${i + 1}.mp4"
      ClipCutter.cut(s.segmentsDir, part, part.first().startUs, part.last().endUs, File(s.dir, name), s.rotation) { p ->
        val doneUs = part.first().startUs + p * (part.last().endUs - part.first().startUs)
        listener?.onFinalizeProgress(s.id, doneUs / total)
      }
      names.add(name)
    }
    s.fullVideoParts = names
    s.status = SessionInfo.STATUS_DONE
    storage.saveSession(s)
    // O vídeo completo e os clips já existem: os segmentos deixam de ser precisos.
    s.segmentsDir.deleteRecursively()
    listener?.onFinalizeProgress(s.id, 1f)
  }

  /** Volta a criar o vídeo completo de uma sessão interrompida, a partir dos segmentos. */
  fun recoverSession(sessionId: String) {
    val s = findSession(sessionId) ?: throw IllegalStateException("Sessão não encontrada.")
    check(s !== session) { "Esta sessão ainda está a gravar." }
    cutter.execute {
      // Só conta segmentos que existem mesmo em disco (o último pode estar incompleto).
      val valid = s.segments.filter { File(s.segmentsDir, it.fileName).length() > 0 }
      s.segments.clear()
      s.segments.addAll(valid)
      s.status = SessionInfo.STATUS_FINALIZING
      storage.saveSession(s)
      try {
        processPendingClips(s)
        exportFullVideo(s)
      } catch (e: Exception) {
        s.status = SessionInfo.STATUS_INTERRUPTED
        storage.saveSession(s)
        emitError("Não foi possível recuperar a gravação: ${e.message}")
      }
    }
  }

  // ---------------------------------------------------------------- consultas

  fun listSessions(): List<SessionInfo> {
    val live = session
    return storage.loadAll().map { if (live != null && it.id == live.id) live else it }
  }

  fun findSession(id: String): SessionInfo? {
    session?.let { if (it.id == id) return it }
    lastSession?.let { if (it.id == id) return it }
    return storage.loadAll().firstOrNull { it.id == id }
  }

  fun deleteSession(id: String) {
    check(session?.id != id) { "Não é possível apagar a gravação em curso." }
    findSession(id)?.dir?.deleteRecursively()
    if (lastSession?.id == id) lastSession = null
  }

  /**
   * Os jogos são para aprender logo: ficam só os [KEEP_SESSIONS] mais recentes
   * (o que se quiser guardar vai antes para a galeria ou é partilhado).
   */
  private fun pruneOldSessions() {
    try {
      val current = session?.id
      storage.loadAll()
        .filter { it.id != current && it.status != SessionInfo.STATUS_RECORDING && it.status != SessionInfo.STATUS_FINALIZING }
        .sortedByDescending { it.startedAtMs }
        .drop(KEEP_SESSIONS)
        .forEach { old ->
          Log.i(TAG, "A apagar jogo antigo ${old.id}")
          old.dir.deleteRecursively()
          if (lastSession?.id == old.id) lastSession = null
        }
    } catch (e: Exception) {
      Log.w(TAG, "Falha a apagar jogos antigos", e)
    }
  }

  fun currentSession(): SessionInfo? = session ?: lastSession

  fun status(): Map<String, Any?> {
    val s = session
    val bm = appContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    val plugged = bm.isCharging
    val thermal = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      when ((appContext.getSystemService(Context.POWER_SERVICE) as PowerManager).currentThermalStatus) {
        PowerManager.THERMAL_STATUS_NONE, PowerManager.THERMAL_STATUS_LIGHT -> "normal"
        PowerManager.THERMAL_STATUS_MODERATE -> "quente"
        else -> "critico"
      }
    } else "normal"
    val free = try { StatFs(storage.root.absolutePath).availableBytes } catch (_: Exception) { -1L }
    val q = s?.quality ?: "1080p"
    val bytesPerSecond = VideoConfig.forQuality(q).bitrate / 8 + 16_000
    return mapOf(
      "state" to state,
      "standby" to standby,
      "sessionId" to s?.id,
      "recordingMs" to nowRecUs() / 1000,
      "segments" to (s?.segments?.size ?: 0),
      "quality" to s?.quality,
      "width" to s?.width,
      "height" to s?.height,
      "batteryPercent" to if (level in 0..100) level else null,
      "charging" to plugged,
      "thermal" to thermal,
      "freeBytes" to free,
      "bytesPerSecond" to bytesPerSecond,
      "hasMicrophone" to (audioEnabled && hasPermission(Manifest.permission.RECORD_AUDIO)),
      "audioEnabled" to audioEnabled,
      "linkActive" to pt.clipsjogo.engine.link.Link.active,
      "tabletConnected" to pt.clipsjogo.engine.link.Link.tabletConnected
    )
  }

  // ---------------------------------------------------------------- utilitários

  private fun setState(newState: String) {
    if (state == newState) return
    state = newState
    listener?.onStateChanged(newState)
  }

  private fun emitError(message: String) {
    Log.e(TAG, message)
    listener?.onError(message)
  }
}
