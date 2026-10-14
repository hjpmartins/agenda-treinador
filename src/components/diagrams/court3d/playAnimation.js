// Amostragem de um passo da jogada num instante t (0..1) para a vista 3D.
//
// As posições no plano (x, y) vêm de computeAnimatedPositions — exatamente as
// mesmas regras do leitor 2D (cortes movem quem tem tokenId, passes/lançamentos
// só movem a bola, drible e hand-off arrastam a bola com quem a leva). Aqui só
// se acrescenta o que o 2D não tem: a altura da bola (passes em arco, drible a
// saltar, lançamento ao cesto) e um ligeiro desvio lateral no drible para a
// bola não ficar enterrada dentro da ficha.

import { computeAnimatedPositions, positionOnArrow, arrowPolyline, pointAlongPolyline, assignCarriedBalls } from "../../../utils";

const BALL_R = 5.5;
const PUCK_H = 4.5;
const PUCK_R = 12;
const RIM_H = 61; // 3,05 m com o campo de 15 m = 300 unidades.

// Cestos em coordenadas do diagrama (mesma posição do ponto em HalfMarkings).
function rimPositions(court, vb) {
  const rims = [{ x: vb.w / 2, y: vb.h - 32 }];
  if (court === "campo") rims.push({ x: vb.w / 2, y: 32 });
  return rims;
}

// Direção da seta no instante t (para pôr a bola ao lado de quem dribla).
function arrowTangent(a, t) {
  const p0 = positionOnArrow(a, Math.max(0, t - 0.01));
  const p1 = positionOnArrow(a, Math.min(1, t + 0.01));
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function pathLength(a) {
  const pts = arrowPolyline(a);
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

// Que seta move cada bola neste passo: a de drible/hand-off que a leva (mesma
// atribuição de computeAnimatedPositions) ou uma seta da própria bola.
function ballDrivers(diagram) {
  const carried = assignCarriedBalls(diagram);
  const drivers = {};
  diagram.arrows.forEach((a) => {
    if (a.tokenId && a.to && diagram.tokens.some((tk) => tk.id === a.tokenId && tk.type === "ball")) drivers[a.tokenId] = a;
  });
  diagram.arrows.forEach((a) => {
    if (carried[a.id]) drivers[carried[a.id]] = a;
  });
  return drivers;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const easeMove = (t) => t * 0.4 + (0.5 - 0.5 * Math.cos(Math.PI * t)) * 0.6;

function nearestRim(diagram, vb, p) {
  return rimPositions(diagram.court, vb).reduce((best, r) => {
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    return d < best.d ? { r, d } : best;
  }, { r: null, d: Infinity });
}

function sampleBall(diagram, ballTk, driver, positions, t, te, vb) {
  let { x, y } = positions[ballTk.id];
  let motionH = BALL_R;
  let shotPhase = 0;

  if (driver) {
    const len = pathLength(driver);
    const env = Math.sin(Math.PI * te);
    if (driver.type === "drible" || driver.type === "handoff") {
      // Bola ao lado de quem a leva (à direita do sentido de marcha); o
      // envelope leva o desvio a zero no início e no fim do passo.
      const tan = arrowTangent(driver, te);
      const side = (PUCK_R + BALL_R) * 0.9 * env;
      x += -tan.y * side;
      y += tan.x * side;
      if (driver.type === "drible") {
        const bounces = Math.max(2, Math.round(len / 32));
        motionH = BALL_R + Math.abs(Math.sin(te * Math.PI * bounces)) * 17 * Math.min(1, env * 3);
      } else {
        motionH = BALL_R + 12 * env;
      }
    } else if (driver.type === "lancamento") {
      const rim = nearestRim(diagram, vb, driver.to);
      const wps = driver.waypoints || [];
      // Com pontos de mudança, a bola primeiro percorre o caminho até ao
      // último ponto (rente ao chão) e só lá é lançada.
      const pre = wps.length ? 0.4 : 0;
      const start = wps.length ? wps[wps.length - 1] : driver.from;
      if (t < pre) {
        const u = t / pre;
        const p = pointAlongPolyline([driver.from, ...wps], u);
        x = p.x;
        y = p.y;
        motionH = BALL_R + 8 * Math.sin(Math.PI * u);
      } else if (rim.r && rim.d < 40) {
        // Arco até ao aro e queda pela rede.
        const k = pre + (1 - pre) * 0.82;
        if (t < k) {
          const u = (t - pre) / (k - pre);
          const dist = Math.hypot(rim.r.x - start.x, rim.r.y - start.y);
          const apex = 48 + dist * 0.25;
          x = start.x + (rim.r.x - start.x) * u;
          y = start.y + (rim.r.y - start.y) * u;
          motionH = BALL_R + 14 + (RIM_H + 4 - BALL_R - 14) * u + apex * 4 * u * (1 - u) * 0.6;
        } else {
          const u = (t - k) / (1 - k);
          x = rim.r.x;
          y = rim.r.y;
          motionH = RIM_H + 4 - (RIM_H + 4 - BALL_R) * u * u;
          shotPhase = 1 - u;
        }
      } else {
        const u = (t - pre) / (1 - pre);
        const p = pointAlongPolyline([start, driver.to], u);
        x = p.x;
        y = p.y;
        motionH = BALL_R + (30 + len * 0.2) * Math.sin(Math.PI * u);
      }
    } else if (driver.type === "passe") {
      motionH = BALL_R + 10 * env + Math.min(26, len * 0.1) * env;
    }
  }

  // Bola parada em cima de uma ficha (é como o 2D a mostra quando estão
  // sobrepostas) em vez de atravessá-la.
  let restH = BALL_R;
  diagram.tokens.forEach((tk) => {
    if (tk.type === "ball" || tk.type === "cone") return;
    const p = positions[tk.id];
    const d = Math.hypot(p.x - x, p.y - y);
    restH = Math.max(restH, BALL_R + PUCK_H * smoothstep(PUCK_R + BALL_R * 0.6, PUCK_R * 0.6, d));
  });

  return { id: ballTk.id, x, y, h: Math.max(restH, motionH), shotPhase };
}

/**
 * Devolve { positions: {id: {x, y}}, balls: [{id, x, y, h, shotPhase}] } para
 * o passo `diagram` no instante t. `shotPhase` > 0 quando a bola acabou de
 * entrar no cesto (para o aro piscar).
 */
function sampleStep(diagram, t, vb) {
  const te = easeMove(t);
  const overrides = computeAnimatedPositions(diagram, te);
  const positions = {};
  diagram.tokens.forEach((tk) => {
    const o = overrides[tk.id];
    positions[tk.id] = o ? { x: o.x, y: o.y } : { x: tk.x, y: tk.y };
  });
  const drivers = ballDrivers(diagram);
  const balls = diagram.tokens.filter((tk) => tk.type === "ball").map((b) => sampleBall(diagram, b, drivers[b.id], positions, t, te, vb));
  return { positions, balls };
}

export { sampleStep, rimPositions, BALL_R, PUCK_H, PUCK_R, RIM_H };
