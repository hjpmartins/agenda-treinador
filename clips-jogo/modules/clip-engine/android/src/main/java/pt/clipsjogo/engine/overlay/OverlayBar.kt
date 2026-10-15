package pt.clipsjogo.engine.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * A vista da barra flutuante: [● 12:34] [10s][20s][30s][60s] [Início] [↗]
 * Arrasta-se pelo cronómetro; um toque no cronómetro encolhe/expande.
 */
@SuppressLint("ClickableViewAccessibility", "SetTextI18n")
internal class OverlayBar(private val context: Context, private val actions: FloatingRemote.Actions) {
  private companion object {
    const val ACCENT = 0xFFFF7A1A.toInt()
    const val SURFACE = 0xF2151820.toInt()
    const val SURFACE_HIGH = 0xFF2A2F38.toInt()
    const val BORDER = 0xFF3A404A.toInt()
    const val TEXT = 0xFFF2F4F7.toInt()
    const val MUTED = 0xFF8A93A0.toInt()
    const val WARN = 0xFFFFB020.toInt()
    const val OK = 0xFF2ECC71.toInt()
    const val REC = 0xFFFF3B30.toInt()
    val PRESETS = intArrayOf(10, 20, 30, 60)
  }

  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val prefs = context.getSharedPreferences("clips_barra", Context.MODE_PRIVATE)
  private val ui = Handler(Looper.getMainLooper())

  private val root = LinearLayout(context)
  private val row = LinearLayout(context)
  private val motiveScroll = HorizontalScrollView(context)
  private val motiveRow = LinearLayout(context)
  private var motiveClipId: String? = null
  private val hideMotives = Runnable { showMotives(null) }
  private val timer = TextView(context)
  private val group = LinearLayout(context)
  private val presetViews = ArrayList<TextView>()
  private val markView = TextView(context)
  private var collapsed = prefs.getBoolean("collapsed", false)
  private var flashText: String? = null
  private var flashColor = OK
  private var flashUntil = 0L

  private val params = WindowManager.LayoutParams(
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    PixelFormat.TRANSLUCENT
  ).apply {
    gravity = Gravity.TOP or Gravity.START
    x = prefs.getInt("x", dp(24))
    y = prefs.getInt("y", dp(24))
  }

  private val tick = object : Runnable {
    override fun run() {
      refresh()
      ui.postDelayed(this, 250)
    }
  }

