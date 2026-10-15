/** Os jogos são para aprender logo: guardam-se só os mais recentes. */
export const KEEP_GAMES = 3;

/** Jogos (sessionId) a apagar: todos menos os `keep` mais recentes. */
export function sessionsToPrune(clips: { sessionId: string; createdAtMs: number }[], keep = KEEP_GAMES): string[] {
  const latest = new Map<string, number>();
  for (const c of clips) latest.set(c.sessionId, Math.max(latest.get(c.sessionId) ?? 0, c.createdAtMs));
  return [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(keep)
    .map(([id]) => id);
}

/** O jogo que será apagado quando começar o próximo (para avisar), ou null. */
export function nextToPrune(clips: { sessionId: string; createdAtMs: number }[], keep = KEEP_GAMES): string | null {
  return sessionsToPrune(clips, keep - 1)[0] ?? null;
}
