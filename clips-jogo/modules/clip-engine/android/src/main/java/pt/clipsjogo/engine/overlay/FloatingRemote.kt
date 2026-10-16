package pt.clipsjogo.engine.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Barra flutuante do modo Comando: fica por cima de outras apps (ex.: a app de
 * estatísticas) quando a app sai do ecrã, e pede clips ao telemóvel.
 *
 * Fala diretamente com o telemóvel (em nativo), porque com a app em segundo
 * plano os temporizadores do JavaScript param.
 */
object FloatingRemote {
  /** skipIds: clips que o tablet já tem (ou apagou), para não os voltar a copiar. */
  data class Config(
    val urls: List<String>,
    val token: String,
    val skipIds: Set<String> = emptySet(),
    /** false = "copiar só quando eu pedir": a barra não copia vídeos, a ligação fica só para os pedidos. */
    val autoDownload: Boolean = true,
    /** Pedir a cópia leve (720p) em vez do original. */
    val light: Boolean = false,
    /** Motivos para escolher logo a seguir a pedir um clip. */
    val motives: List<String> = emptyList(),
  )

  private const val MOTIVES_PREFS = "clips_barra_motivos"

  /** Motivos escolhidos na barra (id do clip → motivo), para a app registar ao voltar. */
  fun takeMotives(context: Context): Map<String, String> {
    val prefs = context.getSharedPreferences(MOTIVES_PREFS, Context.MODE_PRIVATE)
    val all = prefs.all.mapNotNull { (k, v) -> (v as? String)?.let { k to it } }.toMap()
    prefs.edit().clear().apply()
    return all
  }

  private val main = Handler(Looper.getMainLooper())
  private var appContext: Context? = null
  private var config: Config? = null
  private var bar: OverlayBar? = null

  @Volatile var armed = false
    private set

  fun canDraw(context: Context): Boolean = Settings.canDrawOverlays(context)

