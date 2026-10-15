package pt.clipsjogo.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** FileProvider próprio (nome de classe único, para não colidir com os de outros módulos). */
class UpdateFileProvider : FileProvider()

/**
 * Atualizações da app sem passar pelo GitHub no browser: descarrega o APK
 * (com progresso) para a cache e abre o instalador do Android.
 */
object Updater {
  private const val DIR = "atualizacoes"

  private fun dir(context: Context) = File(context.cacheDir, DIR).apply { mkdirs() }

  private fun apkFile(context: Context, version: String): File {
    val safe = version.replace(Regex("[^0-9A-Za-z._-]"), "_")
    return File(dir(context), "clips-jogo-$safe.apk")
  }

  /** Caminho do APK já descarregado desta versão (ex.: a app fechou ao dar a permissão), ou null. */
  fun downloaded(context: Context, version: String): String? =
    apkFile(context, version).takeIf { it.isFile && it.length() > 0 }?.absolutePath

  /** Bloqueante: chamar fora da thread principal. */
  fun download(context: Context, url: String, version: String, onProgress: (Long, Long) -> Unit): String {
    downloaded(context, version)?.let { return it }
    val target = apkFile(context, version)
    val part = File(target.path + ".part")
    var conn: HttpURLConnection? = null
    try {
      var current = URL(url)
      // O GitHub redireciona para outro domínio; seguimos à mão para garantir.
      for (hop in 0 until 6) {
        val c = current.openConnection() as HttpURLConnection
        c.instanceFollowRedirects = false
        c.connectTimeout = 15_000
        c.readTimeout = 30_000
        c.setRequestProperty("Accept", "application/octet-stream")
        val code = c.responseCode
        if (code in 300..399) {
          val loc = c.getHeaderField("Location") ?: throw IOException("Redirecionamento sem destino.")
          c.disconnect()
          current = URL(current, loc)
          continue
        }
        if (code != 200) {
          c.disconnect()
          throw IOException("O servidor respondeu $code.")
        }
        conn = c
        break
      }
      val c = conn ?: throw IOException("Demasiados redirecionamentos.")
      val total = c.contentLengthLong
      var done = 0L
      var lastReport = 0L
      c.inputStream.use { input ->
        part.outputStream().use { out ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            done += n
            if (done - lastReport >= 256 * 1024) {
              lastReport = done
              onProgress(done, total)
            }
          }
        }
      }
      if (total > 0 && done != total) throw IOException("Transferência incompleta.")
      onProgress(done, if (total > 0) total else done)
      if (!part.renameTo(target)) throw IOException("Não foi possível guardar a atualização.")
      return target.absolutePath
    } catch (e: Exception) {
      part.delete()
      throw e
    } finally {
      conn?.disconnect()
    }
  }

  fun canInstall(context: Context): Boolean =
    Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

  fun openInstallPermissionSettings(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  fun install(context: Context, path: String) {
    val file = File(path)
    if (!file.isFile) throw IOException("O ficheiro da atualização já não existe.")
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.clipengine.updates", file)
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  /** Apaga APKs descarregados (chamado quando não há nada para instalar). */
  fun clear(context: Context) {
    dir(context).listFiles()?.forEach { it.delete() }
  }
}
