package pt.clipsjogo.engine.media

import android.graphics.Bitmap
import android.graphics.SurfaceTexture
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLUtils
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * "Cópia leve" de um clip para ver no tablet: vídeo reduzido (até 720p, ~2,5 Mbps),
 * som copiado tal como está. Descodifica → desenha (OpenGL) → codifica em H.264.
 * O clip original não é alterado.
 */
object LightTranscoder {
  private const val MIME = MediaFormat.MIMETYPE_VIDEO_AVC
  private const val TIMEOUT_US = 10_000L

  /** Paragem com desenho: a imagem em [atUs] fica parada [LightTranscoder.Options.freezeUs] com [overlay] por cima. */
  class Freeze(val atUs: Long, val overlay: Bitmap?)

  class Options(
    val maxHeight: Int = 720,
    val bitrate: Int = 2_500_000,
    /** Corte (tempos do ficheiro original). */
    val startUs: Long = 0,
    val endUs: Long = Long.MAX_VALUE,
    val freezes: List<Freeze> = emptyList(),
    val freezeUs: Long = 3_000_000,
    val onProgress: ((Float) -> Unit)? = null,
  )

  fun transcode(src: File, dst: File, maxHeight: Int = 720, bitrate: Int = 2_500_000) =
    export(src, dst, Options(maxHeight = maxHeight, bitrate = bitrate))

  /** Converte [src] em [dst] (via ficheiro temporário) com as opções dadas. */
  fun export(src: File, dst: File, options: Options) {
    val tmp = File(dst.path + ".tmp")
    tmp.delete()
    try {
      run(src, tmp, options)
      if (!tmp.renameTo(dst)) throw IOException("Não foi possível guardar o vídeo.")
    } finally {
      tmp.delete()
    }
  }

  private fun findTrack(ex: MediaExtractor, prefix: String): Int {
    for (i in 0 until ex.trackCount) {
      if (ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith(prefix) == true) return i
    }
    return -1
  }

  private fun even(v: Int) = (v / 2) * 2

  private const val FRAME_US = 33_333L

