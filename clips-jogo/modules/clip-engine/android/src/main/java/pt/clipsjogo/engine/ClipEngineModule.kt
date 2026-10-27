package pt.clipsjogo.engine

import android.Manifest
import android.net.Uri
import android.os.Build
import android.view.Surface
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import pt.clipsjogo.engine.link.Link
import pt.clipsjogo.engine.overlay.FloatingRemote
import java.io.File

class ClipEngineModule : Module() {
  private fun clipToMap(sessionId: String, clip: ClipInfo): Map<String, Any?> {
    val dir = ClipEngine.findSession(sessionId)?.clipsDir
    return mapOf(
      "id" to clip.id,
      "sessionId" to sessionId,
      "name" to clip.name,
      "status" to clip.status,
      "requestedStartMs" to clip.requestedStartUs / 1000.0,
      "requestedEndMs" to clip.requestedEndUs / 1000.0,
      "startMs" to clip.startUs / 1000.0,
      "endMs" to clip.endUs / 1000.0,
      "createdAtMs" to clip.createdAtMs,
      "uri" to clip.fileName?.let { f -> dir?.let { Uri.fromFile(File(it, f)).toString() } },
      "sizeBytes" to clip.sizeBytes,
      "error" to clip.error
    )
  }

  private fun sessionToMap(s: SessionInfo): Map<String, Any?> = mapOf(
    "id" to s.id,
    "startedAtMs" to s.startedAtMs,
    "status" to s.status,
    "quality" to s.quality,
    "durationMs" to s.durationUs / 1000.0,
    "fullVideoUris" to s.fullVideoParts.map { Uri.fromFile(File(s.dir, it)).toString() },
    "clips" to s.clips.map { clipToMap(s.id, it) }
  )

  private fun displayRotationDegrees(): Int {
    @Suppress("DEPRECATION")
    val rotation = appContext.currentActivity?.windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_90
    return when (rotation) {
      Surface.ROTATION_0 -> 0
      Surface.ROTATION_90 -> 90
      Surface.ROTATION_180 -> 180
      else -> 270
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ClipEngine")

    Events("onStateChange", "onClipUpdate", "onFinalizeProgress", "onError", "onUpdateProgress", "onExportProgress")

    OnCreate {
      ClipEngine.init(appContext.reactContext!!)
      Link.init(appContext.reactContext!!)
      Link.displayRotation = { displayRotationDegrees() }
      ClipEngine.listener = object : ClipEngine.Listener {
        override fun onStateChanged(state: String) = sendEvent("onStateChange", mapOf("state" to state))
        override fun onClipUpdated(sessionId: String, clip: ClipInfo) =
          sendEvent("onClipUpdate", clipToMap(sessionId, clip))
        override fun onFinalizeProgress(sessionId: String, progress: Float) =
          sendEvent("onFinalizeProgress", mapOf("sessionId" to sessionId, "progress" to progress.toDouble()))
        override fun onError(message: String) = sendEvent("onError", mapOf("message" to message))
      }
    }

    OnDestroy {
      ClipEngine.listener = null
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      // Notificações (Android 13+): para a notificação "A gravar o jogo". Se recusar, grava na mesma.
      val perms = mutableListOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
      if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, object : expo.modules.kotlin.Promise {
        override fun resolve(value: Any?) {
          // Só câmara e microfone decidem se se pode gravar.
          Permissions.getPermissionsWithPermissionsManager(
            appContext.permissions, promise,
            Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO
          )
        }
        override fun reject(code: String?, message: String?, cause: Throwable?) = promise.reject(code, message, cause)
      }, *perms.toTypedArray())
    }

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(
        appContext.permissions, promise,
        Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO
      )
    }

    Function("getStatus") { ClipEngine.status() }

    Function("getLastCrash") { CrashLog.read() }

    Function("clearLastCrash") { CrashLog.clear() }

    AsyncFunction("setStandby") { on: Boolean -> ClipEngine.setStandby(on) }

