package pt.clipsjogo.engine.media

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import pt.clipsjogo.engine.core.Segment
import java.io.File
import java.nio.ByteBuffer

/**
 * Corta um intervalo da gravação a partir dos segmentos, sem re-codificar
 * (cópia direta das amostras H.264/AAC). É rápido e quase não gasta bateria.
 *
 * O clip começa no keyframe imediatamente anterior ao início pedido (no máximo
 * ~1 s antes), por isso nunca corta o início da jogada.
 */
object ClipCutter {
  private const val TAG = "ClipEngine/Cutter"

  data class Result(val startUs: Long, val endUs: Long, val sizeBytes: Long)

  private class TrackReader(file: File, mimePrefix: String) {
    val extractor = MediaExtractor()
    val format: MediaFormat?

    init {
      extractor.setDataSource(file.absolutePath)
      var found: MediaFormat? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        if (f.getString(MediaFormat.KEY_MIME)?.startsWith(mimePrefix) == true) {
          extractor.selectTrack(i)
          found = f
          break
        }
      }
      format = found
    }

    fun release() = extractor.release()
  }

  /**
   * @param segments segmentos (por ordem) que cobrem o intervalo.
   * @param onProgress fração 0..1 (opcional, para o vídeo completo).
   */
  fun cut(
    segmentsDir: File,
    segments: List<Segment>,
    startUs: Long,
    endUs: Long,
    output: File,
    rotationDegrees: Int,
    onProgress: ((Float) -> Unit)? = null
  ): Result {
    require(segments.isNotEmpty()) { "Sem segmentos para cortar." }
    output.parentFile?.mkdirs()
    val tmp = File(output.parentFile, output.name + ".tmp")
    tmp.delete()

    val muxer = MediaMuxer(tmp.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    muxer.setOrientationHint(rotationDegrees)
    var outVideo = -1
    var outAudio = -1
    var started = false
    var clipStartUs = -1L
    var lastVideoOutUs = -1L
    var lastAudioOutUs = -1L
    var videoSamples = 0
    var buffer = ByteBuffer.allocateDirect(4 * 1024 * 1024)
    val info = MediaCodec.BufferInfo()
    val totalUs = (endUs - startUs).coerceAtLeast(1L)

    try {
      for (seg in segments) {
        val file = File(segmentsDir, seg.fileName)
        val video: TrackReader
        val audio: TrackReader
        try {
          video = TrackReader(file, "video/")
          audio = TrackReader(file, "audio/")
        } catch (e: Exception) {
          // Um segmento estragado (ex.: o último, numa paragem abrupta) não estraga o resto.
          Log.w(TAG, "Segmento ilegível ignorado: ${seg.fileName}", e)
          continue
        }
        try {
          val vFormat = video.format ?: continue
          if (!started) {
            outVideo = muxer.addTrack(vFormat)
            audio.format?.let { outAudio = muxer.addTrack(it) }
            muxer.start()
            started = true
          }

          // Base de tempo do ficheiro: o primeiro frame de vídeo corresponde a seg.startUs.
          video.extractor.seekTo(0, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
          val fileBaseUs = video.extractor.sampleTime.coerceAtLeast(0L)
          fun toRec(localUs: Long) = seg.startUs + (localUs - fileBaseUs)
          fun toLocal(recUs: Long) = fileBaseUs + (recUs - seg.startUs)

          if (clipStartUs < 0) {
            video.extractor.seekTo(toLocal(startUs).coerceAtLeast(0L), MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
            clipStartUs = toRec(video.extractor.sampleTime.coerceAtLeast(fileBaseUs))
          }
          if (audio.format != null) {
            audio.extractor.seekTo(toLocal(clipStartUs).coerceAtLeast(0L), MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
          }

          var videoDone = false
          var audioDone = audio.format == null || outAudio < 0
          while (!videoDone || !audioDone) {
            val vTime = if (videoDone) Long.MAX_VALUE else video.extractor.sampleTime
            val aTime = if (audioDone) Long.MAX_VALUE else audio.extractor.sampleTime
            if (vTime < 0) { videoDone = true; continue }
            if (aTime < 0) { audioDone = true; continue }

            // Intercala por tempo (ambos na mesma base do ficheiro).
            val useVideo = !videoDone && (audioDone || vTime <= aTime)
            val reader = if (useVideo) video else audio
            val recUs = toRec(if (useVideo) vTime else aTime)

            if (recUs > endUs) {
              if (useVideo) videoDone = true else audioDone = true
              continue
            }

            val size = reader.extractor.sampleSize
            if (size > buffer.capacity()) buffer = ByteBuffer.allocateDirect((size * 1.5).toInt())
            buffer.clear()
            val read = reader.extractor.readSampleData(buffer, 0)
            val sampleFlags = reader.extractor.sampleFlags
            reader.extractor.advance()
            if (read <= 0 || recUs < clipStartUs) continue

            val outUs = recUs - clipStartUs
            if (useVideo) {
              if (outUs <= lastVideoOutUs) continue
              lastVideoOutUs = outUs
              videoSamples++
            } else {
              if (outUs <= lastAudioOutUs) continue
              lastAudioOutUs = outUs
            }
            val flags = if (sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
            info.set(0, read, outUs, flags)
            muxer.writeSampleData(if (useVideo) outVideo else outAudio, buffer, info)

            if (onProgress != null && useVideo && videoSamples % 30 == 0) {
              onProgress(((recUs - startUs).toFloat() / totalUs).coerceIn(0f, 1f))
            }
          }
        } finally {
          video.release()
          audio.release()
        }
      }

      if (!started || videoSamples == 0) throw IllegalStateException("O clip ficou vazio.")
      muxer.stop()
    } catch (e: Exception) {
      try { muxer.release() } catch (_: Exception) {}
      tmp.delete()
      throw e
    }
    muxer.release()

    if (!tmp.renameTo(output)) {
      tmp.copyTo(output, overwrite = true)
      tmp.delete()
    }
    onProgress?.invoke(1f)
    return Result(clipStartUs, clipStartUs + lastVideoOutUs + SegmentMuxer.FRAME_US, output.length())
  }
}
