package pt.clipsjogo.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Handler
import android.os.HandlerThread
import android.view.PixelCopy
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Pré-visualização da câmara. A gravação não depende desta vista: se ela
 * desaparecer (ex.: mudar de ecrã), a câmara continua a enviar frames ao encoder.
 */
class CameraPreviewView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val surfaceView = SurfaceView(context)

  init {
    setBackgroundColor(Color.BLACK)
    surfaceView.holder.setFixedSize(PREVIEW_WIDTH, PREVIEW_HEIGHT)
    surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) {
        current = java.lang.ref.WeakReference(surfaceView)
        ClipEngine.setPreviewSurface(holder.surface)
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) = Unit

      override fun surfaceDestroyed(holder: SurfaceHolder) {
        if (current?.get() === surfaceView) current = null
        // Bloqueia até a câmara deixar de usar esta Surface.
        ClipEngine.setPreviewSurface(null)
      }
    })
    addView(surfaceView)
  }

  /** Mantém a proporção 16:9 (ou 9:16 na vertical), centrada. */
  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val w = r - l
    val h = b - t
    val aspect = if (w >= h) 16f / 9f else 9f / 16f
    var pw = w
    var ph = (w / aspect).toInt()
    if (ph > h) {
      ph = h
      pw = (h * aspect).toInt()
    }
    val left = (w - pw) / 2
    val top = (h - ph) / 2
    surfaceView.measure(MeasureSpec.makeMeasureSpec(pw, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(ph, MeasureSpec.EXACTLY))
    surfaceView.layout(left, top, left + pw, top + ph)
  }

  companion object {
    @Volatile private var current: java.lang.ref.WeakReference<SurfaceView>? = null
    private val snapThread = HandlerThread("ClipEngine-imagem").apply { start() }

    /**
     * Imagem atual da pré-visualização em JPEG pequeno (para o tablet confirmar o
     * enquadramento). Copia o que já está no ecrã: não mexe na câmara nem na gravação.
     * null se o ecrã Gravar não está à vista.
     */
    fun snapshotJpeg(width: Int = 640, height: Int = 360): ByteArray? {
      val view = current?.get() ?: return null
      if (!view.holder.surface.isValid) return null
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val done = java.util.concurrent.CountDownLatch(1)
      var ok = false
      try {
        PixelCopy.request(view, bitmap, { result ->
          ok = result == PixelCopy.SUCCESS
          done.countDown()
        }, Handler(snapThread.looper))
      } catch (_: Exception) {
        bitmap.recycle()
        return null
      }
      // Sem resposta a tempo: não reciclar (a cópia ainda pode escrever no bitmap).
      if (!done.await(2, java.util.concurrent.TimeUnit.SECONDS)) return null
      if (!ok) {
        bitmap.recycle()
        return null
      }
      val out = java.io.ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
      bitmap.recycle()
      return out.toByteArray()
    }

    // A pré-visualização não precisa de 1080p (a gravação é independente): menos trabalho, menos calor.
    const val PREVIEW_WIDTH = 1280
    const val PREVIEW_HEIGHT = 720
  }
}
