package pt.clipsjogo.engine.media

import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile

/**
 * Junta os segmentos MP4 da gravação num só ficheiro, sem re-codificar e sem o
 * limite de 4 GB do MediaMuxer (que obrigava a partir o jogo em 2 ou 3 partes).
 *
 * As amostras são copiadas tal como estão (já em formato MP4); a descrição dos
 * codecs (stsd) vem do primeiro segmento. O ficheiro final usa offsets de 64 bits
 * (co64) e um mdat de 64 bits, por isso pode passar dos 4 GB.
 *
 * Não usa nada do Android: é testado no computador com vídeos feitos pelo ffmpeg.
 */
object Mp4Concat {
  /** Um segmento a juntar: o ficheiro e o seu início na linha temporal da gravação (µs). */
  class Input(val file: File, val startUs: Long)

  class Result(val durationUs: Long, val videoSamples: Int, val sizeBytes: Long)

  // ----------------------------------------------------------------- leitura

  private class Box(val type: String, val start: Long, val headerSize: Int, val size: Long) {
    val bodyStart get() = start + headerSize
    val end get() = start + size
  }

  private fun boxes(f: RandomAccessFile, from: Long, to: Long): List<Box> {
    val out = ArrayList<Box>()
    var pos = from
    while (pos + 8 <= to) {
      f.seek(pos)
      var size = f.readInt().toLong() and 0xFFFFFFFFL
      val type = ByteArray(4).also { f.readFully(it) }.toString(Charsets.ISO_8859_1)
      var header = 8
      if (size == 1L) {
        size = f.readLong()
        header = 16
      } else if (size == 0L) {
        size = to - pos
      }
      if (size < header || pos + size > to) throw IOException("MP4 inválido ($type)")
      out.add(Box(type, pos, header, size))
      pos += size
    }
    return out
  }

  private fun child(f: RandomAccessFile, parent: Box, type: String): Box? =
    boxes(f, parent.bodyStart, parent.end).firstOrNull { it.type == type }

  private fun bytesOf(f: RandomAccessFile, b: Box): ByteArray {
    if (b.size > 16_000_000) throw IOException("Caixa demasiado grande (${b.type})")
    f.seek(b.start)
    return ByteArray(b.size.toInt()).also { f.readFully(it) }
  }

  /** Uma faixa de um segmento: tabelas de amostras já resolvidas. */
  private class TrackIn(
    val handler: String,
    val timescale: Int,
    /** Começo da faixa (edit list), na escala da faixa. */
    val startOffset: Long,
    val dts: LongArray,
    val cts: IntArray,
    val sizes: IntArray,
    val offsets: LongArray,
    val sync: BooleanArray,
    val stsd: ByteArray,
    val hdlr: ByteArray,
    val mediaHeader: ByteArray, // vmhd ou smhd
    val dinf: ByteArray?,
    val language: Int,
    val matrix: ByteArray,
    val width: Int,
    val height: Int,
  )

