/**
 * Análise de clips no tablet: motivo, corte e desenhos por cima da imagem.
 * Tudo em ms do próprio clip (0 = início do ficheiro). Coordenadas dos desenhos
 * normalizadas (0..1) para servirem em qualquer tamanho de ecrã.
 */

export const DEFAULT_MOTIVES = [
  'Ressalto defensivo',
  'Ressalto ofensivo',
  'Transição defensiva',
  'Transição ofensiva',
  'Má leitura',
  'Mau posicionamento',
  'Defesa individual',
  'Bom exemplo',
];

export type Point = [number, number];
export type Tool = 'arrow' | 'circle' | 'free';
export type Stroke = { tool: Tool; color: string; points: Point[] };
/** Um momento desenhado: a imagem para aqui e mostra os traços. */
export type Moment = { atMs: number; strokes: Stroke[] };
export type Trim = { startMs: number; endMs: number };
export type ClipNotes = { motive?: string | null; trim?: Trim | null; moments?: Moment[] };

/** Dois tempos a menos disto são o mesmo momento (≈ 1 imagem a 30 fps). */
export const MOMENT_TOLERANCE_MS = 40;
const MIN_TRIM_MS = 1000;

export function findMoment(moments: Moment[] | undefined, atMs: number): Moment | undefined {
  return moments?.find((m) => Math.abs(m.atMs - atMs) <= MOMENT_TOLERANCE_MS);
}

export function addStroke(moments: Moment[] | undefined, atMs: number, stroke: Stroke): Moment[] {
  const list = [...(moments ?? [])];
  const i = list.findIndex((m) => Math.abs(m.atMs - atMs) <= MOMENT_TOLERANCE_MS);
  if (i >= 0) list[i] = { ...list[i], strokes: [...list[i].strokes, stroke] };
  else list.push({ atMs: Math.round(atMs), strokes: [stroke] });
  return list.sort((a, b) => a.atMs - b.atMs);
}

/** Desfaz o último traço do momento (e apaga o momento se ficar vazio). */
export function undoStroke(moments: Moment[] | undefined, atMs: number): Moment[] {
  const list = [...(moments ?? [])];
  const i = list.findIndex((m) => Math.abs(m.atMs - atMs) <= MOMENT_TOLERANCE_MS);
  if (i < 0) return list;
  const strokes = list[i].strokes.slice(0, -1);
  if (strokes.length === 0) list.splice(i, 1);
  else list[i] = { ...list[i], strokes };
  return list;
}

export function clearMoment(moments: Moment[] | undefined, atMs: number): Moment[] {
  return (moments ?? []).filter((m) => Math.abs(m.atMs - atMs) > MOMENT_TOLERANCE_MS);
}

/** O momento atravessado ao avançar de prevMs para curMs (para parar a reprodução nele). */
export function crossedMoment(moments: Moment[] | undefined, prevMs: number, curMs: number): Moment | undefined {
  if (!moments || curMs <= prevMs || curMs - prevMs > 1500) return undefined; // saltos (arrastar) não contam
  return moments.find((m) => m.atMs > prevMs && m.atMs <= curMs);
}

/** Corte válido dentro da duração; null se for o clip inteiro. */
export function normalizeTrim(trim: Partial<Trim> | null | undefined, durationMs: number): Trim | null {
  if (!trim || durationMs <= 0) return null;
  let start = Math.max(0, Math.min(trim.startMs ?? 0, durationMs));
  let end = Math.max(0, Math.min(trim.endMs ?? durationMs, durationMs));
  if (end - start < MIN_TRIM_MS) {
    if (trim.endMs == null || start + MIN_TRIM_MS <= durationMs) end = Math.min(durationMs, start + MIN_TRIM_MS);
    else start = Math.max(0, end - MIN_TRIM_MS);
  }
  if (start <= 0 && end >= durationMs) return null;
  return { startMs: Math.round(start), endMs: Math.round(end) };
}

/** Clips agrupados por motivo, pela ordem da lista de motivos. */
export function groupByMotive<T extends { id: string }>(
  clips: T[],
  notes: Record<string, ClipNotes>,
  motives: string[]
): { motive: string; clips: T[] }[] {
  return motives
    .map((motive) => ({ motive, clips: clips.filter((c) => notes[c.id]?.motive === motive) }))
    .filter((g) => g.clips.length > 0);
}
