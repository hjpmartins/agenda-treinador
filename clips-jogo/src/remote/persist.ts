import { Directory, File, Paths } from 'expo-file-system';
import type { Pairing } from './pairing';

/** Pequenos ficheiros de estado do modo Comando, para sobreviver a reinícios da app. */
const dir = () => new Directory(Paths.document, 'comando');

function read<T>(name: string, fallback: T): T {
  try {
    const f = new File(dir(), name);
    return f.exists ? (JSON.parse(f.textSync()) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown) {
  try {
    dir().create({ intermediates: true, idempotent: true });
    new File(dir(), name).write(JSON.stringify(value));
  } catch {
    // não é crítico: na pior das hipóteses perde-se a fila ao reiniciar
  }
}

export const loadLastPairing = () => read<Pairing | null>('ultimo-telemovel.json', null);
export const saveLastPairing = (p: Pairing) => write('ultimo-telemovel.json', p);

export function loadQueue<T>(token: string): T[] {
  const saved = read<{ token: string; items: T[] } | null>('fila.json', null);
  return saved && saved.token === token ? saved.items : [];
}
export const saveQueue = <T>(token: string, items: T[]) => write('fila.json', { token, items });
