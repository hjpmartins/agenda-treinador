package pt.clipsjogo.engine.link

import android.content.Context
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
  val band: String?,
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
  private const val TAG = "ClipEngine/Link"
  private val PORTS = listOf(8765, 8766, 8767)

  private lateinit var appContext: Context
  private var hotspot: Hotspot? = null
  private var server: LinkServer? = null
  private var joiner: WifiJoiner? = null
  private var info: LinkInfo? = null

  fun init(context: Context) {
    appContext = context.applicationContext
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
    val token = info?.token ?: randomToken()
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
          band = hi?.band,
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
      val sessionId = body.optString("sessionId").ifEmpty { null }
      val current = ClipEngine.currentSession() ?: throw IllegalStateException("O telemóvel não está a gravar.")
      if (sessionId != null && sessionId != current.id) {
        throw IllegalStateException("Este pedido era para uma gravação que já terminou.")
      }
      val clip = ClipEngine.requestClip(
        body.optString("id").ifEmpty { null },
        (body.getDouble("startMs") * 1000).toLong(),
        (body.getDouble("endMs") * 1000).toLong(),
        body.optString("name").ifEmpty { null }
      )
      return clipJson(current.id, clip)
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
    j.join(ssid, passphrase, security, onResult)
  }

  fun leave() {
    joiner?.leave()
  }
}
