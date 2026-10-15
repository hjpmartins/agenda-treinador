package pt.clipsjogo.engine.link

import android.os.SystemClock
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

/**
 * Pequeno servidor HTTP no telemóvel que grava. O tablet usa-o para:
 *  - GET  /api/status   estado + relógio (para sincronizar o cronómetro);
 *  - POST /api/clip     pedir um clip (tempos já calculados no relógio do telemóvel);
 *  - GET  /api/clips    lista de clips e estado de cada um;
 *  - GET  /api/clips/<id>/file   o ficheiro MP4 do clip (aceita Range, para retomar).
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
    fun clipFile(id: String): File?
  }

  @Volatile var lastSeenElapsedMs = 0L
    private set

  /**
   * O tablet pergunta de segundo a segundo, mas com a rede ocupada (ex.: a
   * transferir um clip) uma resposta pode demorar: só dizemos "à espera do
   * tablet" após 15 s sem notícias dele.
   */
  val tabletConnected: Boolean
    get() = lastSeenElapsedMs > 0 && SystemClock.elapsedRealtime() - lastSeenElapsedMs < 15_000

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
        session.method == Method.GET && FILE_ROUTE.matches(session.uri) -> {
          val id = FILE_ROUTE.find(session.uri)!!.groupValues[1]
          val file = api.clipFile(id) ?: return json(Response.Status.NOT_FOUND, JSONObject().put("error", "Clip ainda não está pronto"))
          serveFile(file, session.headers["range"])
        }
        else -> json(Response.Status.NOT_FOUND, JSONObject().put("error", "Não encontrado"))
      }
    } catch (e: IllegalStateException) {
      json(Response.Status.CONFLICT, JSONObject().put("error", e.message ?: "Pedido inválido"))
    } catch (e: Exception) {
      json(Response.Status.INTERNAL_ERROR, JSONObject().put("error", e.message ?: "Erro no telemóvel"))
    }
  }

  private fun serveFile(file: File, range: String?): Response {
    val length = file.length()
    val match = range?.let { RANGE.find(it) }
    if (match != null) {
      val start = match.groupValues[1].toLong()
      val end = match.groupValues[2].takeIf { it.isNotEmpty() }?.toLong()?.coerceAtMost(length - 1) ?: (length - 1)
      if (start >= length || start > end) {
        return newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", "").apply {
          addHeader("Content-Range", "bytes */$length")
        }
      }
      val input = FileInputStream(file).apply { skip(start) }
      return newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, "video/mp4", input, end - start + 1).apply {
        addHeader("Content-Range", "bytes $start-$end/$length")
        addHeader("Accept-Ranges", "bytes")
      }
    }
    return newFixedLengthResponse(Response.Status.OK, "video/mp4", FileInputStream(file), length).apply {
      addHeader("Accept-Ranges", "bytes")
    }
  }

  private fun json(status: Response.Status, body: JSONObject): Response =
    newFixedLengthResponse(status, "application/json; charset=utf-8", body.toString()).apply {
      addHeader("Cache-Control", "no-store")
    }

  companion object {
    private val FILE_ROUTE = Regex("^/api/clips/([A-Za-z0-9_-]+)/file$")
    private val RANGE = Regex("bytes=(\\d+)-(\\d*)")
  }
}