  private fun run(src: File, out: File, opt: Options) {
    val videoEx = MediaExtractor().apply { setDataSource(src.path) }
    val vTrack = findTrack(videoEx, "video/")
    if (vTrack < 0) { videoEx.release(); throw IOException("Clip sem vídeo.") }
    videoEx.selectTrack(vTrack)
    val inFormat = videoEx.getTrackFormat(vTrack)
    val inW = inFormat.getInteger(MediaFormat.KEY_WIDTH)
    val inH = inFormat.getInteger(MediaFormat.KEY_HEIGHT)
    val rotation = if (inFormat.containsKey("rotation-degrees")) inFormat.getInteger("rotation-degrees") else 0
    val durationUs = if (inFormat.containsKey(MediaFormat.KEY_DURATION)) inFormat.getLong(MediaFormat.KEY_DURATION) else 60_000_000L
    val startUs = opt.startUs.coerceAtLeast(0)
    val endUs = minOf(opt.endUs, durationUs + 1_000_000)
    val freezes = opt.freezes.filter { it.atUs in startUs..endUs }.sortedBy { it.atUs }
    if (startUs > 0) videoEx.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

    // Mantém a proporção; o lado menor fica no máximo em maxHeight.
    val scale = minOf(1.0, opt.maxHeight.toDouble() / minOf(inW, inH))
    val outW = even((inW * scale).toInt())
    val outH = even((inH * scale).toInt())

    val audioEx = MediaExtractor().apply { setDataSource(src.path) }
    val aTrack = findTrack(audioEx, "audio/")
    if (aTrack >= 0) {
      audioEx.selectTrack(aTrack)
      if (startUs > 0) audioEx.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
    }

    val muxer = MediaMuxer(out.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    if (rotation != 0) muxer.setOrientationHint(rotation)

    val encFormat = MediaFormat.createVideoFormat(MIME, outW, outH).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, opt.bitrate)
      setInteger(MediaFormat.KEY_FRAME_RATE, 30)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    val encoder = MediaCodec.createEncoderByType(MIME)
    var decoder: MediaCodec? = null
    var input: CodecInputSurface? = null
    var output: DecoderOutputSurface? = null
    var muxerStarted = false
    try {
      encoder.configure(encFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      input = CodecInputSurface(encoder.createInputSurface())
      input.makeCurrent()
      encoder.start()
      val outS = DecoderOutputSurface().also { output = it }
      val inS = input
      decoder = MediaCodec.createDecoderByType(inFormat.getString(MediaFormat.KEY_MIME)!!)
      decoder.configure(inFormat, outS.surface, null, 0)
      decoder.start()

      var videoOutTrack = -1
      var audioOutTrack = -1
      val info = MediaCodec.BufferInfo()
      val encInfo = MediaCodec.BufferInfo()
      var inputDone = false
      var decoderDone = false
      var encoderDone = false
      var frozenUs = 0L
      var nextFreeze = 0
      var lastOutPts = -1L

      fun drainEncoder() {
        while (true) {
          val idx = encoder.dequeueOutputBuffer(encInfo, if (decoderDone) TIMEOUT_US else 0)
          when {
            idx == MediaCodec.INFO_TRY_AGAIN_LATER -> return
            idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              videoOutTrack = muxer.addTrack(encoder.outputFormat)
              if (aTrack >= 0) audioOutTrack = muxer.addTrack(audioEx.getTrackFormat(aTrack))
              muxer.start()
              muxerStarted = true
            }
            idx >= 0 -> {
              val data = encoder.getOutputBuffer(idx)!!
              if (encInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) encInfo.size = 0
              if (encInfo.size > 0 && muxerStarted) {
                data.position(encInfo.offset)
                data.limit(encInfo.offset + encInfo.size)
                muxer.writeSampleData(videoOutTrack, data, encInfo)
              }
              encoder.releaseOutputBuffer(idx, false)
              if (encInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                encoderDone = true
                return
              }
            }
          }
        }
      }

      fun emitFrame(outPts: Long, overlay: Bitmap?) {
        outS.drawImage()
        if (overlay != null) outS.drawOverlay(overlay)
        inS.setPresentationTime(outPts * 1000)
        inS.swapBuffers()
        lastOutPts = outPts
        drainEncoder()
      }

      // Proteção: se algo encravar, desiste.
      val deadline = System.currentTimeMillis() + maxOf(60_000L, (durationUs + freezes.size * opt.freezeUs) / 1000 * 4)
      while (!encoderDone) {
        if (System.currentTimeMillis() > deadline) throw IOException("A conversão do vídeo demorou demasiado.")
        // 1) amostras do ficheiro → descodificador (até ao fim do corte)
        if (!inputDone) {
          val idx = decoder.dequeueInputBuffer(TIMEOUT_US)
          if (idx >= 0) {
            val buf = decoder.getInputBuffer(idx)!!
            val size = videoEx.readSampleData(buf, 0)
            if (size < 0 || videoEx.sampleTime > endUs + 200_000) {
              decoder.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              decoder.queueInputBuffer(idx, 0, size, videoEx.sampleTime, 0)
              videoEx.advance()
            }
          }
        }

        // 2) codificador → ficheiro
        drainEncoder()

        // 3) descodificador → OpenGL → codificador
        if (!decoderDone) {
          val idx = decoder.dequeueOutputBuffer(info, TIMEOUT_US)
          if (idx >= 0) {
            val ptsUs = info.presentationTimeUs
            val eos = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            val inRange = info.size > 0 && ptsUs >= startUs && ptsUs <= endUs
            decoder.releaseOutputBuffer(idx, inRange)
            if (inRange && outS.awaitNewImage()) {
              val outPts = ptsUs - startUs + frozenUs
              if (outPts > lastOutPts) emitFrame(outPts, null)
              // Paragens com desenho neste instante: a mesma imagem repetida, com o desenho por cima.
              while (nextFreeze < freezes.size && freezes[nextFreeze].atUs <= ptsUs) {
                val f = freezes[nextFreeze++]
                val frames = (opt.freezeUs / FRAME_US).toInt()
                for (k in 1..frames) emitFrame(outPts + k * FRAME_US, f.overlay)
                frozenUs += frames * FRAME_US
              }
              opt.onProgress?.invoke(((ptsUs - startUs).toFloat() / maxOf(1L, minOf(endUs, durationUs) - startUs)).coerceIn(0f, 1f))
            }
            if (eos || ptsUs > endUs) {
              encoder.signalEndOfInputStream()
              decoderDone = true
            }
          }
        }
      }

      // Som: copiado sem alterações, dentro do corte e desviado pelas paragens (fica em silêncio durante elas).
      if (audioOutTrack >= 0 && muxerStarted) {
        val buf = ByteBuffer.allocate(1 shl 20)
        val ai = MediaCodec.BufferInfo()
        while (true) {
          val size = audioEx.readSampleData(buf, 0)
          if (size < 0) break
          val t = audioEx.sampleTime
          if (t > endUs) break
          if (t >= startUs) {
            val shift = freezes.count { it.atUs <= t } * ((opt.freezeUs / FRAME_US) * FRAME_US)
            val flags = if (audioEx.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
            ai.set(0, size, t - startUs + shift, flags)
            muxer.writeSampleData(audioOutTrack, buf, ai)
          }
          audioEx.advance()
        }
      }
      if (!muxerStarted) throw IOException("O codificador não produziu vídeo.")
      opt.onProgress?.invoke(1f)
    } finally {
      try { decoder?.stop() } catch (_: Exception) {}
      try { decoder?.release() } catch (_: Exception) {}
      try { encoder.stop() } catch (_: Exception) {}
      try { encoder.release() } catch (_: Exception) {}
      output?.release()
      input?.release()
      try { if (muxerStarted) muxer.stop() } catch (_: Exception) {}
      try { muxer.release() } catch (_: Exception) {}
      videoEx.release()
      audioEx.release()
    }
  }

  /** Superfície de entrada do codificador, com contexto EGL próprio. */
  private class CodecInputSurface(private val surface: Surface) {
    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var context: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    init {
      display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
      val version = IntArray(2)
      if (!EGL14.eglInitialize(display, version, 0, version, 1)) throw IOException("EGL indisponível.")
      val attribs = intArrayOf(
        EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
        EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
        EGL_RECORDABLE_ANDROID, 1,
        EGL14.EGL_NONE
      )
      val configs = arrayOfNulls<EGLConfig>(1)
      val num = IntArray(1)
      EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, num, 0)
      if (num[0] < 1) throw IOException("Configuração EGL indisponível.")
      context = EGL14.eglCreateContext(
        display, configs[0], EGL14.EGL_NO_CONTEXT,
        intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0
      )
      eglSurface = EGL14.eglCreateWindowSurface(display, configs[0], surface, intArrayOf(EGL14.EGL_NONE), 0)
      if (eglSurface == EGL14.EGL_NO_SURFACE) throw IOException("Superfície EGL indisponível.")
    }

    fun makeCurrent() {
      if (!EGL14.eglMakeCurrent(display, eglSurface, eglSurface, context)) throw IOException("eglMakeCurrent falhou.")
    }

    fun setPresentationTime(ns: Long) {
      EGLExt.eglPresentationTimeANDROID(display, eglSurface, ns)
    }

    fun swapBuffers() {
      EGL14.eglSwapBuffers(display, eglSurface)
    }

    fun release() {
      if (display != EGL14.EGL_NO_DISPLAY) {
        EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
        EGL14.eglDestroySurface(display, eglSurface)
        EGL14.eglDestroyContext(display, context)
        EGL14.eglReleaseThread()
        EGL14.eglTerminate(display)
      }
      surface.release()
      display = EGL14.EGL_NO_DISPLAY
    }

    companion object {
      const val EGL_RECORDABLE_ANDROID = 0x3142
    }
  }

