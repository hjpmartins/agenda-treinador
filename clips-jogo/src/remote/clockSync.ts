/**
 * Estima a diferença entre o relógio do tablet e o do telemóvel, ao estilo NTP:
 * cada pedido ao telemóvel dá uma amostra (envio, hora do telemóvel, receção) e
 * a melhor é a de menor ida-e-volta (menos incerteza).
 *
 * Todos os tempos em ms. O relógio local tem de ser monótono (performance.now()).
 */
export type ClockSample = { offsetMs: number; rttMs: number; atMs: number };

const MAX_AGE_MS = 60_000;

export class ClockSync {
  private samples: ClockSample[] = [];

  /** sentAt/receivedAt no relógio do tablet; remoteMs no relógio do telemóvel. */
  addSample(sentAtMs: number, remoteMs: number, receivedAtMs: number): void {
    const rttMs = Math.max(0, receivedAtMs - sentAtMs);
    const offsetMs = remoteMs - (sentAtMs + receivedAtMs) / 2;
    this.samples.push({ offsetMs, rttMs, atMs: receivedAtMs });
    this.samples = this.samples.filter((s) => receivedAtMs - s.atMs <= MAX_AGE_MS).slice(-30);
  }

  get best(): ClockSample | null {
    if (this.samples.length === 0) return null;
    return this.samples.reduce((a, b) => (b.rttMs < a.rttMs ? b : a));
  }

  get synced(): boolean {
    return this.best !== null;
  }

  /** Hora do telemóvel correspondente a um instante local. */
  remoteNow(localMs: number): number | null {
    const b = this.best;
    return b ? localMs + b.offsetMs : null;
  }

  reset(): void {
    this.samples = [];
  }
}

/** Tempo de gravação (ms) no instante local dado, ou null se não está a gravar / sem sincronização. */
export function recordingTimeAt(sync: ClockSync, localMs: number, recStartElapsedMs: number | null): number | null {
  if (recStartElapsedMs == null) return null;
  const remote = sync.remoteNow(localMs);
  return remote == null ? null : Math.max(0, remote - recStartElapsedMs);
}
