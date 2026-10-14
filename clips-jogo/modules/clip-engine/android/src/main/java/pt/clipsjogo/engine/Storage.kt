package pt.clipsjogo.engine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import pt.clipsjogo.engine.core.Segment
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Estado de um clip. Os tempos estão na linha temporal da gravação (µs). */
data class ClipInfo(
  val id: String,
  var name: String,
  val requestedStartUs: Long,
  val requestedEndUs: Long,
  val createdAtMs: Long,
  var status: String = STATUS_PENDING,
  var startUs: Long = requestedStartUs,
  var endUs: Long = requestedEndUs,
  var fileName: String? = null,
  var sizeBytes: Long = 0L,
  var error: String? = null
) {
  fun toJson() = JSONObject().apply {
    put("id", id)
    put("name", name)
    put("requestedStartUs", requestedStartUs)
    put("requestedEndUs", requestedEndUs)
    put("createdAtMs", createdAtMs)
    put("status", status)
    put("startUs", startUs)
    put("endUs", endUs)
    put("fileName", fileName ?: JSONObject.NULL)
    put("sizeBytes", sizeBytes)
    put("error", error ?: JSONObject.NULL)
  }

  companion object {
    const val STATUS_PENDING = "pending"
    const val STATUS_CUTTING = "cutting"
    const val STATUS_READY = "ready"
    const val STATUS_FAILED = "failed"

    fun fromJson(o: JSONObject) = ClipInfo(
      id = o.getString("id"),
      name = o.optString("name", ""),
      requestedStartUs = o.getLong("requestedStartUs"),
      requestedEndUs = o.getLong("requestedEndUs"),
      createdAtMs = o.optLong("createdAtMs"),
      status = o.optString("status", STATUS_PENDING),
      startUs = o.optLong("startUs"),
      endUs = o.optLong("endUs"),
      fileName = o.optString("fileName").takeIf { !o.isNull("fileName") && it.isNotEmpty() },
      sizeBytes = o.optLong("sizeBytes"),
      error = o.optString("error").takeIf { !o.isNull("error") && it.isNotEmpty() }
    )
  }
}

/** Uma sessão = um jogo gravado. */
class SessionInfo(
  val id: String,
  val dir: File,
  val startedAtMs: Long,
  val quality: String,
  val width: Int,
  val height: Int,
  val rotation: Int,
  var status: String = STATUS_RECORDING,
  var durationUs: Long = 0L,
  val segments: MutableList<Segment> = java.util.concurrent.CopyOnWriteArrayList(),
  var fullVideoParts: List<String> = emptyList(),
  val clips: MutableList<ClipInfo> = java.util.concurrent.CopyOnWriteArrayList()
) {
  val segmentsDir get() = File(dir, "segments")
  val clipsDir get() = File(dir, "clips")

  fun toJson() = JSONObject().apply {
    put("id", id)
    put("startedAtMs", startedAtMs)
    put("quality", quality)
    put("width", width)
    put("height", height)
    put("rotation", rotation)
    put("status", status)
    put("durationUs", durationUs)
    put("segments", JSONArray().apply {
      segments.forEach {
        put(JSONObject().apply {
          put("index", it.index)
          put("file", it.fileName)
          put("startUs", it.startUs)
          put("endUs", it.endUs)
          put("size", it.sizeBytes)
        })
      }
    })
    put("fullVideoParts", JSONArray(fullVideoParts))
  }

  companion object {
    const val STATUS_RECORDING = "recording"
    const val STATUS_FINALIZING = "finalizing"
    const val STATUS_DONE = "done"
    const val STATUS_INTERRUPTED = "interrupted"

    fun fromJson(dir: File, o: JSONObject): SessionInfo {
      val s = SessionInfo(
        id = o.getString("id"),
        dir = dir,
        startedAtMs = o.optLong("startedAtMs"),
        quality = o.optString("quality", "1080p"),
        width = o.optInt("width"),
        height = o.optInt("height"),
        rotation = o.optInt("rotation"),
        status = o.optString("status", STATUS_DONE),
        durationUs = o.optLong("durationUs")
      )
      val segs = o.optJSONArray("segments") ?: JSONArray()
      for (i in 0 until segs.length()) {
        val j = segs.getJSONObject(i)
        s.segments.add(Segment(j.getInt("index"), j.getString("file"), j.getLong("startUs"), j.getLong("endUs"), j.optLong("size")))
      }
      val parts = o.optJSONArray("fullVideoParts") ?: JSONArray()
      s.fullVideoParts = (0 until parts.length()).map { parts.getString(it) }
      return s
    }
  }
}

class Storage(context: Context) {
  val root: File = File(context.getExternalFilesDir(null) ?: context.filesDir, "sessions").apply { mkdirs() }

  fun newSession(quality: String, width: Int, height: Int, rotation: Int): SessionInfo {
    val now = System.currentTimeMillis()
    val id = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date(now))
    val dir = File(root, id)
    val session = SessionInfo(id, dir, now, quality, width, height, rotation)
    session.segmentsDir.mkdirs()
    session.clipsDir.mkdirs()
    saveSession(session)
    saveClips(session)
    return session
  }

  @Synchronized
  fun saveSession(session: SessionInfo) = writeAtomic(File(session.dir, "session.json"), session.toJson().toString())

  @Synchronized
  fun saveClips(session: SessionInfo) =
    writeAtomic(File(session.dir, "clips.json"), JSONArray().apply { session.clips.forEach { put(it.toJson()) } }.toString())

  fun loadAll(): List<SessionInfo> = (root.listFiles() ?: emptyArray())
    .filter { it.isDirectory }
    .mapNotNull { load(it) }
    .sortedByDescending { it.startedAtMs }

  fun load(dir: File): SessionInfo? = try {
    val s = SessionInfo.fromJson(dir, JSONObject(File(dir, "session.json").readText()))
    val clipsFile = File(dir, "clips.json")
    if (clipsFile.exists()) {
      val arr = JSONArray(clipsFile.readText())
      for (i in 0 until arr.length()) s.clips.add(ClipInfo.fromJson(arr.getJSONObject(i)))
    }
    s
  } catch (e: Exception) {
    null
  }

  private fun writeAtomic(file: File, text: String) {
    file.parentFile?.mkdirs()
    val tmp = File(file.parentFile, file.name + ".tmp")
    tmp.writeText(text)
    if (!tmp.renameTo(file)) {
      file.writeText(text)
      tmp.delete()
    }
  }
}