  /** Recebe as imagens do descodificador numa textura OpenGL e desenha-as. */
  private class DecoderOutputSurface : SurfaceTexture.OnFrameAvailableListener {
    private val callbackThread = HandlerThread("leve-frames").apply { start() }
    private val lock = Object()
    private var frameAvailable = false
    private val textureId: Int
    private val surfaceTexture: SurfaceTexture
    val surface: Surface
    private val program: Int
    private val stMatrix = FloatArray(16)
    private val vertices: FloatBuffer

    init {
      val tex = IntArray(1)
      GLES20.glGenTextures(1, tex, 0)
      textureId = tex[0]
      GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
      surfaceTexture = SurfaceTexture(textureId)
      surfaceTexture.setOnFrameAvailableListener(this, Handler(callbackThread.looper))
      surface = Surface(surfaceTexture)
      program = buildProgram()
      // x, y, u, v (quadrado que ocupa a imagem toda)
      val data = floatArrayOf(-1f, -1f, 0f, 0f, 1f, -1f, 1f, 0f, -1f, 1f, 0f, 1f, 1f, 1f, 1f, 1f)
      vertices = ByteBuffer.allocateDirect(data.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
        put(data); position(0)
      }
    }

    override fun onFrameAvailable(st: SurfaceTexture) {
      synchronized(lock) {
        frameAvailable = true
        lock.notifyAll()
      }
    }

    /** Espera pela imagem seguinte (false se não chegou a tempo). */
    fun awaitNewImage(): Boolean {
      synchronized(lock) {
        val deadline = System.currentTimeMillis() + 2500
        while (!frameAvailable) {
          val left = deadline - System.currentTimeMillis()
          if (left <= 0) return false
          lock.wait(left)
        }
        frameAvailable = false
      }
      surfaceTexture.updateTexImage()
      return true
    }

