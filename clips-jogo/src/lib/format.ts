/** 754000 → "12:34"; 3_754_000 → "1:02:34" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) return '—';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} kB`;
}

/** Tempo de gravação que ainda cabe no disco (reserva espaço para o vídeo final). */
export function recordingTimeLeftMs(freeBytes: number, bytesPerSecond: number): number {
  if (freeBytes <= 0 || bytesPerSecond <= 0) return 0;
  // O vídeo completo é criado no fim a partir dos segmentos: precisa do dobro do espaço.
  return (freeBytes / (bytesPerSecond * 2)) * 1000;
}

export function formatHoursMinutes(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
