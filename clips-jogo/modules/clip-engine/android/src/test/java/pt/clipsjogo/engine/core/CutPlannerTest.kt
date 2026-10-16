package pt.clipsjogo.engine.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CutPlannerTest {
  private val s = 1_000_000L

  /** 10 segmentos de 2 s: 0–2, 2–4, …, 18–20. */
  private val segments = (0 until 10).map {
    Segment(it, "seg_$it.mp4", it * 2 * s, (it + 1) * 2 * s, 100)
  }

  @Test
  fun clipInsideRecordedRange_usesOverlappingSegments() {
    val plan = CutPlanner.plan(segments, 5 * s, 9 * s, recordingDone = false)
    assertTrue(plan is CutPlan.Ready)
    plan as CutPlan.Ready
    assertEquals(listOf(2, 3, 4), plan.pieces.map { it.segment.index })
    assertEquals(5 * s, plan.pieces.first().fromUs)
    assertEquals(9 * s, plan.pieces.last().toUs)
  }

  @Test
  fun clipEndingInTheFuture_waitsWhileRecording() {
    val plan = CutPlanner.plan(segments, 15 * s, 25 * s, recordingDone = false)
    assertEquals(CutPlan.Waiting(25 * s, 20 * s), plan)
  }

  @Test
  fun clipEndingInTheFuture_isClampedAfterRecordingStops() {
    val plan = CutPlanner.plan(segments, 15 * s, 25 * s, recordingDone = true) as CutPlan.Ready
    assertEquals(20 * s, plan.endUs)
    assertEquals(listOf(7, 8, 9), plan.pieces.map { it.segment.index })
  }

  @Test
  fun negativeStart_isClampedToZero() {
    val plan = CutPlanner.plan(segments, -10 * s, 3 * s, recordingDone = false) as CutPlan.Ready
    assertEquals(0L, plan.startUs)
    assertEquals(listOf(0, 1), plan.pieces.map { it.segment.index })
  }

  @Test
  fun boundaryExactlyOnSegmentEdge_doesNotIncludeEmptyNeighbour() {
    val plan = CutPlanner.plan(segments, 4 * s, 6 * s, recordingDone = false) as CutPlan.Ready
    assertEquals(listOf(2), plan.pieces.map { it.segment.index })
  }

  @Test
  fun invertedRange_isInvalid() {
    assertTrue(CutPlanner.plan(segments, 8 * s, 8 * s, false) is CutPlan.Invalid)
    assertTrue(CutPlanner.plan(segments, 9 * s, 8 * s, false) is CutPlan.Invalid)
  }

  @Test
  fun noSegmentsYet_waits() {
    assertEquals(CutPlan.Waiting(3 * s, 0), CutPlanner.plan(emptyList(), 0, 3 * s, false))
  }

  @Test
  fun splitIntoParts_respectsMaxSize() {
    val parts = CutPlanner.splitIntoParts(segments, 350)
    assertEquals(listOf(3, 3, 3, 1), parts.map { it.size })
    assertEquals((0 until 10).toList(), parts.flatten().map { it.index })
  }

  @Test
  fun recordingClock_mapsBootTimeToRecordingTime() {
    val clock = RecordingClock()
    assertEquals(0L, clock.toRecUs(123))
    clock.start(1_000_000)
    assertEquals(2_500_000L, clock.toRecUs(3_500_000))
  }

  @Test
  fun recordingClock_pauseFreezesTimeAndResumeContinues() {
    val clock = RecordingClock()
    clock.start(0)
    clock.pause(10 * s) // intervalo aos 10 s de jogo
    assertEquals(10 * s, clock.toRecUs(15 * s)) // em pausa, o tempo não anda
    clock.resume(610 * s) // 10 min depois
    assertEquals(10 * s, clock.toRecUs(610 * s))
    assertEquals(12 * s, clock.toRecUs(612 * s))
    assertEquals(600 * s, clock.pausedTotalUs)
  }

  @Test
  fun timebase_framesInMonotonicClock_areShiftedToBoottime() {
    // Telemóvel ligado há 5 dias, 112 h a dormir: MONOTONIC está 112 h atrás de BOOTTIME.
    val mono = 8 * 3600 * s
    val boot = mono + 112 * 3600 * s
    val frame = mono - 80_000 // frame captado há 80 ms, em MONOTONIC
    assertEquals(boot - mono, Timebase.offsetToBootUs(frame, boot, mono))
  }

  @Test
  fun timebase_framesAlreadyInBoottime_needNoShift() {
    val mono = 8 * 3600 * s
    val boot = mono + 112 * 3600 * s
    assertEquals(0L, Timebase.offsetToBootUs(boot - 80_000, boot, mono))
  }

  @Test
  fun timebase_unknownClock_isAnchoredToNow() {
    val mono = 8 * 3600 * s
    val boot = mono + 112 * 3600 * s
    assertEquals(boot - 1_000, Timebase.offsetToBootUs(1_000, boot, mono))
  }
}
