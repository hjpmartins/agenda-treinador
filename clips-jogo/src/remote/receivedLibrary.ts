import { Directory, File, Paths } from 'expo-file-system';

/** Um clip que já está guardado no tablet. */
export type ReceivedClip = {
  id: string;
  sessionId: string;
  name: string;
  startMs: number;
  endMs: number;
  createdAtMs: number;
  receivedAtMs: number;
  sizeBytes: number;
  phone: string;
  uri: string;
};

const dir = () => new Directory(Paths.document, 'recebidos');
const indexFile = () => new File(dir(), 'index.json');
const deletedFile = () => new File(dir(), 'apagados.json');

function ensureDir() {
  dir().create({ intermediates: true, idempotent: true });
}

let cache: ReceivedClip[] | null = null;
const listeners = new Set<(clips: ReceivedClip[]) => void>();

/** Clips guardados no tablet (os que já não existem em disco são ignorados). */
export function listReceived(): ReceivedClip[] {
  if (cache) return cache;
  try {
    ensureDir();
    const f = indexFile();
    const all: ReceivedClip[] = f.exists ? JSON.parse(f.textSync()) : [];
    cache = all.filter((c) => new File(c.uri).exists);
  } catch {
    cache = [];
  }
  return cache;
}

function save(clips: ReceivedClip[]) {
  cache = clips;
  ensureDir();
  indexFile().write(JSON.stringify(clips));
  listeners.forEach((l) => l(clips));
}

export function subscribeReceived(listener: (clips: ReceivedClip[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let deletedIds: Set<string> | null = null;

function deleted(): Set<string> {
  if (!deletedIds) {
    try {
      const f = deletedFile();
      deletedIds = new Set(f.exists ? JSON.parse(f.textSync()) : []);
    } catch {
      deletedIds = new Set();
    }
  }
  return deletedIds;
}

/** Já está no tablet, ou foi apagado de propósito (não voltar a transferir). */
export function hasReceived(id: string): boolean {
  return deleted().has(id) || listReceived().some((c) => c.id === id);
}

export function findReceived(id: string): ReceivedClip | undefined {
  return listReceived().find((c) => c.id === id);
}

/** Ficheiro de destino para um clip (pasta por gravação). */
export function destinationFor(sessionId: string, clipId: string): File {
  const sessionDir = new Directory(dir(), sessionId.replace(/[^A-Za-z0-9_-]/g, '_'));
  sessionDir.create({ intermediates: true, idempotent: true });
  return new File(sessionDir, `${clipId}.mp4`);
}

export function addReceived(clip: ReceivedClip) {
  save([...listReceived().filter((c) => c.id !== clip.id), clip]);
}

export function deleteReceived(id: string) {
  const clip = findReceived(id);
  if (clip) {
    try {
      const f = new File(clip.uri);
      if (f.exists) f.delete();
    } catch {
      // já não existe
    }
  }
  const d = deleted();
  d.add(id);
  try {
    ensureDir();
    deletedFile().write(JSON.stringify([...d].slice(-500)));
  } catch {
    // não é crítico
  }
  save(listReceived().filter((c) => c.id !== id));
}