    fun drawImage() {
      surfaceTexture.getTransformMatrix(stMatrix)
      GLES20.glClearColor(0f, 0f, 0f, 1f)
      GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
      GLES20.glUseProgram(program)
      GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
      GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
      val aPos = GLES20.glGetAttribLocation(program, "aPosition")
      val aTex = GLES20.glGetAttribLocation(program, "aTexCoord")
      vertices.position(0)
      GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 16, vertices)
      GLES20.glEnableVertexAttribArray(aPos)
      vertices.position(2)
      GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 16, vertices)
      GLES20.glEnableVertexAttribArray(aTex)
      GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(program, "uSTMatrix"), 1, false, stMatrix, 0)
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    }

    // ---- desenho por cima (bitmap com transparência)
    private var overlayProgram = 0
    private var overlayTexture = 0
    private var overlayBitmap: Bitmap? = null
    private val overlayVertices: FloatBuffer = run {
      // x, y, u, v — a linha 0 do bitmap fica em cima
      val data = floatArrayOf(-1f, -1f, 0f, 1f, 1f, -1f, 1f, 1f, -1f, 1f, 0f, 0f, 1f, 1f, 1f, 0f)
      ByteBuffer.allocateDirect(data.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(data); position(0) }
    }

    fun drawOverlay(bitmap: Bitmap) {
      if (overlayProgram == 0) overlayProgram = link(OVERLAY_VS, OVERLAY_FS)
      if (overlayBitmap !== bitmap) {
        if (overlayTexture == 0) {
          val t = IntArray(1)
          GLES20.glGenTextures(1, t, 0)
          overlayTexture = t[0]
        }
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, overlayTexture)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
        overlayBitmap = bitmap
      }
      GLES20.glEnable(GLES20.GL_BLEND)
      // Os bitmaps do Android têm a transparência pré-multiplicada.
      GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA)
      GLES20.glUseProgram(overlayProgram)
      GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, overlayTexture)
      val aPos = GLES20.glGetAttribLocation(overlayProgram, "aPosition")
      val aTex = GLES20.glGetAttribLocation(overlayProgram, "aTexCoord")
      overlayVertices.position(0)
      GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 16, overlayVertices)
      GLES20.glEnableVertexAttribArray(aPos)
      overlayVertices.position(2)
      GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 16, overlayVertices)
      GLES20.glEnableVertexAttribArray(aTex)
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
      GLES20.glDisable(GLES20.GL_BLEND)
    }

    fun release() {
      try { if (overlayProgram != 0) GLES20.glDeleteProgram(overlayProgram) } catch (_: Exception) {}
      try { if (overlayTexture != 0) GLES20.glDeleteTextures(1, intArrayOf(overlayTexture), 0) } catch (_: Exception) {}
      try { GLES20.glDeleteProgram(program) } catch (_: Exception) {}
      surface.release()
      surfaceTexture.release()
      callbackThread.quitSafely()
    }

    private fun buildProgram(): Int {
      val vs = """
        attribute vec4 aPosition;
        attribute vec4 aTexCoord;
        uniform mat4 uSTMatrix;
        varying vec2 vTexCoord;
        void main() {
          gl_Position = aPosition;
          vTexCoord = (uSTMatrix * aTexCoord).xy;
        }
      """.trimIndent()
      val fs = """
        #extension GL_OES_EGL_image_external : require
        precision mediump float;
        varying vec2 vTexCoord;
        uniform samplerExternalOES sTexture;
        void main() {
          gl_FragColor = texture2D(sTexture, vTexCoord);
        }
      """.trimIndent()
      return link(vs, fs)
    }

    private fun link(vs: String, fs: String): Int {
      fun shader(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        val ok = IntArray(1)
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) throw IOException("Shader: " + GLES20.glGetShaderInfoLog(s))
        return s
      }
      val p = GLES20.glCreateProgram()
      GLES20.glAttachShader(p, shader(GLES20.GL_VERTEX_SHADER, vs))
      GLES20.glAttachShader(p, shader(GLES20.GL_FRAGMENT_SHADER, fs))
      GLES20.glLinkProgram(p)
      val ok = IntArray(1)
      GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
      if (ok[0] == 0) throw IOException("Programa GL: " + GLES20.glGetProgramInfoLog(p))
      return p
    }

    companion object {
      const val OVERLAY_VS = """
        attribute vec4 aPosition;
        attribute vec2 aTexCoord;
        varying vec2 vTexCoord;
        void main() {
          gl_Position = aPosition;
          vTexCoord = aTexCoord;
        }
      """
      const val OVERLAY_FS = """
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D sTexture;
        void main() {
          gl_FragColor = texture2D(sTexture, vTexCoord);
        }
      """
    }
  }
}
