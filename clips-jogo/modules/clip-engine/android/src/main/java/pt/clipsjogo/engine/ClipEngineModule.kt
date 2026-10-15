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

    Events("onStateChange", "onClipUpdate", "onFinalizeProgress", "onError", "onUpdateProgress")

    OnCreate {
      ClipEngine.init(appContext.reactContext!!)
      Link.init(appContext.reactContext!!)
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

    Function("getRecordingTimeMs") { ClipEngine.nowRecUs() / 1000.0 }

    AsyncFunction("setQuality") { quality: String ->
      ClipEngine.setQuality(quality)
    }

    AsyncFunction("startRecording") { quality: String ->
      ClipEngine.startRecording(quality, displayRotationDegrees())
    }

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

    View(CameraPreviewView::class) {}
  }
}