  private fun readTracks(file: File): List<TrackIn> = RandomAccessFile(file, "r").use { f ->
    val top = boxes(f, 0, f.length())
    val moov = top.firstOrNull { it.type == "moov" } ?: throw IOException("Segmento sem moov: ${file.name}")
    val mvhd = child(f, moov, "mvhd") ?: throw IOException("Sem mvhd")
    f.seek(mvhd.bodyStart)
    val mvVersion = f.readUnsignedByte()
    f.skipBytes(3 + if (mvVersion == 1) 16 else 8)
    val movieTimescale = f.readInt()

    boxes(f, moov.bodyStart, moov.end).filter { it.type == "trak" }.map { trak ->
      val tkhd = child(f, trak, "tkhd") ?: throw IOException("Sem tkhd")
      f.seek(tkhd.bodyStart)
      val tkVersion = f.readUnsignedByte()
      f.skipBytes(3 + if (tkVersion == 1) 32 else 20)
      f.skipBytes(8 + 2 + 2 + 2 + 2) // reservado, camada, grupo, volume, reservado
      val matrix = ByteArray(36).also { f.readFully(it) }
      val width = f.readInt()
      val height = f.readInt()

      val mdia = child(f, trak, "mdia") ?: throw IOException("Sem mdia")
      val mdhd = child(f, mdia, "mdhd") ?: throw IOException("Sem mdhd")
      f.seek(mdhd.bodyStart)
      val mdVersion = f.readUnsignedByte()
      f.skipBytes(3 + if (mdVersion == 1) 16 else 8)
      val timescale = f.readInt()
      f.skipBytes(if (mdVersion == 1) 8 else 4)
      val language = f.readUnsignedShort()
      val hdlrBox = child(f, mdia, "hdlr") ?: throw IOException("Sem hdlr")
      f.seek(hdlrBox.bodyStart + 8)
      val handler = ByteArray(4).also { f.readFully(it) }.toString(Charsets.ISO_8859_1)
      val minf = child(f, mdia, "minf") ?: throw IOException("Sem minf")
      val mediaHeader = (child(f, minf, "vmhd") ?: child(f, minf, "smhd") ?: child(f, minf, "nmhd"))
        ?: throw IOException("Sem vmhd/smhd")
      val dinf = child(f, minf, "dinf")
      val stbl = child(f, minf, "stbl") ?: throw IOException("Sem stbl")

      // Edit list: tempo vazio antes da faixa começar, ou corte do início (media_time).
      var startOffset = 0L
      child(f, trak, "edts")?.let { edts ->
        child(f, edts, "elst")?.let { elst ->
          f.seek(elst.bodyStart)
          val v = f.readUnsignedByte()
          f.skipBytes(3)
          val n = f.readInt()
          var emptyMovie = 0L
          for (i in 0 until n) {
            val dur = if (v == 1) f.readLong() else f.readInt().toLong() and 0xFFFFFFFFL
            val mediaTime = if (v == 1) f.readLong() else f.readInt().toLong()
            f.skipBytes(4)
            if (mediaTime == -1L) {
              emptyMovie += dur
            } else {
              startOffset = emptyMovie * timescale / movieTimescale - mediaTime
              break
            }
          }
        }
      }

      // stts → dts
      val stts = child(f, stbl, "stts") ?: throw IOException("Sem stts")
      f.seek(stts.bodyStart + 4)
      val sttsN = f.readInt()
      val counts = IntArray(sttsN)
      val deltas = IntArray(sttsN)
      var total = 0L
      for (i in 0 until sttsN) {
        counts[i] = f.readInt()
        deltas[i] = f.readInt()
        total += counts[i]
      }
      val stsz = child(f, stbl, "stsz") ?: throw IOException("Sem stsz")
      f.seek(stsz.bodyStart + 4)
      val constSize = f.readInt()
      val count = f.readInt()
      val sizes = IntArray(count) { if (constSize != 0) constSize else f.readInt() }
      val dts = LongArray(count)
      run {
        var t = 0L
        var k = 0
        for (i in 0 until sttsN) for (j in 0 until counts[i]) {
          if (k >= count) break
          dts[k++] = t
          t += deltas[i]
        }
      }
      // ctts → diferença entre apresentação e descodificação
      val cts = IntArray(count)
      child(f, stbl, "ctts")?.let { ctts ->
        f.seek(ctts.bodyStart + 4)
        val n = f.readInt()
        var k = 0
        for (i in 0 until n) {
          val c = f.readInt()
          val off = f.readInt()
          for (j in 0 until c) if (k < count) cts[k++] = off
        }
      }
      // stss → keyframes (sem stss: todas são)
      val sync = BooleanArray(count) { true }
      child(f, stbl, "stss")?.let { stss ->
        sync.fill(false)
        f.seek(stss.bodyStart + 4)
        val n = f.readInt()
        for (i in 0 until n) {
          val s = f.readInt() - 1
          if (s in 0 until count) sync[s] = true
        }
      }
      // stco/co64 + stsc → posição de cada amostra no ficheiro
      val chunkOffsets: LongArray = (child(f, stbl, "stco") ?: child(f, stbl, "co64"))?.let { co ->
        f.seek(co.bodyStart + 4)
        val n = f.readInt()
        LongArray(n) { if (co.type == "co64") f.readLong() else f.readInt().toLong() and 0xFFFFFFFFL }
      } ?: throw IOException("Sem stco")
      val stsc = child(f, stbl, "stsc") ?: throw IOException("Sem stsc")
      f.seek(stsc.bodyStart + 4)
      val stscN = f.readInt()
      val firstChunk = IntArray(stscN)
      val perChunk = IntArray(stscN)
      for (i in 0 until stscN) {
        firstChunk[i] = f.readInt()
        perChunk[i] = f.readInt()
        f.skipBytes(4)
      }
      val offsets = LongArray(count)
      run {
        var k = 0
        for (c in chunkOffsets.indices) {
          val chunkNo = c + 1
          var e = 0
          while (e + 1 < stscN && firstChunk[e + 1] <= chunkNo) e++
          var pos = chunkOffsets[c]
          for (j in 0 until (if (stscN > 0) perChunk[e] else 0)) {
            if (k >= count) break
            offsets[k] = pos
            pos += sizes[k]
            k++
          }
        }
        if (k < count) throw IOException("Tabelas incompletas em ${file.name}")
      }

      TrackIn(
        handler = handler,
        timescale = timescale,
        startOffset = startOffset,
        dts = dts,
        cts = cts,
        sizes = sizes,
        offsets = offsets,
        sync = sync,
        stsd = bytesOf(f, child(f, stbl, "stsd") ?: throw IOException("Sem stsd")),
        hdlr = bytesOf(f, hdlrBox),
        mediaHeader = bytesOf(f, mediaHeader),
        dinf = dinf?.let { bytesOf(f, it) },
        language = language,
        matrix = matrix,
        width = width,
        height = height,
      )
    }
  }

