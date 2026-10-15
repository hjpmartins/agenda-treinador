/** Qualidade da ligação tablet ↔ telemóvel, para escolher onde pôr os aparelhos. */

export type Tone = 'ok' | 'warn' | 'danger' | 'neutral';

/** Força do sinal Wi-Fi (dBm). */
export function classifySignal(rssi: number | null): { label: string; tone: Tone } {
  if (rssi == null) return { label: 'desconhecido', tone: 'neutral' };
  if (rssi >= -60) return { label: 'bom', tone: 'ok' };
  if (rssi >= -70) return { label: 'razoável', tone: 'ok' };
  if (rssi >= -78) return { label: 'fraco', tone: 'warn' };
  return { label: 'muito fraco', tone: 'danger' };
}

export function formatBand(frequencyMHz: number | null): string | null {
  if (!frequencyMHz) return null;
  if (frequencyMHz < 3000) return '2,4 GHz';
  if (frequencyMHz < 5950) return '5 GHz';
  return '6 GHz';
}

export type PollResult = { ok: boolean; rttMs: number | null };

/** Últimos pedidos de estado (1 por segundo): tempo de resposta e falhas. */
export class LinkStats {
  private results: PollResult[] = [];
  private readonly size: number;

  constructor(size = 30) {
    this.size = size;
  }

  add(r: PollResult) {
    this.results.push(r);
    if (this.results.length > this.size) this.results.shift();
  }

  summary(): { rttMs: number | null; failures: number; total: number } {
    const rtts = this.results.filter((r) => r.ok && r.rttMs != null).map((r) => r.rttMs!).sort((a, b) => a - b);
    const rttMs = rtts.length ? Math.round(rtts[Math.floor(rtts.length / 2)]) : null;
    return { rttMs, failures: this.results.filter((r) => !r.ok).length, total: this.results.length };
  }
}

/** Avaliação global: o pior entre o sinal, o tempo de resposta e as falhas. */
export function overallQuality(rssi: number | null, rttMs: number | null, failures: number, total: number): Tone {
  const order: Tone[] = ['neutral', 'ok', 'warn', 'danger'];
  let tone = classifySignal(rssi).tone;
  const worse = (t: Tone) => {
    if (order.indexOf(t) > order.indexOf(tone)) tone = t;
  };
  if (rttMs != null) worse(rttMs > 600 ? 'danger' : rttMs > 200 ? 'warn' : 'ok');
  if (total >= 5) worse(failures / total > 0.2 ? 'danger' : failures > 0 ? 'warn' : 'ok');
  return tone;
}
