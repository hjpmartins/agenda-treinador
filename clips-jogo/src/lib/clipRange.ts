/**
 * Cálculo dos intervalos dos clips, em milissegundos da gravação.
 * Partilhado pelo modo Gravar (botões de teste) e, na fase 2, pelo modo Comando.
 */

export type ClipRange = { startMs: number; endMs: number };

export const PRESET_SECONDS = [10, 20, 30, 60] as const;
export const ADJUST_STEP_MS = 5_000;
const MIN_CLIP_MS = 2_000;

/** "Clip dos últimos N segundos", com ajuste opcional do início e do fim. */
export function lastSeconds(nowMs: number, seconds: number, startAdjustMs = 0, endAdjustMs = 0): ClipRange {
  return normalize({
    startMs: nowMs - seconds * 1000 + startAdjustMs,
    endMs: nowMs + endAdjustMs,
  });
}

/** Modo "Marcar início" / "Marcar fim". */
export function fromMarks(startMarkMs: number, endMarkMs: number): ClipRange {
  return normalize({
    startMs: Math.min(startMarkMs, endMarkMs),
    endMs: Math.max(startMarkMs, endMarkMs),
  });
}

/** Garante início ≥ 0 e uma duração mínima. */
export function normalize(range: ClipRange): ClipRange {
  const startMs = Math.max(0, Math.round(range.startMs));
  const endMs = Math.max(startMs + MIN_CLIP_MS, Math.round(range.endMs));
  return { startMs, endMs };
}
