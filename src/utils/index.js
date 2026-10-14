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
// Pontos de mudança de direção (opcional): uma seta com `waypoints` passa
// por eles numa curva suave (from -> waypoints -> to). Sem waypoints,
// mantém-se a curva Bezier quadrática (from, control, to) de sempre.
function arrowPolyline(a) {
  return [a.from, ...(a.waypoints || []), a.to];
}
function hasWaypoints(a) {
  return !!(a.waypoints && a.waypoints.length);
}
const PATH_SAMPLES_PER_SEG = 16;
// Curva Catmull-Rom que passa por todos os pontos, amostrada: o ponto de
// mudança i fica exatamente no índice (i + 1) * PATH_SAMPLES_PER_SEG.
function arrowPathPoints(a) {
  const pts = arrowPolyline(a);
  if (pts.length < 3) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= PATH_SAMPLES_PER_SEG; k++) {
      const t = k / PATH_SAMPLES_PER_SEG;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}
// Ponto a uma fração t (0..1) do comprimento total de uma polilinha.
function pointAlongPolyline(pts, t) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return { x: pts[0].x, y: pts[0].y };
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, target / lens[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }
    target -= lens[i];
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

// Posição ao longo de uma seta num instante t (0..1): segue os pontos de
// mudança de direção, se houver; senão a curva Bezier quadrática (from,
// control, to) quando há um ponto de controlo definido, ou uma linha reta.
function positionOnArrow(a, t) {
  if (hasWaypoints(a)) return pointAlongPolyline(arrowPathPoints(a), t);
  if (a.control) {
    const mt = 1 - t;
    return {
      x: mt * mt * a.from.x + 2 * mt * t * a.control.x + t * t * a.to.x,
      y: mt * mt * a.from.y + 2 * mt * t * a.control.y + t * t * a.to.y,
    };
  }
  return { x: a.from.x + (a.to.x - a.from.x) * t, y: a.from.y + (a.to.y - a.from.y) * t };
}

