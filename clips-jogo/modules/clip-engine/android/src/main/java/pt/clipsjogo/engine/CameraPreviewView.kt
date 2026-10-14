package pt.clipsjogo.engine

import android.content.Context
import android.graphics.Color
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
        ClipEngine.setPreviewSurface(holder.surface)
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) = Unit

      override fun surfaceDestroyed(holder: SurfaceHolder) {
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
    const val PREVIEW_WIDTH = 1920
    const val PREVIEW_HEIGHT = 1080
  }
}