  /**
   * Configuração do codec dentro do stsd (avcC/hvcC/esds): é o que tem de ser igual
   * entre segmentos (o resto, ex. a taxa de bits média, pode variar).
   */
  private fun codecConfig(stsd: ByteArray): ByteArray {
    for (name in arrayOf("avcC", "hvcC", "esds")) {
      val t = name.toByteArray(Charsets.ISO_8859_1)
      for (i in 4..stsd.size - 4) {
        if (stsd[i] == t[0] && stsd[i + 1] == t[1] && stsd[i + 2] == t[2] && stsd[i + 3] == t[3]) {
          val size = ((stsd[i - 4].toInt() and 0xFF) shl 24) or ((stsd[i - 3].toInt() and 0xFF) shl 16) or
            ((stsd[i - 2].toInt() and 0xFF) shl 8) or (stsd[i - 1].toInt() and 0xFF)
          if (size >= 8 && i - 4 + size <= stsd.size) {
            val cfg = stsd.copyOfRange(i - 4, i - 4 + size)
            return if (name == "esds") aacSpecificConfig(cfg) else cfg
          }
        }
      }
    }
    return stsd
  }

  /** Do esds só interessa o AudioSpecificConfig (as taxas de bits mudam de segmento para segmento). */
  private fun aacSpecificConfig(esds: ByteArray): ByteArray {
    var i = 12 // tamanho + "esds" + versão/flags
    fun readLen(): Int {
      var len = 0
      for (k in 0 until 4) {
        if (i >= esds.size) return 0
        val b = esds[i++].toInt() and 0xFF
        len = (len shl 7) or (b and 0x7F)
        if (b and 0x80 == 0) break
      }
      return len
    }
    while (i < esds.size) {
      val tag = esds[i++].toInt() and 0xFF
      val len = readLen()
      when (tag) {
        0x03 -> { i += 3 } // ES_ID + flags (sem URL/dependências nos ficheiros do MediaMuxer)
        0x04 -> { i += 13 } // tipo, stream, buffer e taxas de bits
        0x05 -> return esds.copyOfRange(i, minOf(esds.size, i + len))
        else -> i += len
      }
    }
    return esds
  }

  // ----------------------------------------------------------------- escrita

