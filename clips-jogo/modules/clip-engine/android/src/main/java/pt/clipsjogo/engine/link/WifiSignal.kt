package pt.clipsjogo.engine.link

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build

/** Força do sinal Wi-Fi do tablet (para escolher onde pôr os aparelhos). */
object WifiSignal {
  /** rssi em dBm (null se desconhecido), frequência em MHz, velocidade da ligação em Mbps. */
  fun read(context: Context): Map<String, Any?> {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    var rssi: Int? = null
    var freq: Int? = null
    var speed: Int? = null
    try {
      @Suppress("DEPRECATION")
      val networks = listOfNotNull(cm.boundNetworkForProcess) + cm.allNetworks.toList()
      for (n in networks) {
        val caps = cm.getNetworkCapabilities(n) ?: continue
        if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) continue
        if (Build.VERSION.SDK_INT >= 29) {
          caps.signalStrength.takeIf { it != NetworkCapabilities.SIGNAL_STRENGTH_UNSPECIFIED }?.let { rssi = it }
          (caps.transportInfo as? WifiInfo)?.let { info ->
            if (info.rssi > -127 && info.rssi < 0) rssi = info.rssi
            info.frequency.takeIf { it > 0 }?.let { freq = it }
            info.linkSpeed.takeIf { it > 0 }?.let { speed = it }
          }
        }
        if (rssi != null) break
      }
    } catch (_: Exception) {
    }
    if (rssi == null || freq == null) {
      try {
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        val info = wm.connectionInfo
        if (rssi == null && info.rssi > -127 && info.rssi < 0) rssi = info.rssi
        if (freq == null) info.frequency.takeIf { it > 0 }?.let { freq = it }
        if (speed == null) info.linkSpeed.takeIf { it > 0 }?.let { speed = it }
      } catch (_: Exception) {
      }
    }
    return mapOf("rssi" to rssi, "frequencyMHz" to freq, "linkSpeedMbps" to speed)
  }
}
