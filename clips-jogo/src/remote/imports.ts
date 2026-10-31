import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { addEngineListener, ClipEngine } from '../../modules/clip-engine';
import { hideProgress, showProgress } from '../components/exportShare';
import { addReceived, destinationFor } from './receivedLibrary';
import { randomId, type RemoteClip } from './RemoteClient';

/**
 * Vídeos importados no tablet (outro telemóvel, GoPro, YouTube…): ficam dentro da
 * app e servem para fazer clips como no "Rever jogo". Uma GoPro divide o jogo em
 * vários ficheiros: escolhem-se todos de uma vez e ficam como partes seguidas.
 */
export type ImportedPart = { uri: string; startMs: number; endMs: number };
export type ImportedVideo = { id: string; name: string; createdAtMs: number; durationMs: number; parts: ImportedPart[] };

const dir = () => new Directory(Paths.document, 'importados');
const indexFile = () => new File(dir(), 'index.json');
let cache: ImportedVideo[] | null = null;
const listeners = new Set<(v: ImportedVideo[]) => void>();

export function listImports(): ImportedVideo[] {
  if (cache) return cache;
  try {
    dir().create({ intermediates: true, idempotent: true });
    const f = indexFile();
    cache = f.exists ? (JSON.parse(f.textSync()) as ImportedVideo[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(list: ImportedVideo[]) {
  cache = list;
  dir().create({ intermediates: true, idempotent: true });
  indexFile().write(JSON.stringify(list));
  listeners.forEach((l) => l(list));
}

export function subscribeImports(l: (v: ImportedVideo[]) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** "20261031-214500-imp": começa pela data, como os jogos gravados (a lista mostra "jogo de 31/10 21:45"). */
function newId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-imp`;
}

/** Escolher um ou mais vídeos e copiá-los para a app. null se o utilizador cancelar. */
export async function importFromPicker(): Promise<ImportedVideo | null> {
  if (!ClipEngine) throw new Error('Indisponível neste dispositivo.');
  const picked = await DocumentPicker.getDocumentAsync({ type: 'video/*', multiple: true, copyToCacheDirectory: false });
  if (picked.canceled || !picked.assets?.length) return null;
  // GoPro: GX010123, GX020123… — pela ordem do nome.
  const assets = [...picked.assets].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const id = newId();
  const folder = new Directory(dir(), id);
  folder.create({ intermediates: true, idempotent: true });
  const parts: ImportedPart[] = [];
  let t = 0;
  let index = 0;
  const sub = addEngineListener('onImportProgress', ({ progress }) =>
    showProgress((index + progress) / assets.length, `A importar ${assets.length > 1 ? `${index + 1}/${assets.length}` : 'o vídeo'}…`)
  );
  try {
    for (; index < assets.length; index++) {
      const a = assets[index];
      showProgress(index / assets.length, `A importar ${assets.length > 1 ? `${index + 1}/${assets.length}` : 'o vídeo'}…`);
      const ext = (/\.(\w{2,4})$/.exec(a.name)?.[1] ?? 'mp4').toLowerCase();
      const uri = await ClipEngine.importCopy(a.uri, new File(folder, `parte-${index + 1}.${ext}`).uri);
      const info = await ClipEngine.probeVideo(uri);
      parts.push({ uri, startMs: t, endMs: t + info.durationMs });
      t += info.durationMs;
    }
  } catch (e) {
    try {
      folder.delete();
    } catch {
      // ignora
    }
    throw e;
  } finally {
    sub?.remove();
    hideProgress();
  }
  const name = assets.length > 1 ? `${assets[0].name} (+${assets.length - 1})` : assets[0].name;
  const video: ImportedVideo = { id, name: name.replace(/\.\w{2,4}$/, ''), createdAtMs: Date.now(), durationMs: t, parts };
  save([video, ...listImports()]);
  return video;
}

/** Apaga o vídeo importado (os clips feitos dele ficam). */
export function deleteImport(id: string) {
  try {
    const d = new Directory(dir(), id);
    if (d.exists) d.delete();
  } catch {
    // ignora
  }
  save(listImports().filter((v) => v.id !== id));
}

export type LocalClip = RemoteClip & { localUri?: string | null };

/**
 * Faz os clips de um vídeo importado, no próprio tablet (um de cada vez), e põe-nos
 * na lista de clips (junto, como um jogo). Tem a mesma forma que o ReviewClient.
 */
export class ImportClipper {
  private clips: LocalClip[] = [];
  private listeners = new Set<(c: LocalClip[]) => void>();
  private busy = false;

  constructor(readonly video: ImportedVideo) {}

  start() {}
  stop() {}

  subscribe(l: (c: LocalClip[]) => void): () => void {
    this.listeners.add(l);
    l(this.clips);
    return () => this.listeners.delete(l);
  }

  private publish() {
    this.listeners.forEach((l) => l(this.clips));
  }

  private update(id: string, patch: Partial<LocalClip>) {
    this.clips = this.clips.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.publish();
  }

  /** O vídeo de cada parte (no tablet). */
  videoUrl(part: number): string {
    return this.video.parts[part]?.uri ?? '';
  }

  requestClip(startMs: number, endMs: number): string {
    const id = randomId();
    const n = this.clips.length + 1;
    this.clips = [
      ...this.clips,
      {
        id,
        sessionId: this.video.id,
        name: `Clip ${n}`,
        status: 'pending',
        requestedStartMs: startMs,
        requestedEndMs: endMs,
        startMs,
        endMs,
        createdAtMs: Date.now(),
        sizeBytes: 0,
        error: null,
      },
    ];
    this.publish();
    this.next();
    return id;
  }

  private async next() {
    if (this.busy || !ClipEngine) return;
    const c = this.clips.find((x) => x.status === 'pending');
    if (!c) return;
    this.busy = true;
    this.update(c.id, { status: 'cutting' });
    try {
      // O clip fica dentro da parte onde acaba (os clips não atravessam partes).
      const part = this.video.parts.find((p) => c.requestedEndMs <= p.endMs + 1) ?? this.video.parts[this.video.parts.length - 1];
      const from = Math.max(part.startMs, c.requestedStartMs);
      const dest = destinationFor(this.video.id, c.id);
      const r = await ClipEngine.cutLocal(part.uri, from - part.startMs, c.requestedEndMs - part.startMs, dest.uri);
      const startMs = part.startMs + r.startMs;
      const endMs = part.startMs + r.endMs;
      addReceived({
        id: c.id,
        sessionId: this.video.id,
        name: c.name,
        startMs,
        endMs,
        createdAtMs: c.createdAtMs,
        receivedAtMs: Date.now(),
        sizeBytes: r.sizeBytes,
        phone: `vídeo importado "${this.video.name}"`,
        uri: dest.uri,
      });
      this.update(c.id, { status: 'ready', startMs, endMs, sizeBytes: r.sizeBytes, localUri: dest.uri });
    } catch (e) {
      this.update(c.id, { status: 'failed', error: e instanceof Error ? e.message : String(e) });
    } finally {
      this.busy = false;
    }
    this.next();
  }
}
