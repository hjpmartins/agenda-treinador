// Amostragem de um passo da jogada num instante t (0..1) para a vista 3D.
//
// As posições no plano (x, y) vêm de computeAnimatedPositions — exatamente as
// mesmas regras do leitor 2D (cortes movem quem tem tokenId, passes/lançamentos
// só movem a bola, drible e hand-off arrastam a bola com quem a leva). Aqui só
// se acrescenta o que o 2D não tem: a altura da bola (passes em arco, drible a
// saltar, lançamento ao cesto) e um ligeiro desvio lateral no drible para a
// bola não ficar enterrada dentro da ficha.

import { computeAnimatedPositions } from "../../../utils";

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

function quadPoint(from, control, to, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
  };
}

// Mesma regra que positionOnArrow em utils: curva só se a seta tiver control.
function arrowTangent(a, t) {
  const p0 = a.control ? quadPoint(a.from, a.control, a.to, Math.max(0, t - 0.01)) : a.from;
  const p1 = a.control ? quadPoint(a.from, a.control, a.to, Math.min(1, t + 0.01)) : a.to;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// Que seta está a mover a bola neste passo (pela mesma ordem de prioridade de
// computeAnimatedPositions: hand-off > drible > seta da própria bola).
function ballDriver(diagram, ball) {
  if (!ball) return null;
  const handoff = diagram.arrows.find((a) => a.type === "handoff" && a.tokenId);
  if (handoff) return handoff;
  const drible = diagram.arrows.find((a) => a.type === "drible" && a.tokenId);
  if (drible) return drible;
  return diagram.arrows.find((a) => a.tokenId === ball.id && a.to) || null;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const easeMove = (t) => t * 0.4 + (0.5 - 0.5 * Math.cos(Math.PI * t)) * 0.6;

/**
 * Devolve { positions: {id: {x, y}}, ball: {id, x, y, h, shotPhase} | null }
 * para o passo `diagram` no instante t. `shotPhase` > 0 quando a bola acabou de
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

  const ballTk = diagram.tokens.find((tk) => tk.type === "ball");
  if (!ballTk) return { positions, ball: null };

  let { x, y } = positions[ballTk.id];
  let motionH = BALL_R;
  let shotPhase = 0;
  const driver = ballDriver(diagram, ballTk);

  if (driver) {
    const len = Math.hypot(driver.to.x - driver.from.x, driver.to.y - driver.from.y);
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
      const rims = rimPositions(diagram.court, vb);
      const rim = rims.reduce((best, r) => {
        const d = Math.hypot(r.x - driver.to.x, r.y - driver.to.y);
        return d < best.d ? { r, d } : best;
      }, { r: null, d: Infinity });
      const start = driver.from;
      if (rim.r && rim.d < 40) {
        // Arco até ao aro (82% do tempo) e queda pela rede.
        const k = 0.82;
        if (t < k) {
          const u = t / k;
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
        motionH = BALL_R + (30 + len * 0.2) * env;
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

  return { positions, ball: { id: ballTk.id, x, y, h: Math.max(restH, motionH), shotPhase } };
}

export { sampleStep, rimPositions, BALL_R, PUCK_H, PUCK_R, RIM_H };
