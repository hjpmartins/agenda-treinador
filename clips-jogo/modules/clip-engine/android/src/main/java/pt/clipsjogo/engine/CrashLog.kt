package pt.clipsjogo.engine

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Se a app fechar por um erro nativo, guarda o erro num ficheiro para ser
 * mostrado no ecrã inicial da próxima vez (e enviado a quem desenvolve).
 */
object CrashLog {
  private var file: File? = null

  fun install(context: Context) {
    if (file != null) return
    val f = File(context.filesDir, "ultimo-erro.txt")
    file = f
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        val sw = StringWriter()
        error.printStackTrace(PrintWriter(sw))
        val text = buildString {
          appendLine(SimpleDateFormat("dd/MM HH:mm:ss", Locale.US).format(Date()))
          appendLine("${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
          appendLine("Thread: ${thread.name}")
          append(sw.toString().lines().take(40).joinToString("\n"))
        }
        f.writeText(text)
      } catch (_: Throwable) {
      }
      previous?.uncaughtException(thread, error)
    }
  }

  fun read(): String? = file?.takeIf { it.exists() }?.readText()

  fun clear() {
    file?.delete()
  }
}
