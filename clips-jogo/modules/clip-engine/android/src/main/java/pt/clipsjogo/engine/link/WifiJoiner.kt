package pt.clipsjogo.engine.link

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.util.Log

/**
 * Lado do tablet: liga-se à rede criada pelo telemóvel (dados do QR) e passa
 * a usá-la para o tráfego da app. Como essa rede não tem internet, sem o
 * "bind" o Android mandava os pedidos pelos dados móveis ou por outro Wi-Fi.
 */
class WifiJoiner(context: Context) {
  private val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private var callback: ConnectivityManager.NetworkCallback? = null

  val supported: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

  fun join(ssid: String, passphrase: String, security: String, onResult: (Result<Unit>) -> Unit) {
    if (!supported) {
      onResult(Result.failure(IllegalStateException(
        "Este tablet tem uma versão antiga do Android: liga-te à rede \"$ssid\" nas definições de Wi-Fi e volta a ler o QR."
      )))
      return
    }
    leave()
    val spec = WifiNetworkSpecifier.Builder().setSsid(ssid).apply {
      when (security) {
        "open" -> Unit
        "wpa3" -> setWpa3Passphrase(passphrase)
        else -> setWpa2Passphrase(passphrase)
      }
    }.build()
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(spec)
      .build()
    var answered = false
    val cb = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        cm.bindProcessToNetwork(network)
        if (!answered) {
          answered = true
          onResult(Result.success(Unit))
        }
      }

      override fun onUnavailable() {
        if (!answered) {
          answered = true
          onResult(Result.failure(IllegalStateException(
            "O tablet não encontrou a rede \"$ssid\"."
          )))
        }
      }

      override fun onLost(network: Network) {
        Log.w(TAG, "Ligação à rede do telemóvel perdida; o Android volta a tentar sozinho.")
      }
    }
    callback = cb
    // O Android mostra uma janela a pedir para escolher a rede; o utilizador confirma.
    // Se em 40 s não encontrar a rede (ex.: banda que o tablet não suporta), desiste e explica.
    cm.requestNetwork(request, cb, 40_000)
  }

  fun leave() {
    callback?.let {
      try { cm.unregisterNetworkCallback(it) } catch (_: Exception) {}
    }
    callback = null
    cm.bindProcessToNetwork(null)
  }

  companion object {
    private const val TAG = "ClipEngine/WifiJoiner"
  }
}
