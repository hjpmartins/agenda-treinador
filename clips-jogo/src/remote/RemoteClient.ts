import { File } from 'expo-file-system';
import { ClipEngine } from '../../modules/clip-engine';
import { ClockSync, recordingTimeAt } from './clockSync';
import type { Pairing } from './pairing';
import { LinkStats } from '../lib/linkQuality';
import { loadQueue, loadSettings, saveLastPairing, saveQueue, saveSettings } from './persist';
import { addReceived, copiedMarkerFor, destinationFor, findReceived, hasReceived } from './receivedLibrary';

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
  freeBytes?: number;
  bytesPerSecond?: number;
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
  /** Cópia no tablet: ficheiro local quando já foi transferido. */
  localUri?: string | null;
  /** Progresso da transferência (0..1) enquanto está a ser copiado para o tablet. */
  transfer?: number | null;
  /** O telemóvel está a preparar a cópia leve deste clip. */
  preparingLight?: boolean;
};

export type ConnectionState = 'joining' | 'connecting' | 'connected' | 'lost';

export type RemoteSnapshot = {
  connection: ConnectionState;
  error: string | null;
  phone: PhoneStatus | null;
  clips: RemoteClip[];
  /**
   * Se o telemóvel está a gravar, com tolerância: uma resposta isolada a dizer
   * o contrário não bloqueia os botões (só 3 seguidas).
   */
  recording: boolean;
  /** Porque é que não se pode pedir clips agora (para mostrar ao utilizador). */
  notRecordingReason: string | null;
  /** Qualidade da ligação nos últimos ~30 s: tempo de resposta (mediana) e pedidos falhados. */
  link: { rttMs: number | null; failures: number; total: number };
  /** Copiar os clips para o tablet logo que ficam prontos (ou só ao carregar em "Copiar agora"). */
  autoDownload: boolean;
  /** "Copiar agora" a decorrer (modo manual). */
  copying: boolean;
  /** Clips prontos no telemóvel que ainda não estão no tablet. */
  readyToCopy: number;
  quality: 'original' | 'leve';
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

async function fetchJson(url: string, token: string, init: RequestInit = {}, timeoutMs = 4000): Promise<any> {
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
  private downloading: string | null = null;
  private transferProgress: Record<string, number> = {};
  private failedDownloads: Record<string, number> = {};
  private stats = new LinkStats();
  private copyRequested = false;
  /** Clips cuja cópia leve está a ser preparada no telemóvel: até quando esperar antes de perguntar outra vez. */
  private lightWait: Record<string, number> = {};
  private snapshot: RemoteSnapshot = {
    connection: 'joining',
    error: null,
    phone: null,
    clips: [],
    recording: false,
    notRecordingReason: null,
    link: { rttMs: null, failures: 0, total: 0 },
    autoDownload: loadSettings().autoDownload,
    quality: loadSettings().quality,
    copying: false,
    readyToCopy: 0,
  };
  /** Última gravação confirmada pelo telemóvel (sessão + instante de início no relógio dele). */
  private lastRecording: { sessionId: string | null; recStartElapsedMs: number } | null = null;
  private notRecordingStreak = 0;

  /** Momento da última transferência com progresso (uma transferência a decorrer prova que há ligação). */
  private lastTransferAt = 0;
  private polling = false;

  constructor(readonly pairing: Pairing) {
    // Pedidos que ficaram por enviar (ex.: a app do tablet fechou sem ligação).
    this.queue = loadQueue<QueuedRequest>(pairing.token);
    saveLastPairing(pairing);
  }

  private persistQueue() {
    saveQueue(this.pairing.token, this.queue);
  }

  get state(): RemoteSnapshot {
    return this.snapshot;
  }

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
    if (!ssid) ClipEngine?.keepWifiAwake().catch(() => {});
    if (this.stopped) return;
    this.emit({ connection: 'connecting' });
    this.timers.push(setInterval(() => this.pollStatus(), 1000));
    this.timers.push(setInterval(() => this.pollClips(), 2000));
    this.timers.push(setInterval(() => this.flushQueue(), 2000));
    this.timers.push(setInterval(() => this.downloadNext(), 3000));
    this.pollStatus();
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    ClipEngine?.leaveNetwork().catch(() => {});
  }

  /** Endereços do telemóvel, o que está a funcionar primeiro (para a barra flutuante). */
  get phoneUrls(): string[] {
    const all = this.pairing.ips.map((ip) => `http://${ip}:${this.pairing.port}`);
    return this.baseUrl ? [this.baseUrl, ...all.filter((u) => u !== this.baseUrl)] : all;
  }

  /** Copiar os clips logo que ficam prontos (true) ou só com "Copiar agora" (false). */
  setAutoDownload(on: boolean) {
    saveSettings({ ...loadSettings(), autoDownload: on });
    this.emit({ autoDownload: on });
    if (on) this.downloadNext();
  }

  setQuality(quality: 'original' | 'leve') {
    saveSettings({ ...loadSettings(), quality });
    this.emit({ quality });
  }

  /** Modo manual: copia agora todos os clips prontos. */
  copyNow() {
    this.copyRequested = true;
    this.emit({ copying: true });
    this.downloadNext();
  }

  /** Tempo de gravação agora (ms), no relógio do telemóvel. */
  recordingTimeNow(): number | null {
    if (!this.snapshot.recording || !this.lastRecording) return null;
    return recordingTimeAt(this.sync, now(), this.lastRecording.recStartElapsedMs);
  }

  get isRecording(): boolean {
    return this.snapshot.recording && this.recordingTimeNow() != null;
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
    this.persistQueue();
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
    if (this.stopped || this.polling) return;
    this.polling = true;
    try {
      await this.pollStatusOnce();
    } finally {
      this.polling = false;
    }
  }

  private async pollStatusOnce() {
    if (!this.baseUrl) {
      this.baseUrl = await this.findBaseUrl();
      if (!this.baseUrl) {
        this.recordPoll(false, null);
        return this.markLost();
      }
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
      this.recordPoll(true, receivedAt - sentAt);
      this.lastOkAt = receivedAt;
      this.emit({ connection: 'connected', error: null, phone: status, ...this.updateRecording(status) });
      this.publishClips();
    } catch (e) {
      if ((e as any)?.status === 403) {
        this.emit({ connection: 'lost', error: (e as Error).message });
        return;
      }
      this.recordPoll(false, null);
      this.markLost();
    }
  }

  private updateRecording(status: PhoneStatus): Pick<RemoteSnapshot, 'recording' | 'notRecordingReason'> {
    if (status.state === 'recording' && status.recStartElapsedMs != null) {
      this.lastRecording = { sessionId: status.sessionId, recStartElapsedMs: status.recStartElapsedMs };
      this.notRecordingStreak = 0;
      return { recording: true, notRecordingReason: null };
    }
    this.notRecordingStreak++;
    const sameSession = this.lastRecording && (status.sessionId == null || status.sessionId === this.lastRecording.sessionId);
    // Respostas isoladas (ex.: a câmara a reconfigurar ao bloquear o ecrã) não bloqueiam os botões.
    if (this.lastRecording && sameSession && status.state !== 'finalizing' && this.notRecordingStreak < 3) {
      return { recording: true, notRecordingReason: null };
    }
    const reason =
      status.state === 'finalizing'
        ? 'O telemóvel está a terminar a gravação'
        : status.state === 'recording'
          ? 'A sincronizar com o telemóvel…'
          : `O telemóvel não está a gravar (estado: ${status.state})`;
    return { recording: false, notRecordingReason: reason };
  }

  private recordPoll(ok: boolean, rttMs: number | null) {
    this.stats.add({ ok, rttMs });
    this.emit({ link: this.stats.summary() });
  }

  private markLost() {
    // Durante uma transferência o telemóvel responde mais devagar: não é perda de ligação.
    if (now() - this.lastTransferAt < 5000) return;
    if (now() - this.lastOkAt > 8000 && this.snapshot.connection !== 'joining') {
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
      this.downloadNext();
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
          this.persistQueue();
          this.serverClips = [...this.serverClips.filter((c) => c.id !== clip.id), clip];
        } catch (e) {
          const status = (e as any)?.status;
          if (status === 409 || status === 400) {
            // O telemóvel recusou (ex.: gravação já terminou): não vale a pena insistir.
            this.queue = this.queue.filter((q) => q.id !== req.id);
            this.persistQueue();
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

  /**
   * Copia para o tablet, um de cada vez, os clips que já estão prontos no
   * telemóvel. Se a ligação cair a meio, volta a tentar mais tarde.
   */
  private async downloadNext() {
    if (this.downloading || this.stopped || !this.baseUrl || this.snapshot.connection !== 'connected') return;
    if (!this.snapshot.autoDownload && !this.copyRequested) return;
    const t = now();
    const next = this.serverClips.find(
      (c) =>
        c.status === 'ready' &&
        !hasReceived(c.id) &&
        (this.failedDownloads[c.id] ?? 0) < 5 &&
        (this.lightWait[c.id] ?? 0) <= t
    );
    if (!next) {
      const waitingLight = this.serverClips.some((c) => (this.lightWait[c.id] ?? 0) > t && !hasReceived(c.id));
      if (this.copyRequested && !waitingLight) {
        this.copyRequested = false;
        this.emit({ copying: false });
      }
      return;
    }
    this.downloading = next.id;
    this.transferProgress[next.id] = 0;
    this.publishClips();
    const dest = destinationFor(next.sessionId, next.id);
    const marker = copiedMarkerFor(dest);
    let leve = false;
    const register = () =>
      addReceived({
        id: next.id,
        sessionId: next.sessionId,
        name: next.name,
        startMs: next.startMs,
        endMs: next.endMs,
        createdAtMs: next.createdAtMs,
        receivedAtMs: Date.now(),
        sizeBytes: dest.exists ? dest.size : next.sizeBytes,
        phone: this.snapshot.phone?.device ?? 'telemóvel',
        uri: dest.uri,
        leve,
      });
    try {
      if (marker.exists && dest.exists) {
        // Já copiado pela barra flutuante enquanto a app estava em segundo plano.
        try {
          leve = marker.textSync().trim() === 'leve';
          marker.delete();
        } catch {
          // ignora
        }
        register();
      } else {
        let query = '';
        if (this.snapshot.quality === 'leve') {
          const light = await fetchJson(
            `${this.baseUrl}/api/clips/${encodeURIComponent(next.id)}/light`,
            this.pairing.token
          );
          if (light.state === 'preparing') {
            // O telemóvel está a fazer a cópia leve: pergunta outra vez daqui a pouco.
            this.lightWait[next.id] = now() + 2500;
            return;
          }
          if (light.state === 'ready') {
            leve = true;
            query = '?q=leve';
          }
        }
        delete this.lightWait[next.id];
        await File.downloadFileAsync(`${this.baseUrl}/api/clips/${encodeURIComponent(next.id)}/file${query}`, dest, {
          headers: { 'X-Token': this.pairing.token },
          idempotent: true,
          onProgress: ({ bytesWritten, totalBytes }) => {
            const total = totalBytes > 0 ? totalBytes : next.sizeBytes;
            this.lastTransferAt = now();
            if (total > 0) {
              this.transferProgress[next.id] = Math.min(1, bytesWritten / total);
              this.publishClips();
            }
          },
        });
        register();
      }
    } catch {
      this.failedDownloads[next.id] = (this.failedDownloads[next.id] ?? 0) + 1;
      try {
        if (dest.exists) dest.delete();
      } catch {
        // ignora
      }
    } finally {
      delete this.transferProgress[next.id];
      this.downloading = null;
      this.publishClips();
    }
    // Há mais? Continua logo.
    this.downloadNext();
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
    const withLocal = merged.map((c) => ({
      ...c,
      localUri: findReceived(c.id)?.uri ?? null,
      transfer: this.transferProgress[c.id] ?? null,
      preparingLight: (this.lightWait[c.id] ?? 0) > now() && !findReceived(c.id),
    }));
    const readyToCopy = this.serverClips.filter((c) => c.status === 'ready' && !hasReceived(c.id)).length;
    this.emit({ clips: withLocal, readyToCopy });
  }
}
