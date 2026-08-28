import { emptyJogo, emptyPlayer, POSICOES } from "../data";

function normalizeJogo(s) {
  if (s.type !== "jogo") return s;
  let dirigentes = s.dirigentes;
  if (typeof dirigentes === "string") {
    dirigentes = dirigentes
      .split(",")
      .map((nome) => nome.trim())
      .filter(Boolean)
      .map((nome) => ({ id: uid(), nome, licenca: "" }));
  }
  return {
    ...emptyJogo,
    ...s,
    dirigentes: dirigentes || [],
    convocatoria: s.convocatoria || {},
    objetivosJogo: s.objetivosJogo || [],
    estatisticas: s.estatisticas || {},
  };
}
function emptyDiagram(court = "meio") {
  return { court, tokens: [], arrows: [] };
}
// Posição ao longo de uma seta num instante t (0..1): segue a curva Bezier
// quadrática (from, control, to) quando há um ponto de controlo definido,
// ou uma linha reta caso contrário.
function positionOnArrow(a, t) {
  if (a.control) {
    const mt = 1 - t;
    return {
      x: mt * mt * a.from.x + 2 * mt * t * a.control.x + t * t * a.to.x,
      y: mt * mt * a.from.y + 2 * mt * t * a.control.y + t * t * a.to.y,
    };
  }
  return { x: a.from.x + (a.to.x - a.from.x) * t, y: a.from.y + (a.to.y - a.from.y) * t };
}

function computeAnimatedPositions(diagram, t) {
  const overrides = {};
  diagram.arrows.forEach((a) => {
    // Bloqueios antigos (ponto único, sem tokenId) ficam de fora — não há para onde mover.
    if (!a.tokenId || !a.to) return;
    const token = diagram.tokens.find((tk) => tk.id === a.tokenId);
    if (!token) return;
    if ((a.type === "passe" || a.type === "lancamento") && token.type !== "ball") return;
    overrides[a.tokenId] = { ...token, ...positionOnArrow(a, t) };
  });
  const dribbleArrow = diagram.arrows.find((a) => a.type === "drible" && a.tokenId);
  if (dribbleArrow) {
    const ball = diagram.tokens.find((tk) => tk.type === "ball");
    if (ball) {
      overrides[ball.id] = { ...ball, ...positionOnArrow(dribbleArrow, t) };
    }
  }
  return overrides;
}
function resolveFinalDiagram(diagram) {
  if (!diagram) return emptyDiagram();
  const overrides = computeAnimatedPositions(diagram, 1);
  const tokens = diagram.tokens.map((t) => (overrides[t.id] ? { ...t, x: overrides[t.id].x, y: overrides[t.id].y } : t));
  return { court: diagram.court, tokens, arrows: [] };
}
function normalizeDiagramas(item) {
  if (item.diagramas) return item;
  return { ...item, diagramas: item.diagrama ? [item.diagrama] : [] };
}
function resizeImageFile(file, maxDim = 320, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}
function normalizePlayer(p) {
  return { ...emptyPlayer, ...p, lesoes: p.lesoes || [], avaliacoes: p.avaliacoes || [], testesFisicos: p.testesFisicos || [] };
}
function distPt(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
// Linha ondulada (efeito de "drible") que acompanha uma curva Bezier
// quadrática em vez de um segmento reto — os desvios em ziguezague seguem
// a direção local da curva, não a direção direta from→to.
function wavyCurvedPathD(from, control, to, amplitude = 5, segments = 8) {
  let d = `M ${from.x} ${from.y}`;
  let prev = from;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const pt = {
      x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
    };
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = i === segments ? 0 : (i % 2 === 0 ? 1 : -1) * amplitude;
    d += ` L ${pt.x + nx * off} ${pt.y + ny * off}`;
    prev = pt;
  }
  return d;
}
// Ponto de controlo por defeito para a curva de uma seta (Bezier quadrática).
// "lancamento" já começa com uma leve curva (como um arco de lançamento);
// os outros tipos curáveis (passe, corte, drible) começam retos — o
// treinador pode depois arrastar o ponto de controlo para curvar a linha.
function defaultControlPoint(type, from, to) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (type !== "lancamento") return { x: mx, y: my };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const height = 30;
  return { x: mx + nx * height, y: my + ny * height };
}
function arrowHead(x1, y1, x2, y2, size = 7) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - 0.4;
  const a2 = angle + Math.PI + 0.4;
  return `M ${x2} ${y2} L ${x2 + size * Math.cos(a1)} ${y2 + size * Math.sin(a1)} M ${x2} ${y2} L ${x2 + size * Math.cos(a2)} ${y2 + size * Math.sin(a2)}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function computeTemporadaAtual() {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}
function nextTemporadaLabel(atual) {
  const m = /^(\d{4})\/(\d{4})$/.exec(atual || "");
  if (!m) return computeTemporadaAtual();
  const y1 = Number(m[1]) + 1;
  return `${y1}/${y1 + 1}`;
}
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
function parseRosterText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const tokens = line.split(/[;,\t]+|\s{2,}/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length < 2) continue;
    let numero, nome, posicao;
    if (tokens.length >= 3) {
      numero = tokens[0];
      posicao = tokens[tokens.length - 1];
      nome = tokens.slice(1, -1).join(" ");
    } else {
      numero = tokens[0];
      nome = tokens[1];
      posicao = POSICOES[0];
    }
    const match = POSICOES.find((p) => p.toLowerCase() === posicao.toLowerCase());
    parsed.push({
      id: uid(),
      numero,
      nome,
      posicao: match || posicao,
      nascimento: "",
      notas: "",
    });
  }
  return parsed;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function calcPresenca(playerId, sessions) {
  let total = 0;
  let presentes = 0;
  (sessions || []).forEach((s) => {
    if (s.type !== "treino" || s.realizado !== true) return;
    const status = (s.presencas || {})[playerId];
    if (status === "P" || status === "F") {
      total += 1;
      if (status === "P") presentes += 1;
    }
  });
  if (total === 0) return null;
  return { presentes, faltas: total - presentes, total, pct: Math.round((presentes / total) * 100) };
}

function countTreinosRealizados(sessions) {
  return (sessions || []).filter((s) => s.type === "treino" && s.realizado === true && s.presencas && Object.keys(s.presencas).length > 0).length;
}

function diasParaAniversario(nascimento) {
  if (!nascimento) return null;
  const parts = nascimento.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [, m, d] = parts;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let proximo = new Date(hoje.getFullYear(), m - 1, d);
  if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, m - 1, d);
  return Math.round((proximo - hoje) / (24 * 60 * 60 * 1000));
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatDateShortYear(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- Diagram rendering as plain SVG strings (for the printable/downloadable file) ---- */

function playerChartData(list, key) {
  return (list || [])
    .filter((item) => item.data && item[key] !== "" && item[key] != null)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((item) => ({ dataLabel: formatDateShortYear(item.data), valor: Number(item[key]) }));
}

export {
  normalizeJogo,
  emptyDiagram,
  computeAnimatedPositions,
  resolveFinalDiagram,
  normalizeDiagramas,
  resizeImageFile,
  normalizePlayer,
  distPt,
  wavyCurvedPathD,
  defaultControlPoint,
  arrowHead,
  uid,
  computeTemporadaAtual,
  nextTemporadaLabel,
  withTimeout,
  parseRosterText,
  todayStr,
  calcPresenca,
  countTreinosRealizados,
  diasParaAniversario,
  formatDateShort,
  formatDateShortYear,
  formatDateFull,
  escapeHtml,
  playerChartData,
};

