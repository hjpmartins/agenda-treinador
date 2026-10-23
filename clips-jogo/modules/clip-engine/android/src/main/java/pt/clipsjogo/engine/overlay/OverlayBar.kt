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
import android.widget.GridLayout
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
    const val PLAYER_BLUE = 0xFF2D7FF9.toInt()
    const val TONE_POS = 0xFF1E6FE0.toInt()
    const val TONE_NEG = 0xFFE0352B.toInt()
    val PRESETS = intArrayOf(15, 25, 45, 60)
  }

  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val prefs = context.getSharedPreferences("clips_barra", Context.MODE_PRIVATE)
  private val ui = Handler(Looper.getMainLooper())

  private val root = LinearLayout(context)
  private val row = LinearLayout(context)
  // Painel por baixo da barra: tipo (+/−), motivos e jogadoras, tudo à vista.
  private val tagPanel = LinearLayout(context)
  private val toneColumn = LinearLayout(context)
  private val toneGrid = GridLayout(context)
  private val motiveColumn = LinearLayout(context)
  private val playerColumn = LinearLayout(context)
  private val motiveGrid = GridLayout(context)
  private val playerGrid = GridLayout(context)
  private var motiveClipId: String? = null
  private val hideMotives = Runnable { showMotives(null) }
  private val timer = TextView(context)
  private val group = LinearLayout(context)
  private val presetViews = ArrayList<TextView>()
  private val markView = TextView(context)
  private val qualityView = TextView(context)
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

    // Qualidade da cópia para o tablet: HD (original) ou Leve (720p, chega mais depressa).
    group.addView(qualityView.apply {
      setTextColor(TEXT)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      background = rounded(SURFACE_HIGH, 12)
      isClickable = true
      layoutParams = LinearLayout.LayoutParams(dp(56), dp(46)).apply { marginStart = dp(5) }
      setOnClickListener { v ->
        actions.toggleLight()
        v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        flash(if (actions.isLight()) "Cópia leve" else "Cópia HD", OK)
        refresh()
      }
    })
    group.addView(button("↗", SURFACE_HIGH, 42) { actions.openApp(context) })
    row.addView(group)

    // Motivos e jogadoras: aparecem depois de pedir um clip (tocar é opcional).
    fun column(col: LinearLayout, title: String, grid: GridLayout, columns: Int) {
      col.orientation = LinearLayout.VERTICAL
      col.addView(TextView(context).apply {
        text = title
        setTextColor(MUTED)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        typeface = Typeface.DEFAULT_BOLD
        setPadding(dp(2), 0, 0, dp(4))
      })
      grid.columnCount = columns
      col.addView(grid)
    }
    column(toneColumn, "TIPO", toneGrid, 1)
    column(motiveColumn, "MOTIVO", motiveGrid, 2)
    column(playerColumn, "JOGADORAS", playerGrid, 3)
    tagPanel.orientation = LinearLayout.HORIZONTAL
    tagPanel.addView(toneColumn)
    tagPanel.addView(View(context).apply { layoutParams = LinearLayout.LayoutParams(dp(14), 1) })
    tagPanel.addView(motiveColumn)
    tagPanel.addView(View(context).apply { layoutParams = LinearLayout.LayoutParams(dp(14), 1) })
    tagPanel.addView(playerColumn)
    // Fechar (✓) por baixo do tipo, à esquerda: fica sempre à vista, mesmo com a barra encostada à direita.
    toneColumn.addView(button("✓ OK", OK, 100) { showMotives(null) }.apply {
      (layoutParams as LinearLayout.LayoutParams).apply {
        marginStart = 0
        topMargin = dp(6)
      }
    })
    tagPanel.layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) }
    tagPanel.visibility = View.GONE
    root.addView(tagPanel)
  }

  fun attach() {
    applyCollapsed()
    refresh()
    wm.addView(root, params)
    ui.post(tick)
  }

  /**
   * Depois de pedir um clip: tipo (+/−), motivos (laranja, um) e jogadoras (azul, várias) para
   * tocar. Tudo opcional; a fila esconde-se uns segundos depois do último toque.
   */
  private var chosenMotive: String? = null
  private var chosenTone: String? = null
  private val chosenPlayers = LinkedHashSet<String>()

  private fun showMotives(clipId: String?) {
    ui.removeCallbacks(hideMotives)
    motiveClipId = clipId
    chosenMotive = null
    chosenTone = null
    chosenPlayers.clear()
    if (clipId == null || collapsed) {
      tagPanel.visibility = View.GONE
      restoreX()
      return
    }
    renderChips()
    tagPanel.visibility = View.VISIBLE
    root.post { keepOnScreen() }
    ui.postDelayed(hideMotives, 8000)
  }

  /** Posição da barra antes de o painel a empurrar para dentro do ecrã. */
  private var xBeforePanel: Int? = null

  /** Com o painel aberto, a janela não pode sair pela direita (o ✓ e as jogadoras ficavam escondidos). */
  private fun keepOnScreen() {
    val screenW = context.resources.displayMetrics.widthPixels
    val w = root.width
    if (w <= 0 || params.x + w <= screenW) return
    if (xBeforePanel == null) xBeforePanel = params.x
    params.x = maxOf(0, screenW - w)
    try { wm.updateViewLayout(root, params) } catch (_: Exception) {}
  }

  private fun restoreX() {
    val x = xBeforePanel ?: return
    xBeforePanel = null
    params.x = x
    try { wm.updateViewLayout(root, params) } catch (_: Exception) {}
  }

  private fun chip(label: String, selected: Boolean, selColor: Int, widthDp: Int, onTap: () -> Unit) = TextView(context).apply {
    text = label
    setTextColor(TEXT)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    typeface = Typeface.DEFAULT_BOLD
    gravity = Gravity.CENTER
    maxLines = 1
    ellipsize = android.text.TextUtils.TruncateAt.END
    setPadding(dp(6), 0, dp(6), 0)
    background = if (selected) rounded(selColor, 12) else rounded(SURFACE_HIGH, 12, BORDER)
    layoutParams = GridLayout.LayoutParams().apply {
      width = dp(widthDp)
      height = dp(40)
      setMargins(0, 0, dp(5), dp(5))
    }
    isClickable = true
    setOnClickListener { v ->
      v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
      onTap()
      renderChips()
      // Mais tempo para escolher o resto (ex.: jogadoras depois do motivo).
      ui.removeCallbacks(hideMotives)
      ui.postDelayed(hideMotives, 8000)
    }
  }

  private fun renderChips() {
    val id = motiveClipId ?: return
    toneGrid.removeAllViews()
    motiveGrid.removeAllViews()
    playerGrid.removeAllViews()
    for ((tone, label, color) in listOf(Triple("pos", "+ Positivo", TONE_POS), Triple("neg", "− Negativo", TONE_NEG))) {
      toneGrid.addView(chip(label, chosenTone == tone, color, 100) {
        chosenTone = if (chosenTone == tone) null else tone
        actions.setTone(context, id, chosenTone)
      })
    }
    val motives = actions.motives()
    val players = actions.players()
    motiveColumn.visibility = if (motives.isEmpty()) View.GONE else View.VISIBLE
    playerColumn.visibility = if (players.isEmpty()) View.GONE else View.VISIBLE
    for (m in motives) {
      motiveGrid.addView(chip(m, chosenMotive == m, ACCENT, 148) {
        chosenMotive = m
        actions.setMotive(context, id, m)
        flash("✓ $m", OK)
      })
    }
    for ((num, label) in players) {
      playerGrid.addView(chip(label, num in chosenPlayers, PLAYER_BLUE, 104) {
        if (!chosenPlayers.add(num)) chosenPlayers.remove(num)
        actions.setPlayers(context, id, chosenPlayers.toList())
      })
    }
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
    if (collapsed) tagPanel.visibility = View.GONE
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
    qualityView.text = if (actions.isLight()) "Leve" else "HD"
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
            xBeforePanel = null // mudou de sítio à mão: fica onde a puseram
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
