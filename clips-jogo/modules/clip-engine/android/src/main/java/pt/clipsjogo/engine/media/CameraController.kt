package pt.clipsjogo.engine.media

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.os.Handler
import android.util.Log
import android.util.Range
import android.view.Surface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Câmara traseira via Camera2. Envia os frames para a pré-visualização e,
 * durante a gravação, também para a Surface do encoder.
 *
 * Todas as operações correm na thread da câmara ([handler]).
 */
class CameraController(
  context: Context,
  private val handler: Handler,
  private val onError: (String) -> Unit
) {
  private val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  val cameraId: String
  val sensorOrientation: Int

  private val fpsRange: Range<Int>?

  private var device: CameraDevice? = null
  private var session: CameraCaptureSession? = null
  private var surfaces: List<Surface> = emptyList()
  private var opening = false

  init {
    val id = manager.cameraIdList.firstOrNull {
      manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
    } ?: manager.cameraIdList.firstOrNull() ?: throw IllegalStateException("Não foi encontrada nenhuma câmara.")
    cameraId = id
    val chars = manager.getCameraCharacteristics(id)
    sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
    val ranges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES) ?: emptyArray()
    fpsRange = ranges.firstOrNull { it.lower == 30 && it.upper == 30 }
      ?: ranges.filter { it.upper == 30 }.maxByOrNull { it.lower }
  }

  /** Define as Surfaces que recebem frames; reconfigura a sessão se mudarem. Bloqueia até aplicar. */
  fun setSurfaces(newSurfaces: List<Surface>) {
    runOnCameraThread {
      if (newSurfaces == surfaces && session != null) return@runOnCameraThread
      surfaces = newSurfaces
      if (surfaces.isEmpty()) {
        closeInternal()
      } else if (device == null) {
        openInternal()
      } else {
        createSession()
      }
    }
  }

  fun close() = runOnCameraThread {
    surfaces = emptyList()
    closeInternal()
  }

  private fun runOnCameraThread(block: () -> Unit) {
    if (handler.looper.isCurrentThread) {
      block()
      return
    }
    val latch = CountDownLatch(1)
    handler.post {
      try { block() } finally { latch.countDown() }
    }
    latch.await(3, TimeUnit.SECONDS)
  }

  @SuppressLint("MissingPermission")
  private fun openInternal() {
    if (opening) return
    opening = true
    try {
      manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
          opening = false
          device = camera
          if (surfaces.isEmpty()) closeInternal() else createSession()
        }

        override fun onDisconnected(camera: CameraDevice) {
          opening = false
          camera.close()
          if (device == camera) device = null
          session = null
          onError("A câmara foi desligada por outra app ou pelo sistema.")
        }

        override fun onError(camera: CameraDevice, error: Int) {
          opening = false
          camera.close()
          if (device == camera) device = null
          session = null
          onError("Erro na câmara (código $error).")
        }
      }, handler)
    } catch (e: Exception) {
      opening = false
      onError("Não foi possível abrir a câmara: ${e.message}")
    }
  }

  @Suppress("DEPRECATION")
  private fun createSession() {
    val cam = device ?: return
    val targets = surfaces.filter { it.isValid }
    try {
      session?.close()
    } catch (_: Exception) {}
    session = null
    if (targets.isEmpty()) return
    try {
      cam.createCaptureSession(targets, object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(s: CameraCaptureSession) {
          if (device != cam || surfaces.filter { it.isValid } != targets) {
            s.close()
            return
          }
          session = s
          try {
            val request = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
              targets.forEach { addTarget(it) }
              set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
              set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
              fpsRange?.let { set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, it) }
            }.build()
            s.setRepeatingRequest(request, null, handler)
          } catch (e: Exception) {
            Log.e(TAG, "setRepeatingRequest falhou", e)
            onError("Não foi possível iniciar a câmara: ${e.message}")
          }
        }

        override fun onConfigureFailed(s: CameraCaptureSession) {
          onError("A câmara não aceitou a configuração pedida.")
        }
      }, handler)
    } catch (e: Exception) {
      Log.e(TAG, "createCaptureSession falhou", e)
      onError("Não foi possível configurar a câmara: ${e.message}")
    }
  }

  private fun closeInternal() {
    try { session?.close() } catch (_: Exception) {}
    session = null
    try { device?.close() } catch (_: Exception) {}
    device = null
  }

  /** Rotação a gravar no MP4 para o vídeo ficar direito, dada a rotação do ecrã (0/90/180/270). */
  fun rotationFor(displayDegrees: Int): Int = (sensorOrientation - displayDegrees + 360) % 360

  companion object {
    private const val TAG = "ClipEngine/Camera"
  }
}
