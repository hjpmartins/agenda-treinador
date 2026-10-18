import { File } from 'expo-file-system';
import { addReceived, destinationFor, hasReceived } from './receivedLibrary';
import { fetchJson, randomId, type RemoteClip } from './RemoteClient';

/** Um jogo gravado no telemóvel, para rever no tablet. */
export type PhoneGame = {
  id: string;
  startedAtMs: number;
  durationMs: number;
  quality: string;
  clips: number;
  /** Partes do vídeo completo (normalmente uma), em tempo de jogo. */
  parts: { index: number; startMs: number; endMs: number; sizeBytes: number }[];
};

export type ReviewClip = RemoteClip & { localUri?: string | null };

/**
 * "Rever jogo": o tablet vê o vídeo completo a partir do telemóvel (sem o copiar)
 * e pede clips; o telemóvel corta-os do vídeo e o tablet copia-os para a lista
 * de clips, junto com os do mesmo jogo.
 */
export class ReviewClient {
  private clips: ReviewClip[] = [];
  private listeners = new Set<(clips: ReviewClip[]) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private downloading = false;
  private failed: Record<string, number> = {};

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    readonly game: PhoneGame,
    private readonly phoneName: string
  ) {}

  static async listGames(baseUrl: string, token: string): Promise<PhoneGame[]> {
    const body = await fetchJson(`${baseUrl}/api/sessions`, token, {}, 8000);
    return body.sessions ?? [];
  }

  /** Endereço do vídeo de uma parte (o código vai no endereço: o leitor de vídeo não manda cabeçalhos). */
  videoUrl(part: number): string {
    return `${this.baseUrl}/api/sessions/${encodeURIComponent(this.game.id)}/video/${part}?token=${encodeURIComponent(this.token)}`;
  }

  subscribe(l: (clips: ReviewClip[]) => void): () => void {
    this.listeners.add(l);
    l(this.clips);
    return () => this.listeners.delete(l);
  }

  private publish() {
    this.listeners.forEach((l) => l(this.clips));
  }

  start() {
    this.timer = setInterval(() => this.poll(), 2000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Pede o clip [startMs, endMs] (tempo de jogo). Devolve o id (para guardar motivo, jogadoras…). */
  requestClip(startMs: number, endMs: number): string {
    const id = randomId();
    const placeholder: ReviewClip = {
      id,
      sessionId: this.game.id,
      name: 'Clip',
      status: 'queued',
      requestedStartMs: startMs,
      requestedEndMs: endMs,
      startMs,
      endMs,
      createdAtMs: Date.now(),
      sizeBytes: 0,
      error: null,
    };
    this.clips = [...this.clips, placeholder];
    this.publish();
    this.send(placeholder);
    return id;
  }

  private async send(c: ReviewClip, attempt = 0) {
    try {
      const clip: RemoteClip = await fetchJson(
        `${this.baseUrl}/api/sessions/${encodeURIComponent(this.game.id)}/clip`,
        this.token,
        { method: 'POST', body: JSON.stringify({ id: c.id, startMs: c.requestedStartMs, endMs: c.requestedEndMs, name: null }) },
        8000
      );
      this.merge([clip]);
    } catch (e) {
      const status = (e as any)?.status;
      if (status == null && attempt < 5) {
        setTimeout(() => this.send(c, attempt + 1), 2000);
        return;
      }
      this.merge([{ ...c, status: 'failed', error: e instanceof Error ? e.message : String(e) }]);
    }
  }

  private merge(updates: RemoteClip[]) {
    const mine = new Set(this.clips.map((c) => c.id));
    this.clips = this.clips.map((c) => {
      const u = updates.find((x) => x.id === c.id);
      return u ? { ...c, ...u, localUri: c.localUri } : c;
    });
    if (updates.some((u) => mine.has(u.id))) this.publish();
  }

  private async poll() {
    if (!this.clips.some((c) => c.status === 'pending' || c.status === 'cutting' || (c.status === 'ready' && !c.localUri))) return;
    try {
      const body = await fetchJson(`${this.baseUrl}/api/sessions/${encodeURIComponent(this.game.id)}/clips`, this.token);
      this.merge(body.clips ?? []);
    } catch {
      // sem ligação: tenta outra vez
    }
    this.downloadNext();
  }

  private async downloadNext() {
    if (this.downloading) return;
    const next = this.clips.find((c) => c.status === 'ready' && !c.localUri && (this.failed[c.id] ?? 0) < 5);
    if (!next) return;
    this.downloading = true;
    const dest = destinationFor(this.game.id, next.id);
    try {
      if (!hasReceived(next.id)) {
        await File.downloadFileAsync(
          `${this.baseUrl}/api/sessions/${encodeURIComponent(this.game.id)}/clips/${encodeURIComponent(next.id)}/file`,
          dest,
          { headers: { 'X-Token': this.token }, idempotent: true }
        );
        addReceived({
          id: next.id,
          sessionId: this.game.id,
          name: next.name,
          startMs: next.startMs,
          endMs: next.endMs,
          createdAtMs: next.createdAtMs,
          receivedAtMs: Date.now(),
          sizeBytes: dest.exists ? dest.size : next.sizeBytes,
          phone: this.phoneName,
          uri: dest.uri,
        });
      }
      this.clips = this.clips.map((c) => (c.id === next.id ? { ...c, localUri: dest.uri } : c));
      this.publish();
    } catch {
      this.failed[next.id] = (this.failed[next.id] ?? 0) + 1;
      try {
        if (dest.exists) dest.delete();
      } catch {
        // ignora
      }
    } finally {
      this.downloading = false;
    }
    this.downloadNext();
  }
}
