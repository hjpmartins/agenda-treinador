/**
 * Zoom no leitor (dois dedos): escala s e deslocamento (x, y) em píxeis, à volta
 * do centro da imagem. A imagem nunca sai da caixa (nem fica mais pequena).
 */
export type Zoom = { s: number; x: number; y: number };
export type XY = { x: number; y: number };

export const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };
export const MAX_ZOOM = 5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function clampZoom(z: Zoom, w: number, h: number): Zoom {
  const s = clamp(z.s, 1, MAX_ZOOM);
  const mx = ((s - 1) * w) / 2;
  const my = ((s - 1) * h) / 2;
  // "|| 0" evita -0 (mais fácil de comparar).
  return { s, x: clamp(z.x, -mx, mx) || 0, y: clamp(z.y, -my, my) || 0 };
}

/**
 * Beliscar: o ponto da imagem que estava debaixo dos dedos no início continua
 * debaixo dos dedos (pontos relativos ao canto da caixa w×h).
 */
export function pinchZoom(start: Zoom, startMid: XY, startDist: number, mid: XY, dist: number, w: number, h: number): Zoom {
  const s = clamp(start.s * (dist / Math.max(1, startDist)), 1, MAX_ZOOM);
  // Ponto da imagem (sem zoom, relativo ao centro) que estava debaixo dos dedos.
  const px = (startMid.x - w / 2 - start.x) / start.s;
  const py = (startMid.y - h / 2 - start.y) / start.s;
  return clampZoom({ s, x: mid.x - w / 2 - s * px, y: mid.y - h / 2 - s * py }, w, h);
}

/** Dois toques: aproxima nesse ponto (ou volta ao normal se já tinha zoom). */
export function doubleTapZoom(current: Zoom, at: XY, w: number, h: number, scale = 2.5): Zoom {
  if (current.s > 1.01) return NO_ZOOM;
  return clampZoom({ s: scale, x: -(at.x - w / 2) * (scale - 1), y: -(at.y - h / 2) * (scale - 1) }, w, h);
}

/** Parte da imagem à vista: [x, y, largura, altura] em 0..1, a partir do canto de cima à esquerda. */
export type Crop = [number, number, number, number];

/** Zoom do leitor → parte da imagem a pôr no vídeo enviado (null sem zoom). */
export function zoomToCrop(z: Zoom, w: number, h: number): Crop | null {
  if (z.s <= 1.01 || w <= 0 || h <= 0) return null;
  const cw = 1 / z.s;
  const ch = 1 / z.s;
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return [round(0.5 - (0.5 + z.x / w) * cw), round(0.5 - (0.5 + z.y / h) * ch), round(cw), round(ch)];
}

/** O inverso: ao voltar a abrir o clip, o leitor mostra o mesmo zoom. */
export function cropToZoom(c: Crop | null | undefined, w: number, h: number): Zoom {
  if (!c || c[2] >= 0.999) return NO_ZOOM;
  const s = 1 / c[2];
  return clampZoom({ s, x: ((0.5 - c[0]) * s - 0.5) * w, y: ((0.5 - c[1]) * s - 0.5) * h }, w, h);
}