  fun openPermissionSettings(context: Context) {
    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  /** Ativa a barra: aparece sempre que a app sair do ecrã. */
  fun arm(context: Context, cfg: Config) {
    appContext = context.applicationContext
    config = cfg
    armed = true
    Client.start(appContext!!, cfg)
  }

  /** Qualidade da cópia para o tablet escolhida na barra (null se a barra não está ativa). */
  fun currentLight(): Boolean? = if (armed) config?.light else null

  fun setLight(on: Boolean) {
    val ctx = appContext ?: return
    val cfg = config?.copy(light = on) ?: return
    config = cfg
    Client.start(ctx, cfg) // só atualiza a configuração (o ciclo já está a correr)
  }

  fun disarm() {
    armed = false
    main.post { hide() }
    Client.stop()
  }

  fun onAppBackground() {
    if (armed) main.post { show() }
  }

  fun onAppForeground() {
    main.post { hide() }
  }

  private fun show() {
    val ctx = appContext ?: return
    if (!armed || bar != null || !canDraw(ctx)) return
    bar = OverlayBar(ctx, Actions).also { it.attach() }
    Client.downloadsActive = true
  }

  private fun hide() {
    // Com a app à frente, é ela que copia os clips (com progresso no ecrã).
    Client.downloadsActive = false
    bar?.detach()
    bar = null
  }

  /** Ações da barra (chamadas na thread principal). */
  internal object Actions {
    private var markStartMs: Long? = null

    val markStart: Long? get() = markStartMs

    var lastRequestId: String? = null
      private set

    fun motives(): List<String> = config?.motives ?: emptyList()

    fun isLight(): Boolean = config?.light == true

    fun toggleLight() = setLight(!isLight())

    fun setMotive(context: Context, clipId: String, motive: String) {
      context.getSharedPreferences(MOTIVES_PREFS, Context.MODE_PRIVATE).edit().putString(clipId, motive).apply()
    }

    fun recordingNowMs(): Long? = Client.recordingNowMs()
    fun connectionOk(): Boolean = Client.connectionOk()
    fun pending(): Int = Client.pendingCount()

    fun preset(seconds: Int): Boolean {
      val now = Client.recordingNowMs() ?: return false
      lastRequestId = Client.request(now - seconds * 1000L, now)
      return true
    }

    /** Devolve true se marcou o início, false se fechou o clip (ou não está a gravar). */
    fun mark(): Boolean? {
      val now = Client.recordingNowMs() ?: return null
      val start = markStartMs
      return if (start == null) {
        markStartMs = now
        true
      } else {
        markStartMs = null
        lastRequestId = Client.request(minOf(start, now), maxOf(start, now))
        false
      }
    }

    fun cancelMark() {
      markStartMs = null
    }

    fun openApp(context: Context) {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      context.startActivity(intent)
    }
  }

  /** Ligação ao telemóvel: estado (1 s), sincronização do relógio e fila de pedidos. */
  private object Client {
    private const val MIN_CLIP_MS = 2_000L
    private const val LOST_AFTER_MS = 8_000L
    private const val SAMPLE_MAX_AGE_MS = 60_000.0

    private class Sample(val offsetMs: Double, val rttMs: Double, val atMs: Double)

    private val lock = Any()
    private var thread: Thread? = null
    private val wake = LinkedBlockingQueue<Unit>()
    @Volatile private var running = false
    @Volatile private var generation = 0

    private var cfg: Config? = null
    private var filesDir: File? = null
    @Volatile var downloadsActive = false
    private val failedDownloads = HashMap<String, Int>()
    private var baseUrl: String? = null
    private val samples = ArrayList<Sample>()
    private var recStartElapsedMs: Double? = null
    private var sessionId: String? = null
    private var recording = false
    private var notRecordingStreak = 0
    private var lastOkAt = 0L
    private val queue = ArrayList<JSONObject>()

    private fun nowMs(): Double = SystemClock.elapsedRealtimeNanos() / 1_000_000.0

    fun start(context: Context, c: Config) {
      synchronized(lock) { cfg = c; baseUrl = null; filesDir = context.filesDir }
      if (running) return
      running = true
      val gen = ++generation
      thread = Thread({ loop(gen) }, "clips-barra").apply { isDaemon = true; start() }
      Thread({ downloadLoop(gen) }, "clips-barra-copia").apply { isDaemon = true; start() }
    }

    fun stop() {
      running = false
      wake.offer(Unit)
      thread = null
    }

    fun connectionOk(): Boolean = SystemClock.elapsedRealtime() - lastOkAt < LOST_AFTER_MS

    fun pendingCount(): Int = synchronized(lock) { queue.size }

    fun recordingNowMs(): Long? = synchronized(lock) {
      val start = recStartElapsedMs ?: return null
      if (!recording) return null
      val best = samples.minByOrNull { it.rttMs } ?: return null
      maxOf(0.0, nowMs() + best.offsetMs - start).toLong()
    }

    fun request(startMs: Long, endMs: Long): String {
      val s = maxOf(0L, startMs)
      val e = maxOf(s + MIN_CLIP_MS, endMs)
      val req = JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("sessionId", synchronized(lock) { sessionId } ?: JSONObject.NULL)
        .put("startMs", s)
        .put("endMs", e)
        .put("name", JSONObject.NULL)
        .put("createdAtMs", System.currentTimeMillis())
      synchronized(lock) { queue.add(req) }
      wake.offer(Unit)
      return req.getString("id")
    }

    private fun loop(gen: Int) {
      while (running && gen == generation) {
        try {
          pollStatus()
          flush()
        } catch (_: Exception) {
        }
        wake.poll(1000, TimeUnit.MILLISECONDS)
      }
    }

    /**
     * Com a barra visível, copia para o tablet os clips já prontos no telemóvel,
     * para o mesmo sítio onde a app os guarda (a app só os regista ao voltar).
     */
    private fun downloadLoop(gen: Int) {
      while (running && gen == generation) {
        try {
          if (downloadsActive && synchronized(lock) { cfg?.autoDownload } == true) downloadOne()
        } catch (_: Exception) {
        }
        try {
          Thread.sleep(3000)
        } catch (_: InterruptedException) {
          return
        }
      }
    }

    private fun downloadOne() {
      val c = synchronized(lock) { cfg } ?: return
      val dir = synchronized(lock) { filesDir } ?: return
      val url = baseUrl ?: return
      val clips = http("GET", "$url/api/clips", c.token, null, 4000).optJSONArray("clips") ?: return
      for (i in 0 until clips.length()) {
        if (!downloadsActive || !running) return
        val clip = clips.getJSONObject(i)
        val id = clip.optString("id")
        if (id.isEmpty() || clip.optString("status") != "ready" || id in c.skipIds) continue
        if ((failedDownloads[id] ?: 0) >= 5) continue
        val session = clip.optString("sessionId").replace(Regex("[^A-Za-z0-9_-]"), "_")
        val dest = File(File(dir, "recebidos/$session"), "$id.mp4")
        val marker = File(dest.path + ".ok")
        if (dest.exists() && marker.exists()) continue
        val enc = java.net.URLEncoder.encode(id, "UTF-8")
        try {
          var size = clip.optLong("sizeBytes")
          var query = ""
          var kind = "original"
          if (c.light) {
            val light = http("GET", "$url/api/clips/$enc/light", c.token, null, 4000)
            when (light.optString("state")) {
              "preparing" -> continue // o telemóvel ainda a preparar: tenta na volta seguinte
              "ready" -> { query = "?q=leve"; kind = "leve"; size = light.optLong("sizeBytes") }
            }
          }
          download("$url/api/clips/$enc/file$query", c.token, dest, size)
          // Marca de cópia completa: a app regista o clip ao voltar.
          marker.writeText(kind)
        } catch (e: Exception) {
          failedDownloads[id] = (failedDownloads[id] ?: 0) + 1
        }
      }
    }

    private fun download(url: String, token: String, dest: File, expectedSize: Long) {
      dest.parentFile?.mkdirs()
      val part = File(dest.path + ".part")
      val conn = URL(url).openConnection() as HttpURLConnection
      try {
        conn.connectTimeout = 4000
        conn.readTimeout = 15_000
        conn.setRequestProperty("X-Token", token)
        if (conn.responseCode != 200) throw HttpError(conn.responseCode)
        conn.inputStream.use { input -> part.outputStream().use { input.copyTo(it, 64 * 1024) } }
        if (expectedSize > 0 && part.length() != expectedSize) throw IOException("Cópia incompleta")
        if (!part.renameTo(dest)) throw IOException("Não foi possível guardar")
      } catch (e: Exception) {
        part.delete()
        throw e
      } finally {
        conn.disconnect()
      }
    }

    private fun pollStatus() {
      val c = synchronized(lock) { cfg } ?: return
      val candidates = baseUrl?.let { listOf(it) } ?: c.urls
      for (url in candidates) {
        try {
          val t0 = nowMs()
          val status = http("GET", "$url/api/status", c.token, null, if (baseUrl == null) 1500 else 4000)
          val t1 = nowMs()
          onStatus(status, t0, t1)
          baseUrl = url
          return
        } catch (_: Exception) {
        }
      }
      baseUrl = null
    }

    private fun onStatus(status: JSONObject, t0: Double, t1: Double) = synchronized(lock) {
      val remote = status.getDouble("elapsedMs")
      samples.add(Sample(remote - (t0 + t1) / 2, t1 - t0, t1))
      samples.removeAll { t1 - it.atMs > SAMPLE_MAX_AGE_MS }
      while (samples.size > 30) samples.removeAt(0)
      lastOkAt = SystemClock.elapsedRealtime()

      val state = status.optString("state")
      val start = if (status.isNull("recStartElapsedMs")) null else status.optDouble("recStartElapsedMs")
      if (state == "recording" && start != null) {
        recStartElapsedMs = start
        sessionId = if (status.isNull("sessionId")) null else status.optString("sessionId")
        recording = true
        notRecordingStreak = 0
      } else {
        // Respostas isoladas não bloqueiam os botões (igual ao ecrã do comando).
        notRecordingStreak++
        if (state == "finalizing" || notRecordingStreak >= 3) recording = false
      }
    }

    private fun flush() {
      val c = synchronized(lock) { cfg } ?: return
      val url = baseUrl ?: return
      while (running) {
        val req = synchronized(lock) { queue.firstOrNull() } ?: return
        try {
          http("POST", "$url/api/clip", c.token, req.toString(), 4000)
          synchronized(lock) { queue.remove(req) }
        } catch (e: HttpError) {
          if (e.code == 400 || e.code == 409) {
            synchronized(lock) { queue.remove(req) } // recusado (ex.: gravação terminou)
          } else return
        } catch (_: Exception) {
          return // sem ligação: tenta mais tarde
        }
      }
    }

    private class HttpError(val code: Int) : IOException("HTTP $code")

    private fun http(method: String, url: String, token: String, body: String?, timeoutMs: Int): JSONObject {
      val conn = URL(url).openConnection() as HttpURLConnection
      try {
        conn.requestMethod = method
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("X-Token", token)
        conn.setRequestProperty("Content-Type", "application/json")
        if (body != null) {
          conn.doOutput = true
          conn.outputStream.use { it.write(body.toByteArray()) }
        }
        val code = conn.responseCode
        if (code !in 200..299) throw HttpError(code)
        return JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
      } finally {
        conn.disconnect()
      }
    }
  }
}