  /** Lista crescente de números (para não guardar centenas de milhares de objetos). */
  private class LongList {
    var data = LongArray(1024)
    var size = 0
    fun add(v: Long) {
      if (size == data.size) data = data.copyOf(size * 2)
      data[size++] = v
    }
    operator fun get(i: Int) = data[i]
  }

  private class IntList {
    var data = IntArray(1024)
    var size = 0
    fun add(v: Int) {
      if (size == data.size) data = data.copyOf(size * 2)
      data[size++] = v
    }
    operator fun get(i: Int) = data[i]
  }

  private class TrackOut(val first: TrackIn, val id: Int) {
    val handler = first.handler
    val timescale = first.timescale
    val dts = LongList()
    val cts = IntList()
    val sizes = IntList()
    val sync = IntList() // números (1..) das amostras keyframe
    val chunkOffsets = LongList()
    val chunkCounts = IntList()
    var lastDts = -1L
    var lastDelta = 1L
    /**
     * Com B-frames o primeiro tempo de descodificação é negativo (a apresentação
     * começa em 0): os tempos são todos avançados deste valor e uma edit list
     * repõe o início em 0, como faz o MediaMuxer.
     */
    var shift = -1L
  }

  /**
   * Junta [inputs] (por ordem) em [output]. O tempo 0 do ficheiro final é o início
   * do primeiro segmento. Segmentos ilegíveis (ex.: o último, numa paragem
   * abrupta) são ignorados, como nos cortes.
   */
  fun concat(inputs: List<Input>, output: File, onProgress: ((Float) -> Unit)? = null): Result {
    require(inputs.isNotEmpty()) { "Sem segmentos." }
    val originUs = inputs.first().startUs
    var video: TrackOut? = null
    var audio: TrackOut? = null
    val tmp = File(output.parentFile, output.name + ".tmp")
    tmp.delete()
    var written = 0L
    val buffer = ByteArray(4 * 1024 * 1024)
    val totalBytes = inputs.sumOf { it.file.length() }.coerceAtLeast(1)
    var doneBytes = 0L
    var result: Result? = null

    FileOutputStream(tmp).use { fos ->
      val out = BufferedOutputStream(fos, 1 shl 20)
      // ftyp
      val ftyp = box("ftyp") {
        writeBytes("isom"); writeInt(512); writeBytes("isom"); writeBytes("iso2"); writeBytes("avc1"); writeBytes("mp41")
      }
      out.write(ftyp)
      // mdat de 64 bits: o tamanho é escrito no fim.
      val mdatStart = ftyp.size.toLong()
      out.write(byteArrayOf(0, 0, 0, 1))
      out.write("mdat".toByteArray(Charsets.ISO_8859_1))
      out.write(ByteArray(8))
      written = mdatStart + 16

      for (input in inputs) {
        val tracks = try {
          readTracks(input.file)
        } catch (e: Exception) {
          doneBytes += input.file.length()
          continue // segmento estragado: segue para o próximo
        }
        val v = tracks.firstOrNull { it.handler == "vide" } ?: continue
        val a = tracks.firstOrNull { it.handler == "soun" }
        if (video == null) video = TrackOut(v, 1)
        if (a != null && audio == null && video!!.dts.size == 0) audio = TrackOut(a, 2)
        if (!codecConfig(video!!.first.stsd).contentEquals(codecConfig(v.stsd))) {
          throw IOException("O formato do vídeo mudou a meio (${input.file.name}).")
        }
        // Base: o primeiro frame de vídeo do segmento corresponde ao início do segmento.
        val vBase = v.startOffset + v.dts[0] + v.cts[0]
        val segOutUs = input.startUs - originUs

        RandomAccessFile(input.file, "r").use { src ->
          fun copy(tin: TrackIn, tout: TrackOut, baseInTrackTs: Double) {
            if (tin.dts.isEmpty()) return
            var chunkStarted = false
            var n = 0
            for (i in tin.dts.indices) {
              // Tempo no ficheiro final, na escala desta faixa.
              val outTs = Math.round(segOutUs * tin.timescale / 1e6 + (tin.startOffset + tin.dts[i]) - baseInTrackTs)
              if (outTs + tin.cts[i] < 0) continue // áudio antes do primeiro frame do jogo
              if (tout.shift < 0) tout.shift = maxOf(0L, -outTs)
              val shifted = outTs + tout.shift
              val d = if (shifted <= tout.lastDts) tout.lastDts + 1 else shifted
              if (tout.lastDts >= 0) tout.lastDelta = d - tout.lastDts
              tout.lastDts = d
              tout.dts.add(d)
              tout.cts.add(tin.cts[i])
              tout.sizes.add(tin.sizes[i])
              if (tin.sync[i]) tout.sync.add(tout.sizes.size)
              if (!chunkStarted) {
                tout.chunkOffsets.add(written)
                chunkStarted = true
              }
              n++
              var left = tin.sizes[i]
              src.seek(tin.offsets[i])
              while (left > 0) {
                val r = src.read(buffer, 0, minOf(left, buffer.size))
                if (r < 0) throw IOException("Segmento cortado: ${input.file.name}")
                out.write(buffer, 0, r)
                left -= r
              }
              written += tin.sizes[i]
            }
            if (chunkStarted) tout.chunkCounts.add(n)
          }
          // vBase está na escala do vídeo; para o áudio converte-se para a escala dele.
          copy(v, video!!, vBase.toDouble())
          val au = audio
          if (a != null && au != null && codecConfig(a.stsd).contentEquals(codecConfig(au.first.stsd))) {
            copy(a, au, vBase.toDouble() * a.timescale / v.timescale)
          }
        }
        doneBytes += input.file.length()
        onProgress?.invoke((doneBytes.toFloat() / totalBytes).coerceIn(0f, 0.99f))
      }

      val vt = video ?: throw IOException("Nenhum segmento legível.")
      if (vt.dts.size == 0) throw IOException("O vídeo ficou vazio.")
      val tracks = listOfNotNull(vt, audio?.takeIf { it.dts.size > 0 })
      val durationUs = tracks.maxOf { t -> (t.lastDts + t.lastDelta - maxOf(0L, t.shift)) * 1_000_000L / t.timescale }
      out.write(moov(tracks, durationUs))
      out.flush()
      // Tamanho do mdat (64 bits).
      fos.channel.position(mdatStart + 8)
      fos.channel.write(java.nio.ByteBuffer.allocate(8).putLong(written - mdatStart).apply { flip() })
      fos.fd.sync()
      result = Result(durationUs, vt.dts.size, 0)
    }
    if (!tmp.renameTo(output)) {
      tmp.copyTo(output, overwrite = true)
      tmp.delete()
    }
    onProgress?.invoke(1f)
    return Result(result!!.durationUs, result!!.videoSamples, output.length())
  }

