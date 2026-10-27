// Desenho de um frame de uma jogada (campo de madeira + setas + fichas) num
// <canvas> 2D normal — partilhado entre a exportação em GIF e em vídeo, para
// as duas corresponderem sempre ao que se vê no estúdio de jogadas.

import { HALF_VB, FULL_VB } from "../data";
import { hasWaypoints, arrowPathPoints, defaultControlPoint } from "../utils";
import { drawCourtCanvas, drawTokenTopCanvas } from "../components/diagrams/court3d/courtCanvas";

const STEP_MS = 1400; // duração da transição de um passo, igual à animação do editor
const PAUSE_MS = 550; // pausa no fim de cada passo, antes de avançar para o seguinte
const ARROW_COLOR = "#C7CDD8";

function drawBall(ctx, x, y) {
  ctx.fillStyle = "#EA5B13";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#14181F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.stroke();
}

function drawCone(ctx, x, y) {
  ctx.fillStyle = "#F2C744";
  ctx.strokeStyle = "#14181F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x + 8, y + 8);
  ctx.lineTo(x - 8, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Tampo das fichas (jogadora/defesa/treinador) desenhado numa textura à parte
// (courtCanvas.js) e colado aqui em cima, já no sítio certo — mesma imagem
// usada na vista 3D, só que achatada sobre o campo em vez de num cilindro.
function drawTokenTop(ctx, cache, token) {
  const key = `${token.type}|${token.number ?? ""}`;
  let top = cache.get(key);
  if (!top) {
    top = drawTokenTopCanvas(token.type, token.number);
    cache.set(key, top);
  }
  const r = token.type === "treinador" ? 10 : 12;
  ctx.save();
  if (token.type !== "treinador") {
    ctx.beginPath();
    ctx.arc(token.x, token.y, r, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(top, token.x - r, token.y - r, r * 2, r * 2);
  ctx.restore();
}

function drawToken(ctx, cache, token) {
  if (token.type === "ball") return drawBall(ctx, token.x, token.y);
  if (token.type === "cone") return drawCone(ctx, token.x, token.y);
  drawTokenTop(ctx, cache, token);
}

// Réplica, em canvas, do ArrowShape de CourtPrimitives.jsx — mesma paleta e
// geometria (incluindo waypoints/hand-off).
function drawArrow(ctx, a) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (a.type === "bloqueio") {
    ctx.strokeStyle = ARROW_COLOR;
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.beginPath();
    if (a.at) {
      ctx.moveTo(a.at.x - 9, a.at.y);
      ctx.lineTo(a.at.x + 9, a.at.y);
    } else if (hasWaypoints(a)) {
      const pts = arrowPathPoints(a);
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    } else {
      ctx.moveTo(a.from.x, a.from.y);
      ctx.lineTo(a.to.x, a.to.y);
    }
    ctx.stroke();
    return;
  }

  const { from, to } = a;
  const isShot = a.type === "lancamento";
  const isHandoff = a.type === "handoff" || a.type === "ressalto";
  const control = a.control || defaultControlPoint(a.type, from, to);
  const multi = hasWaypoints(a);
  const pts = multi ? arrowPathPoints(a) : null;

  ctx.strokeStyle = ARROW_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash(a.type === "passe" || isShot ? [6, 4] : []);
  ctx.beginPath();
  if (multi) {
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (isShot) {
    ctx.beginPath();
    ctx.arc(to.x, to.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ARROW_COLOR;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const tipFrom = multi ? pts.slice(-2)[0] : control;
    const angle = Math.atan2(to.y - tipFrom.y, to.x - tipFrom.x);
    const size = 7;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x + size * Math.cos(angle + Math.PI - 0.4), to.y + size * Math.sin(angle + Math.PI - 0.4));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x + size * Math.cos(angle + Math.PI + 0.4), to.y + size * Math.sin(angle + Math.PI + 0.4));
    ctx.stroke();
  }

  // Marcador de bola a meio da linha — hand-off e ressalto, que terminam
  // sempre em cima de outra ficha (quem recebe / a bola solta).
  if (isHandoff) {
    ctx.fillStyle = "#EA5B13";
    ctx.strokeStyle = ARROW_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0.25 * from.x + 0.5 * control.x + 0.25 * to.x, 0.25 * from.y + 0.5 * control.y + 0.25 * to.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Cria as caches reutilizáveis entre frames (a madeira é cara de gerar —
// ruído pixel a pixel — por isso só se gera uma vez por tipo de campo).
function createFrameCaches() {
  const courtCache = new Map();
  const tokenCache = new Map();
  const getCourtCanvas = (court, vb) => {
    const key = `${court}|${vb.w}x${vb.h}`;
    let c = courtCache.get(key);
    if (!c) {
      c = drawCourtCanvas(court, vb);
      courtCache.set(key, c);
    }
    return c;
  };
  return { getCourtCanvas, tokenCache };
}

// Desenha um diagrama (campo + setas + fichas, com posições já animadas em
// `overrides`) num canvas de width×height.
function drawDiagramFrame(ctx, diagram, overrides, width, height, caches) {
  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const wood = caches.getCourtCanvas(diagram.court, vb);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(wood, 0, 0, wood.width, wood.height, 0, 0, width, height);
  ctx.save();
  ctx.scale(width / vb.w, height / vb.h);
  diagram.arrows.forEach((a) => drawArrow(ctx, a));
  diagram.tokens.forEach((t) => drawToken(ctx, caches.tokenCache, overrides && overrides[t.id] ? { ...t, ...overrides[t.id] } : t));
  ctx.restore();
}

export { STEP_MS, PAUSE_MS, createFrameCaches, drawDiagramFrame };
