package pt.clipsjogo.engine.core

/**
 * Um segmento de gravação já fechado em disco.
 * Os tempos estão na linha temporal da gravação (µs desde o primeiro frame).
 * Cada segmento começa num keyframe e é um MP4 independente.
 */
data class Segment(
  val index: Int,
  val fileName: String,
  val startUs: Long,
  val endUs: Long,
  val sizeBytes: Long = 0L
) {
  val durationUs: Long get() = endUs - startUs
}

/** Pedaço de um segmento que entra num clip. */
data class CutPiece(val segment: Segment, val fromUs: Long, val toUs: Long)

sealed class CutPlan {
  /** Todos os segmentos necessários já estão fechados: pode cortar-se já. */
  data class Ready(val pieces: List<CutPiece>, val startUs: Long, val endUs: Long) : CutPlan()

  /** O fim pedido ainda não foi gravado/fechado em disco. */
  data class Waiting(val needUntilUs: Long, val coveredUntilUs: Long) : CutPlan()

  /** Intervalo vazio ou fora da gravação. */
  data class Invalid(val reason: String) : CutPlan()
}

object CutPlanner {
  /**
   * Decide que segmentos são precisos para o intervalo [startUs, endUs].
   *
   * @param segments segmentos fechados, por ordem, contíguos.
   * @param recordingDone se a gravação já terminou, o fim é limitado ao fim real
   *        da gravação em vez de esperar por segmentos que nunca vão existir.
   */
  fun plan(segments: List<Segment>, startUs: Long, endUs: Long, recordingDone: Boolean): CutPlan {
    val coveredUntil = segments.lastOrNull()?.endUs ?: 0L
    var start = maxOf(0L, startUs)
    var end = endUs

    if (end <= start) return CutPlan.Invalid("O fim do clip tem de ser depois do início.")

    if (end > coveredUntil) {
      if (!recordingDone) return CutPlan.Waiting(end, coveredUntil)
      end = coveredUntil
    }
    if (segments.isEmpty() || end <= start) {
      return CutPlan.Invalid("O intervalo pedido está fora da gravação.")
    }

    val pieces = segments
      .filter { it.endUs > start && it.startUs < end }
      .map { CutPiece(it, maxOf(it.startUs, start), minOf(it.endUs, end)) }

    if (pieces.isEmpty()) return CutPlan.Invalid("O intervalo pedido está fora da gravação.")
    start = pieces.first().fromUs
    return CutPlan.Ready(pieces, start, end)
  }

  /**
   * Agrupa os segmentos em partes de tamanho limitado, para o vídeo completo.
   * Um jogo longo em 1080p passa facilmente dos 4 GB, que é o limite prático
   * de muitos leitores/apps e do formato MP4 com offsets de 32 bits.
   */
  fun splitIntoParts(segments: List<Segment>, maxPartBytes: Long): List<List<Segment>> {
    val parts = mutableListOf<MutableList<Segment>>()
    var current = mutableListOf<Segment>()
    var currentBytes = 0L
    for (seg in segments) {
      if (current.isNotEmpty() && currentBytes + seg.sizeBytes > maxPartBytes) {
        parts.add(current)
        current = mutableListOf()
        currentBytes = 0L
      }
      current.add(seg)
      currentBytes += seg.sizeBytes
    }
    if (current.isNotEmpty()) parts.add(current)
    return parts
  }
}

/**
 * Converte entre o relógio do sistema (elapsedRealtime, em µs) e a linha
 * temporal da gravação. O instante zero é o primeiro keyframe gravado.
 */
class RecordingClock {
  @Volatile var t0BootUs: Long = -1L
    private set

  val started: Boolean get() = t0BootUs >= 0

  fun start(bootUs: Long) {
    t0BootUs = bootUs
  }

  fun reset() {
    t0BootUs = -1L
  }

  fun toRecUs(bootUs: Long): Long = if (started) bootUs - t0BootUs else 0L
}
