/** Conteúdo do QR mostrado pelo telemóvel que grava. */
export type Pairing = {
  ssid: string | null;
  passphrase: string | null;
  security: string;
  ips: string[];
  port: number;
  token: string;
};

const PREFIX = 'CLIPSJOGO1:';

export function encodePairing(p: Pairing): string {
  return (
    PREFIX +
    JSON.stringify({ s: p.ssid, p: p.passphrase, k: p.security, i: p.ips, o: p.port, t: p.token })
  );
}

/** Devolve null se o QR não for desta app. */
export function decodePairing(text: string): Pairing | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(text.slice(PREFIX.length));
    if (!Array.isArray(o.i) || typeof o.o !== 'number' || typeof o.t !== 'string') return null;
    return {
      ssid: typeof o.s === 'string' ? o.s : null,
      passphrase: typeof o.p === 'string' ? o.p : null,
      security: typeof o.k === 'string' ? o.k : 'wpa2',
      ips: o.i.filter((x: unknown) => typeof x === 'string'),
      port: o.o,
      token: o.t,
    };
  } catch {
    return null;
  }
}
