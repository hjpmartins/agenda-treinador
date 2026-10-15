package pt.clipsjogo.engine.link

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import pt.clipsjogo.engine.ClipEngine
import pt.clipsjogo.engine.ClipInfo
import java.security.SecureRandom

/** Dados que vão no QR para o tablet se ligar. */
data class LinkInfo(
  val ssid: String?,
  val passphrase: String?,
  val security: String,
  val ips: List<String>,
  val port: Int,
  val token: String,
  val hotspotError: String?
)

/**
 * Ligação offline telemóvel ↔ tablet.
 *  - No telemóvel: cria a rede local e o servidor (start/stop).
 *  - No tablet: liga-se à rede do QR (join/leave); os pedidos HTTP são feitos em JS.
 */
object Link {
  /** Rotação do ecrã do telemóvel (dada pelo módulo), para o tablet poder iniciar a gravação. */
  @Volatile var displayRotation: () -> Int = { 90 }

  private const val TAG = "ClipEngine/Link"
  private val PORTS = listOf(8765, 8766, 8767)

  private lateinit var appContext: Context
  private var hotspot: Hotspot? = null
  private var server: LinkServer? = null
  private var joiner: WifiJoiner? = null
  private var info: LinkInfo? = null

  private var wifiLock: WifiManager.WifiLock? = null

  fun init(context: Context) {
    appContext = context.applicationContext
  }

  /**
   * Código de acesso fixo deste telemóvel: assim, se a app reiniciar, o tablet
   * volta a ligar-se sem ler o QR outra vez.
   */
  private fun persistentToken(): String {
    val prefs = appContext.getSharedPreferences("clipsjogo", Context.MODE_PRIVATE)
    prefs.getString("token", null)?.let { return it }
    return randomToken().also { prefs.edit().putString("token", it).apply() }
  }