  private fun dp(v: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), context.resources.displayMetrics).toInt()

  private fun rounded(color: Int, radiusDp: Int, stroke: Int? = null) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = dp(radiusDp).toFloat()
    if (stroke != null) setStroke(dp(1), stroke)
  }

  private fun button(label: String, bg: Int, widthDp: Int, onClick: (View) -> Unit) = TextView(context).apply {
    text = label
    setTextColor(TEXT)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
    typeface = Typeface.DEFAULT_BOLD
    gravity = Gravity.CENTER
    background = rounded(bg, 12)
    isClickable = true
    setOnClickListener(onClick)
    layoutParams = LinearLayout.LayoutParams(dp(widthDp), dp(46)).apply { marginStart = dp(5) }
  }

  init {
    root.orientation = LinearLayout.VERTICAL
    root.background = rounded(SURFACE, 16, BORDER)
    root.setPadding(dp(6), dp(6), dp(6), dp(6))
    row.orientation = LinearLayout.HORIZONTAL
    row.gravity = Gravity.CENTER_VERTICAL
    root.addView(row)

    timer.setTextColor(TEXT)
    timer.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
    timer.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    timer.gravity = Gravity.CENTER
    timer.minWidth = dp(92)
    timer.setPadding(dp(8), 0, dp(8), 0)
    timer.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(46))
    timer.setOnTouchListener(DragListener())
    row.addView(timer)

    group.orientation = LinearLayout.HORIZONTAL
    group.gravity = Gravity.CENTER_VERTICAL
    for (s in PRESETS) {
      val b = button("${s}s", ACCENT, 56) { v ->
        if (actions.preset(s)) {
          v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
          flash("✓ ${s}s", OK)
          showMotives(actions.lastRequestId)
        } else {
          flash("Sem gravação", WARN)
        }
      }
      presetViews.add(b)
      group.addView(b)
    }

    markView.apply {
      setTextColor(TEXT)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      isClickable = true
      layoutParams = LinearLayout.LayoutParams(dp(66), dp(46)).apply { marginStart = dp(5) }
      setOnClickListener { v ->
        when (actions.mark()) {
          true -> { v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); flash("Início ✓", OK) }
          false -> {
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            flash("✓ clip", OK)
            showMotives(actions.lastRequestId)
          }
          null -> flash("Sem gravação", WARN)
        }
        refresh()
      }
      setOnLongClickListener {
        actions.cancelMark()
        flash("Marca cancelada", MUTED)
        refresh()
        true
      }
    }
    group.addView(markView)

    group.addView(button("↗", SURFACE_HIGH, 42) { actions.openApp(context) })
    row.addView(group)

    // Motivos: aparecem uns segundos depois de pedir um clip (tocar é opcional).
    motiveRow.orientation = LinearLayout.HORIZONTAL
    motiveScroll.isHorizontalScrollBarEnabled = false
    motiveScroll.addView(motiveRow)
    // Mesma largura que a barra (desliza para ver mais motivos).
    motiveScroll.layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(6) }
    motiveScroll.visibility = View.GONE
    root.addView(motiveScroll)
  }

  fun attach() {
    applyCollapsed()
    refresh()
    wm.addView(root, params)
    ui.post(tick)
  }

  /** Mostra os motivos para o clip acabado de pedir (null esconde). */
  private fun showMotives(clipId: String?) {
    ui.removeCallbacks(hideMotives)
    val motives = actions.motives()
    motiveClipId = clipId
    if (clipId == null || motives.isEmpty() || collapsed) {
      motiveScroll.visibility = View.GONE
      return
    }
    motiveRow.removeAllViews()
    for (m in motives) {
      motiveRow.addView(TextView(context).apply {
        text = m
        setTextColor(TEXT)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        setPadding(dp(12), 0, dp(12), 0)
        background = rounded(SURFACE_HIGH, 18, BORDER)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(38)).apply { marginEnd = dp(5) }
        isClickable = true
        setOnClickListener { v ->
          val id = motiveClipId ?: return@setOnClickListener
          actions.setMotive(context, id, m)
          v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
          flash("✓ $m", OK)
          showMotives(null)
        }
      })
    }
    motiveScroll.visibility = View.VISIBLE
    ui.postDelayed(hideMotives, 6000)
  }

  fun detach() {
    ui.removeCallbacks(hideMotives)
    ui.removeCallbacks(tick)
    try {
      wm.removeView(root)
    } catch (_: Exception) {
    }
  }

  private fun flash(text: String, color: Int) {
    flashText = text
    flashColor = color
    flashUntil = System.currentTimeMillis() + 1300
    refresh()
  }

  private fun applyCollapsed() {
    group.visibility = if (collapsed) View.GONE else View.VISIBLE
    if (collapsed) motiveScroll.visibility = View.GONE
  }

  private fun refresh() {
    val now = actions.recordingNowMs()
    val ok = actions.connectionOk()
    val canClip = now != null

    if (flashText != null && System.currentTimeMillis() < flashUntil) {
      timer.text = flashText
      timer.setTextColor(flashColor)
    } else {
      flashText = null
      val pending = actions.pending()
      val clock = if (now != null) "● " + format(now) else "--:--"
      timer.text = if (pending > 0) "$clock ·$pending" else clock
      timer.setTextColor(
        when {
          !ok -> WARN
          now == null -> MUTED
          else -> TEXT
        }
      )
      if (now != null && ok) {
        // ponto vermelho: só o "●" fica a vermelho
        val sp = android.text.SpannableString(timer.text)
        sp.setSpan(android.text.style.ForegroundColorSpan(REC), 0, 1, 0)
        timer.text = sp
      }
    }

    for (b in presetViews) b.alpha = if (canClip) 1f else 0.35f
    val marking = actions.markStart != null
    markView.text = if (marking) "Fim" else "Início"
    markView.background = if (marking) rounded(ACCENT, 12, TEXT) else rounded(SURFACE_HIGH, 12)
    markView.alpha = if (canClip) 1f else 0.35f
  }

  private fun format(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total / 60) % 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
  }

  /** Arrastar pelo cronómetro; toque simples encolhe/expande a barra. */
  private inner class DragListener : View.OnTouchListener {
    private val slop = ViewConfiguration.get(context).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var startX = 0
    private var startY = 0
    private var dragging = false

    override fun onTouch(v: View, e: MotionEvent): Boolean {
      when (e.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = e.rawX; downY = e.rawY
          startX = params.x; startY = params.y
          dragging = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = e.rawX - downX
          val dy = e.rawY - downY
          if (!dragging && (abs(dx) > slop || abs(dy) > slop)) dragging = true
          if (dragging) {
            params.x = (startX + dx).toInt().coerceAtLeast(0)
            params.y = (startY + dy).toInt().coerceAtLeast(0)
            try { wm.updateViewLayout(root, params) } catch (_: Exception) {}
          }
        }
        MotionEvent.ACTION_UP -> {
          if (dragging) {
            prefs.edit().putInt("x", params.x).putInt("y", params.y).apply()
          } else {
            collapsed = !collapsed
            prefs.edit().putBoolean("collapsed", collapsed).apply()
            applyCollapsed()
          }
        }
      }
      return true
    }
  }
}
