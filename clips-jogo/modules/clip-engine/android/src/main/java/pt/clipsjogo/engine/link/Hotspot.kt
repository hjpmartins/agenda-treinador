package pt.clipsjogo.engine.link

import android.content.Context
import android.net.wifi.SoftApConfiguration
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.net.Inet4Address
import java.net.NetworkInterface

/** Dados da rede criada pelo telemóvel, para pôr no QR. */
data class HotspotInfo(val ssid: String, val passphrase: String, val security: String, val band: String?)

/**
 * Rede Wi-Fi local criada pelo próprio telemóvel ("Local-Only Hotspot"):
 * não partilha dados móveis nem precisa de internet. O nome e a palavra-passe
 * são gerados pelo Android e mudam de cada vez que a rede é criada.
 */
class Hotspot(context: Context) {
  private val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
  private var reservation: WifiManager.LocalOnlyHotspotReservation? = null
  @Volatile var info: HotspotInfo? = null
    private set

  val active: Boolean get() = reservation != null

  fun start(onResult: (Result<HotspotInfo>) -> Unit) {
    info?.let { return onResult(Result.success(it)) }
    try {
      wifi.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
        override fun onStarted(res: WifiManager.LocalOnlyHotspotReservation) {
          reservation = res
          val i = readInfo(res)
          if (i == null) {
            res.close()
            reservation = null
            onResult(Result.failure(IllegalStateException("O Android não indicou o nome da rede criada.")))
            return
          }
          info = i
          onResult(Result.success(i))
        }

        override fun onStopped() {
          Log.w(TAG, "A rede local foi desligada pelo sistema.")
          reservation = null
          info = null
        }

        override fun onFailed(reason: Int) {
          val msg = when (reason) {
            ERROR_INCOMPATIBLE_MODE ->
              "O Ponto de acesso do telemóvel está ligado: a app usa essa rede."
            ERROR_TETHERING_DISALLOWED -> "Este telemóvel não permite criar redes Wi-Fi (restrição do sistema)."
            ERROR_NO_CHANNEL -> "Não há canal Wi-Fi disponível. Tenta desligar e ligar o Wi-Fi."
            else -> "Não foi possível criar a rede Wi-Fi local (erro $reason)."
          }
          onResult(Result.failure(IllegalStateException(msg)))
        }
      }, Handler(Looper.getMainLooper()))
    } catch (e: SecurityException) {
      onResult(Result.failure(IllegalStateException(
        "Para criar a rede, a app precisa da permissão \"Dispositivos próximos\" (ou Localização) e a Localização ligada."
      )))
    } catch (e: IllegalStateException) {
      // Já existe um pedido ativo (ex.: noutra app).
      onResult(Result.failure(IllegalStateException("Não foi possível criar a rede: ${e.message}")))
    }
  }

  fun stop() {
    try { reservation?.close() } catch (_: Exception) {}
    reservation = null
    info = null
  }

  @Suppress("DEPRECATION")
  private fun readInfo(res: WifiManager.LocalOnlyHotspotReservation): HotspotInfo? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val c: SoftApConfiguration = res.softApConfiguration
      val ssid = if (Build.VERSION.SDK_INT >= 33) c.wifiSsid?.toString()?.trim('"') else c.ssid
      val security = when (c.securityType) {
        SoftApConfiguration.SECURITY_TYPE_WPA3_SAE -> "wpa3"
        SoftApConfiguration.SECURITY_TYPE_OPEN -> "open"
        else -> "wpa2" // WPA2 ou transição WPA2/WPA3: WPA2 funciona
      }
      val band = when {
        c.band and SoftApConfiguration.BAND_6GHZ != 0 && c.band and SoftApConfiguration.BAND_2GHZ == 0 -> "6 GHz"
        c.band and SoftApConfiguration.BAND_5GHZ != 0 && c.band and SoftApConfiguration.BAND_2GHZ == 0 -> "5 GHz"
        c.band and SoftApConfiguration.BAND_2GHZ != 0 -> "2,4 GHz"
        else -> null
      }
      return ssid?.let { HotspotInfo(it, c.passphrase ?: "", security, band) }
    }
    val c = res.wifiConfiguration ?: return null
    return HotspotInfo(c.SSID.trim('"'), c.preSharedKey?.trim('"') ?: "", "wpa2", null)
  }

  companion object {
    private const val TAG = "ClipEngine/Hotspot"
  }
}

object NetUtils {
  /**
   * Endereços IPv4 locais, os mais prováveis primeiro (interfaces Wi-Fi /
   * ponto de acesso), sem as de dados móveis ou VPN.
   */
  fun localIPv4Addresses(): List<String> {
    val result = mutableListOf<Pair<Int, String>>()
    try {
      for (nif in NetworkInterface.getNetworkInterfaces()) {
        if (!nif.isUp || nif.isLoopback) continue
        val name = nif.name.lowercase()
        if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("tun") || name.startsWith("dummy")) continue
        val score = when {
          name.startsWith("ap") || name.startsWith("swlan") || name.contains("softap") -> 0
          name.startsWith("wlan") -> 1
          else -> 2
        }
        for (addr in nif.inetAddresses) {
          if (addr is Inet4Address && !addr.isLoopbackAddress) result.add(score to addr.hostAddress!!)
        }
      }
    } catch (_: Exception) {}
    return result.sortedBy { it.first }.map { it.second }.distinct()
  }
}