  /** Impede o Wi-Fi de entrar em poupança de energia (causa cortes de ligação). */
  @Synchronized
  private fun holdWifi(hold: Boolean) {
    if (hold && wifiLock == null) {
      val wm = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      @Suppress("DEPRECATION")
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) WifiManager.WIFI_MODE_FULL_LOW_LATENCY
      else WifiManager.WIFI_MODE_FULL_HIGH_PERF
      wifiLock = wm.createWifiLock(mode, "ClipsJogo:ligacao").apply {
        setReferenceCounted(false)
        acquire()
      }
    } else if (!hold) {
      wifiLock?.let { if (it.isHeld) it.release() }
      wifiLock = null
    }
  }

  val tabletConnected: Boolean get() = server?.tabletConnected == true
  val active: Boolean get() = server != null

  // ------------------------------------------------------------- telemóvel

  @Synchronized
  fun start(onResult: (Result<LinkInfo>) -> Unit) {
    val current = info
    if (current != null && server != null && (hotspot?.active == true || current.ssid == null)) {
      return onResult(Result.success(current.copy(ips = NetUtils.localIPv4Addresses().ifEmpty { current.ips })))
    }
    val token = persistentToken()
    holdWifi(true)
    val srv = server ?: startServer(token) ?: return onResult(
      Result.failure(IllegalStateException("Não foi possível abrir a ligação local (portas ocupadas)."))
    )
    server = srv
    val hs = hotspot ?: Hotspot(appContext).also { hotspot = it }
    hs.start { result ->
      Thread {
        // A interface da rede nova pode demorar um instante a ter IP.
        var ips = NetUtils.localIPv4Addresses()
        var tries = 0
        while (ips.isEmpty() && tries++ < 10) {
          Thread.sleep(300)
          ips = NetUtils.localIPv4Addresses()
        }
        val hi = result.getOrNull()
        val li = LinkInfo(
          ssid = hi?.ssid,
          passphrase = hi?.passphrase,
          security = hi?.security ?: "wpa2",
          ips = ips,
          port = srv.listeningPort,
          token = token,
          hotspotError = result.exceptionOrNull()?.message
        )
        synchronized(this) { info = li }
        // Sem rede própria mas com Wi-Fi (ex.: router portátil), o tablet ainda se pode ligar.
        if (hi == null && ips.isEmpty()) {
          onResult(Result.failure(result.exceptionOrNull() ?: IllegalStateException("Sem rede disponível.")))
        } else {
          onResult(Result.success(li))
        }
      }.start()
    }
  }

  @Synchronized
  fun stop() {
    try { server?.stop() } catch (_: Exception) {}
    server = null
    hotspot?.stop()
    info = null
    holdWifi(false)
  }

  private fun startServer(token: String): LinkServer? {
    for (port in PORTS) {
      try {
        val s = LinkServer(port, token, api)
        s.start(5_000, false)
        Log.i(TAG, "Servidor local na porta $port")
        return s
      } catch (e: Exception) {
        Log.w(TAG, "Porta $port ocupada", e)
      }
    }
    return null
  }

  private fun randomToken(): String {
    val bytes = ByteArray(9)
    SecureRandom().nextBytes(bytes)
    return bytes.joinToString("") { "%02x".format(it) }
  }

  private val api = object : LinkServer.Api {
    override fun status(): JSONObject {
      val s = ClipEngine.status()
      return JSONObject().apply {
        put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
        put("elapsedMs", SystemClock.elapsedRealtimeNanos() / 1_000_000.0)
        put("state", s["state"])
        put("standby", s["standby"] == true)
        put("sessionId", s["sessionId"] ?: JSONObject.NULL)
        put("recStartElapsedMs", ClipEngine.recordingStartElapsedMs() ?: JSONObject.NULL)
        put("batteryPercent", s["batteryPercent"] ?: JSONObject.NULL)
        put("charging", s["charging"])
        put("thermal", s["thermal"])
        put("freeBytes", s["freeBytes"])
        put("bytesPerSecond", s["bytesPerSecond"])
      }
    }

    override fun requestClip(body: JSONObject): JSONObject {
      // JSON null chega como "null" em optString: tratar como ausente.
      fun str(key: String) = if (body.isNull(key)) null else body.optString(key).ifEmpty { null }
      val sessionId = str("sessionId")
      val current = ClipEngine.currentSession() ?: throw IllegalStateException("O telemóvel não está a gravar.")
      if (sessionId != null && sessionId != current.id) {
        throw IllegalStateException("Este pedido era para uma gravação que já terminou.")
      }
      val clip = ClipEngine.requestClip(
        str("id"),
        (body.getDouble("startMs") * 1000).toLong(),
        (body.getDouble("endMs") * 1000).toLong(),
        str("name")
      )
      return clipJson(current.id, clip)
    }

    private fun originalFile(id: String): java.io.File? {
      val s = ClipEngine.currentSession() ?: return null
      val clip = s.clips.firstOrNull { it.id == id && it.status == ClipInfo.STATUS_READY } ?: return null
      return clip.fileName?.let { java.io.File(s.clipsDir, it) }?.takeIf { it.exists() }
    }

    override fun clipFile(id: String, light: Boolean): java.io.File? {
      val original = originalFile(id) ?: return null
      if (!light) return original
      // Sem cópia leve (ainda a preparar ou falhou): entrega o original.
      return pt.clipsjogo.engine.media.LightCopies.fileFor(original).takeIf { it.exists() } ?: original
    }

    override fun startRecording(): JSONObject {
      when (ClipEngine.state) {
        ClipEngine.STATE_RECORDING -> return JSONObject().put("ok", true)
        ClipEngine.STATE_FINALIZING -> throw IllegalStateException("O telemóvel ainda está a terminar a gravação anterior.")
        ClipEngine.STATE_PREVIEW -> {}
        else -> throw IllegalStateException("Abre o ecrã Gravar no telemóvel (com o ecrã ligado).")
      }
      val id = ClipEngine.startRecording(ClipEngine.selectedQuality, displayRotation())
      return JSONObject().put("ok", true).put("sessionId", id)
    }

    override fun stopRecording(): JSONObject {
      ClipEngine.stopRecording()
      return JSONObject().put("ok", true)
    }

    override fun clipLight(id: String): JSONObject {
      val original = originalFile(id) ?: return JSONObject().put("state", "missing")
      val (state, size) = pt.clipsjogo.engine.media.LightCopies.request(original)
      return JSONObject().put("state", state).put("sizeBytes", size)
    }

    override fun clips(): JSONObject {
      val s = ClipEngine.currentSession()
      return JSONObject().apply {
        put("sessionId", s?.id ?: JSONObject.NULL)
        put("clips", JSONArray().apply { s?.clips?.forEach { put(clipJson(s.id, it)) } })
      }
    }
  }

  fun clipJson(sessionId: String, c: ClipInfo) = JSONObject().apply {
    put("id", c.id)
    put("sessionId", sessionId)
    put("name", c.name)
    put("status", c.status)
    put("requestedStartMs", c.requestedStartUs / 1000.0)
    put("requestedEndMs", c.requestedEndUs / 1000.0)
    put("startMs", c.startUs / 1000.0)
    put("endMs", c.endUs / 1000.0)
    put("createdAtMs", c.createdAtMs)
    put("sizeBytes", c.sizeBytes)
    put("error", c.error ?: JSONObject.NULL)
  }

  // ------------------------------------------------------------- tablet

  fun join(ssid: String, passphrase: String, security: String, onResult: (Result<Unit>) -> Unit) {
    val j = joiner ?: WifiJoiner(appContext).also { joiner = it }
    holdWifi(true)
    j.join(ssid, passphrase, security, onResult)
  }

  /** Tablet ligado à mão (sem dados de rede no QR): mantém na mesma o Wi-Fi acordado. */
  fun keepWifiAwake() = holdWifi(true)

  fun leave() {
    holdWifi(false)
    joiner?.leave()
  }
}
