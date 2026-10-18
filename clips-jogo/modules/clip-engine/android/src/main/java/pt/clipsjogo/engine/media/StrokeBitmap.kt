package pt.clipsjogo.engine.media

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import org.json.JSONArray
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

/**
 * Desenha os traços feitos no tablet (coordenadas 0..1) num bitmap transparente,
 * com as mesmas formas do ecrã (seta, círculo, traço livre).
 */
object StrokeBitmap {
  /** [crop] = zoom do vídeo (x, y, largura, altura em 0..1): os traços acompanham a parte mostrada. */
  fun render(strokes: JSONArray, width: Int, height: Int, crop: FloatArray? = null): Bitmap {
    val cx = crop?.get(0) ?: 0f
    val cy = crop?.get(1) ?: 0f
    val cw = crop?.get(2) ?: 1f
    val ch = crop?.get(3) ?: 1f
    val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val strokeWidth = max(3f, width * 0.006f)
    for (i in 0 until strokes.length()) {
      val s = strokes.getJSONObject(i)
      val color = try { Color.parseColor(s.optString("color", "#FFD60A")) } catch (_: Exception) { Color.YELLOW }
      val pts = s.getJSONArray("points").let { arr ->
        (0 until arr.length()).map { j ->
          val p = arr.getJSONArray(j)
          floatArrayOf((p.getDouble(0).toFloat() - cx) / cw * width, (p.getDouble(1).toFloat() - cy) / ch * height)
        }
      }
      if (pts.isEmpty()) continue
      val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        this.strokeWidth = strokeWidth
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }
      val a = pts.first()
      val b = pts.last()
      when (s.optString("tool")) {
        "circle" -> canvas.drawOval(
          RectF(minOf(a[0], b[0]), minOf(a[1], b[1]), maxOf(a[0], b[0]), maxOf(a[1], b[1])), line
        )
        "free" -> {
          val path = Path().apply {
            moveTo(a[0], a[1])
            pts.drop(1).forEach { lineTo(it[0], it[1]) }
          }
          canvas.drawPath(path, line)
        }
        else -> {
          // Seta: linha + ponta triangular.
          val angle = atan2((b[1] - a[1]).toDouble(), (b[0] - a[0]).toDouble())
          val head = max(12f, width * 0.03f)
          fun at(d: Float, da: Double) =
            floatArrayOf(b[0] - d * cos(angle + da).toFloat(), b[1] - d * sin(angle + da).toFloat())
          val base = at(head * 0.8f, 0.0)
          canvas.drawLine(a[0], a[1], base[0], base[1], line)
          val l = at(head, -0.45)
          val r = at(head, 0.45)
          val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL }
          canvas.drawPath(Path().apply { moveTo(b[0], b[1]); lineTo(l[0], l[1]); lineTo(r[0], r[1]); close() }, fill)
        }
      }
    }
    return bmp
  }
}
