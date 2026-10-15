import { ClipEngine } from '../../modules/clip-engine';
import { ClockSync, recordingTimeAt } from './clockSync';
import type { Pairing } from './pairing';

/** Estado do telemóvel, tal como devolvido por GET /api/status. */
export type PhoneStatus = {
  device: string;
  elapsedMs: number;
  state: 'idle' | 'preview' | 'recording' | 'finalizing';
  sessionId: string | null;
  recStartElapsedMs: number | null;
  batteryPercent: number | null;
  charging: boolean;
  thermal: string;
};

export type RemoteClip = {
  id: string;
  sessionId: string;
  name: string;
  status: 'queued' | 'pending' | 'cutting' | 'ready' | 'failed';
  requestedStartMs: number;
  requestedEndMs: number;
  startMs: number;
  endMs: number;
  createdAtMs: number;
  sizeBytes: number;
  error: string | null;
};

export type ConnectionState = 'joining' | 'connecting' | 'connected' | 'lost';

export type RemoteSnapshot = {
  connection: ConnectionState;
  error: string | null;
  phone: PhoneStatus | null;
  clips: RemoteClip[];
};

type QueuedRequest = {
  id: string;
  sessionId: string | null;
  startMs: number;
  endMs: number;
  name: string | null;
  createdAtMs: number;
};

const now = () => performance.now();

function randomId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

