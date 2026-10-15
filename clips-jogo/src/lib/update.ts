/** Atualizações publicadas como Releases do GitHub (tag "clips-jogo-v<versão>"). */

export const RELEASES_URL = 'https://api.github.com/repos/hjpmartins/agenda-treinador/releases?per_page=30';
export const TAG_PREFIX = 'clips-jogo-v';

export type ReleaseInfo = {
  version: string;
  notes: string;
  apkUrl: string;
  sizeBytes: number;
};

type GhAsset = { name?: string; browser_download_url?: string; size?: number };
type GhRelease = { tag_name?: string; body?: string | null; draft?: boolean; prerelease?: boolean; assets?: GhAsset[] };

function parts(v: string): number[] {
  return v.split(/[.-]/).map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** >0 se a for mais recente que b. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** A versão mais recente publicada, se for mais nova do que a instalada. */
export function pickUpdate(releases: unknown, currentVersion: string): ReleaseInfo | null {
  if (!Array.isArray(releases)) return null;
  let best: ReleaseInfo | null = null;
  for (const r of releases as GhRelease[]) {
    if (!r || r.draft || r.prerelease || typeof r.tag_name !== 'string' || !r.tag_name.startsWith(TAG_PREFIX)) continue;
    const version = r.tag_name.slice(TAG_PREFIX.length);
    const apk = (r.assets ?? []).find((a) => a.name?.endsWith('.apk') && a.browser_download_url);
    if (!apk) continue;
    if (best && compareVersions(version, best.version) <= 0) continue;
    best = { version, notes: (r.body ?? '').trim(), apkUrl: apk.browser_download_url!, sizeBytes: apk.size ?? 0 };
  }
  return best && compareVersions(best.version, currentVersion) > 0 ? best : null;
}

/** Pergunta ao GitHub (precisa de internet). Lança erro se não conseguir. */
export async function fetchUpdate(currentVersion: string, timeoutMs = 8000): Promise<ReleaseInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
    return pickUpdate(await res.json(), currentVersion);
  } finally {
    clearTimeout(timer);
  }
}
