package pt.clipsjogo.engine.media

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTimestamp
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import java.nio.ByteBuffer

data class VideoConfig(val width: Int, val height: Int, val fps: Int, val bitrate: Int) {
  companion object {
    fun forQuality(quality: String) = when (quality) {
      "720p" -> VideoConfig(1280, 720, 30, 5_000_000)
      else -> VideoConfig(1920, 1080, 30, 10_000_000)
    }
  }
}

/**
 * Encoder H.264 por hardware alimentado diretamente pela câmara (Surface).
 * Um keyframe por segundo, para que os cortes sejam precisos.
 *
 * O encoder arranca com a pré-visualização e fica sempre ligado à câmara:
 * começar a gravar é só passar a guardar o que ele produz. Assim a sessão da
 * câmara nunca é reconfigurada ao carregar em gravar (o que reiniciava o foco
 * e a exposição e fazia a imagem "saltar" nos primeiros segundos).
 */
class VideoEncoder(
  val config: VideoConfig,
  handler: Handler,
  private val onOutput: (ByteBuffer, MediaCodec.BufferInfo) -> Unit,
  private val onError: (String) -> Unit
) {
  private val codec: MediaCodec
  val inputSurface: Surface

  /** Formato de saída (SPS/PPS). Só lido/escrito na thread do encoder. */
  var outputFormat: MediaFormat? = null
    private set

  init {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, config.width, config.height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, config.bitrate)
      setInteger(MediaFormat.KEY_FRAME_RATE, config.fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
    }
    val name = MediaCodecList(MediaCodecList.REGULAR_CODECS).findEncoderForFormat(format)
      ?: throw IllegalStateException("Este telemóvel não suporta gravar em ${config.width}x${config.height}.")
    codec = MediaCodec.createByCodecName(name)
    codec.setCallback(object : MediaCodec.Callback() {
      override fun onInputBufferAvailable(codec: MediaCodec, index: Int) = Unit

      override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
        try {
          val buffer = codec.getOutputBuffer(index)
          if (buffer != null && info.size > 0) onOutput(buffer, info)
          codec.releaseOutputBuffer(index, false)
        } catch (e: Exception) {
          Log.e(TAG, "Erro a escrever vídeo", e)
          onError("Erro a escrever o vídeo: ${e.message}")
        }
      }

      override fun onError(codec: MediaCodec, e: MediaCodec.CodecException) {
        Log.e(TAG, "Erro no encoder de vídeo", e)
        onError("Erro no encoder de vídeo: ${e.diagnosticInfo}")
      }

      override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
        outputFormat = format
      }
    }, handler)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    inputSurface = codec.createInputSurface()
    codec.start()
  }

  /** Pede um keyframe já (para a gravação começar sem esperar até 1 s). */
  fun requestKeyFrame() {
    try {
      codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0) })
    } catch (e: Exception) {
      Log.w(TAG, "Pedido de keyframe falhou", e)
    }
  }

  fun release() {
    try { codec.stop() } catch (_: Exception) {}
    codec.release()
    inputSurface.release()
  }

  companion object {
    private const val TAG = "ClipEngine/Video"

    /** Confirma que existe um encoder para esta resolução. */
    fun isSupported(config: VideoConfig): Boolean {
      val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, config.width, config.height).apply {
        setInteger(MediaFormat.KEY_FRAME_RATE, config.fps)
      }
      return MediaCodecList(MediaCodecList.REGULAR_CODECS).findEncoderForFormat(format) != null
    }
  }
}

/**
 * Captura o microfone e codifica em AAC numa thread própria.
 * Os timestamps vêm do relógio do áudio (AudioTimestamp, em BOOTTIME), para
 * ficarem alinhados com o vídeo da câmara ao longo de jogos inteiros.
 */