    /** Ecrã de repouso: brilho no mínimo (menos calor e bateria). */
    Function("setScreenDim") { on: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        val lp = activity.window.attributes
        lp.screenBrightness = if (on) 0.01f else android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        activity.window.attributes = lp
      }
    }

    Function("getRecordingTimeMs") { ClipEngine.nowRecUs() / 1000.0 }

    AsyncFunction("setQuality") { quality: String ->
      ClipEngine.setQuality(quality)
    }

    AsyncFunction("startRecording") { quality: String ->
      ClipEngine.startRecording(quality, displayRotationDegrees())
    }

    AsyncFunction("pauseRecording") { ClipEngine.pauseRecording() }

    AsyncFunction("resumeRecording") { ClipEngine.resumeRecording() }

    AsyncFunction("stopRecording") {
      ClipEngine.stopRecording()
    }

    AsyncFunction("requestClip") { id: String?, startMs: Double, endMs: Double, name: String? ->
      val clip = ClipEngine.requestClip(id, (startMs * 1000).toLong(), (endMs * 1000).toLong(), name)
      clipToMap(ClipEngine.currentSession()!!.id, clip)
    }

    AsyncFunction("renameClip") { sessionId: String, clipId: String, name: String ->
      ClipEngine.renameClip(sessionId, clipId, name)
    }

    AsyncFunction("deleteClip") { sessionId: String, clipId: String ->
      ClipEngine.deleteClip(sessionId, clipId)
    }

    AsyncFunction("listSessions") {
      ClipEngine.listSessions().map { sessionToMap(it) }
    }

    AsyncFunction("deleteSession") { sessionId: String ->
      ClipEngine.deleteSession(sessionId)
    }

    AsyncFunction("recoverSession") { sessionId: String ->
      ClipEngine.recoverSession(sessionId)
    }

    // ---------------------------------------------------------- ligação ao tablet

    AsyncFunction("requestLinkPermissionsAsync") { promise: Promise ->
      val perm = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES
      else Manifest.permission.ACCESS_FINE_LOCATION
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, perm)
    }

    AsyncFunction("startLink") { promise: Promise ->
      Link.start { result ->
        result.fold(
          onSuccess = { li ->
            promise.resolve(mapOf(
              "ssid" to li.ssid,
              "passphrase" to li.passphrase,
              "security" to li.security,
              "ips" to li.ips,
              "port" to li.port,
              "token" to li.token,
              "hotspotError" to li.hotspotError
            ))
          },
          onFailure = { e -> promise.reject("E_LINK", e.message ?: "Não foi possível criar a ligação.", e) }
        )
      }
    }

    AsyncFunction("stopLink") { Link.stop() }

    AsyncFunction("joinNetwork") { ssid: String, passphrase: String, security: String, promise: Promise ->
      Link.join(ssid, passphrase, security) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { e -> promise.reject("E_JOIN", e.message ?: "Não foi possível ligar à rede.", e) }
        )
      }
    }

    AsyncFunction("leaveNetwork") { Link.leave() }

    AsyncFunction("keepWifiAwake") { Link.keepWifiAwake() }

    Function("getWifiSignal") { pt.clipsjogo.engine.link.WifiSignal.read(appContext.reactContext!!) }

    // ---------------------------------------------------------- atualizações

    Function("getDownloadedUpdate") { version: String ->
      Updater.downloaded(appContext.reactContext!!, version)
    }

    AsyncFunction("downloadUpdate") { url: String, version: String, promise: Promise ->
      val context = appContext.reactContext!!
      Thread({
        try {
          val path = Updater.download(context, url, version) { done, total ->
            sendEvent("onUpdateProgress", mapOf("bytes" to done.toDouble(), "total" to total.toDouble()))
          }
          promise.resolve(path)
        } catch (e: Exception) {
          promise.reject("E_UPDATE", "Não foi possível descarregar a atualização: ${e.message ?: e.javaClass.simpleName}", e)
        }
      }, "clips-update").start()
    }

    Function("canInstallUpdates") { Updater.canInstall(appContext.reactContext!!) }

    Function("openInstallPermissionSettings") {
      Updater.openInstallPermissionSettings(appContext.reactContext!!)
    }

    AsyncFunction("installUpdate") { path: String ->
      Updater.install(appContext.reactContext!!, path)
    }

    Function("clearUpdates") { Updater.clear(appContext.reactContext!!) }

    // ---------------------------------------------------------- exportar com desenhos (tablet)

    /**
     * Cria um vídeo para enviar (ex.: WhatsApp): só a parte cortada, em 720p, e em cada
     * desenho a imagem fica parada [freezeMs] com o desenho por cima.
     * momentsJson: [{ atMs, strokes: [{ tool, color, points: [[x,y],…] }] }] (tempos do ficheiro).
     */
    AsyncFunction("exportAnnotated") { srcUri: String, startMs: Double, endMs: Double, momentsJson: String, freezeMs: Double, maxHeight: Double, cropJson: String, promise: Promise ->
      val context = appContext.reactContext!!
      Thread({
        try {
          val src = java.io.File(Uri.parse(srcUri).path ?: srcUri)
          val dir = java.io.File(context.cacheDir, "exportados").apply { mkdirs() }
          dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 24 * 3600_000L }?.forEach { it.delete() }
          // 720 = leve (WhatsApp); 1080 = qualidade máxima (YouTube), nunca acima do original.
          val maxH = if (maxHeight >= 1080) 1080 else 720
          val dst = java.io.File(dir, src.nameWithoutExtension + "-desenhos-$maxH.mp4")
          // Tamanho de saída (para desenhar os traços à mesma escala).
          val probe = android.media.MediaMetadataRetriever().apply { setDataSource(src.path) }
          val w = probe.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 1920
          val h = probe.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 1080
          probe.release()
          val scale = minOf(1.0, maxH.toDouble() / minOf(w, h))
          val outW = ((w * scale).toInt() / 2) * 2
          val outH = ((h * scale).toInt() / 2) * 2
          // Zoom: [x, y, largura, altura] em 0..1 (vazio = imagem inteira).
          val crop = cropJson.takeIf { it.isNotBlank() }?.let { j ->
            val a = org.json.JSONArray(j)
            floatArrayOf(a.getDouble(0).toFloat(), a.getDouble(1).toFloat(), a.getDouble(2).toFloat(), a.getDouble(3).toFloat())
          }?.takeIf { it[2] in 0.05f..0.999f && it[3] in 0.05f..0.999f }
          val moments = org.json.JSONArray(momentsJson)
          val freezes = (0 until moments.length()).map { i ->
            val m = moments.getJSONObject(i)
            pt.clipsjogo.engine.media.LightTranscoder.Freeze(
              (m.getDouble("atMs") * 1000).toLong(),
              pt.clipsjogo.engine.media.StrokeBitmap.render(m.getJSONArray("strokes"), outW, outH, crop)
            )
          }
          var last = -1
          pt.clipsjogo.engine.media.LightTranscoder.export(
            src, dst,
            pt.clipsjogo.engine.media.LightTranscoder.Options(
              maxHeight = maxH,
              bitrate = if (maxH >= 1080) 9_000_000 else 3_000_000,
              startUs = (startMs * 1000).toLong(),
              endUs = if (endMs > 0) (endMs * 1000).toLong() else Long.MAX_VALUE,
              freezes = freezes,
              freezeUs = (freezeMs * 1000).toLong(),
              crop = crop,
              // Sem som: as paragens nos desenhos ficam sempre com a duração certa.
              audio = false,
              onProgress = { p ->
                val pct = (p * 100).toInt()
                if (pct != last) {
                  last = pct
                  sendEvent("onExportProgress", mapOf("progress" to p.toDouble()))
                }
              }
            )
          )
          freezes.forEach { it.overlay?.recycle() }
          promise.resolve(Uri.fromFile(dst).toString())
        } catch (e: Throwable) {
          promise.reject("E_EXPORT", "Não foi possível criar o vídeo: ${e.message ?: e.javaClass.simpleName}", e)
        }
      }, "exportar-desenhos").start()
    }

    /** Partilhar vários vídeos de uma vez (ex.: todos os clips de uma jogadora pelo WhatsApp). */
    AsyncFunction("shareFiles") { uris: List<String>, names: List<String>, text: String, title: String, mimeType: String ->
      val context = appContext.reactContext!!
      val authority = "${context.packageName}.clipengine.updates"
      // Com título: vai uma cópia com o título no nome do ficheiro (ex.: "Ressalto #7.mp4").
      val named = java.io.File(context.cacheDir, "exportados/titulos").apply { mkdirs() }
      named.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 24 * 3600_000L }?.forEach { it.delete() }
      val used = HashSet<String>()
      val files = uris.mapIndexed { i, u ->
        val src = java.io.File(Uri.parse(u).path ?: u)
        val base = names.getOrNull(i)?.let(::safeFileName)?.takeIf { it.isNotEmpty() } ?: return@mapIndexed src
        var name = base
        var n = 2
        while (!used.add(name.lowercase())) name = "$base (${n++})"
        java.io.File(named, "$name.mp4").also { dst ->
          if (dst.length() != src.length()) src.copyTo(dst, overwrite = true)
          dst.setLastModified(System.currentTimeMillis())
        }
      }
      val contentUris = ArrayList(files.map { androidx.core.content.FileProvider.getUriForFile(context, authority, it) })
      if (contentUris.isEmpty()) return@AsyncFunction
      val send = android.content.Intent(
        if (contentUris.size == 1) android.content.Intent.ACTION_SEND else android.content.Intent.ACTION_SEND_MULTIPLE
      ).apply {
        type = mimeType.ifBlank { "video/mp4" }
        if (contentUris.size == 1) putExtra(android.content.Intent.EXTRA_STREAM, contentUris[0])
        else putParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, contentUris)
        if (text.isNotBlank()) {
          putExtra(android.content.Intent.EXTRA_TEXT, text)
          putExtra(android.content.Intent.EXTRA_TITLE, text.lineSequence().first())
        }
        clipData = android.content.ClipData.newUri(context.contentResolver, title, contentUris[0]).also { cd ->
          contentUris.drop(1).forEach { cd.addItem(android.content.ClipData.Item(it)) }
        }
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = android.content.Intent.createChooser(send, title).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
      (appContext.currentActivity ?: context).startActivity(chooser)
    }

    // ---------------------------------------------------------- barra flutuante (tablet)

    OnActivityEntersBackground { FloatingRemote.onAppBackground() }
    OnActivityEntersForeground { FloatingRemote.onAppForeground() }

    Function("canDrawOverlays") { FloatingRemote.canDraw(appContext.reactContext!!) }

    Function("openOverlayPermissionSettings") {
      FloatingRemote.openPermissionSettings(appContext.reactContext!!)
    }

    Function("armFloatingBar") { urls: List<String>, token: String, skipIds: List<String>, autoDownload: Boolean, light: Boolean, motives: List<String>, playerNums: List<String>, playerLabels: List<String> ->
      FloatingRemote.arm(
        appContext.reactContext!!,
        FloatingRemote.Config(urls, token, skipIds.toSet(), autoDownload, light, motives, playerNums.zip(playerLabels))
      )
    }

    /** Jogadoras escolhidas na barra flutuante desde a última chamada (id do clip → números). */
    Function("takeBarPlayers") { FloatingRemote.takePlayers(appContext.reactContext!!) }

    /** Motivos escolhidos na barra flutuante desde a última vez (id do clip → motivo). */
    Function("takeBarMotives") { FloatingRemote.takeMotives(appContext.reactContext!!) }

    /** Tipo (+/−) escolhido na barra flutuante desde a última vez (id do clip → "pos" | "neg" | ""). */
    Function("takeBarTones") { FloatingRemote.takeTones(appContext.reactContext!!) }

    Function("disarmFloatingBar") { FloatingRemote.disarm() }

    /** Qualidade escolhida na barra (true = leve), ou null se a barra não está ativa. */
    Function("getBarLight") { FloatingRemote.currentLight() }

    /** Põe a app em segundo plano (volta à app anterior, ex.: estatísticas). */
    Function("moveToBackground") {
      appContext.currentActivity?.moveTaskToBack(true) ?: false
    }

    View(CameraPreviewView::class) {}
  }

  /** Título → nome de ficheiro válido (sem / : * ? " < > | e no máximo 60 letras). */
  private fun safeFileName(title: String): String =
    title.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), " ").replace(Regex("\\s+"), " ").trim().take(60).trim()
}
