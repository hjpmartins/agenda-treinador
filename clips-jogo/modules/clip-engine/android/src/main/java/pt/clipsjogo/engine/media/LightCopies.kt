package pt.clipsjogo.engine.media

import android.os.Process
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Cópias leves dos clips (para o tablet), feitas a pedido, uma de cada vez e
 * com prioridade baixa para não perturbar a gravação.
 */
object LightCopies {
  private val worker = Executors.newSingleThreadExecutor { r ->
    Thread({
      Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
      r.run()
    }, "copias-leves")
  }
  private val states = ConcurrentHashMap<String, String>()

  fun fileFor(original: File) = File(original.parentFile, original.nameWithoutExtension + "-leve.mp4")

  /**
   * Estado da cópia leve ("ready" | "preparing" | "failed") e tamanho do ficheiro
   * a transferir. Se ainda não existe, começa a prepará-la.
   */
  fun request(original: File): Pair<String, Long> {
    val light = fileFor(original)
    if (light.exists()) return "ready" to light.length()
    val key = original.path
    when (states[key]) {
      "failed" -> return "failed" to original.length() // o tablet recebe o original
      "preparing" -> return "preparing" to 0L
    }
    states[key] = "preparing"
    worker.execute {
      try {
        LightTranscoder.export(original, light, LightTranscoder.Options(audio = false))
        states.remove(key)
      } catch (e: Throwable) {
        light.delete()
        states[key] = "failed"
      }
    }
    return "preparing" to 0L
  }
}