class AudioEncoder(
  private val deliver: (ByteArray, Long) -> Unit,
  private val onFormat: (MediaFormat) -> Unit,
  private val onError: (String) -> Unit
) {
  private val sampleRate = 48_000
  private val bytesPerFrame = 2 // PCM 16 bits, mono
  private var record: AudioRecord? = null
  private var codec: MediaCodec? = null
  private var thread: Thread? = null
  @Volatile private var running = false

  @SuppressLint("MissingPermission")
  fun start() {
    val minBuf = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val rec = AudioRecord(
      MediaRecorder.AudioSource.CAMCORDER, sampleRate,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
      maxOf(minBuf * 4, 16 * 1024)
    )
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      throw IllegalStateException("Não foi possível abrir o microfone.")
    }
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, 1).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
      setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024)
    }
    val c = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    c.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    c.start()
    rec.startRecording()
    record = rec
    codec = c
    running = true
    thread = Thread({ loop(rec, c) }, "ClipEngine-audio").apply {
      priority = Thread.MAX_PRIORITY
      start()
    }
  }

  fun stop() {
    running = false
    thread?.join(2_000)
    thread = null
    try { record?.stop() } catch (_: Exception) {}
    record?.release()
    record = null
    try { codec?.stop() } catch (_: Exception) {}
    codec?.release()
    codec = null
  }

  private fun loop(rec: AudioRecord, c: MediaCodec) {
    val info = MediaCodec.BufferInfo()
    val ts = AudioTimestamp()
    var framesRead = 0L
    var anchorFrame = -1L
    var anchorBootNs = 0L
    var lastAnchorUpdateFrame = -1L
    var lastPtsUs = -1L

    try {
      while (running) {
        val inIndex = c.dequeueInputBuffer(10_000)
        if (inIndex >= 0) {
          val inBuf: ByteBuffer = c.getInputBuffer(inIndex)!!
          inBuf.clear()
          // ~43 ms por leitura (2048 amostras), múltiplo do tamanho de frame.
          val n = rec.read(inBuf, minOf(inBuf.capacity(), 4096) and 1.inv())
          if (n > 0) {
            // Atualiza a âncora do relógio de áudio a cada ~5 s (corrige deriva).
            if (anchorFrame < 0 || framesRead - lastAnchorUpdateFrame > sampleRate * 5) {
              if (rec.getTimestamp(ts, AudioTimestamp.TIMEBASE_BOOTTIME) == AudioRecord.SUCCESS) {
                anchorFrame = ts.framePosition
                anchorBootNs = ts.nanoTime
              } else if (anchorFrame < 0) {
                // Sem timestamp do hardware: estima a partir de agora.
                anchorFrame = framesRead + n / bytesPerFrame
                anchorBootNs = SystemClock.elapsedRealtimeNanos()
              }
              lastAnchorUpdateFrame = framesRead
            }
            var ptsUs = (anchorBootNs + (framesRead - anchorFrame) * 1_000_000_000L / sampleRate) / 1000
            if (ptsUs <= lastPtsUs) ptsUs = lastPtsUs + 1
            lastPtsUs = ptsUs
            c.queueInputBuffer(inIndex, 0, n, ptsUs, 0)
            framesRead += n / bytesPerFrame
          } else {
            c.queueInputBuffer(inIndex, 0, 0, maxOf(0L, lastPtsUs), 0)
          }
        }
        drain(c, info)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Erro no áudio", e)
      if (running) onError("Erro no microfone: ${e.message}")
    }
  }

  private fun drain(c: MediaCodec, info: MediaCodec.BufferInfo) {
    while (true) {
      val outIndex = c.dequeueOutputBuffer(info, 0)
      when {
        outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> onFormat(c.outputFormat)
        outIndex >= 0 -> {
          val buf = c.getOutputBuffer(outIndex)
          if (buf != null && info.size > 0 && info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0) {
            val data = ByteArray(info.size)
            buf.position(info.offset)
            buf.get(data, 0, info.size)
            deliver(data, info.presentationTimeUs)
          }
          c.releaseOutputBuffer(outIndex, false)
        }
        else -> return
      }
    }
  }

  companion object {
    private const val TAG = "ClipEngine/Audio"
  }
}
