package pt.clipsjogo.engine.link

import android.os.SystemClock
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

/**
 * Pequeno servidor HTTP no telemóvel que grava. O tablet usa-o para:
 *  - GET  /api/status   estado + relógio (para sincronizar o cronómetro);
 *  - POST /api/clip     pedir um clip (tempos já calculados no relógio do telemóvel);
 *  - GET  /api/clips    lista de clips e estado de cada um.
 *
 * Todos os pedidos levam o código do QR (cabeçalho X-Token), para que outros
 * dispositivos na mesma rede não consigam pedir clips.
 */
class LinkServer(
  port: Int,
  private val token: String,
  private val api: Api
) : NanoHTTPD(port) {
  interface Api {
    fun status(): JSONObject
    fun requestClip(body: JSONObject): JSONObject
    fun clips(): JSONObject
  }

  @Volatile var lastSeenElapsedMs = 0L
    private set

  val tabletConnected: Boolean
    get() = lastSeenElapsedMs > 0 && SystemClock.elapsedRealtime() - lastSeenElapsedMs < 5_000

  override fun serve(session: IHTTPSession): Response {
    val tok = session.headers["x-token"] ?: session.parameters["token"]?.firstOrNull()
    if (tok != token) return json(Response.Status.FORBIDDEN, JSONObject().put("error", "Código inválido. Volta a ler o QR."))
    lastSeenElapsedMs = SystemClock.elapsedRealtime()
    return try {
      when {
        session.method == Method.GET && session.uri == "/api/status" -> json(Response.Status.OK, api.status())
        session.method == Method.GET && session.uri == "/api/clips" -> json(Response.Status.OK, api.clips())
        session.method == Method.POST && session.uri == "/api/clip" -> {
          val files = HashMap<String, String>()
          session.parseBody(files)
          val body = JSONObject(files["postData"] ?: "{}")
          json(Response.Status.OK, api.requestClip(body))
        }
        else -> json(Response.Status.NOT_FOUND, JSONObject().put("error", "Não encontrado"))
      }
    } catch (e: IllegalStateException) {
      json(Response.Status.CONFLICT, JSONObject().put("error", e.message ?: "Pedido inválido"))
    } catch (e: Exception) {
      json(Response.Status.INTERNAL_ERROR, JSONObject().put("error", e.message ?: "Erro no telemóvel"))
    }
  }

  private fun json(status: Response.Status, body: JSONObject): Response =
    newFixedLengthResponse(status, "application/json; charset=utf-8", body.toString()).apply {
      addHeader("Cache-Control", "no-store")
    }
}
