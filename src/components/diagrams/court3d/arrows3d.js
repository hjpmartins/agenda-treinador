// Setas desenhadas no chão do campo 3D como fitas (ribbons) com um shader
// próprio: tracejado para passe/lançamento, "revelação" progressiva durante a
// animação (a parte já percorrida fica acesa, o resto esbatido) e um halo
// suave por baixo para dar o ar de néon sobre a madeira.

import * as THREE from "three";
import { defaultControlPoint, hasWaypoints, arrowPathPoints, positionOnArrow } from "../../../utils";

const LIFT = 0.35; // acima do soalho, para não haver z-fighting.

const vertexShader = /* glsl */ `
  attribute float aDist;
  attribute float aSide;
  varying float vDist;
  varying float vSide;
  void main() {
    vDist = aDist;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uDash;
  uniform float uGap;
  uniform float uDim;
  uniform float uGlow;
  uniform float uHead;
  varying float vDist;
  varying float vSide;
  void main() {
    if (uDash > 0.0 && mod(vDist, uDash + uGap) > uDash) discard;
    float lit = step(vDist, uReveal);
    float a;
    if (uGlow > 0.5) {
      a = exp(-vSide * vSide * 3.5) * 0.45;
    } else {
      a = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
    }
    a *= mix(uDim, 1.0, lit) * uOpacity;
    // Ponto brilhante na "cabeça" da revelação enquanto a jogada corre.
    float head = uHead * exp(-pow(vDist - uReveal, 2.0) / 18.0) * lit;
    vec3 col = uColor + head * 0.6;
    a = clamp(a + head * (uGlow > 0.5 ? 0.25 : 0.0), 0.0, 1.0);
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

function makeMaterial({ color, dash = 0, gap = 0, glow = false }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uReveal: { value: 1e6 },
      uDash: { value: dash },
      uGap: { value: gap },
      uDim: { value: 0.28 },
      uGlow: { value: glow ? 1 : 0 },
      uHead: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// Constrói uma fita ao longo de uma polilinha (pontos em coordenadas do mundo
// x/z). `distOverride` força a distância de todos os vértices (usado nas pontas
// das setas, que só acendem quando a revelação chega ao fim).
function ribbonGeometry(points, width, distOverride = null) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  const dist = new Float32Array(n * 2);
  const side = new Float32Array(n * 2);
  const idx = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (i > 0) acc += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz * (width / 2);
    const nz = tx * (width / 2);
    pos.set([p.x + nx, LIFT, p.z + nz, p.x - nx, LIFT, p.z - nz], i * 6);
    const d = distOverride ?? acc;
    dist[i * 2] = d;
    dist[i * 2 + 1] = d;
    side[i * 2] = 1;
    side[i * 2 + 1] = -1;
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setIndex(idx);
  return { geometry: g, length: acc };
}

// Triângulo cheio para a ponta da seta (aSide = 0 => opaco em toda a área).
function headGeometry(tip, dir, size, dist) {
  const nx = -dir.z;
  const nz = dir.x;
  const back = { x: tip.x - dir.x * size * 1.3, z: tip.z - dir.z * size * 1.3 };
  const pts = [tip.x, LIFT, tip.z, back.x + nx * size * 0.75, LIFT, back.z + nz * size * 0.75, back.x - nx * size * 0.75, LIFT, back.z - nz * size * 0.75];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  g.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array([dist, dist, dist]), 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 1));
  return g;
}

function ringGeometry(center, r, width, dist, segments = 40) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r });
  }
  return ribbonGeometry(pts, width, dist).geometry;
}

function discGeometry(center, r, dist) {
  const g = new THREE.CircleGeometry(r, 24);
  g.rotateX(-Math.PI / 2);
  g.translate(center.x, LIFT + 0.05, center.z);
  const count = g.attributes.position.count;
  g.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array(count).fill(dist), 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(count).fill(0), 1));
  return g;
}

// Pontos ao longo do caminho da seta: a curva suave pelos pontos de mudança
// de direção (subdividida, para a ondulação do drible), ou a quadrática.
function sampleCurve(arrow, control, segments, wavy) {
  const { from, to } = arrow;
  const raw = [];
  if (hasWaypoints(arrow)) {
    const poly = arrowPathPoints(arrow);
    raw.push({ x: poly[0].x, y: poly[0].y });
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const n = wavy ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3)) : 1;
      for (let k = 1; k <= n; k++) raw.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  } else {
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      raw.push({
        x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
        y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
      });
    }
  }
  if (!wavy) return raw;
  // Ondulação do drible: sinusoide perpendicular à curva, a apagar-se no fim
  // para a ponta da seta assentar direita.
  let total = 0;
  const acc = [0];
  for (let i = 1; i < raw.length; i++) {
    total += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
    acc.push(total);
  }
  const waves = Math.max(2, Math.round(total / 22));
  return raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const s = acc[i] / (total || 1);
    const fade = Math.min(1, (1 - s) * 6) * Math.min(1, s * 12);
    const off = Math.sin(s * waves * Math.PI * 2) * 4.5 * fade;
    return { x: p.x + (-dy / l) * off, y: p.y + (dx / l) * off };
  });
}

/**
 * Cria um THREE.Group com todas as setas de um diagrama. `toWorld(p)` converte
 * {x, y} do diagrama para {x, z} do mundo. Devolve { group, setProgress, dispose }.
 */
function buildArrows(diagram, toWorld, { highlightId = null } = {}) {
  const group = new THREE.Group();
  const items = []; // { materials: [], length }

  diagram.arrows.forEach((arrow) => {
    // Seta selecionada no editor fica laranja.
    const color = arrow.id === highlightId ? "#FF6B1A" : "#F2EDE3";
    const mats = [];
    const add = (geometry, mat) => {
      const m = new THREE.Mesh(geometry, mat);
      m.renderOrder = mat.uniforms.uGlow.value ? 2 : 3;
      group.add(m);
      if (!mats.includes(mat)) mats.push(mat);
    };

    if (arrow.type === "bloqueio") {
      const from = arrow.at ? { x: arrow.at.x - 9, y: arrow.at.y } : arrow.from;
      const to = arrow.at ? { x: arrow.at.x + 9, y: arrow.at.y } : arrow.to;
      const pts = (!arrow.at && hasWaypoints(arrow) ? arrowPathPoints(arrow) : [from, to]).map(toWorld);
      const core = makeMaterial({ color });
      const glow = makeMaterial({ color, glow: true });
      const r = ribbonGeometry(pts, 4.5);
      add(ribbonGeometry(pts, 16).geometry, glow);
      add(r.geometry, core);
      // Barra do bloqueio (T) na extremidade.
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * 9;
      const nz = (dx / l) * 9;
      add(ribbonGeometry([{ x: b.x + nx, z: b.z + nz }, { x: b.x - nx, z: b.z - nz }], 4.5, r.length).geometry, core);
      items.push({ mats, length: r.length });
      return;
    }

    const { from, to } = arrow;
    if (!from || !to) return;
    const control = arrow.control || defaultControlPoint(arrow.type, from, to);
    const isShot = arrow.type === "lancamento";
    const dashed = arrow.type === "passe" || isShot;
    const pts2d = sampleCurve(arrow, control, 48, arrow.type === "drible");
    const pts = pts2d.map(toWorld);

    const core = makeMaterial({ color, dash: dashed ? 6 : 0, gap: dashed ? 4 : 0 });
    const glow = makeMaterial({ color, glow: true, dash: dashed ? 6 : 0, gap: dashed ? 4 : 0 });
    const headMat = makeMaterial({ color });

    // Encurta a fita para a ponta não ficar por cima do traço.
    const headSize = 4.6;
    const r = ribbonGeometry(pts, 2.8);
    add(ribbonGeometry(pts, dashed ? 9 : 14).geometry, glow);
    add(r.geometry, core);

    const tipW = toWorld(to);
    if (isShot) {
      add(ringGeometry(tipW, 6, 2, r.length), headMat);
      add(discGeometry(tipW, 2.2, r.length), headMat);
    } else {
      const c = toWorld(hasWaypoints(arrow) ? arrowPathPoints(arrow).slice(-3)[0] : control);
      const dx = tipW.x - c.x;
      const dz = tipW.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      add(headGeometry(tipW, { x: dx / l, z: dz / l }, headSize, r.length), headMat);
    }
    if (arrow.type === "handoff" || arrow.type === "ressalto") {
      // Hand-off: marcador a meio (a seta termina em cima de quem recebe,
      // ficaria escondido). Ressalto: a seta também termina sempre em cima
      // da bola solta — mesma razão, mesmo sítio.
      const mid = toWorld(positionOnArrow(arrow.control || hasWaypoints(arrow) ? arrow : { ...arrow, control }, 0.5));
      const ballMat = makeMaterial({ color: "#EA5B13" });
      add(discGeometry(mid, 4, r.length / 2), ballMat);
    }
    items.push({ mats, length: r.length });
  });

  // progress: null => tudo aceso (pré-visualização); 0..1 => revelação.
  const setProgress = (progress, opacity = 1) => {
    items.forEach(({ mats, length }) => {
      mats.forEach((m) => {
        m.uniforms.uReveal.value = progress == null ? 1e6 : progress * length + 0.001;
        m.uniforms.uHead.value = progress == null || progress >= 1 || progress <= 0 ? 0 : 1;
        m.uniforms.uOpacity.value = opacity;
      });
    });
  };

  const dispose = () => {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  };

  return { group, setProgress, dispose };
}

export { buildArrows };