// Que bola leva cada seta de drible / hand-off. Com várias bolas, cada seta
// fica com a bola livre mais próxima do seu início (até 30 unidades). Com uma
// só bola mantém-se o comportamento antigo: o hand-off tem prioridade e
// depois o drible, sem limite de distância.
function assignCarriedBalls(diagram) {
  const balls = diagram.tokens.filter((tk) => tk.type === "ball");
  const result = {}; // arrowId -> ballId
  if (!balls.length) return result;
  const taken = new Set();
  const carriers = [
    ...diagram.arrows.filter((a) => a.type === "handoff" && a.tokenId && a.from),
    ...diagram.arrows.filter((a) => a.type === "drible" && a.tokenId && a.from),
  ];
  carriers.forEach((a) => {
    let best = null;
    let bestD = balls.length === 1 ? Infinity : 30;
    balls.forEach((b) => {
      if (taken.has(b.id)) return;
      const d = Math.hypot(b.x - a.from.x, b.y - a.from.y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    });
    if (best) {
      taken.add(best.id);
      result[a.id] = best.id;
    }
  });
  return result;
}

function computeAnimatedPositions(diagram, t) {
  const overrides = {};
  diagram.arrows.forEach((a) => {
    // Bloqueios antigos (ponto único, sem tokenId) ficam de fora — não há para onde mover.
    if (!a.tokenId || !a.to) return;
    let token = diagram.tokens.find((tk) => tk.id === a.tokenId);
    if ((a.type === "passe" || a.type === "lancamento") && (!token || token.type !== "ball")) {
      // A bola pode ter sido arrastada para junto do jogador depois de a seta
      // já estar desenhada — nesse caso o tokenId guardado é do jogador, não
      // da bola. Procura-se a bola perto do início da seta, para o passe
      // funcionar sempre, independentemente da ordem em que foi feito.
      // 26: mesma distância usada nos editores para detetar "quem tem bola"
      // (raio do jogador 12 + raio da bola 7 + margem), não o SNAP_DIST de arrasto.
      token = diagram.tokens.find((tk) => tk.type === "ball" && Math.hypot(tk.x - a.from.x, tk.y - a.from.y) < 26);
    }
    if (!token) return;
    overrides[token.id] = { ...token, ...positionOnArrow(a, t) };
  });
  // Drible e hand-off: a bola acompanha quem a leva (no hand-off fica com
  // quem recebe, no fim da seta).
  const carried = assignCarriedBalls(diagram);
  diagram.arrows.forEach((a) => {
    const ballId = carried[a.id];
    if (!ballId) return;
    const ball = diagram.tokens.find((tk) => tk.id === ballId);
    overrides[ball.id] = { ...ball, ...positionOnArrow(a, t) };
  });
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
// Primeiro + último nome, para exibição compacta em listas (ex: cartões do plantel).
// O nome completo continua guardado e é usado na ficha do jogador e nos relatórios.
function shortName(nome) {
  if (!nome) return nome;
  const parts = nome.trim().split(/\s+/);
  if (parts.length <= 1) return nome.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
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
// Caminho SVG por uma lista de pontos (já amostrada), ondulado no drible.
function polylinePathD(pts, wavy = false, amplitude = 5) {
  if (!wavy) return pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const total = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const steps = Math.max(1, Math.ceil(len / 3));
    for (let k = 1; k <= steps; k++) {
      const dist = acc + (len * k) / steps;
      const fade = Math.min(1, (total - dist) / 10);
      const off = Math.sin((dist / 16) * Math.PI * 2) * amplitude * fade;
      d += ` L ${a.x + ((b.x - a.x) * k) / steps + nx * off} ${a.y + ((b.y - a.y) * k) / steps + ny * off}`;
    }
    acc += len;
  }
  return d;
}
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
// Reconhece o texto de uma (ou várias, coladas seguidas) ficha(s) de
// exercício copiada(s) da plataforma de treinadores da FIBA — cada exercício
// começa numa linha "Título: ..." e tem secções "Descrição", "Objetivos /
// propósito / habilidades", "Variações" e "Dicas / Sugestões / Ênfase".
// Como a nossa Biblioteca só tem um campo de descrição, as secções são juntas
// num só texto; a categoria fica por definir (o treinador escolhe depois).
const FIBA_SECOES = ["Descrição", "Objetivos / propósito / habilidades", "Variações", "Dicas / Sugestões / Ênfase"];
function parseFibaExercicios(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocos = [];
  let atual = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const tituloMatch = /^T[ií]tulo:\s*(.+)/i.exec(line);
    if (tituloMatch) {
      if (atual) blocos.push(atual);
      atual = { nome: tituloMatch[1].trim(), autor: "", secoes: {}, secaoAtual: null };
      continue;
    }
    if (!atual) continue; // ignora texto antes do primeiro "Título:"
    const autorMatch = /^Autor:\s*(.+)/i.exec(line);
    if (autorMatch) {
      atual.autor = autorMatch[1].trim();
      atual.secaoAtual = null;
      continue;
    }
    if (/^Gr[áa]fico\s*N/i.test(line) || /^EXERC[ÍI]CIO\b/i.test(line)) {
      atual.secaoAtual = null;
      continue;
    }
    const secao = FIBA_SECOES.find((s) => s.toLowerCase() === line.toLowerCase());
    if (secao) {
      atual.secaoAtual = secao;
      atual.secoes[secao] = atual.secoes[secao] || [];
      continue;
    }
    if (atual.secaoAtual) atual.secoes[atual.secaoAtual].push(line);
  }
  if (atual) blocos.push(atual);

  const semDados = (v) => !v || /^não há dados$/i.test(v);
  return blocos
    .filter((b) => b.nome)
    .map((b) => {
      const texto = (secao) => (b.secoes[secao] || []).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      const descricao = texto("Descrição");
      const objetivos = texto("Objetivos / propósito / habilidades");
      const variacoes = texto("Variações");
      const dicas = texto("Dicas / Sugestões / Ênfase");
      const partes = [descricao];
      if (!semDados(objetivos)) partes.push(`Objetivos: ${objetivos}`);
      if (!semDados(variacoes)) partes.push(`Variações: ${variacoes}`);
      if (!semDados(dicas)) partes.push(`Dicas: ${dicas}`);
      if (b.autor) partes.push(`Fonte: FIBA Coaching — ${b.autor}`);
      return { nome: b.nome, descricao: partes.filter(Boolean).join("\n\n") };
    });
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
  positionOnArrow,
  arrowPolyline,
  arrowPathPoints,
  PATH_SAMPLES_PER_SEG,
  hasWaypoints,
  pointAlongPolyline,
  assignCarriedBalls,
  polylinePathD,
  resolveFinalDiagram,
  normalizeDiagramas,
  resizeImageFile,
  normalizePlayer,
  shortName,
  distPt,
  wavyCurvedPathD,
  defaultControlPoint,
  arrowHead,
  uid,
  computeTemporadaAtual,
  nextTemporadaLabel,
  withTimeout,
  parseRosterText,
  parseFibaExercicios,
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

