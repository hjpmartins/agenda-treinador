import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { DEFAULT_MOTIVES, type ClipNotes, type Player } from '../lib/annotations';

/**
 * Anotações dos clips no tablet (motivo, corte, desenhos) e lista de motivos.
 * Guardadas por id de clip, por isso servem antes e depois de o clip ser copiado.
 */
type Data = { notes: Record<string, ClipNotes>; motives: string[]; roster: Player[] };

const file = () => new File(Paths.document, 'anotacoes.json');
let data: Data | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): Data {
  if (data) return data;
  try {
    const f = file();
    const parsed = f.exists ? (JSON.parse(f.textSync()) as Partial<Data>) : {};
    data = {
      notes: parsed.notes ?? {},
      motives: parsed.motives?.length ? parsed.motives : DEFAULT_MOTIVES,
      roster: parsed.roster ?? [],
    };
  } catch {
    data = { notes: {}, motives: DEFAULT_MOTIVES, roster: [] };
  }
  return data;
}

function commit(next: Data) {
  data = next;
  version++;
  try {
    file().write(JSON.stringify(next));
  } catch {
    // não é crítico
  }
  listeners.forEach((l) => l());
}

export function getNotes(id: string): ClipNotes {
  return load().notes[id] ?? {};
}

export function setNotes(id: string, patch: Partial<ClipNotes>) {
  const d = load();
  commit({ ...d, notes: { ...d.notes, [id]: { ...d.notes[id], ...patch } } });
}

export function getMotives(): string[] {
  return load().motives;
}

export function setMotives(motives: string[]) {
  commit({ ...load(), motives });
}

/** Plantel (número + nome) para marcar as jogadoras nos clips. */
export function getRoster(): Player[] {
  return load().roster;
}

export function setRoster(roster: Player[]) {
  commit({ ...load(), roster });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renderiza quando alguma anotação ou a lista de motivos muda. */
export function useNotesVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function allNotes(): Record<string, ClipNotes> {
  return load().notes;
}