  // ----------------------------------------------------------------- caixas

  private class BoxWriter(buf: ByteArrayOutputStream) : DataOutputStream(buf)

  private fun box(type: String, body: BoxWriter.() -> Unit): ByteArray {
    val inner = ByteArrayOutputStream()
    BoxWriter(inner).apply(body).flush()
    val content = inner.toByteArray()
    val out = ByteArrayOutputStream(content.size + 8)
    DataOutputStream(out).apply {
      writeInt(content.size + 8)
      write(type.toByteArray(Charsets.ISO_8859_1))
      write(content)
      flush()
    }
    return out.toByteArray()
  }

  private fun fullBox(type: String, version: Int, flags: Int, body: BoxWriter.() -> Unit) = box(type) {
    writeInt((version shl 24) or flags)
    body()
  }

  private fun moov(tracks: List<TrackOut>, durationUs: Long): ByteArray {
    val movieTs = 1000
    val movieDur = durationUs / 1000
    return box("moov") {
      write(fullBox("mvhd", 1, 0) {
        writeLong(0); writeLong(0); writeInt(movieTs); writeLong(movieDur)
        writeInt(0x00010000); writeShort(0x0100); writeShort(0); writeInt(0); writeInt(0)
        write(IDENTITY)
        repeat(6) { writeInt(0) }
        writeInt(tracks.size + 1)
      })
      for (t in tracks) write(trak(t, movieTs))
    }
  }

