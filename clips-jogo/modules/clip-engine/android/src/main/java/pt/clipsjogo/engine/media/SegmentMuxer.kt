package pt.clipsjogo.engine.media

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import pt.clipsjogo.engine.core.RecordingClock
import pt.clipsjogo.engine.core.Segment
import java.io.File
import java.nio.ByteBuffer

/**
 * Recebe as amostras já codificadas (vídeo H.264 + áudio AAC) e escreve-as em
 * segmentos MP4 curtos e independentes.
 *
 * O encoder nunca para: a troca de ficheiro acontece aqui, a jusante, sempre
 * num keyframe de vídeo. Por isso não há frames perdidos entre segmentos e cada
 * segmento pode ser lido (e cortado) logo que fecha.
 *
 * Como o áudio pode chegar uns milissegundos depois do vídeo, o segmento
 * anterior fica aberto por instantes ("a fechar") para receber o áudio que
 * ainda lhe pertence — assim não há micro-cortes de som entre segmentos.
 *
 * Todos os métodos têm de ser chamados na mesma thread (a thread do encoder).
 */
class SegmentMuxer(
  private val segmentsDir: File,
  private val segmentDurationUs: Long,
  private val rotationDegrees: Int,
  audioEnabled: Boolean,
  private val clock: RecordingClock,
  private val onSegmentClosed: (Segment) -> Unit
) {
  private inner class OpenSegment(val index: Int, val startUs: Long) {
    val file = File(segmentsDir, segmentFileName(index))
    val muxer = MediaMuxer(file.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val videoTrack: Int
    val audioTrack: Int
    var endUs = -1L
    var lastAudioRecUs = -1L

    init {
      muxer.setOrientationHint(rotationDegrees)
      videoTrack = muxer.addTrack(videoFormat!!)
      audioTrack = if (audioActive) muxer.addTrack(audioFormat!!) else -1
      muxer.start()
    }

    fun close() {
      try {
        muxer.stop()
      } catch (e: IllegalStateException) {
        Log.e(TAG, "Falha ao fechar segmento $index", e)
      } finally {
        muxer.release()
      }
      onSegmentClosed(Segment(index, file.name, startUs, endUs, file.length()))
    }
  }

  /**
   * Se o microfone deixar de entregar áudio, os segmentos seguintes passam a
   * ser só vídeo (um MP4 com uma faixa de áudio vazia pode ficar ilegível).
   */
  private var audioActive = audioEnabled
  private var lastAudioSeenRecUs = 0L
  private var framesWaitingForAudio = 0

  private var videoFormat: MediaFormat? = null
  private var audioFormat: MediaFormat? = null

  private var current: OpenSegment? = null
  private var closing: OpenSegment? = null
  private var nextIndex = 0
  private var lastVideoRecUs = -1L
  private var finished = false

  private val bufferInfo = MediaCodec.BufferInfo()
  private var audioBuffer: ByteBuffer = ByteBuffer.allocateDirect(64 * 1024)

  /** Tempo de gravação já escrito (último frame de vídeo). */
  val writtenUntilUs: Long get() = maxOf(0L, lastVideoRecUs)

  val hasVideoFormat: Boolean get() = videoFormat != null

  fun onVideoFormat(format: MediaFormat) {
    videoFormat = format
  }

  fun onAudioFormat(format: MediaFormat) {
    audioFormat = format
  }

  private val ready: Boolean
    get() = videoFormat != null && (!audioActive || audioFormat != null)

  fun writeVideo(buffer: ByteBuffer, info: MediaCodec.BufferInfo, bootUs: Long) {
    if (finished) return
    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) return
    if (info.size <= 0) return
    if (!ready) {
      // O microfone abriu mas nunca entregou áudio: não ficamos sem vídeo por causa disso.
      if (videoFormat != null && ++framesWaitingForAudio > 90) {
        Log.w(TAG, "O áudio não arrancou: a gravar só vídeo.")
        audioActive = false
      }
      return
    }

    val isKey = info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0
    if (!clock.started) {
      if (!isKey) return
      clock.start(bootUs)
      current = OpenSegment(nextIndex++, 0L)
    }
    val recUs = clock.toRecUs(bootUs)
    if (recUs <= lastVideoRecUs) {
      Log.w(TAG, "Frame de vídeo fora de ordem ignorado ($recUs <= $lastVideoRecUs)")
      return
    }

    var seg = current!!
    if (isKey && recUs - seg.startUs >= segmentDurationUs) {
      // Se ainda havia um segmento à espera de áudio, fecha-o já.
      closing?.close()
      if (audioActive && recUs - lastAudioSeenRecUs > AUDIO_TIMEOUT_US) {
        Log.w(TAG, "Sem áudio há mais de ${AUDIO_TIMEOUT_US / 1_000_000} s: a continuar só com vídeo.")
        audioActive = false
      }
      seg.endUs = recUs
      closing = seg
      seg = OpenSegment(nextIndex++, recUs)
      current = seg
    }

    bufferInfo.set(info.offset, info.size, recUs, if (isKey) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
    buffer.position(info.offset)
    buffer.limit(info.offset + info.size)
    seg.muxer.writeSampleData(seg.videoTrack, buffer, bufferInfo)
    lastVideoRecUs = recUs

    // Rede de segurança: se o áudio parou (ex.: microfone ocupado), não esperamos para sempre.
    closing?.let {
      if (it.audioTrack < 0 || recUs - it.endUs > CLOSE_GRACE_US) {
        it.close()
        closing = null
      }
    }
  }

  fun writeAudio(data: ByteArray, bootUs: Long) {
    if (finished || !audioActive) return
    if (!clock.started) return
    val recUs = clock.toRecUs(bootUs)
    if (recUs < 0) return
    lastAudioSeenRecUs = recUs

    val pending = closing
    val target = when {
      pending != null && recUs < pending.endUs -> pending
      else -> current ?: return
    }
    if (target.audioTrack < 0 || recUs < target.startUs || recUs <= target.lastAudioRecUs) return

    if (audioBuffer.capacity() < data.size) audioBuffer = ByteBuffer.allocateDirect(data.size * 2)
    audioBuffer.clear()
    audioBuffer.put(data)
    audioBuffer.flip()
    bufferInfo.set(0, data.size, recUs, MediaCodec.BUFFER_FLAG_KEY_FRAME)
    target.muxer.writeSampleData(target.audioTrack, audioBuffer, bufferInfo)
    target.lastAudioRecUs = recUs

    // O áudio já passou o fim do segmento anterior: pode fechá-lo.
    if (pending != null && recUs >= pending.endUs) {
      pending.close()
      closing = null
    }
  }

  /** Fecha os segmentos abertos. Devolve o fim real da gravação (µs). */
  fun finish(): Long {
    if (finished) return writtenUntilUs
    finished = true
    closing?.close()
    closing = null
    val end = lastVideoRecUs + FRAME_US
    current?.let {
      it.endUs = end
      it.close()
    }
    current = null
    return maxOf(0L, end)
  }

  companion object {
    private const val TAG = "ClipEngine/Muxer"
    private const val CLOSE_GRACE_US = 1_000_000L
    private const val AUDIO_TIMEOUT_US = 3_000_000L
    const val FRAME_US = 33_333L

    fun segmentFileName(index: Int) = String.format(java.util.Locale.US, "seg_%05d.mp4", index)
  }
}