async function fetchJson(url: string, token: string, init: RequestInit = {}, timeoutMs = 2500): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'X-Token': token, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.error ?? `Erro ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ligação do tablet ao telemóvel que grava.
 *
 * - Liga-se à rede do telemóvel (dados do QR) e descobre o endereço que responde.
 * - De 1 em 1 s pede o estado (e sincroniza o relógio); de 2 em 2 s a lista de clips.
 * - Os pedidos de clip ficam numa fila até o telemóvel confirmar: se a ligação
 *   cair, são reenviados quando voltar (o ID evita duplicados). Os tempos são
 *   fixados no momento em que se carrega no botão, por isso continuam certos.
 */
export class RemoteClient {
  private baseUrl: string | null = null;
  private sync = new ClockSync();
  private timers: ReturnType<typeof setInterval>[] = [];
  private listeners = new Set<(s: RemoteSnapshot) => void>();
  private queue: QueuedRequest[] = [];
  private serverClips: RemoteClip[] = [];
  private lastOkAt = 0;
  private stopped = false;
  private snapshot: RemoteSnapshot = { connection: 'joining', error: null, phone: null, clips: [] };

  constructor(readonly pairing: Pairing) {}

  subscribe(listener: (s: RemoteSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(patch: Partial<RemoteSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l(this.snapshot));
  }

  async start(): Promise<void> {
    const { ssid, passphrase, security } = this.pairing;
    if (ssid && ClipEngine) {
      this.emit({ connection: 'joining', error: null });
      try {
        await ClipEngine.joinNetwork(ssid, passphrase ?? '', security);
      } catch (e) {
        // Pode já estar ligado à mesma rede (ex.: router portátil): tentamos na mesma.
        this.emit({ error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (this.stopped) return;
    this.emit({ connection: 'connecting' });
    this.timers.push(setInterval(() => this.pollStatus(), 1000));
    this.timers.push(setInterval(() => this.pollClips(), 2000));
    this.timers.push(setInterval(() => this.flushQueue(), 2000));
    this.pollStatus();
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    ClipEngine?.leaveNetwork().catch(() => {});
  }

  /** Tempo de gravação agora (ms), no relógio do telemóvel. */
  recordingTimeNow(): number | null {
    return recordingTimeAt(this.sync, now(), this.snapshot.phone?.recStartElapsedMs ?? null);
  }

  get isRecording(): boolean {
    return this.snapshot.phone?.state === 'recording' && this.recordingTimeNow() != null;
  }

  /** Pede um clip. startMs/endMs em tempo de gravação (já calculados no momento do toque). */
  requestClip(startMs: number, endMs: number, name: string | null): string {
    const req: QueuedRequest = {
      id: randomId(),
      sessionId: this.snapshot.phone?.sessionId ?? null,
      startMs,
      endMs,
      name: name?.trim() || null,
      createdAtMs: Date.now(),
    };
    this.queue.push(req);
    this.publishClips();
    this.flushQueue();
    return req.id;
  }

  // ------------------------------------------------------------------ rede

  private async findBaseUrl(): Promise<string | null> {
    for (const ip of this.pairing.ips) {
      const url = `http://${ip}:${this.pairing.port}`;
      try {
        await fetchJson(`${url}/api/status`, this.pairing.token, {}, 1500);
        return url;
      } catch {
        // tenta o próximo endereço
      }
    }
    return null;
  }

  private async pollStatus() {
    if (this.stopped) return;
    if (!this.baseUrl) {
      this.baseUrl = await this.findBaseUrl();
      if (!this.baseUrl) return this.markLost();
    }
    const sentAt = now();
    try {
      const status: PhoneStatus = await fetchJson(`${this.baseUrl}/api/status`, this.pairing.token);
      const receivedAt = now();
      if (status.sessionId !== this.snapshot.phone?.sessionId) {
        // Nova gravação: a lista de clips é outra.
        this.serverClips = [];
      }
      this.sync.addSample(sentAt, status.elapsedMs, receivedAt);
      this.lastOkAt = receivedAt;
      this.emit({ connection: 'connected', error: null, phone: status });
      this.publishClips();
    } catch (e) {
      if ((e as any)?.status === 403) {
        this.emit({ connection: 'lost', error: (e as Error).message });
        return;
      }
      this.markLost();
    }
  }

  private markLost() {
    if (now() - this.lastOkAt > 4000 && this.snapshot.connection !== 'joining') {
      this.emit({ connection: this.lastOkAt === 0 ? 'connecting' : 'lost' });
      // O endereço pode ter mudado (ex.: telemóvel recriou a rede): volta a procurar.
      this.baseUrl = null;
    }
  }

  private async pollClips() {
    if (this.stopped || !this.baseUrl || this.snapshot.connection !== 'connected') return;
    try {
      const body = await fetchJson(`${this.baseUrl}/api/clips`, this.pairing.token);
      this.serverClips = body.clips ?? [];
      this.publishClips();
    } catch {
      // o pollStatus trata do estado da ligação
    }
  }

  private flushing = false;

  private async flushQueue() {
    if (this.flushing || this.stopped || !this.baseUrl || this.queue.length === 0) return;
    this.flushing = true;
    try {
      for (const req of [...this.queue]) {
        try {
          const clip: RemoteClip = await fetchJson(`${this.baseUrl}/api/clip`, this.pairing.token, {
            method: 'POST',
            body: JSON.stringify(req),
          });
          this.queue = this.queue.filter((q) => q.id !== req.id);
          this.serverClips = [...this.serverClips.filter((c) => c.id !== clip.id), clip];
        } catch (e) {
          const status = (e as any)?.status;
          if (status === 409 || status === 400) {
            // O telemóvel recusou (ex.: gravação já terminou): não vale a pena insistir.
            this.queue = this.queue.filter((q) => q.id !== req.id);
            this.serverClips = [...this.serverClips, this.failedClip(req, (e as Error).message)];
          } else {
            break; // sem ligação: tenta mais tarde, pela mesma ordem
          }
        }
      }
    } finally {
      this.flushing = false;
      this.publishClips();
    }
  }

  private failedClip(req: QueuedRequest, error: string): RemoteClip {
    return {
      id: req.id,
      sessionId: req.sessionId ?? '',
      name: req.name ?? 'Clip',
      status: 'failed',
      requestedStartMs: req.startMs,
      requestedEndMs: req.endMs,
      startMs: req.startMs,
      endMs: req.endMs,
      createdAtMs: req.createdAtMs,
      sizeBytes: 0,
      error,
    };
  }

  private publishClips() {
    const queued: RemoteClip[] = this.queue.map((q) => ({
      ...this.failedClip(q, ''),
      name: q.name ?? 'Clip (na fila)',
      status: 'queued',
      error: null,
    }));
    const merged = [...this.serverClips.filter((c) => !this.queue.some((q) => q.id === c.id)), ...queued];
    merged.sort((a, b) => a.createdAtMs - b.createdAtMs);
    this.emit({ clips: merged });
  }
}