  private fun trak(t: TrackOut, movieTs: Int): ByteArray {
    val shift = maxOf(0L, t.shift)
    val trackDur = t.lastDts + t.lastDelta - shift
    val isVideo = t.handler == "vide"
    return box("trak") {
      write(fullBox("tkhd", 1, 3) {
        writeLong(0); writeLong(0); writeInt(t.id); writeInt(0)
        writeLong(trackDur * movieTs / t.timescale)
        writeInt(0); writeInt(0)
        writeShort(0); writeShort(0); writeShort(if (isVideo) 0 else 0x0100); writeShort(0)
        write(t.first.matrix)
        writeInt(t.first.width); writeInt(t.first.height)
      })
      if (shift > 0) {
        write(box("edts") {
          write(fullBox("elst", 1, 0) {
            writeInt(1)
            writeLong(trackDur * movieTs / t.timescale)
            writeLong(shift)
            writeInt(0x00010000)
          })
        })
      }
      write(box("mdia") {
        write(fullBox("mdhd", 1, 0) {
          writeLong(0); writeLong(0); writeInt(t.timescale); writeLong(t.lastDts + t.lastDelta)
          writeShort(t.first.language); writeShort(0)
        })
        write(t.first.hdlr)
        write(box("minf") {
          write(t.first.mediaHeader)
          write(t.first.dinf ?: box("dinf") {
            write(fullBox("dref", 0, 0) { writeInt(1); write(fullBox("url ", 0, 1) {}) })
          })
          write(box("stbl") {
            write(t.first.stsd)
            write(stts(t))
            if ((0 until t.cts.size).any { t.cts[it] != 0 }) write(ctts(t))
            if (isVideo && t.sync.size < t.sizes.size) {
              write(fullBox("stss", 0, 0) {
                writeInt(t.sync.size)
                for (i in 0 until t.sync.size) writeInt(t.sync[i])
              })
            }
            write(fullBox("stsz", 0, 0) {
              writeInt(0); writeInt(t.sizes.size)
              for (i in 0 until t.sizes.size) writeInt(t.sizes[i])
            })
            write(stsc(t))
            write(fullBox("co64", 0, 0) {
              writeInt(t.chunkOffsets.size)
              for (i in 0 until t.chunkOffsets.size) writeLong(t.chunkOffsets[i])
            })
          })
        })
      })
    }
  }

  private fun stts(t: TrackOut) = fullBox("stts", 0, 0) {
    val entries = ArrayList<LongArray>()
    for (i in 0 until t.dts.size) {
      val delta = if (i + 1 < t.dts.size) t.dts[i + 1] - t.dts[i] else t.lastDelta
      val last = entries.lastOrNull()
      if (last != null && last[1] == delta) last[0]++ else entries.add(longArrayOf(1, delta))
    }
    writeInt(entries.size)
    for (e in entries) { writeInt(e[0].toInt()); writeInt(e[1].toInt()) }
  }

  private fun ctts(t: TrackOut) = fullBox("ctts", 1, 0) {
    val entries = ArrayList<IntArray>()
    for (i in 0 until t.cts.size) {
      val last = entries.lastOrNull()
      if (last != null && last[1] == t.cts[i]) last[0]++ else entries.add(intArrayOf(1, t.cts[i]))
    }
    writeInt(entries.size)
    for (e in entries) { writeInt(e[0]); writeInt(e[1]) }
  }

  private fun stsc(t: TrackOut) = fullBox("stsc", 0, 0) {
    val entries = ArrayList<IntArray>()
    for (c in 0 until t.chunkCounts.size) {
      val n = t.chunkCounts[c]
      if (entries.lastOrNull()?.get(1) != n) entries.add(intArrayOf(c + 1, n, 1))
    }
    writeInt(entries.size)
    for (e in entries) { writeInt(e[0]); writeInt(e[1]); writeInt(e[2]) }
  }

  private val IDENTITY: ByteArray = ByteArrayOutputStream().also { b ->
    DataOutputStream(b).apply {
      for (v in intArrayOf(0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000)) writeInt(v)
      flush()
    }
  }.toByteArray()
}
