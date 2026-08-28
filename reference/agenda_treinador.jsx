import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Dumbbell, CalendarDays, Plus, X, Trophy, Trash2, Pencil, ChevronLeft, ChevronRight, Loader2, Upload, BookOpen, Star, Search, Image as ImageIcon, Play, RotateCcw, Printer, CheckCircle2, Sparkles, AlertTriangle, TrendingUp, Swords, Settings, Copy, Home, ArrowRightLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STORAGE_KEY = "agenda-treinador-data";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
`;

const COLOR_FALLBACK_CSS = `
html, body, #root { background-color: rgb(20, 24, 31); }
.bg-\\[\\#0A0C10\\]\\/95 { background-color: rgba(10, 12, 16, 0.95) !important; }
.bg-\\[\\#0F1319\\] { background-color: rgb(15, 19, 25) !important; }
.bg-\\[\\#14181F\\] { background-color: rgb(20, 24, 31) !important; }
.bg-\\[\\#1E242E\\] { background-color: rgb(30, 36, 46) !important; }
.bg-\\[\\#2E3644\\] { background-color: rgb(46, 54, 68) !important; }
.bg-\\[\\#4C9A6A\\] { background-color: rgb(76, 154, 106) !important; }
.bg-\\[\\#4C9A6A\\]\\/10 { background-color: rgba(76, 154, 106, 0.1) !important; }
.bg-\\[\\#4C9A6A\\]\\/20 { background-color: rgba(76, 154, 106, 0.2) !important; }
.bg-\\[\\#D64545\\] { background-color: rgb(214, 69, 69) !important; }
.bg-\\[\\#D64545\\]\\/10 { background-color: rgba(214, 69, 69, 0.1) !important; }
.bg-\\[\\#EA5B13\\] { background-color: rgb(234, 91, 19) !important; }
.bg-\\[\\#EA5B13\\]\\/10 { background-color: rgba(234, 91, 19, 0.1) !important; }
.bg-\\[\\#EA5B13\\]\\/20 { background-color: rgba(234, 91, 19, 0.2) !important; }
.border-\\[\\#2E3644\\] { border-color: rgb(46, 54, 68) !important; }
.border-\\[\\#4C9A6A\\]\\/30 { border-color: rgba(76, 154, 106, 0.3) !important; }
.border-\\[\\#D64545\\]\\/30 { border-color: rgba(214, 69, 69, 0.3) !important; }
.border-\\[\\#EA5B13\\] { border-color: rgb(234, 91, 19) !important; }
.disabled\\:bg-\\[\\#2E3644\\]:disabled { background-color: rgb(46, 54, 68) !important; }
.disabled\\:text-\\[\\#5A6272\\]:disabled { color: rgb(90, 98, 114) !important; }
.focus\\:border-\\[\\#EA5B13\\]:focus { border-color: rgb(234, 91, 19) !important; }
.focus\\:ring-\\[\\#EA5B13\\]:focus { box-shadow: 0 0 0 1px rgb(234, 91, 19); }
.hover\\:bg-\\[\\#D64545\\]\\/20:hover { background-color: rgba(214, 69, 69, 0.2) !important; }
.hover\\:bg-\\[\\#FF6B1A\\]:hover { background-color: rgb(255, 107, 26) !important; }
.hover\\:bg-\\[\\#e05a5a\\]:hover { background-color: rgb(224, 90, 90) !important; }
.hover\\:bg-white\\/10:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
.hover\\:bg-white\\/5:hover { background-color: rgba(255, 255, 255, 0.05) !important; }
.hover\\:border-\\[\\#5A6272\\]:hover { border-color: rgb(90, 98, 114) !important; }
.hover\\:border-\\[\\#D64545\\]:hover { border-color: rgb(214, 69, 69) !important; }
.hover\\:text-\\[\\#D64545\\]:hover { color: rgb(214, 69, 69) !important; }
.hover\\:text-\\[\\#EA5B13\\]:hover { color: rgb(234, 91, 19) !important; }
.hover\\:text-\\[\\#F2EDE3\\]:hover { color: rgb(242, 237, 227) !important; }
.hover\\:text-\\[\\#FF6B1A\\]:hover { color: rgb(255, 107, 26) !important; }
.placeholder-\\[\\#5A6272\\]::placeholder { color: rgb(90, 98, 114); opacity: 1; }
.text-\\[\\#14181F\\] { color: rgb(20, 24, 31) !important; }
.text-\\[\\#4C9A6A\\] { color: rgb(76, 154, 106) !important; }
.text-\\[\\#5A6272\\] { color: rgb(90, 98, 114) !important; }
.text-\\[\\#8A93A3\\] { color: rgb(138, 147, 163) !important; }
.text-\\[\\#D64545\\] { color: rgb(214, 69, 69) !important; }
.text-\\[\\#EA5B13\\] { color: rgb(234, 91, 19) !important; }
.text-\\[\\#F2EDE3\\] { color: rgb(242, 237, 227) !important; }
.text-white { color: rgb(255, 255, 255) !important; }
`;

const POSICOES = ["Base", "Extremo", "Poste", "Ala", "Ala-Poste"];
const HABILIDADES = [
  { id: "d-ti-1", fase: "Defesa", componente: "Técnica individual", nome: "Posição básica" },
  { id: "d-ti-2", fase: "Defesa", componente: "Técnica individual", nome: "Deslocamentos defensivos" },
  { id: "d-ti-3", fase: "Defesa", componente: "Técnica individual", nome: "Defesa 1x1 com bola" },
  { id: "d-ti-4", fase: "Defesa", componente: "Técnica individual", nome: "Defesa da 1ª linha de passe" },
  { id: "d-ti-5", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do jogador sem bola (lado fraco)" },
  { id: "d-ti-6", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do corte para a bola" },
  { id: "d-ti-7", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do passe e corta" },
  { id: "d-ti-8", fase: "Defesa", componente: "Técnica individual", nome: "Ajuda e recuperação defensiva" },
  { id: "d-ti-9", fase: "Defesa", componente: "Técnica individual", nome: "Lado forte" },
  { id: "d-ti-10", fase: "Defesa", componente: "Técnica individual", nome: "Lado fraco" },
  { id: "d-ti-11", fase: "Defesa", componente: "Técnica individual", nome: "Jogador interior" },
  { id: "d-ti-12", fase: "Defesa", componente: "Técnica individual", nome: "Jogador exterior" },
  { id: "d-ti-13", fase: "Defesa", componente: "Técnica individual", nome: "Ressalto defensivo" },
  { id: "d-ti-14", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do jogador interior" },
  { id: "d-ta-1", fase: "Defesa", componente: "Tática individual", nome: "Identificação e adaptação da defesa em função do atacante c/ bola e da vantagem/desvantagem" },
  { id: "d-ta-2", fase: "Defesa", componente: "Tática individual", nome: "Identificação das características do atacante sem bola e adaptação da defesa às mesmas" },
  { id: "d-ta-3", fase: "Defesa", componente: "Tática individual", nome: "Identificação e adaptação da defesa ao jogador interior em função de situações de vantagem/desvantagem" },
  { id: "d-tc-1", fase: "Defesa", componente: "Tática coletiva", nome: "Transição defensiva / Recuperação Defensiva" },
  { id: "d-tc-2", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa de reposições na linha de fundo" },
  { id: "d-tc-3", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa individual em diferentes extensões do campo" },
  { id: "d-tc-4", fase: "Defesa", componente: "Tática coletiva", nome: "Salta e troca" },
  { id: "d-tc-5", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa em 2x1" },
  { id: "d-tc-6", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa em 2x1 sobre jogador interior" },
  { id: "a-ti-1", fase: "Ataque", componente: "Técnica individual", nome: "Posição básica, deslizamentos e jogo sem bola" },
  { id: "a-ti-2", fase: "Ataque", componente: "Técnica individual", nome: "Receção de bola e fintas de receção" },
  { id: "a-ti-3", fase: "Ataque", componente: "Técnica individual", nome: "Passes estáticos, em movimento e em drible" },
  { id: "a-ti-4", fase: "Ataque", componente: "Técnica individual", nome: "Posição básica com bola, manejo de bola e fundamentos do drible" },
  { id: "a-ti-5", fase: "Ataque", componente: "Técnica individual", nome: "Penetrações para o cesto depois de passe e drible com máxima variação" },
  { id: "a-ti-6", fase: "Ataque", componente: "Técnica individual", nome: "Lançamento em suspensão" },
  { id: "a-ti-7", fase: "Ataque", componente: "Técnica individual", nome: "Lançamento estatico" },
  { id: "a-ti-8", fase: "Ataque", componente: "Técnica individual", nome: "Gancho / Semi-gancho" },
  { id: "a-ti-9", fase: "Ataque", componente: "Técnica individual", nome: "Lançamentos de baixo do aro e efeitos" },
  { id: "a-ti-10", fase: "Ataque", componente: "Técnica individual", nome: "Movimentos do jogador interior" },
  { id: "a-ti-11", fase: "Ataque", componente: "Técnica individual", nome: "Ressalto ofensivo" },
  { id: "a-ti-12", fase: "Ataque", componente: "Técnica individual", nome: "Jogo 2x2" },
  { id: "a-ti-13", fase: "Ataque", componente: "Técnica individual", nome: "2 Jogadores exteriores" },
  { id: "a-ti-14", fase: "Ataque", componente: "Técnica individual", nome: "Interior-exterior" },
  { id: "a-ti-15", fase: "Ataque", componente: "Técnica individual", nome: "Jogo 3x3" },
  { id: "a-ti-16", fase: "Ataque", componente: "Técnica individual", nome: "3 Jogadores exteriores" },
  { id: "a-ti-17", fase: "Ataque", componente: "Técnica individual", nome: "2 Jogadores exteriores e 1 jogador interior" },
  { id: "a-ti-18", fase: "Ataque", componente: "Técnica individual", nome: "Superioridades" },
  { id: "a-ta-1", fase: "Ataque", componente: "Tática individual", nome: "Possibilidades táticas ofensivas no 1x1 com bola – prioridades: o uso do passe, drible e lançamento." },
  { id: "a-ta-2", fase: "Ataque", componente: "Tática individual", nome: "Identificação e castigo no 1x1 às desvantagens defensivas por razões físicas ou técnicas" },
  { id: "a-ta-3", fase: "Ataque", componente: "Tática individual", nome: "Alternativas táticas, sem bola na 1ª linha de passe:" },
  { id: "a-ta-4", fase: "Ataque", componente: "Tática individual", nome: "Fintas de receção" },
  { id: "a-ta-5", fase: "Ataque", componente: "Tática individual", nome: "Cortes para o lado fraco" },
  { id: "a-ta-6", fase: "Ataque", componente: "Tática individual", nome: "Corte em V" },
  { id: "a-ta-7", fase: "Ataque", componente: "Tática individual", nome: "Possibilidade táticas sem bola - lado fraco" },
  { id: "a-ta-8", fase: "Ataque", componente: "Tática individual", nome: "Posição de tripla ameaça - simular lançamento" },
  { id: "a-ta-9", fase: "Ataque", componente: "Tática individual", nome: "Corte nas costas" },
  { id: "a-ta-10", fase: "Ataque", componente: "Tática individual", nome: "Corte para o lado forte" },
  { id: "a-ta-11", fase: "Ataque", componente: "Tática individual", nome: "Conhecimento e exploração das capacidades individuais" },
  { id: "a-ta-12", fase: "Ataque", componente: "Tática individual", nome: "Conhecimento e exploração das capacidades dos companheiros" },
  { id: "a-tc-1", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos de colocação em bolas aéreas disputadas" },
  { id: "a-tc-2", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos e jogadas de reposição na linha de fundo" },
  { id: "a-tc-3", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos de colocação em lances-livres próprios" },
  { id: "a-tc-4", fase: "Ataque", componente: "Tática coletiva", nome: "Transição defesa-ataque" },
  { id: "a-tc-5", fase: "Ataque", componente: "Tática coletiva", nome: "Depois de roubar bola" },
  { id: "a-tc-6", fase: "Ataque", componente: "Tática coletiva", nome: "Depois de ressalto defensivo" },
  { id: "a-tc-7", fase: "Ataque", componente: "Tática coletiva", nome: "Equilíbrio ofensivo:" },
  { id: "a-tc-8", fase: "Ataque", componente: "Tática coletiva", nome: "Ressalto ofensivo" },
  { id: "a-tc-9", fase: "Ataque", componente: "Tática coletiva", nome: "Ressalto longo" },
  { id: "a-tc-10", fase: "Ataque", componente: "Tática coletiva", nome: "Preparação do balanço defensivo/recuperação defensiva" },
  { id: "a-tc-11", fase: "Ataque", componente: "Tática coletiva", nome: "Jogo 2x2" },
  { id: "a-tc-12", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores exteriores" },
  { id: "a-tc-13", fase: "Ataque", componente: "Tática coletiva", nome: "Interior-exterior" },
  { id: "a-tc-14", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores interiores" },
  { id: "a-tc-15", fase: "Ataque", componente: "Tática coletiva", nome: "Jogo 3x3" },
  { id: "a-tc-16", fase: "Ataque", componente: "Tática coletiva", nome: "3 Jogadores exteriores" },
  { id: "a-tc-17", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores exteriores e 1 jogador interior" },
  { id: "a-tc-18", fase: "Ataque", componente: "Tática coletiva", nome: "Ataque por conceitos e sistemas contra defesas individuais" },
  { id: "a-tc-19", fase: "Ataque", componente: "Tática coletiva", nome: "4 Jogadores exteriores e 1 jogador interior" },
  { id: "a-tc-20", fase: "Ataque", componente: "Tática coletiva", nome: "5 Jogadores exteriores" },
];

function getHabilidade(id) {
  return HABILIDADES.find((h) => h.id === id);
}

function habilidadeLabel(id) {
  const h = getHabilidade(id);
  return h ? h.nome : id || "—";
}

const emptyPlayer = {
  nome: "",
  numero: "",
  posicao: POSICOES[0],
  nascimento: "",
  notas: "",
  foto: "",
  morada: "",
  cidade: "",
  cc: "",
  nif: "",
  profissao: "",
  email: "",
  telemovel: "",
  epocasClube: "",
  medicacao: "",
  outrosDesportos: "",
  lesoes: [],
  avaliacoes: [],
  testesFisicos: [],
};
const emptyLesao = { id: "", ano: "", descricao: "" };
const emptyAvaliacao = { id: "", data: "", altura: "", peso: "", envergadura: "", obs: "" };

const TIPOS_TESTE = [
  { id: "sprint10", nome: "Sprint 10m", unidade: "s", categoria: "Velocidade" },
  { id: "sprint20", nome: "Sprint 20m", unidade: "s", categoria: "Velocidade" },
  { id: "sprint30", nome: "Sprint 30m", unidade: "s", categoria: "Velocidade" },
  { id: "t_test", nome: "T-Test", unidade: "s", categoria: "Agilidade" },
  { id: "illinois", nome: "Illinois Agility Test", unidade: "s", categoria: "Agilidade" },
  { id: "shuttle_run", nome: "Shuttle Run 5-10-5", unidade: "s", categoria: "Agilidade" },
  { id: "salto_vertical", nome: "Salto vertical (CMJ)", unidade: "cm", categoria: "Força" },
  { id: "salto_horizontal", nome: "Salto horizontal (sem impulso)", unidade: "cm", categoria: "Força" },
  { id: "lancamento_medicinal", nome: "Lançamento bola medicinal", unidade: "m", categoria: "Força" },
  { id: "vaivem", nome: "Vaivém / Course Navette (nível)", unidade: "nível", categoria: "Resistência" },
  { id: "cooper", nome: "Teste de Cooper (12 min)", unidade: "m", categoria: "Resistência" },
  { id: "yoyo", nome: "Yo-Yo Intermittent Recovery", unidade: "m", categoria: "Resistência" },
  { id: "outro", nome: "Outro (personalizado)", unidade: "", categoria: "Outro" },
];
function getTipoTeste(id) {
  return TIPOS_TESTE.find((t) => t.id === id) || TIPOS_TESTE[TIPOS_TESTE.length - 1];
}
const emptyTesteFisico = { id: "", data: "", tipoId: TIPOS_TESTE[0].id, nomePersonalizado: "", valor: "", obs: "" };

const emptySession = { type: "treino", date: "", title: "", objetivo: "", exercicios: [], observacoes: "", adversario: "", resultado: "", conteudo: "", realizado: false };

const emptyJogo = {
  type: "jogo",
  date: "",
  horario: "",
  title: "",
  campeonato: "",
  jogoNumero: "",
  local: "",
  adversario: "",
  treinadorPrincipal: "",
  treinadorPrincipalLicenca: "",
  treinadorAdjunto: "",
  treinadorAdjuntoLicenca: "",
  dirigentes: [], // [{id, nome, licenca}]
  convocatoria: {}, // { playerId: [p1, p2, p3, p4] }
  objetivosJogo: [], // [{id, texto}]
  reflexaoPreparacao: "",
  palestraInicial: "",
  descontosTempo: "",
  resultado: "",
  conteudo: "",
  apreciacaoGeral: "",
  estatisticas: {}, // { playerId: { pontos, ressaltos, assistencias, roubos, bloqueios, faltas } }
};

const ESTATISTICAS_CAMPOS = [
  { key: "pontos", label: "Pts", nome: "Pontos" },
  { key: "ressaltos", label: "Res", nome: "Ressaltos" },
  { key: "assistencias", label: "Ass", nome: "Assistências" },
  { key: "roubos", label: "Rou", nome: "Roubos de bola" },
  { key: "bloqueios", label: "Blq", nome: "Bloqueios" },
  { key: "faltas", label: "Flt", nome: "Faltas cometidas" },
];

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

const emptyLibraryItem = { nome: "", categoria: HABILIDADES[0].id, duracaoPadrao: "", descricao: "", diagramas: [] };

const ARROW_TYPES = [
  { id: "passe", label: "Passe", desc: "linha tracejada" },
  { id: "drible", label: "Drible", desc: "linha ondulada" },
  { id: "corte", label: "Corte", desc: "linha contínua" },
  { id: "bloqueio", label: "Bloqueio", desc: "clique único" },
];

const HALF_VB = { w: 300, h: 320 };
const FULL_VB = { w: 300, h: 560 };

function emptyDiagram(court = "meio") {
  return { court, tokens: [], arrows: [] };
}

// Computes token positions at animation progress t (0..1) for a single diagram.
// A "passe" arrow moves the ball only. "Drible"/"corte" move the linked player.
// The ball automatically follows whichever player is dribbling, even though the
// dribble arrow itself is only linked to the player, not the ball.
function computeAnimatedPositions(diagram, t) {
  const overrides = {};
  diagram.arrows.forEach((a) => {
    if (!a.tokenId || a.type === "bloqueio") return;
    const token = diagram.tokens.find((tk) => tk.id === a.tokenId);
    if (!token) return;
    if (a.type === "passe" && token.type !== "ball") return;
    overrides[a.tokenId] = { ...token, x: a.from.x + (a.to.x - a.from.x) * t, y: a.from.y + (a.to.y - a.from.y) * t };
  });
  const dribbleArrow = diagram.arrows.find((a) => a.type === "drible" && a.tokenId);
  if (dribbleArrow) {
    const ball = diagram.tokens.find((tk) => tk.type === "ball");
    if (ball) {
      overrides[ball.id] = {
        ...ball,
        x: dribbleArrow.from.x + (dribbleArrow.to.x - dribbleArrow.from.x) * t,
        y: dribbleArrow.from.y + (dribbleArrow.to.y - dribbleArrow.from.y) * t,
      };
    }
  }
  return overrides;
}

// Given a diagram, returns a fresh diagram with tokens moved to their final
// (t=1) positions — used as the starting point for the next diagram in a sequence.
function resolveFinalDiagram(diagram) {
  if (!diagram) return emptyDiagram();
  const overrides = computeAnimatedPositions(diagram, 1);
  const tokens = diagram.tokens.map((t) => (overrides[t.id] ? { ...t, x: overrides[t.id].x, y: overrides[t.id].y } : t));
  return { court: diagram.court, tokens, arrows: [] };
}

// Migrates items saved before "diagramas" (plural, sequence) existed.
function normalizeDiagramas(item) {
  if (item.diagramas) return item;
  return { ...item, diagramas: item.diagrama ? [item.diagrama] : [] };
}

// Migrates players saved before the richer profile (contacts, lesões, avaliações) existed.
// Resizes/compresses an uploaded photo before storing it, since storage is JSON-based
// and large camera photos would quickly bloat it. Caps the longest side and re-encodes as JPEG.
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

// Builds a zig-zag "dribble" path between two points
function wavyPathD(x1, y1, x2, y2, amplitude = 5, segments = 8) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const off = i === segments ? 0 : (i % 2 === 0 ? 1 : -1) * amplitude;
    d += ` L ${px + nx * off} ${py + ny * off}`;
  }
  return d;
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

// Basketball seasons typically run Aug→June. Before August, we're still in last year's season.
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

// Races a promise against a timeout so storage calls can never hang the app forever.
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

export default function AgendaTreinadorInner() {
  const [tab, setTab] = useState("inicio");
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [library, setLibrary] = useState([]);
  const [teams, setTeams] = useState([]);
  const [clubLogo, setClubLogo] = useState("");
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [viewingTemporada, setViewingTemporada] = useState(null);
  const [teamsModal, setTeamsModal] = useState(false);
  const [transferModal, setTransferModal] = useState(null); // session being transferred
  const [moveTeamModal, setMoveTeamModal] = useState(null); // player being moved
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);

  const [playerModal, setPlayerModal] = useState(null); // null | 'new' | player object
  const [importModal, setImportModal] = useState(false);
  const [libraryModal, setLibraryModal] = useState(null); // null | 'new' | item
  const [sessionModal, setSessionModal] = useState(null); // null | {date} | session object
  const [jogoModal, setJogoModal] = useState(null); // null | jogo object
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null); // {y, m, d} | null

  // Load on mount
  useEffect(() => {
    let settled = false;
    let loadedTeams = [];
    (async () => {
      try {
        const res = await withTimeout(window.storage.get(STORAGE_KEY, false), 6000);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          loadedTeams = parsed.teams || [];
          let loadedPlayers = (parsed.players || []).map(normalizePlayer);
          let loadedSessions = (parsed.sessions || []).map((s) =>
            normalizeJogo({
              ...s,
              exercicios: (s.exercicios || []).map(normalizeDiagramas),
            })
          );
          if (loadedTeams.length === 0) {
            // Migration: no teams existed yet — create a default one and assign all existing data to it.
            const defaultTeam = { id: uid(), nome: "Equipa principal", temporadaAtual: computeTemporadaAtual() };
            loadedTeams = [defaultTeam];
            loadedPlayers = loadedPlayers.map((p) => (p.equipaId ? p : { ...p, equipaId: defaultTeam.id }));
            loadedSessions = loadedSessions.map((s) => (s.equipaId ? s : { ...s, equipaId: defaultTeam.id, temporada: s.temporada || defaultTeam.temporadaAtual }));
          }
          // Migration: teams saved before seasons existed — give them one.
          loadedTeams = loadedTeams.map((t) => (t.temporadaAtual ? t : { ...t, temporadaAtual: computeTemporadaAtual() }));
          // Migration: sessions saved before seasons existed — assign them to their team's current season.
          loadedSessions = loadedSessions.map((s) => {
            if (s.temporada) return s;
            const team = loadedTeams.find((t) => t.id === s.equipaId);
            return { ...s, temporada: team ? team.temporadaAtual : computeTemporadaAtual() };
          });
          const resolvedActiveTeamId =
            parsed.activeTeamId && loadedTeams.some((t) => t.id === parsed.activeTeamId) ? parsed.activeTeamId : loadedTeams[0].id;
          setActiveTeamId(resolvedActiveTeamId);
          setViewingTemporada((loadedTeams.find((t) => t.id === resolvedActiveTeamId) || loadedTeams[0]).temporadaAtual);
          setPlayers(loadedPlayers);
          setSessions(loadedSessions);
          setLibrary((parsed.library || []).map(normalizeDiagramas));
          setClubLogo(parsed.clubLogo || "");
        }
      } catch (e) {
        if (e && e.message === "timeout") {
          setError(`Não foi possível carregar dados guardados (tempo esgotado). A app vai continuar vazia — os teus dados antigos podem ainda estar guardados; tenta recarregar mais tarde ou usa "Importar cópia de segurança".`);
        }
        // Any other error (e.g. no data saved yet) is expected on first use — ignore silently.
      } finally {
        if (loadedTeams.length === 0) {
          // Nothing loaded (first-ever use, or the read failed) — always start with one team.
          const defaultTeam = { id: uid(), nome: "Equipa principal", temporadaAtual: computeTemporadaAtual() };
          loadedTeams = [defaultTeam];
          setActiveTeamId(defaultTeam.id);
          setViewingTemporada(defaultTeam.temporadaAtual);
        }
        setTeams(loadedTeams);
        settled = true;
        setReady(true);
      }
    })();
    // Absolute fallback: never stay stuck on the loading screen, even if the
    // storage call neither resolves nor rejects.
    const failSafe = setTimeout(() => {
      if (!settled) setReady(true);
    }, 7000);
    return () => clearTimeout(failSafe);
  }, []);

  const persist = useCallback(async (nextPlayers, nextSessions, nextLibrary, nextTeams, nextActiveTeamId, nextClubLogo) => {
    try {
      await withTimeout(
        window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ players: nextPlayers, sessions: nextSessions, library: nextLibrary, teams: nextTeams, activeTeamId: nextActiveTeamId, clubLogo: nextClubLogo }),
          false
        ),
        6000
      );
    } catch (e) {
      setError(`Não foi possível guardar automaticamente (${e.message || e}). Usa "Exportar cópia de segurança" para não perderes o que fizeste.`);
    }
  }, []);

  const savePlayer = (player) => {
    let next;
    if (player.id) {
      next = players.map((p) => (p.id === player.id ? player : p));
    } else {
      next = [...players, { ...player, id: uid(), equipaId: activeTeamId }];
    }
    setPlayers(next);
    persist(next, sessions, library, teams, activeTeamId, clubLogo);
    setPlayerModal(null);
  };

  const importPlayers = (newPlayers) => {
    const next = [...players, ...newPlayers.map((p) => ({ ...p, equipaId: activeTeamId }))];
    setPlayers(next);
    persist(next, sessions, library, teams, activeTeamId, clubLogo);
    setImportModal(false);
  };

  const deletePlayer = (id) => {
    const next = players.filter((p) => p.id !== id);
    setPlayers(next);
    persist(next, sessions, library, teams, activeTeamId, clubLogo);
  };

  const saveSession = (session) => {
    let next;
    if (session.id) {
      next = sessions.map((s) => (s.id === session.id ? session : s));
    } else {
      const team = teams.find((t) => t.id === activeTeamId);
      next = [...sessions, { ...session, id: uid(), equipaId: activeTeamId, temporada: team ? team.temporadaAtual : computeTemporadaAtual() }];
    }
    setSessions(next);
    persist(players, next, library, teams, activeTeamId, clubLogo);
    setSessionModal(null);
    setJogoModal(null);
  };

  const deleteSession = (id) => {
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    persist(players, next, library, teams, activeTeamId, clubLogo);
  };

  const saveLibraryItem = (item) => {
    let next;
    if (item.id) {
      next = library.map((l) => (l.id === item.id ? item : l));
    } else {
      next = [...library, { ...item, id: uid() }];
    }
    setLibrary(next);
    persist(players, sessions, next, teams, activeTeamId, clubLogo);
    setLibraryModal(null);
    return next[next.length - 1] || next.find((l) => l.id === item.id);
  };

  const deleteLibraryItem = (id) => {
    const next = library.filter((l) => l.id !== id);
    setLibrary(next);
    persist(players, sessions, next, teams, activeTeamId, clubLogo);
  };

  const addLibraryItemQuiet = (item) => {
    // Used when saving an exercise straight from a training session, without opening the modal
    const next = [...library, { ...item, id: uid() }];
    setLibrary(next);
    persist(players, sessions, next, teams, activeTeamId, clubLogo);
  };

  const addTeam = (nome) => {
    const newTeam = { id: uid(), nome: nome.trim() || "Nova equipa", temporadaAtual: computeTemporadaAtual() };
    const nextTeams = [...teams, newTeam];
    setTeams(nextTeams);
    setActiveTeamId(newTeam.id);
    setViewingTemporada(newTeam.temporadaAtual);
    persist(players, sessions, library, nextTeams, newTeam.id, clubLogo);
  };

  const fecharTemporada = (teamId, novaTemporada) => {
    const nextTeams = teams.map((t) => (t.id === teamId ? { ...t, temporadaAtual: novaTemporada } : t));
    setTeams(nextTeams);
    if (teamId === activeTeamId) setViewingTemporada(novaTemporada);
    persist(players, sessions, library, nextTeams, activeTeamId, clubLogo);
  };

  const renameTeam = (id, nome) => {
    const nextTeams = teams.map((t) => (t.id === id ? { ...t, nome } : t));
    setTeams(nextTeams);
    persist(players, sessions, library, nextTeams, activeTeamId, clubLogo);
  };

  const deleteTeam = (id) => {
    const remaining = teams.filter((t) => t.id !== id);
    const nextTeams = remaining.length > 0 ? remaining : [{ id: uid(), nome: "Equipa principal" }];
    const nextPlayers = players.filter((p) => p.equipaId !== id);
    const nextSessions = sessions.filter((s) => s.equipaId !== id);
    const nextActiveTeamId = activeTeamId === id ? nextTeams[0].id : activeTeamId;
    setTeams(nextTeams);
    setPlayers(nextPlayers);
    setSessions(nextSessions);
    setActiveTeamId(nextActiveTeamId);
    persist(nextPlayers, nextSessions, library, nextTeams, nextActiveTeamId, clubLogo);
  };

  const switchTeam = (id) => {
    setActiveTeamId(id);
    const team = teams.find((t) => t.id === id);
    if (team) setViewingTemporada(team.temporadaAtual);
    persist(players, sessions, library, teams, id, clubLogo);
  };

  const saveClubLogo = (dataUrl) => {
    setClubLogo(dataUrl);
    persist(players, sessions, library, teams, activeTeamId, dataUrl);
  };

  // Duplicates a treino/jogo into another team — copies the plan (exercises, objectives,
  // etc.) but resets things that are specific to a roster (presences/convocatória) and,
  // for treinos, resets "realizado" so it starts as a fresh plan for the target team.
  const transferSession = (session, targetTeamId) => {
    const targetTeam = teams.find((t) => t.id === targetTeamId);
    const copy = { ...session, id: uid(), equipaId: targetTeamId, temporada: targetTeam ? targetTeam.temporadaAtual : session.temporada };
    if (copy.type === "treino") {
      copy.realizado = false;
      copy.presencas = {};
    } else {
      copy.convocatoria = {};
      copy.resultado = "";
      copy.conteudo = "";
      copy.apreciacaoGeral = "";
    }
    const next = [...sessions, copy];
    setSessions(next);
    persist(players, next, library, teams, activeTeamId, clubLogo);
    setTransferModal(null);
    setImportSuccess(`Copiado para "${teams.find((t) => t.id === targetTeamId)?.nome || "outra equipa"}".`);
  };

  const movePlayerToTeam = (player, targetTeamId) => {
    const next = players.map((p) => (p.id === player.id ? { ...p, equipaId: targetTeamId } : p));
    setPlayers(next);
    persist(next, sessions, library, teams, activeTeamId, clubLogo);
    setMoveTeamModal(null);
    setImportSuccess(`"${player.nome}" mudou para "${teams.find((t) => t.id === targetTeamId)?.nome || "outra equipa"}".`);
  };

  const generateSeasonReport = () => {
    const html = buildSeasonReportContent(activeTeam, teamPlayers, seasonSessions, library, clubLogo);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const namePart = (activeTeam ? activeTeam.nome : "equipa").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const temporadaPart = ((activeTeam && activeTeam.temporadaAtual) || "").replace(/[^a-z0-9]+/gi, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-epoca-${temporadaPart}-${namePart}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const data = JSON.stringify({ players, sessions, library, teams, activeTeamId, clubLogo, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda-treinador-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [importPreview, setImportPreview] = useState(null); // {parsed, fileName}

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        setError("Não foi possível ler este ficheiro. Confirma que escolheste o .json exportado por esta aplicação.");
        return;
      }
      const valid = parsed && Array.isArray(parsed.players) && Array.isArray(parsed.sessions) && Array.isArray(parsed.library);
      if (!valid) {
        setError("Este ficheiro não parece ser uma cópia de segurança válida da Agenda do Treinador — nada foi alterado.");
        return;
      }
      setError(null);
      setImportPreview({ parsed, fileName: file.name });
    };
    reader.onerror = () => setError("Não foi possível ler este ficheiro.");
    reader.readAsText(file);
  };

  const confirmImport = () => {
    try {
      const { parsed } = importPreview;
      let nextTeams = parsed.teams || [];
      let nextPlayers = parsed.players.map(normalizePlayer);
      let nextSessions = parsed.sessions.map((s) => normalizeJogo({ ...s, exercicios: (s.exercicios || []).map(normalizeDiagramas) }));
      const nextLibrary = parsed.library.map(normalizeDiagramas);
      const nextClubLogo = parsed.clubLogo || "";
      if (nextTeams.length === 0) {
        const defaultTeam = { id: uid(), nome: "Equipa principal" };
        nextTeams = [defaultTeam];
        nextPlayers = nextPlayers.map((p) => (p.equipaId ? p : { ...p, equipaId: defaultTeam.id }));
        nextSessions = nextSessions.map((s) => (s.equipaId ? s : { ...s, equipaId: defaultTeam.id }));
      }
      const nextActiveTeamId = parsed.activeTeamId && nextTeams.some((t) => t.id === parsed.activeTeamId) ? parsed.activeTeamId : nextTeams[0].id;
      setTeams(nextTeams);
      setActiveTeamId(nextActiveTeamId);
      setPlayers(nextPlayers);
      setSessions(nextSessions);
      setLibrary(nextLibrary);
      setClubLogo(nextClubLogo);
      persist(nextPlayers, nextSessions, nextLibrary, nextTeams, nextActiveTeamId, nextClubLogo);
      setImportPreview(null);
      setImportSuccess(`Importado: ${nextPlayers.length} jogadores, ${nextSessions.length} treinos/jogos, ${nextLibrary.length} exercícios, ${nextTeams.length} equipa${nextTeams.length === 1 ? "" : "s"}.`);
      setTab("jogadores");
    } catch (e) {
      setError(`Ocorreu um erro ao aplicar os dados importados: ${e.message || e}`);
      setImportPreview(null);
    }
  };

  const teamPlayers = players.filter((p) => p.equipaId === activeTeamId);
  const teamSessions = sessions.filter((s) => s.equipaId === activeTeamId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const temporadasDisponiveis = Array.from(new Set(teamSessions.map((s) => s.temporada).filter(Boolean))).sort().reverse();
  const currentViewingTemporada = viewingTemporada || (activeTeam && activeTeam.temporadaAtual);
  if (currentViewingTemporada && !temporadasDisponiveis.includes(currentViewingTemporada)) {
    temporadasDisponiveis.unshift(currentViewingTemporada);
  }
  const seasonSessions = teamSessions.filter((s) => s.temporada === currentViewingTemporada);
  const isViewingCurrentSeason = activeTeam && currentViewingTemporada === activeTeam.temporadaAtual;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-full w-full bg-[#14181F] text-[#F2EDE3] flex flex-col">
      <style>{FONT_IMPORT}</style>
      <style>{COLOR_FALLBACK_CSS}</style>
      <TopBar
        onExport={exportBackup}
        onImport={handleImportFile}
        teams={teams}
        activeTeamId={activeTeamId}
        onSwitchTeam={switchTeam}
        onManageTeams={() => setTeamsModal(true)}
        temporadas={temporadasDisponiveis}
        viewingTemporada={currentViewingTemporada}
        onSwitchTemporada={setViewingTemporada}
        isCurrentSeason={isViewingCurrentSeason}
      />
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <Sidebar
          tab={tab}
          setTab={setTab}
          playerCount={teamPlayers.length}
          sessionCount={seasonSessions.filter((s) => s.type === "treino" && s.realizado !== true).length}
          realizadosCount={seasonSessions.filter((s) => s.type === "treino" && s.realizado === true).length}
          jogosCount={seasonSessions.filter((s) => s.type === "jogo").length}
          libraryCount={library.length}
        />
        <main className="flex-1 p-5 md:p-8 max-w-5xl">
          {!ready ? (
            <div className="flex items-center gap-2 text-[#8A93A3] mt-10">
              <Loader2 className="animate-spin" size={18} /> A carregar dados...
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 text-sm text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="shrink-0 text-[#D64545] hover:text-[#F2EDE3]"><X size={14} /></button>
                </div>
              )}
              {importSuccess && (
                <div className="mb-4 text-sm text-[#4C9A6A] bg-[#4C9A6A]/10 border border-[#4C9A6A]/30 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <span>{importSuccess}</span>
                  <button onClick={() => setImportSuccess(null)} className="shrink-0 text-[#4C9A6A] hover:text-[#F2EDE3]"><X size={14} /></button>
                </div>
              )}
              {tab === "inicio" && (
                <DashboardView
                  team={activeTeam}
                  players={teamPlayers}
                  sessions={seasonSessions}
                  library={library}
                  onNavigate={setTab}
                  onGenerateReport={generateSeasonReport}
                />
              )}
              {tab === "jogadores" && (
                <PlayersView
                  players={teamPlayers}
                  sessions={seasonSessions}
                  clubLogo={clubLogo}
                  onAdd={() => setPlayerModal("new")}
                  onImportClick={() => setImportModal(true)}
                  onEdit={(p) => setPlayerModal(p)}
                  onDelete={deletePlayer}
                  onMoveTeam={(p) => setMoveTeamModal(p)}
                />
              )}
              {tab === "treinos" && (
                <SessionsView
                  sessions={seasonSessions.filter((s) => s.type === "treino" && s.realizado !== true)}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onAdd={() => setSessionModal({ ...emptySession, date: todayStr() })}
                  onEdit={(s) => setSessionModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                />
              )}
              {tab === "realizados" && (
                <RealizadosView
                  sessions={seasonSessions.filter((s) => s.type === "treino" && s.realizado === true)}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onEdit={(s) => setSessionModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                />
              )}
              {tab === "jogos" && (
                <JogosView
                  sessions={seasonSessions.filter((s) => s.type === "jogo")}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onAdd={() => setJogoModal({ ...emptyJogo, date: todayStr() })}
                  onEdit={(s) => setJogoModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                />
              )}
              {tab === "biblioteca" && (
                <LibraryView
                  library={library}
                  onAdd={() => setLibraryModal("new")}
                  onEdit={(item) => setLibraryModal(item)}
                  onDelete={deleteLibraryItem}
                />
              )}
              {tab === "calendario" && (
                <CalendarView
                  sessions={seasonSessions}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  calYear={calYear}
                  setCalYear={setCalYear}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  onAddOnDay={(dateStr) => setSessionModal({ ...emptySession, date: dateStr })}
                  onEdit={(s) => (s.type === "jogo" ? setJogoModal(s) : setSessionModal(s))}
                  onDelete={deleteSession}
                />
              )}
            </>
          )}
        </main>
      </div>

      {playerModal && (
        <PlayerModal
          initial={playerModal === "new" ? emptyPlayer : playerModal}
          sessions={teamSessions}
          onClose={() => setPlayerModal(null)}
          onSave={savePlayer}
        />
      )}
      {sessionModal && (
        <SessionModal
          initial={sessionModal}
          library={library}
          players={teamPlayers}
          onSaveToLibrary={addLibraryItemQuiet}
          onClose={() => setSessionModal(null)}
          onSave={saveSession}
        />
      )}
      {jogoModal && (
        <JogoModal
          initial={jogoModal}
          players={teamPlayers}
          onClose={() => setJogoModal(null)}
          onSave={saveSession}
        />
      )}
      {importModal && (
        <ImportModal onClose={() => setImportModal(false)} onImport={importPlayers} />
      )}
      {libraryModal && (
        <LibraryModal
          initial={libraryModal === "new" ? emptyLibraryItem : libraryModal}
          onClose={() => setLibraryModal(null)}
          onSave={saveLibraryItem}
        />
      )}
      {importPreview && (
        <ImportBackupConfirmModal
          fileName={importPreview.fileName}
          counts={{
            players: importPreview.parsed.players.length,
            sessions: importPreview.parsed.sessions.length,
            library: importPreview.parsed.library.length,
          }}
          onCancel={() => setImportPreview(null)}
          onConfirm={confirmImport}
        />
      )}
      {teamsModal && (
        <TeamsModal
          teams={teams}
          players={players}
          sessions={sessions}
          clubLogo={clubLogo}
          onSaveLogo={saveClubLogo}
          onClose={() => setTeamsModal(false)}
          onAdd={addTeam}
          onRename={renameTeam}
          onDelete={deleteTeam}
          onFecharTemporada={fecharTemporada}
        />
      )}
      {transferModal && (
        <TransferModal
          teams={teams.filter((t) => t.id !== activeTeamId)}
          onClose={() => setTransferModal(null)}
          onConfirm={(targetTeamId) => transferSession(transferModal, targetTeamId)}
        />
      )}
      {moveTeamModal && (
        <MovePlayerModal
          player={moveTeamModal}
          teams={teams.filter((t) => t.id !== activeTeamId)}
          onClose={() => setMoveTeamModal(null)}
          onConfirm={(targetTeamId) => movePlayerToTeam(moveTeamModal, targetTeamId)}
        />
      )}
    </div>
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TopBar({ onExport, onImport, teams, activeTeamId, onSwitchTeam, onManageTeams, temporadas, viewingTemporada, onSwitchTemporada, isCurrentSeason }) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#1E242E] border-b border-[#2E3644] shrink-0 gap-3 flex-wrap">
      <div className="flex items-center gap-2 shrink-0">
        <Trophy size={18} className="text-[#EA5B13] shrink-0" />
        <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-sm whitespace-nowrap">
          Agenda do Treinador
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0 flex-wrap">
        {teams && teams.length > 0 && (
          <>
            <select
              value={activeTeamId || ""}
              onChange={(e) => onSwitchTeam(e.target.value)}
              className="bg-[#14181F] border border-[#2E3644] rounded-md text-sm px-2.5 py-1.5 max-w-[160px] truncate"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            {temporadas && temporadas.length > 0 && (
              <select
                value={viewingTemporada || ""}
                onChange={(e) => onSwitchTemporada(e.target.value)}
                title={isCurrentSeason ? "Época atual" : "A ver uma época arquivada"}
                className={`border rounded-md text-sm px-2.5 py-1.5 max-w-[110px] ${isCurrentSeason ? "bg-[#14181F] border-[#2E3644]" : "bg-[#EA5B13]/10 border-[#EA5B13]/40 text-[#EA5B13]"}`}
              >
                {temporadas.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <button onClick={onManageTeams} title="Gerir equipas" className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 shrink-0">
              <Settings size={16} />
            </button>
            <div className="w-px h-5 bg-[#2E3644] mx-0.5 shrink-0" />
          </>
        )}
        <button onClick={onExport} title="Exportar cópia de segurança" className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 shrink-0">
          <Upload size={16} className="rotate-180" />
        </button>
        <label
          htmlFor="backup-import-input"
          title="Importar cópia de segurança"
          className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 cursor-pointer flex items-center shrink-0"
        >
          <Upload size={16} />
        </label>
        <input
          id="backup-import-input"
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ""; }}
        />
      </div>
    </header>
  );
}

function Sidebar({ tab, setTab, playerCount, sessionCount, realizadosCount, jogosCount, libraryCount }) {
  const items = [
    { id: "inicio", label: "Início", icon: Home, count: null },
    { id: "jogadores", label: "Plantel", icon: Users, count: playerCount },
    { id: "treinos", label: "Treinos", icon: Dumbbell, count: sessionCount },
    { id: "realizados", label: "Realizados", icon: CheckCircle2, count: realizadosCount },
    { id: "jogos", label: "Jogos", icon: Swords, count: jogosCount },
    { id: "biblioteca", label: "Biblioteca", icon: BookOpen, count: libraryCount },
    { id: "calendario", label: "Calendário", icon: CalendarDays, count: null },
  ];
  return (
    <aside style={{ width: 208, flexShrink: 0 }} className="bg-[#1E242E] border-r border-[#2E3644]">
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              style={{ display: "flex", alignItems: "center" }}
              className={`gap-2.5 px-4 py-3 text-sm transition-colors border-l-2 ${
                active
                  ? "border-[#EA5B13] bg-[#EA5B13]/10 text-[#F2EDE3]"
                  : "border-transparent text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5"
              }`}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide">{it.label}</span>
              {it.count !== null && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }} className="text-xs bg-[#2E3644] text-[#8A93A3] rounded px-1.5 py-0.5">
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ---------------- JOGADORES ---------------- */

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

function PlayersView({ players, sessions, clubLogo, onAdd, onImportClick, onEdit, onDelete, onMoveTeam }) {
  const totalTreinos = countTreinosRealizados(sessions);
  return (
    <div>
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">
            Plantel
          </h1>
          <div className="text-sm text-[#8A93A3] mt-0.5">
            {players.length} jogador{players.length === 1 ? "" : "es"} registados
            {totalTreinos > 0 && ` · ${totalTreinos} treino${totalTreinos === 1 ? "" : "s"} realizado${totalTreinos === 1 ? "" : "s"} com presenças registadas`}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onImportClick} className="flex items-center gap-1.5 border border-[#2E3644] hover:border-[#5A6272] text-[#F2EDE3] text-sm font-medium rounded-md px-3.5 py-2 transition-colors">
            <Upload size={16} /> Importar lista
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 transition-colors">
            <Plus size={16} /> Adicionar jogador
          </button>
        </div>
      </div>
      {players.length === 0 ? (
        <EmptyState text="Ainda não adicionaste nenhum jogador. Começa por criar a ficha do primeiro." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((p) => {
            const presenca = calcPresenca(p.id, sessions);
            const ultimaAvaliacao = (p.avaliacoes || []).slice().sort((a, b) => (a.data < b.data ? 1 : -1))[0];
            return (
              <div key={p.id} className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 relative group">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div style={{ width: 76, height: 76 }} className="relative shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-[#14181F] border border-[#2E3644] flex items-center justify-center">
                        {p.foto ? (
                          <img src={p.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontFamily: "'Oswald', sans-serif" }} className="text-3xl font-bold text-[#EA5B13]">
                            {p.numero || "—"}
                          </span>
                        )}
                      </div>
                      {p.foto && p.numero && (
                        <span
                          style={{ fontFamily: "'IBM Plex Mono', monospace", width: 26, height: 26 }}
                          className="absolute -bottom-0.5 -right-0.5 bg-[#EA5B13] text-[#14181F] text-sm font-bold rounded-full flex items-center justify-center border-2 border-[#1E242E]"
                        >
                          {p.numero}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-base font-semibold uppercase tracking-wide truncate">
                        {p.nome || "Sem nome"}
                      </div>
                      <div className="text-xs text-[#8A93A3] truncate">{p.posicao}{p.nascimento ? ` · ${p.nascimento}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => onMoveTeam(p)} title="Mudar de equipa" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                      <ArrowRightLeft size={14} />
                    </button>
                    <button onClick={() => printPlayer(p, sessions, clubLogo)} title="Descarregar / Imprimir ficha" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                      <Printer size={14} />
                    </button>
                    <button onClick={() => onEdit(p)} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {(presenca !== null || ultimaAvaliacao) && (
                  <div className="mt-2 text-[11px] space-y-1">
                    {presenca !== null && (
                      <div className={presenca.pct >= 75 ? "text-[#4C9A6A]" : presenca.pct >= 50 ? "text-[#EA5B13]" : "text-[#D64545]"}>
                        {presenca.presentes} presenças de {presenca.total} treinos realizados · <b>{presenca.pct}% presença</b>
                        {presenca.faltas > 0 && <span className="text-[#8A93A3]"> ({presenca.faltas} falta{presenca.faltas === 1 ? "" : "s"})</span>}
                      </div>
                    )}
                    {ultimaAvaliacao && (ultimaAvaliacao.altura || ultimaAvaliacao.peso) && (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#8A93A3]">
                        {ultimaAvaliacao.altura ? `${ultimaAvaliacao.altura}m` : ""}{ultimaAvaliacao.altura && ultimaAvaliacao.peso ? " · " : ""}{ultimaAvaliacao.peso ? `${ultimaAvaliacao.peso}kg` : ""}
                      </div>
                    )}
                  </div>
                )}
                {p.notas && <div className="text-xs text-[#8A93A3] mt-2 line-clamp-3 border-t border-[#2E3644] pt-2">{p.notas}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerModal({ initial, sessions, onClose, onSave }) {
  const [form, setForm] = useState({ lesoes: [], avaliacoes: [], testesFisicos: [], ...initial });
  const [showEvolucao, setShowEvolucao] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const lesoes = form.lesoes || [];
  const avaliacoes = form.avaliacoes || [];
  const testesFisicos = form.testesFisicos || [];

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true);
    setFotoError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      setForm((f) => ({ ...f, foto: dataUrl }));
    } catch (err) {
      setFotoError(err.message || "Não foi possível carregar a foto.");
    } finally {
      setFotoLoading(false);
    }
  };

  const addLesao = () => setForm({ ...form, lesoes: [...lesoes, { id: uid(), ano: "", descricao: "" }] });
  const updateLesao = (id, key, value) => setForm({ ...form, lesoes: lesoes.map((l) => (l.id === id ? { ...l, [key]: value } : l)) });
  const removeLesao = (id) => setForm({ ...form, lesoes: lesoes.filter((l) => l.id !== id) });

  const addAvaliacao = () => setForm({ ...form, avaliacoes: [...avaliacoes, { id: uid(), data: todayStr(), altura: "", peso: "", envergadura: "", obs: "" }] });
  const updateAvaliacao = (id, key, value) => setForm({ ...form, avaliacoes: avaliacoes.map((a) => (a.id === id ? { ...a, [key]: value } : a)) });
  const removeAvaliacao = (id) => setForm({ ...form, avaliacoes: avaliacoes.filter((a) => a.id !== id) });
  const sortedAvaliacoes = [...avaliacoes].sort((a, b) => (a.data < b.data ? 1 : -1));

  const addTeste = () => setForm({ ...form, testesFisicos: [...testesFisicos, { id: uid(), data: todayStr(), tipoId: TIPOS_TESTE[0].id, nomePersonalizado: "", unidadePersonalizada: "", valor: "", obs: "" }] });
  const updateTeste = (id, key, value) => setForm({ ...form, testesFisicos: testesFisicos.map((t) => (t.id === id ? { ...t, [key]: value } : t)) });
  const removeTeste = (id) => setForm({ ...form, testesFisicos: testesFisicos.filter((t) => t.id !== id) });
  const sortedTestes = [...testesFisicos].sort((a, b) => (a.data < b.data ? 1 : -1));

  const temEstatisticasJogo = (sessions || []).some((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[form.id || "__novo__"]);
  const temDadosEvolucao = avaliacoes.length > 0 || testesFisicos.length > 0 || temEstatisticasJogo;

  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar jogador" : "Novo jogador"} wide>
      <div className="flex items-center gap-4 mb-4">
        <div style={{ width: 72, height: 72 }} className="rounded-full overflow-hidden bg-[#14181F] border border-[#2E3644] flex items-center justify-center shrink-0">
          {fotoLoading ? (
            <Loader2 size={20} className="animate-spin text-[#5A6272]" />
          ) : form.foto ? (
            <img src={form.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Users size={26} className="text-[#5A6272]" />
          )}
        </div>
        <div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs px-3 py-2 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]">
              {form.foto ? "Alterar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            </label>
            {form.foto && (
              <button type="button" onClick={() => setForm({ ...form, foto: "" })} className="text-xs text-[#D64545] hover:text-[#F2EDE3] px-2">
                Remover
              </button>
            )}
          </div>
          {fotoError && <div className="text-[11px] text-[#D64545] mt-1">{fotoError}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2">
          <input value={form.nome} onChange={set("nome")} className={inputCls} placeholder="Nome do jogador" />
        </Field>
        <Field label="Número">
          <input value={form.numero} onChange={set("numero")} className={inputCls} placeholder="7" />
        </Field>
        <Field label="Posição">
          <select value={form.posicao} onChange={set("posicao")} className={inputCls}>
            {POSICOES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Data de nascimento">
          <input type="date" value={form.nascimento} onChange={set("nascimento")} className={inputCls} />
        </Field>
        <Field label="Épocas no clube">
          <input type="number" min="0" value={form.epocasClube} onChange={set("epocasClube")} className={inputCls} placeholder="1" />
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Contactos</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morada" className="col-span-2">
            <input value={form.morada} onChange={set("morada")} className={inputCls} placeholder="Rua, nº" />
          </Field>
          <Field label="Cidade">
            <input value={form.cidade} onChange={set("cidade")} className={inputCls} />
          </Field>
          <Field label="Profissão">
            <input value={form.profissao} onChange={set("profissao")} className={inputCls} placeholder="Estudante" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
          </Field>
          <Field label="Telemóvel">
            <input value={form.telemovel} onChange={set("telemovel")} className={inputCls} />
          </Field>
          <Field label="C.C.">
            <input value={form.cc} onChange={set("cc")} className={inputCls} />
          </Field>
          <Field label="NIF">
            <input value={form.nif} onChange={set("nif")} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Saúde</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Medicação">
            <input value={form.medicacao} onChange={set("medicacao")} className={inputCls} placeholder="Nenhuma" />
          </Field>
          <Field label="Outros desportos">
            <input value={form.outrosDesportos} onChange={set("outrosDesportos")} className={inputCls} placeholder="Não" />
          </Field>
        </div>
        <div className="mt-3">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Histórico de lesões</span>
          <div className="space-y-2">
            {lesoes.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <input value={l.ano} onChange={(e) => updateLesao(l.id, "ano", e.target.value)} className={inputCls + " w-24"} placeholder="Ano" />
                <input value={l.descricao} onChange={(e) => updateLesao(l.id, "descricao", e.target.value)} className={inputCls + " flex-1"} placeholder="Descrição da lesão" />
                <button type="button" onClick={() => removeLesao(l.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLesao}
            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
          >
            <Plus size={13} /> Adicionar lesão
          </button>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-[#8A93A3]" style={{ fontFamily: "'Oswald', sans-serif" }}>Avaliação corporal</div>
          {temDadosEvolucao && (
            <button type="button" onClick={() => setShowEvolucao(true)} className="flex items-center gap-1 text-[11px] text-[#EA5B13] hover:text-[#FF6B1A]">
              <TrendingUp size={13} /> Ver evolução
            </button>
          )}
        </div>
        <div className="space-y-2">
          {sortedAvaliacoes.map((a) => (
            <div key={a.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
              <div className="grid grid-cols-4 gap-2">
                <input type="date" value={a.data} onChange={(e) => updateAvaliacao(a.id, "data", e.target.value)} className={inputCls} />
                <input value={a.altura} onChange={(e) => updateAvaliacao(a.id, "altura", e.target.value)} className={inputCls} placeholder="Altura (m)" />
                <input value={a.peso} onChange={(e) => updateAvaliacao(a.id, "peso", e.target.value)} className={inputCls} placeholder="Peso (kg)" />
                <div className="flex gap-1">
                  <input value={a.envergadura} onChange={(e) => updateAvaliacao(a.id, "envergadura", e.target.value)} className={inputCls} placeholder="Envergadura" />
                  <button type="button" onClick={() => removeAvaliacao(a.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  value={a.obs}
                  onChange={(e) => updateAvaliacao(a.id, "obs", e.target.value)}
                  className={inputCls + " col-span-4"}
                  placeholder="Observações (opcional)"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAvaliacao}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar avaliação
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Testes físicos (velocidade, agilidade, força, resistência)</div>
        <div className="space-y-2">
          {sortedTestes.map((t) => {
            const tipo = getTipoTeste(t.tipoId);
            return (
              <div key={t.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
                <div className="grid grid-cols-4 gap-2">
                  <select value={t.tipoId} onChange={(e) => updateTeste(t.id, "tipoId", e.target.value)} className={inputCls + " col-span-2"}>
                    {["Velocidade", "Agilidade", "Força", "Resistência", "Outro"].map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {TIPOS_TESTE.filter((tt) => tt.categoria === cat).map((tt) => (
                          <option key={tt.id} value={tt.id}>{tt.nome}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input type="date" value={t.data} onChange={(e) => updateTeste(t.id, "data", e.target.value)} className={inputCls} />
                  <div className="flex gap-1">
                    <input value={t.valor} onChange={(e) => updateTeste(t.id, "valor", e.target.value)} className={inputCls} placeholder={`Valor${tipo.unidade ? ` (${tipo.unidade})` : ""}`} />
                    <button type="button" onClick={() => removeTeste(t.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {t.tipoId === "outro" && (
                    <input
                      value={t.nomePersonalizado}
                      onChange={(e) => updateTeste(t.id, "nomePersonalizado", e.target.value)}
                      className={inputCls + " col-span-2"}
                      placeholder="Nome do teste"
                    />
                  )}
                  {t.tipoId === "outro" && (
                    <input
                      value={t.unidadePersonalizada || ""}
                      onChange={(e) => updateTeste(t.id, "unidadePersonalizada", e.target.value)}
                      className={inputCls + " col-span-2"}
                      placeholder="Unidade (ex: s, cm, m)"
                    />
                  )}
                  <input
                    value={t.obs}
                    onChange={(e) => updateTeste(t.id, "obs", e.target.value)}
                    className={inputCls + " col-span-4"}
                    placeholder="Observações (opcional)"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addTeste}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar teste físico
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <Field label="Notas gerais">
          <textarea value={form.notas} onChange={set("notas")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Pontos fortes, comportamento, outras observações..." />
        </Field>
      </div>

      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.nome.trim()} />
    </Modal>
    {showEvolucao && (
      <EvolucaoModal player={form} sessions={sessions} onClose={() => setShowEvolucao(false)} />
    )}
    </>
  );
}

function EvolucaoChart({ title, unidade, data }) {
  if (data.length === 0) return null;
  return (
    <div className="bg-[#14181F] border border-[#2E3644] rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{title}</span>
        {unidade && <span className="text-[10px] text-[#5A6272]">{unidade}</span>}
      </div>
      {data.length === 1 ? (
        <div className="text-[11px] text-[#8A93A3] py-4 text-center">
          Só há um registo ({formatDateFull(data[0].dataRaw)}: <b className="text-[#F2EDE3]">{data[0].valor}{unidade}</b>). Adiciona mais para veres a evolução.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E3644" />
            <XAxis dataKey="dataLabel" tick={{ fill: "#8A93A3", fontSize: 10 }} axisLine={{ stroke: "#2E3644" }} tickLine={false} />
            <YAxis tick={{ fill: "#8A93A3", fontSize: 10 }} axisLine={{ stroke: "#2E3644" }} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#1E242E", border: "1px solid #2E3644", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#F2EDE3" }}
              itemStyle={{ color: "#EA5B13" }}
            />
            <Line type="monotone" dataKey="valor" stroke="#EA5B13" strokeWidth={2} dot={{ r: 3, fill: "#EA5B13" }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EvolucaoModal({ player, sessions, onClose }) {
  const avaliacoes = [...(player.avaliacoes || [])]
    .filter((a) => a.data)
    .sort((a, b) => (a.data > b.data ? 1 : -1));
  const testes = [...(player.testesFisicos || [])]
    .filter((t) => t.data && t.valor !== "")
    .sort((a, b) => (a.data > b.data ? 1 : -1));
  const jogosComEstatisticas = [...(sessions || [])]
    .filter((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[player.id])
    .sort((a, b) => (a.data > b.data ? 1 : -1));

  const toChartData = (list, key) =>
    list
      .filter((item) => item[key] !== "" && item[key] != null)
      .map((item) => ({ dataLabel: formatDateShortYear(item.data), dataRaw: item.data, valor: Number(item[key]) }));

  const alturaData = toChartData(avaliacoes, "altura");
  const pesoData = toChartData(avaliacoes, "peso");
  const envergaduraData = toChartData(avaliacoes, "envergadura");

  const testesPorTipo = {};
  testes.forEach((t) => {
    const key = t.tipoId;
    testesPorTipo[key] = testesPorTipo[key] || [];
    testesPorTipo[key].push(t);
  });

  const estatisticasChartData = (campo) =>
    jogosComEstatisticas
      .filter((s) => s.estatisticas[player.id][campo] !== "" && s.estatisticas[player.id][campo] != null)
      .map((s) => ({
        dataLabel: `${formatDateShortYear(s.date)} vs ${s.adversario || "?"}`,
        dataRaw: s.date,
        valor: Number(s.estatisticas[player.id][campo]),
      }));

  return (
    <Modal onClose={onClose} title={`Evolução — ${player.nome || "Jogador"}`} wide>
      <div className="grid grid-cols-2 gap-3">
        <EvolucaoChart title="Altura" unidade="m" data={alturaData} />
        <EvolucaoChart title="Peso" unidade="kg" data={pesoData} />
        <EvolucaoChart title="Envergadura" unidade="cm" data={envergaduraData} />
        {Object.entries(testesPorTipo).map(([tipoId, list]) => {
          const tipo = getTipoTeste(tipoId);
          const nome = tipoId === "outro" ? (list[0].nomePersonalizado || "Teste personalizado") : tipo.nome;
          const unidade = tipoId === "outro" ? (list[0].unidadePersonalizada || "") : tipo.unidade;
          return <EvolucaoChart key={tipoId} title={nome} unidade={unidade} data={toChartData(list, "valor")} />;
        })}
      </div>
      {jogosComEstatisticas.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mt-5 mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Estatísticas de jogo</div>
          <div className="grid grid-cols-2 gap-3">
            {ESTATISTICAS_CAMPOS.map((c) => (
              <EvolucaoChart key={c.key} title={c.nome} unidade="" data={estatisticasChartData(c.key)} />
            ))}
          </div>
        </>
      )}
      {alturaData.length === 0 && pesoData.length === 0 && envergaduraData.length === 0 && Object.keys(testesPorTipo).length === 0 && jogosComEstatisticas.length === 0 && (
        <EmptyState text="Ainda não há dados suficientes para mostrar gráficos." />
      )}
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

/* ---------------- PAINEL INICIAL ---------------- */

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

function DashboardView({ team, players, sessions, library, onNavigate, onGenerateReport }) {
  const hojeStr = todayStr();
  const treinosJogos = sessions.filter((s) => s.type === "treino" || s.type === "jogo");

  const proximos = treinosJogos
    .filter((s) => s.date >= hojeStr && !(s.type === "treino" && s.realizado === true))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3);

  const porConfirmar = sessions.filter((s) => s.type === "treino" && s.date < hojeStr && s.realizado !== true);

  const treinosRealizados = countTreinosRealizados(sessions);
  const jogosDaEpoca = sessions.filter((s) => s.type === "jogo");

  const presencaBaixa = players
    .map((p) => ({ p, presenca: calcPresenca(p.id, sessions) }))
    .filter((x) => x.presenca && x.presenca.total >= 3 && x.presenca.pct < 50);

  const aniversarios = players
    .map((p) => ({ p, dias: diasParaAniversario(p.nascimento) }))
    .filter((x) => x.dias !== null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const totalHabilidades = HABILIDADES.length;
  const tocadas = new Set(library.map((ex) => ex.categoria).filter(Boolean)).size;
  const pctPlano = totalHabilidades ? Math.round((tocadas / totalHabilidades) * 100) : 0;

  return (
    <div>
      <ViewHeader title={`Olá! ${team ? `— ${team.nome}` : ""}`} subtitle={team && team.temporadaAtual ? `Época ${team.temporadaAtual}` : ""} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{players.length}</div>
          <div className="text-xs text-[#8A93A3]">Jogadoras/es</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{treinosRealizados}</div>
          <div className="text-xs text-[#8A93A3]">Treinos realizados</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{jogosDaEpoca.length}</div>
          <div className="text-xs text-[#8A93A3]">Jogos</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{pctPlano}%</div>
          <div className="text-xs text-[#8A93A3]">Plano cumprido</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Próximos</span>
            <button onClick={() => onNavigate("calendario")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver calendário</button>
          </div>
          {proximos.length === 0 ? (
            <EmptyState text="Nada agendado. Cria um treino ou jogo." small />
          ) : (
            <div className="space-y-2">
              {proximos.map((s) => {
                const isGame = s.type === "jogo";
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3] w-12 shrink-0">{formatDateShort(s.date)}</div>
                    <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 ${isGame ? "bg-[#EA5B13]/20 text-[#EA5B13]" : "bg-[#4C9A6A]/20 text-[#4C9A6A]"}`}>
                      {isGame ? "Jogo" : "Treino"}
                    </span>
                    <span className="truncate">{isGame ? `vs ${s.adversario || "?"}` : (s.title || "Treino")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Por confirmar</span>
            {porConfirmar.length > 0 && <button onClick={() => onNavigate("treinos")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver treinos</button>}
          </div>
          {porConfirmar.length === 0 ? (
            <EmptyState text="Tudo em dia — sem treinos passados por confirmar." small />
          ) : (
            <div className="text-sm text-[#D64545]">
              {porConfirmar.length} treino{porConfirmar.length === 1 ? "" : "s"} já passou{porConfirmar.length === 1 ? "" : "aram"} a data e ainda não {porConfirmar.length === 1 ? "foi" : "foram"} marcado{porConfirmar.length === 1 ? "" : "s"} como realizado{porConfirmar.length === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Presença baixa</span>
            {presencaBaixa.length > 0 && <button onClick={() => onNavigate("jogadores")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver plantel</button>}
          </div>
          {presencaBaixa.length === 0 ? (
            <EmptyState text="Ninguém abaixo de 50% de presença." small />
          ) : (
            <div className="space-y-1.5">
              {presencaBaixa.map(({ p, presenca }) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.nome}</span>
                  <span className="text-[#D64545] text-xs shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{presenca.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Aniversários próximos</span>
          </div>
          {aniversarios.length === 0 ? (
            <EmptyState text="Nenhum aniversário nos próximos 30 dias." small />
          ) : (
            <div className="space-y-1.5">
              {aniversarios.map(({ p, dias }) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.nome}</span>
                  <span className="text-[#8A93A3] text-xs shrink-0">{dias === 0 ? "Hoje!" : `em ${dias} dia${dias === 1 ? "" : "s"}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Relatório de fim de época</div>
          <div className="text-xs text-[#8A93A3] mt-0.5">Resumo completo desta época — presenças, resultados, plano cumprido — pronto a descarregar.</div>
        </div>
        <button onClick={onGenerateReport} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 shrink-0">
          <Printer size={15} /> Gerar relatório
        </button>
      </div>
    </div>
  );
}

/* ---------------- TREINOS ---------------- */

function SessionsView({ sessions, players, clubLogo, onAdd, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Treinos e jogos" subtitle={`${sessions.length} registo${sessions.length === 1 ? "" : "s"} por realizar/planeado${sessions.length === 1 ? "" : "s"}`} onAdd={onAdd} addLabel="Novo registo" />
      {sorted.length === 0 ? (
        <EmptyState text="Sem treinos ou jogos planeados. Cria o primeiro registo — depois de realizado, marca-o como concluído e ele passa para a aba Realizados." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RealizadosView({ sessions, players, clubLogo, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Treinos realizados" subtitle={`${sessions.length} treino${sessions.length === 1 ? "" : "s"} concluído${sessions.length === 1 ? "" : "s"}`} />
      {sorted.length === 0 ? (
        <EmptyState text="Ainda não marcaste nenhum treino como realizado. Vai à aba Treinos, edita um registo e marca 'Sim' em 'Este treino foi realizado?'." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ s, players, clubLogo, onEdit, onDelete, onTransfer }) {
  const isGame = s.type === "jogo";
  const exercicios = s.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);
  const naoRealizado = !isGame && s.realizado === false;
  return (
    <div className={`bg-[#1E242E] border rounded-lg p-4 flex items-start gap-4 group ${naoRealizado ? "border-[#D64545]/30 opacity-70" : "border-[#2E3644]"}`}>
      <div className="text-center shrink-0 w-14">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          {formatDateShort(s.date)}
        </div>
        <div className={`mt-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${isGame ? "bg-[#EA5B13]/20 text-[#EA5B13]" : "bg-[#4C9A6A]/20 text-[#4C9A6A]"}`}>
          {isGame ? "Jogo" : "Treino"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide truncate">
            {s.title || (isGame ? `vs ${s.adversario || "?"}` : "Treino")}
          </div>
          {naoRealizado && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider bg-[#D64545]/20 text-[#D64545] rounded px-1.5 py-0.5">Não realizado</span>
          )}
        </div>
        {isGame ? (
          <div className="text-xs text-[#8A93A3] mt-0.5">Adversário: {s.adversario || "—"} {s.resultado && `· Resultado: ${s.resultado}`}</div>
        ) : (
          <>
            {s.objetivo && <div className="text-xs text-[#8A93A3] mt-0.5">Objetivo: {s.objetivo}</div>}
            {exercicios.length > 0 && (
              <div className="text-xs text-[#8A93A3] mt-0.5">
                {exercicios.length} exercício{exercicios.length === 1 ? "" : "s"} · {totalMin} min
              </div>
            )}
          </>
        )}
        {isGame && s.conteudo && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.conteudo}</div>}
        {!isGame && exercicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {exercicios.slice(0, 4).map((e) => (
              <span key={e.id} className="text-[10px] bg-[#14181F] border border-[#2E3644] rounded px-1.5 py-0.5 text-[#8A93A3]">
                {e.nome || "Exercício"}
              </span>
            ))}
            {exercicios.length > 4 && (
              <span className="text-[10px] text-[#5A6272] px-1">+{exercicios.length - 4}</span>
            )}
          </div>
        )}
        {!isGame && s.observacoes && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.observacoes}</div>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onTransfer && (
          <button onClick={onTransfer} title="Copiar para outra equipa" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
            <Copy size={14} />
          </button>
        )}
        <button onClick={() => printSession(s, players, clubLogo)} title="Descarregar / Imprimir" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Printer size={14} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
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

function svgHalfMarkingsStr(flipY, w, h) {
  const cx = w / 2;
  const baseline = h - 10;
  const keyTop = baseline - 120;
  const keyHalf = 50;
  const inner = `
    <rect x="${cx - keyHalf}" y="${keyTop}" width="${keyHalf * 2}" height="120" fill="#eee" stroke="#999" stroke-width="1"/>
    <circle cx="${cx}" cy="${keyTop}" r="36" fill="none" stroke="#999" stroke-width="1.5"/>
    <path d="M ${cx - 130} ${baseline} Q ${cx - 130} ${baseline - 155} ${cx} ${baseline - 155}" fill="none" stroke="#999" stroke-width="1.5"/>
    <path d="M ${cx + 130} ${baseline} Q ${cx + 130} ${baseline - 155} ${cx} ${baseline - 155}" fill="none" stroke="#999" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${baseline - 22}" r="3" fill="#999"/>
    <line x1="${cx - 20}" y1="${baseline - 4}" x2="${cx + 20}" y2="${baseline - 4}" stroke="#999" stroke-width="3"/>`;
  return flipY ? `<g transform="translate(0 ${h}) scale(1 -1)">${inner}</g>` : inner;
}

function svgCourtBackgroundStr(court, vb) {
  let bg = `<rect x="0" y="0" width="${vb.w}" height="${vb.h}" fill="#fff"/><rect x="10" y="10" width="${vb.w - 20}" height="${vb.h - 20}" fill="none" stroke="#999" stroke-width="1.5"/>`;
  if (court === "campo") {
    bg += svgHalfMarkingsStr(false, vb.w, vb.h) + svgHalfMarkingsStr(true, vb.w, vb.h);
    bg += `<line x1="10" y1="${vb.h / 2}" x2="${vb.w - 10}" y2="${vb.h / 2}" stroke="#999" stroke-width="1.5"/><circle cx="${vb.w / 2}" cy="${vb.h / 2}" r="30" fill="none" stroke="#999" stroke-width="1.5"/>`;
  } else {
    bg += svgHalfMarkingsStr(false, vb.w, vb.h);
    bg += `<line x1="10" y1="10" x2="${vb.w - 10}" y2="10" stroke="#999" stroke-width="1.5"/>`;
  }
  return bg;
}

function svgTokenStr(token) {
  const { x, y, type, number } = token;
  if (type === "ball") {
    return `<g transform="translate(${x} ${y})"><circle r="7" fill="#EA5B13"/><path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#14181F" stroke-width="1"/></g>`;
  }
  const isDef = type === "defense";
  return `<g transform="translate(${x} ${y})">
    <circle r="12" fill="${isDef ? "transparent" : "#EA5B13"}" stroke="${isDef ? "#D64545" : "#14181F"}" stroke-width="${isDef ? 2.5 : 1.5}" ${isDef ? 'stroke-dasharray="3 2"' : ""}/>
    <text text-anchor="middle" dy="4" font-size="11" fill="${isDef ? "#D64545" : "#14181F"}" font-family="Arial" font-weight="600">${escapeHtml(number)}</text>
  </g>`;
}

function svgArrowStr(arrow) {
  const color = "#555";
  if (arrow.type === "bloqueio") {
    const { x, y } = arrow.at;
    return `<g transform="translate(${x} ${y})"><line x1="-9" y1="0" x2="9" y2="0" stroke="${color}" stroke-width="4"/></g>`;
  }
  const { from, to } = arrow;
  const d = arrow.type === "drible" ? wavyPathD(from.x, from.y, to.x, to.y) : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dash = arrow.type === "passe" ? 'stroke-dasharray="6 4"' : "";
  return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" ${dash}/><path d="${arrowHead(from.x, from.y, to.x, to.y)}" stroke="${color}" stroke-width="2" fill="none"/>`;
}

function diagramToSvgString(diagram, width = 150) {
  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const height = Math.round(width * (vb.h / vb.w));
  const inner = svgCourtBackgroundStr(diagram.court, vb) + diagram.arrows.map(svgArrowStr).join("") + diagram.tokens.map(svgTokenStr).join("");
  return `<svg viewBox="0 0 ${vb.w} ${vb.h}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #ddd;border-radius:4px;">${inner}</svg>`;
}

function buildSessionPrintContent(session, players, clubLogo) {
  const isGame = session.type === "jogo";
  const exercicios = session.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);
  const presencas = session.presencas || {};
  const presentesRows = (players || [])
    .map((p) => {
      const st = presencas[p.id];
      const label = st === "P" ? "Presente" : st === "F" ? "Falta" : "—";
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td><td>${label}</td></tr>`;
    })
    .join("");

  const exerciciosHtml = exercicios
    .map(
      (e, i) => `
      <tr>
        <td style="text-align:center;font-weight:600;">${i + 1}</td>
        <td style="text-align:center;">${escapeHtml(e.duracao || "-")}'</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(e.nome || "Exercício")}</div>
          ${e.descricao ? `<div style="white-space:pre-wrap;color:#444;margin-top:2px;">${escapeHtml(e.descricao)}</div>` : ""}
          ${e.diagramas && e.diagramas.length > 0 ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            ${e.diagramas.map((d, idx) => `
              <div style="text-align:center;">
                ${diagramToSvgString(d, 150)}
                <div style="font-size:10px;color:#999;margin-top:2px;">Passo ${idx + 1}</div>
              </div>`).join("")}
          </div>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const title = escapeHtml(session.title || (isGame ? `vs ${session.adversario || "?"}` : "Treino"));

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; margin-bottom: 20px; padding: 12px 16px; background: #f4f4f5; border-radius: 6px; }
  .meta div b { display: block; font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; }
  .presencas-grid { columns: 2; column-gap: 24px; }
  .presencas-grid table { break-inside: avoid; }
  footer { margin-top: 30px; font-size: 11px; color: #999; text-align: center; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin-bottom:10px;display:block;" />` : ""}
  <h1>${title}</h1>
  <div class="sub">${isGame ? "Jogo" : "Treino"} · ${formatDateFull(session.date)}</div>
  <div class="meta">
    ${isGame
      ? `<div><b>Adversário</b>${escapeHtml(session.adversario || "—")}</div><div><b>Resultado</b>${escapeHtml(session.resultado || "—")}</div>`
      : `<div><b>Objetivo</b>${escapeHtml(session.objetivo || "—")}</div><div><b>Duração total</b>${totalMin} min</div><div><b>Nº exercícios</b>${exercicios.length}</div>`
    }
  </div>

  ${!isGame && exercicios.length > 0 ? `
  <h2>Exercícios</h2>
  <table>
    <thead><tr><th style="width:30px;">#</th><th style="width:60px;">Tempo</th><th>Descrição</th></tr></thead>
    <tbody>${exerciciosHtml}</tbody>
  </table>` : ""}

  ${(isGame ? session.conteudo : session.observacoes) ? `
  <h2>${isGame ? "Relatório do jogo" : "Observações"}</h2>
  <div class="obs">${escapeHtml(isGame ? session.conteudo : session.observacoes)}</div>` : ""}

  ${!isGame && players && players.length > 0 ? `
  <h2>Presenças</h2>
  <div class="presencas-grid">
    <table>
      <thead><tr><th style="width:30px;">Nº</th><th>Nome</th><th style="width:70px;">Estado</th></tr></thead>
      <tbody>${presentesRows}</tbody>
    </table>
  </div>` : ""}

  <footer>Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printSession(session, players, clubLogo) {
  const html = buildSessionPrintContent(session, players, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const isGame = session.type === "jogo";
  const namePart = (session.title || (isGame ? `vs-${session.adversario || "adversario"}` : "treino")).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.date || "treino"}-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SessionModal({ initial, library, players, onSaveToLibrary, onClose, onSave }) {
  const [form, setForm] = useState({ exercicios: [], observacoes: "", presencas: {}, ...initial });
  const [showPicker, setShowPicker] = useState(false);
  const [showAiTreino, setShowAiTreino] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFase, setPickerFase] = useState("");
  const [savedIds, setSavedIds] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isGame = form.type === "jogo";
  const exercicios = form.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);

  const addExercise = () => {
    setForm({ ...form, exercicios: [...exercicios, { id: uid(), nome: "", duracao: "", descricao: "", diagramas: [], categoria: "" }] });
  };
  const addFromLibrary = (item) => {
    setForm({
      ...form,
      exercicios: [...exercicios, { id: uid(), nome: item.nome, duracao: item.duracaoPadrao || "", descricao: item.descricao || "", diagramas: item.diagramas || [], categoria: item.categoria || "" }],
    });
    setShowPicker(false);
    setPickerSearch("");
  };
  const updateExercise = (id, key, value) => {
    setForm({ ...form, exercicios: exercicios.map((e) => (e.id === id ? { ...e, [key]: value } : e)) });
  };
  const removeExercise = (id) => {
    setForm({ ...form, exercicios: exercicios.filter((e) => e.id !== id) });
  };
  const moveExercise = (index, dir) => {
    const next = [...exercicios];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setForm({ ...form, exercicios: next });
  };
  const saveExerciseToLibrary = (ex) => {
    if (!ex.nome.trim()) return;
    onSaveToLibrary({ nome: ex.nome, categoria: ex.categoria || HABILIDADES[0].id, duracaoPadrao: ex.duracao || "", descricao: ex.descricao || "", diagramas: ex.diagramas || [] });
    setSavedIds({ ...savedIds, [ex.id]: true });
  };

  const filteredLibrary = (library || []).filter((l) => {
    const h = getHabilidade(l.categoria);
    if (pickerFase && (!h || h.fase !== pickerFase)) return false;
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.trim().toLowerCase();
    return l.nome.toLowerCase().includes(q) || (h && h.nome.toLowerCase().includes(q));
  });

  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar treino" : "Novo treino"} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
        </Field>
        <Field label="Título" className="col-span-2">
          <input value={form.title} onChange={set("title")} className={inputCls} placeholder="Ex: Defesa em zona" />
        </Field>

        {isGame ? (
          <>
            <Field label="Adversário">
              <input value={form.adversario} onChange={set("adversario")} className={inputCls} placeholder="Nome da equipa" />
            </Field>
            <Field label="Resultado">
              <input value={form.resultado} onChange={set("resultado")} className={inputCls} placeholder="Ex: 68-54" />
            </Field>
            <Field label="Relatório do jogo" className="col-span-2">
              <textarea value={form.conteudo} onChange={set("conteudo")} className={inputCls + " resize-none"} style={{ minHeight: 110 }} placeholder="Observações, desempenho, pontos a melhorar..." />
            </Field>
          </>
        ) : (
          <>
            <div className="col-span-2 flex items-center justify-between bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2 mb-1">
              <span className="text-sm">Este treino foi realizado?</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, realizado: true })}
                  className={`px-3 py-1 text-xs rounded ${form.realizado === true ? "bg-[#4C9A6A] text-[#14181F] font-medium" : "border border-[#2E3644] text-[#8A93A3]"}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, realizado: false })}
                  className={`px-3 py-1 text-xs rounded ${form.realizado !== true ? "bg-[#D64545] text-[#14181F] font-medium" : "border border-[#2E3644] text-[#8A93A3]"}`}
                >
                  Não
                </button>
              </div>
            </div>

            <Field label="Objetivo geral" className="col-span-2">
              <input value={form.objetivo} onChange={set("objetivo")} className={inputCls} placeholder="Ex: Melhorar transição defesa-ataque" />
            </Field>

            <div className="col-span-2 mt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8A93A3]">Exercícios do treino</span>
                {exercicios.length > 0 && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#EA5B13]">
                    Duração total: {totalMin} min
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {exercicios.map((ex, i) => (
                  <div key={ex.id} className="border border-[#2E3644] rounded-md p-3 bg-[#14181F]">
                    <div className="flex items-start gap-2">
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#5A6272] mt-2 w-4 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <input
                          value={ex.nome}
                          onChange={(e) => updateExercise(ex.id, "nome", e.target.value)}
                          className={inputCls + " col-span-3"}
                          placeholder="Nome do exercício"
                        />
                        <input
                          type="number"
                          min="0"
                          value={ex.duracao}
                          onChange={(e) => updateExercise(ex.id, "duracao", e.target.value)}
                          className={inputCls}
                          placeholder="min"
                        />
                        <div className="col-span-4">
                          <HabilidadeSelect
                            value={ex.categoria || ""}
                            onChange={(e) => updateExercise(ex.id, "categoria", e.target.value)}
                            className={inputCls + " text-xs"}
                            placeholderOption="Sem habilidade associada (opcional)"
                          />
                        </div>
                        <textarea
                          value={ex.descricao}
                          onChange={(e) => updateExercise(ex.id, "descricao", e.target.value)}
                          className={inputCls + " col-span-4 resize-none"} style={{ minHeight: 50 }}
                          placeholder="Descrição / instruções (organização, variantes, critério de sucesso...)"
                        />
                        <div className="col-span-4">
                          <DiagramStepsRow diagramas={ex.diagramas || []} onChange={(diagramas) => updateExercise(ex.id, "diagramas", diagramas)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button type="button" onClick={() => moveExercise(i, -1)} disabled={i === 0} className="p-1 text-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-20">
                          <ChevronLeft size={13} className="rotate-90" />
                        </button>
                        <button type="button" onClick={() => moveExercise(i, 1)} disabled={i === exercicios.length - 1} className="p-1 text-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-20">
                          <ChevronRight size={13} className="rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveExerciseToLibrary(ex)}
                          disabled={!ex.nome.trim() || savedIds[ex.id]}
                          title="Guardar na biblioteca"
                          className={`p-1 ${savedIds[ex.id] ? "text-[#EA5B13]" : "text-[#5A6272] hover:text-[#EA5B13]"} disabled:opacity-20`}
                        >
                          <Star size={13} fill={savedIds[ex.id] ? "currentColor" : "none"} />
                        </button>
                        <button type="button" onClick={() => removeExercise(ex.id)} className="p-1 text-[#5A6272] hover:text-[#D64545]">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showPicker && (
                <div className="mt-2 border border-[#2E3644] rounded-md bg-[#14181F] p-2">
                  <div className="flex items-center gap-2 border border-[#2E3644] rounded-md px-2 mb-1.5">
                    <Search size={13} className="text-[#5A6272] shrink-0" />
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Pesquisar por nome ou habilidade..."
                      className="w-full bg-transparent py-1.5 text-sm text-[#F2EDE3] placeholder-[#5A6272] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1 mb-1.5">
                    {["", "Defesa", "Ataque"].map((f) => (
                      <button
                        key={f || "todas"}
                        type="button"
                        onClick={() => setPickerFase(f)}
                        className={`text-[11px] px-2 py-0.5 rounded ${pickerFase === f ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}
                      >
                        {f || "Todas"}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-[#5A6272] self-center">{filteredLibrary.length} resultado{filteredLibrary.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLibrary.length === 0 ? (
                      <div className="text-xs text-[#5A6272] px-2 py-3 text-center">Nenhum exercício encontrado.</div>
                    ) : (
                      filteredLibrary.map((item) => {
                        const h = getHabilidade(item.categoria);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addFromLibrary(item)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm truncate">{item.nome}</span>
                              {item.duracaoPadrao && (
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{item.duracaoPadrao}min</span>
                              )}
                            </div>
                            {h && <div className="text-[10px] text-[#5A6272] truncate">{h.fase} · {h.componente} · {h.nome}</div>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={addExercise}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2.5 transition-colors"
                >
                  <Plus size={14} /> Exercício em branco
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2.5 transition-colors"
                >
                  <BookOpen size={14} /> Da biblioteca
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiTreino(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#EA5B13]/50 hover:border-[#EA5B13] text-[#EA5B13] text-xs rounded-md py-2.5 transition-colors"
                >
                  <Sparkles size={14} /> Sugerir com IA
                </button>
              </div>
            </div>

            {players && players.length > 0 && (
              <div className="col-span-2 mt-1">
                <span className="block text-xs text-[#8A93A3] mb-1.5">Presenças</span>
                <div style={{ maxHeight: 180, overflowY: "auto" }} className="grid grid-cols-2 gap-1.5 border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
                  {players.map((p) => {
                    const status = (form.presencas || {})[p.id];
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs px-1.5 py-1">
                        <span className="truncate">{p.numero ? `${p.numero} · ` : ""}{p.nome}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, presencas: { ...form.presencas, [p.id]: status === "P" ? null : "P" } })}
                            className={`w-6 h-6 rounded text-[10px] font-semibold ${status === "P" ? "bg-[#4C9A6A] text-[#14181F]" : "bg-[#2E3644] text-[#8A93A3]"}`}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, presencas: { ...form.presencas, [p.id]: status === "F" ? null : "F" } })}
                            className={`w-6 h-6 rounded text-[10px] font-semibold ${status === "F" ? "bg-[#D64545] text-[#14181F]" : "bg-[#2E3644] text-[#8A93A3]"}`}
                          >
                            F
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Observações gerais" className="col-span-2 mt-1">
              <textarea value={form.observacoes} onChange={set("observacoes")} className={inputCls + " resize-none"} style={{ minHeight: 60 }} placeholder="Notas sobre o treino, avaliação geral..." />
            </Field>
          </>
        )}
      </div>
      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.date} />
    </Modal>
    {showAiTreino && (
      <AiSuggestModal
        mode="treino"
        defaults={{ objetivo: form.objetivo, duracaoTotal: totalMin > 0 ? totalMin : 90 }}
        onClose={() => setShowAiTreino(false)}
        onInsertTreino={(items) => {
          const novos = items.map((it) => ({ id: uid(), nome: it.nome, duracao: String(it.duracao || ""), descricao: it.descricao || "", diagramas: [] }));
          setForm({ ...form, exercicios: [...exercicios, ...novos] });
          setShowAiTreino(false);
        }}
      />
    )}
    </>
  );
}

function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseRosterText(text) : [];

  return (
    <Modal onClose={onClose} title="Importar lista de jogadores">
      <p className="text-xs text-[#8A93A3] mb-3">
        Cola a lista com <span className="text-[#F2EDE3]">número, nome e posição</span> por linha (como copiaste de um documento ou folha de cálculo).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputCls + " resize-none"} style={{ minHeight: 160 }}
        style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}
        placeholder={"11;Ana Cláudia Dias Bastos;Poste\n8;Carlota Brigas Raquel;Base\n\n(também aceita listas separadas por tabs ou espaços)"}
      />
      {text.trim() && (
        <div className="mt-3 border border-[#2E3644] rounded-md max-h-40 overflow-y-auto">
          {parsed.length === 0 ? (
            <div className="text-xs text-[#D64545] px-3 py-2">Não consegui reconhecer nenhuma linha válida.</div>
          ) : (
            parsed.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-[#2E3644] last:border-b-0">
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#EA5B13] w-6 shrink-0">{p.numero}</span>
                <span className="flex-1 truncate">{p.nome}</span>
                <span className="text-[#8A93A3] shrink-0">{p.posicao}</span>
              </div>
            ))
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">
          Cancelar
        </button>
        <button
          onClick={() => onImport(parsed)}
          disabled={parsed.length === 0}
          className="px-4 py-2 text-sm font-medium bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:bg-[#2E3644] disabled:text-[#5A6272] text-[#14181F] rounded-md transition-colors"
        >
          Importar {parsed.length > 0 ? `(${parsed.length})` : ""}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- CAMPO (MARCAÇÕES) ---------------- */

function HalfMarkings({ flipY = false, w = HALF_VB.w, h = HALF_VB.h }) {
  // Drawn for a court with baseline at bottom (y = h-10), hoop area near baseline, centered on w/2.
  const cx = w / 2;
  const baseline = h - 10;
  const keyTop = baseline - 120;
  const keyHalf = 50;
  const g = (
    <g stroke="#3A4354" strokeWidth="2" fill="none">
      <rect x={cx - keyHalf} y={keyTop} width={keyHalf * 2} height="120" fill="#1E2A38" />
      <circle cx={cx} cy={keyTop} r="36" />
      <path d={`M ${cx - 130} ${baseline} Q ${cx - 130} ${baseline - 155} ${cx} ${baseline - 155}`} />
      <path d={`M ${cx + 130} ${baseline} Q ${cx + 130} ${baseline - 155} ${cx} ${baseline - 155}`} />
      <circle cx={cx} cy={baseline - 22} r="3" fill="#3A4354" stroke="none" />
      <line x1={cx - 20} y1={baseline - 4} x2={cx + 20} y2={baseline - 4} strokeWidth="3" />
    </g>
  );
  return flipY ? <g transform={`translate(0 ${h}) scale(1 -1)`}>{g}</g> : g;
}

function CourtSvgDefs() {
  return (
    <defs>
      <pattern id="woodgrain" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#1A1F28" />
        <line x1="0" y1="0" x2="0" y2="10" stroke="#20262F" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

function CourtBackground({ court, vb }) {
  return (
    <>
      <CourtSvgDefs />
      <rect x="0" y="0" width={vb.w} height={vb.h} fill="url(#woodgrain)" />
      <rect x="10" y="10" width={vb.w - 20} height={vb.h - 20} fill="none" stroke="#3A4354" strokeWidth="2" />
      {court === "campo" ? (
        <>
          <HalfMarkings w={vb.w} h={vb.h} flipY={false} />
          <HalfMarkings w={vb.w} h={vb.h} flipY={true} />
          <line x1="10" y1={vb.h / 2} x2={vb.w - 10} y2={vb.h / 2} stroke="#3A4354" strokeWidth="2" />
          <circle cx={vb.w / 2} cy={vb.h / 2} r="30" fill="none" stroke="#3A4354" strokeWidth="2" />
        </>
      ) : (
        <>
          <HalfMarkings w={vb.w} h={vb.h} flipY={false} />
          <line x1="10" y1="10" x2={vb.w - 10} y2="10" stroke="#3A4354" strokeWidth="2" />
        </>
      )}
    </>
  );
}

/* ---------------- TOKENS E SETAS DO DIAGRAMA ---------------- */

function TokenShape({ token, onMouseDown, selected }) {
  const { x, y, type, number } = token;
  if (type === "ball") {
    return (
      <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "grab" }}>
        <circle r="7" fill="#EA5B13" stroke={selected ? "#F2EDE3" : "none"} strokeWidth="2" />
        <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#14181F" strokeWidth="1" />
      </g>
    );
  }
  const isDef = type === "defense";
  return (
    <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "grab" }}>
      <circle r="12" fill={isDef ? "transparent" : "#EA5B13"} stroke={isDef ? "#D64545" : selected ? "#F2EDE3" : "#14181F"} strokeWidth={isDef ? 2.5 : selected ? 2.5 : 1.5} strokeDasharray={isDef ? "3 2" : "none"} />
      <text textAnchor="middle" dy="4" fontSize="11" fill={isDef ? "#D64545" : "#14181F"} fontFamily="'IBM Plex Mono', monospace" fontWeight="600">
        {number}
      </text>
    </g>
  );
}

function ArrowShape({ arrow, onMouseDown, selected }) {
  const color = selected ? "#F2EDE3" : "#C7CDD8";
  if (arrow.type === "bloqueio") {
    const { x, y } = arrow.at;
    return (
      <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
        <line x1="-9" y1="0" x2="9" y2="0" stroke={color} strokeWidth="4" />
      </g>
    );
  }
  const { from, to } = arrow;
  let d;
  if (arrow.type === "drible") d = wavyPathD(from.x, from.y, to.x, to.y);
  else d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeDasharray={arrow.type === "passe" ? "6 4" : "none"} />
      <path d={arrowHead(from.x, from.y, to.x, to.y)} stroke={color} strokeWidth="2" fill="none" />
    </g>
  );
}

function DiagramThumbnail({ diagram, size = 56 }) {
  if (!diagram || (diagram.tokens.length === 0 && diagram.arrows.length === 0)) return null;
  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const ratio = vb.h / vb.w;
  return (
    <div style={{ width: size, height: size * ratio }} className="rounded overflow-hidden border border-[#2E3644] shrink-0">
      <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full">
        <CourtBackground court={diagram.court} vb={vb} />
        {diagram.arrows.map((a) => (
          <ArrowShape key={a.id} arrow={a} />
        ))}
        {diagram.tokens.map((t) => (
          <TokenShape key={t.id} token={t} />
        ))}
      </svg>
    </div>
  );
}

function DiagramEditor({ initial, onClose, onSave }) {
  const [diagram, setDiagram] = useState(initial || emptyDiagram());
  const [mode, setMode] = useState("mover"); // 'mover' | arrow type id
  const [dragId, setDragId] = useState(null);
  const [drawing, setDrawing] = useState(null); // {type, from:{x,y,tokenId}, to:{x,y,tokenId}}
  const [selectedId, setSelectedId] = useState(null);
  const [animPositions, setAnimPositions] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wrapRef = useRef(null);

  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const SNAP_DIST = 14;

  const getPoint = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * vb.w;
    const y = ((e.clientY - rect.top) / rect.height) * vb.h;
    return { x: Math.max(4, Math.min(vb.w - 4, x)), y: Math.max(4, Math.min(vb.h - 4, y)) };
  };

  const nearestToken = (pt) => diagram.tokens.find((t) => distPt(t, pt) < SNAP_DIST);

  const snapAngle = (from, raw) => {
    const dx = raw.x - from.x;
    const dy = raw.y - from.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 12; // 15°
    const snapped = Math.round(angle / step) * step;
    return { x: from.x + dist * Math.cos(snapped), y: from.y + dist * Math.sin(snapped) };
  };

  const nextOffenseNumber = () => {
    const used = diagram.tokens.filter((t) => t.type === "offense").map((t) => Number(t.number));
    for (let i = 1; i <= 9; i++) if (!used.includes(i)) return i;
    return diagram.tokens.length + 1;
  };

  const addToken = (type) => {
    if (type === "ball" && diagram.tokens.some((t) => t.type === "ball")) return;
    const token = {
      id: uid(),
      type,
      number: type === "offense" ? nextOffenseNumber() : type === "defense" ? "D" : "",
      x: vb.w / 2 + (Math.random() * 20 - 10),
      y: type === "ball" ? vb.h - 40 : vb.h / 2,
    };
    setDiagram({ ...diagram, tokens: [...diagram.tokens, token] });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setDiagram({
      ...diagram,
      tokens: diagram.tokens.filter((t) => t.id !== selectedId),
      arrows: diagram.arrows.filter((a) => a.id !== selectedId),
    });
    setSelectedId(null);
  };

  // ---- Pointer down: start dragging a token, start drawing an arrow, or place a bloqueio ----
  const startFromToken = (e, tokenId) => {
    e.stopPropagation();
    const token = diagram.tokens.find((t) => t.id === tokenId);
    if (mode === "mover") {
      setDragId(tokenId);
      setSelectedId(tokenId);
    } else if (mode === "bloqueio") {
      // bloqueio placed on empty canvas only
    } else {
      setDrawing({ type: mode, from: { x: token.x, y: token.y, tokenId: token.id }, to: { x: token.x, y: token.y, tokenId: null } });
    }
  };

  const startFromCanvas = (e) => {
    const pt = getPoint(e);
    if (mode === "mover") {
      setSelectedId(null);
      return;
    }
    if (mode === "bloqueio") {
      setDiagram({ ...diagram, arrows: [...diagram.arrows, { id: uid(), type: "bloqueio", at: pt }] });
      return;
    }
    setDrawing({ type: mode, from: { ...pt, tokenId: null }, to: { ...pt, tokenId: null } });
  };

  // ---- Pointer move: update drag or live preview of the arrow being drawn ----
  const handleMouseMove = (e) => {
    if (dragId) {
      const pt = getPoint(e);
      setDiagram((d) => ({ ...d, tokens: d.tokens.map((t) => (t.id === dragId ? { ...t, x: pt.x, y: pt.y } : t)) }));
      return;
    }
    if (drawing) {
      let raw = getPoint(e);
      const near = nearestToken(raw);
      let pt = near ? { x: near.x, y: near.y } : raw;
      if (!near && e.shiftKey) pt = snapAngle(drawing.from, raw);
      setDrawing({ ...drawing, to: { x: pt.x, y: pt.y, tokenId: near ? near.id : null } });
    }
  };

  // ---- Pointer up: finalize drag or finalize the arrow ----
  const handleMouseUp = () => {
    if (dragId) {
      setDragId(null);
      return;
    }
    if (drawing) {
      const isTiny = distPt(drawing.from, drawing.to) < 6;
      if (!isTiny) {
        setDiagram((d) => ({
          ...d,
          arrows: [
            ...d.arrows,
            {
              id: uid(),
              type: drawing.type,
              from: { x: drawing.from.x, y: drawing.from.y },
              to: { x: drawing.to.x, y: drawing.to.y },
              tokenId: drawing.from.tokenId || drawing.to.tokenId || null,
            },
          ],
        }));
      }
      setDrawing(null);
    }
  };

  const playAnimation = () => {
    const hasMovement = diagram.arrows.some((a) => a.tokenId && a.type !== "bloqueio");
    if (!hasMovement) return;
    setIsPlaying(true);
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setAnimPositions(computeAnimatedPositions(diagram, t));
      if (t < 1) requestAnimationFrame(tick);
      else setIsPlaying(false);
    };
    requestAnimationFrame(tick);
  };

  const resetAnimation = () => {
    setAnimPositions(null);
    setIsPlaying(false);
  };

  return (
    <Modal onClose={onClose} title="Diagrama do exercício" wide>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={diagram.court} onChange={(e) => setDiagram({ ...diagram, court: e.target.value })} className={inputCls + " w-auto"}>
          <option value="meio">Meio campo</option>
          <option value="campo">Campo inteiro</option>
        </select>
        <div className="w-px h-6 bg-[#2E3644]" />
        <button onClick={() => addToken("offense")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Ataque</button>
        <button onClick={() => addToken("defense")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Defesa</button>
        <button onClick={() => addToken("ball")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Bola</button>
        <div className="w-px h-6 bg-[#2E3644]" />
        <button onClick={deleteSelected} disabled={!selectedId} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#D64545] hover:text-[#D64545] disabled:opacity-30">
          <Trash2 size={13} className="inline -mt-0.5 mr-1" /> Apagar selecionado
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-[#8A93A3] mr-1">Modo:</span>
        <button onClick={() => setMode("mover")} className={`text-xs px-2.5 py-1 rounded ${mode === "mover" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          Mover
        </button>
        {ARROW_TYPES.map((a) => (
          <button key={a.id} onClick={() => setMode(a.id)} title={a.desc} className={`text-xs px-2.5 py-1 rounded ${mode === a.id ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
            {a.label}
          </button>
        ))}
        {mode !== "mover" && mode !== "bloqueio" && (
          <span className="text-[11px] text-[#8A93A3] ml-1">
            Arrasta para desenhar · segura <b className="text-[#F2EDE3]">Shift</b> para linha reta
            {mode === "passe" && <> · <b className="text-[#F2EDE3]">Passe</b> não desloca o jogador, só a bola — usa Corte para o movimento do passador</>}
          </span>
        )}
      </div>

      <div
        ref={wrapRef}
        className="bg-[#0F1319] rounded-lg overflow-hidden touch-none"
        style={{ aspectRatio: `${vb.w} / ${vb.h}`, maxHeight: "50vh" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full select-none" onMouseDown={startFromCanvas}>
          <CourtBackground court={diagram.court} vb={vb} />
          {diagram.arrows.map((a) => (
            <ArrowShape key={a.id} arrow={a} selected={selectedId === a.id} onMouseDown={(e) => { e.stopPropagation(); if (mode === "mover") setSelectedId(a.id); }} />
          ))}
          {drawing && (
            <ArrowShape arrow={{ type: drawing.type, from: drawing.from, to: drawing.to, at: drawing.to }} selected={false} />
          )}
          {diagram.tokens.map((t) => {
            const pos = (animPositions && animPositions[t.id]) || t;
            return <TokenShape key={t.id} token={pos} selected={selectedId === t.id} onMouseDown={(e) => startFromToken(e, t.id)} />;
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={playAnimation} disabled={isPlaying} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-40">
            <Play size={13} /> Reproduzir
          </button>
          <button onClick={resetAnimation} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
        <span className="text-[11px] text-[#5A6272]">Termina a seta perto de um jogador para animar o seu movimento.</span>
      </div>

      <ModalActions onCancel={onClose} onSave={() => onSave(diagram)} />
    </Modal>
  );
}

/* ---------------- SEQUÊNCIA DE DIAGRAMAS (passos) ---------------- */

function SequencePlayerModal({ diagramas, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [overrides, setOverrides] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const stopRef = useRef(false);

  const current = diagramas[stepIndex] || diagramas[0];
  const vb = current.court === "campo" ? FULL_VB : HALF_VB;

  const playAll = () => {
    stopRef.current = false;
    setIsPlaying(true);
    let idx = 0;
    const stepDuration = 1300;
    const pause = 350;

    const runStep = () => {
      if (stopRef.current || idx >= diagramas.length) {
        setIsPlaying(false);
        return;
      }
      setStepIndex(idx);
      const diagram = diagramas[idx];
      const start = performance.now();
      const tick = (now) => {
        if (stopRef.current) return;
        const t = Math.min(1, (now - start) / stepDuration);
        setOverrides(computeAnimatedPositions(diagram, t));
        if (t < 1) requestAnimationFrame(tick);
        else {
          idx += 1;
          setTimeout(runStep, pause);
        }
      };
      requestAnimationFrame(tick);
    };
    runStep();
  };

  const reset = () => {
    stopRef.current = true;
    setIsPlaying(false);
    setStepIndex(0);
    setOverrides(null);
  };

  return (
    <Modal onClose={onClose} title="Sequência completa" wide>
      <div className="flex items-center gap-1.5 mb-3">
        {diagramas.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i === stepIndex ? "bg-[#EA5B13]" : i < stepIndex ? "bg-[#4C9A6A]" : "bg-[#2E3644]"}`} />
        ))}
      </div>
      <div className="bg-[#0F1319] rounded-lg overflow-hidden" style={{ aspectRatio: `${vb.w} / ${vb.h}`, maxHeight: "55vh" }}>
        <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full select-none">
          <CourtBackground court={current.court} vb={vb} />
          {current.arrows.map((a) => (
            <ArrowShape key={a.id} arrow={a} />
          ))}
          {current.tokens.map((t) => (
            <TokenShape key={t.id} token={(overrides && overrides[t.id]) || t} />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          Passo {stepIndex + 1} / {diagramas.length}
        </span>
        <div className="flex gap-2">
          <button onClick={playAll} disabled={isPlaying} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-40">
            <Play size={13} /> Reproduzir tudo
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

function DiagramStepsRow({ diagramas, onChange }) {
  const [editing, setEditing] = useState(null); // {isNew:true, base} | {isNew:false, index}
  const [playingAll, setPlayingAll] = useState(false);
  const steps = diagramas || [];

  const openNew = () => {
    const base = steps.length > 0 ? resolveFinalDiagram(steps[steps.length - 1]) : emptyDiagram();
    setEditing({ isNew: true, base });
  };
  const openEdit = (i) => setEditing({ isNew: false, index: i });

  const handleSave = (diagram) => {
    if (editing.isNew) onChange([...steps, diagram]);
    else onChange(steps.map((d, i) => (i === editing.index ? diagram : d)));
    setEditing(null);
  };

  const deleteStep = (i, e) => {
    e.stopPropagation();
    onChange(steps.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((d, i) => (
        <button key={i} type="button" onClick={() => openEdit(i)} className="relative group/step">
          <DiagramThumbnail diagram={d} size={44} />
          <span
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            className="absolute -top-1.5 -left-1.5 bg-[#14181F] border border-[#2E3644] text-[9px] rounded-full w-4 h-4 flex items-center justify-center text-[#8A93A3]"
          >
            {i + 1}
          </span>
          <span
            onClick={(e) => deleteStep(i, e)}
            className="absolute -top-1.5 -right-1.5 bg-[#D64545] text-white rounded-full w-4 h-4 hidden group-hover/step:flex items-center justify-center"
          >
            <X size={10} />
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={openNew}
        title={steps.length > 0 ? "Continuar a partir das posições finais" : "Criar primeiro diagrama"}
        className="w-11 shrink-0 flex items-center justify-center rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]"
        style={{ aspectRatio: "1" }}
      >
        <Plus size={16} />
      </button>
      {steps.length > 1 && (
        <button
          type="button"
          onClick={() => setPlayingAll(true)}
          className="flex items-center gap-1.5 text-xs px-3 h-11 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]"
        >
          <Play size={13} /> Ver sequência
        </button>
      )}
      {steps.length === 0 && <span className="text-[11px] text-[#5A6272]">Sem diagramas ainda</span>}
      {editing && (
        <DiagramEditor
          initial={editing.isNew ? editing.base : steps[editing.index]}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {playingAll && <SequencePlayerModal diagramas={steps} onClose={() => setPlayingAll(false)} />}
    </div>
  );
}

const COMPONENTES = ["Técnica individual", "Tática individual", "Tática coletiva"];

/* ---------------- SUGESTÕES COM IA ---------------- */

async function callClaudeJSON(promptText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: promptText }],
    }),
  });
  if (!response.ok) throw new Error(`A IA não respondeu corretamente (erro ${response.status}). Tenta novamente.`);
  const data = await response.json();
  const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("A IA devolveu uma resposta que não consegui interpretar. Tenta novamente.");
  }
}

function AiSuggestModal({ mode, defaults, onClose, onInsertTreino, onUseExercicio }) {
  const [objetivo, setObjetivo] = useState(defaults.objetivo || "");
  const [duracaoTotal, setDuracaoTotal] = useState(defaults.duracaoTotal || 90);
  const [nivel, setNivel] = useState(defaults.nivel || "");
  const [foco, setFoco] = useState("");
  const [contexto, setContexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultTreino, setResultTreino] = useState(null); // array with {selected, ...}
  const [resultExercicio, setResultExercicio] = useState(null);

  const habilidade = defaults.habilidade || null;

  const gerar = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "treino") {
        const prompt = `És um treinador assistente de basquetebol de formação, a escrever em português de Portugal.

Sugere um conjunto de exercícios práticos para um treino, com estas condições:
- Objetivo do treino: "${objetivo || "trabalho geral de fundamentos"}"
- Nível/escalão da equipa: "${nivel || "não especificado, assume formação jovem"}"
- Duração total pretendida: aproximadamente ${duracaoTotal} minutos
- Foco tático preferencial: ${foco || "equilibrado entre ataque e defesa"}

Devolve APENAS um array JSON válido, sem markdown, sem comentários, sem texto antes ou depois, com esta estrutura exata:
[
  { "nome": "Nome curto do exercício", "duracao": 15, "descricao": "Organização, critérios de êxito e variantes, em 2 a 4 frases práticas e diretas, como notas reais de treinador." }
]

Usa entre 3 e 6 exercícios, cuja soma de "duracao" (em minutos) se aproxime do total pretendido. Escreve tudo em português de Portugal.`;
        const items = await callClaudeJSON(prompt);
        if (!Array.isArray(items)) throw new Error("Resposta inesperada da IA.");
        setResultTreino(items.map((it) => ({ ...it, selected: true, id: uid() })));
      } else {
        const habLabel = habilidade ? `${habilidade.fase} · ${habilidade.componente} · ${habilidade.nome}` : "geral";
        const prompt = `És um treinador assistente de basquetebol de formação, a escrever em português de Portugal.

Sugere UM exercício de treino para trabalhar especificamente a habilidade: "${habLabel}".
${contexto ? `Contexto adicional: "${contexto}"` : ""}
${defaults.duracaoPadrao ? `Duração alvo: aproximadamente ${defaults.duracaoPadrao} minutos.` : ""}

Devolve APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com esta estrutura exata:
{ "nome": "Nome curto do exercício", "duracaoPadrao": 15, "descricao": "Organização, critérios de êxito e variantes, em 2 a 4 frases práticas e diretas, como notas reais de treinador." }

Escreve tudo em português de Portugal.`;
        const item = await callClaudeJSON(prompt);
        setResultExercicio(item);
      }
    } catch (e) {
      setError(e.message || "Ocorreu um erro ao contactar a IA.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (id) => {
    setResultTreino(resultTreino.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)));
  };

  return (
    <Modal onClose={onClose} title={mode === "treino" ? "Sugerir treino com IA" : "Sugerir exercício com IA"} wide={mode === "treino"}>
      {mode === "exercicio" && habilidade && (
        <div className="text-xs text-[#8A93A3] mb-3 bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2">
          Habilidade: <b className="text-[#F2EDE3]">{habilidade.fase} · {habilidade.componente} · {habilidade.nome}</b>
        </div>
      )}

      {!resultTreino && !resultExercicio && (
        <>
          {mode === "treino" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Objetivo do treino" className="col-span-2">
                <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inputCls} placeholder="Ex: Melhorar transição defesa-ataque" />
              </Field>
              <Field label="Duração total pretendida (min)">
                <input type="number" min="10" value={duracaoTotal} onChange={(e) => setDuracaoTotal(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Nível / escalão">
                <input value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputCls} placeholder="Ex: Sub-14, iniciantes" />
              </Field>
              <Field label="Foco tático" className="col-span-2">
                <select value={foco} onChange={(e) => setFoco(e.target.value)} className={inputCls}>
                  <option value="">Equilibrado (ataque e defesa)</option>
                  <option value="Defesa">Defesa</option>
                  <option value="Ataque">Ataque</option>
                </select>
              </Field>
            </div>
          ) : (
            <Field label="Contexto adicional (opcional)">
              <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Ex: para jogadoras principiantes, sem oposição" />
            </Field>
          )}

          {error && (
            <div className="mt-3 text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={gerar}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-60 text-[#14181F] text-sm font-medium rounded-md py-2.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "A gerar..." : "Gerar sugestões"}
            </button>
            <button onClick={onClose} className="w-full text-center text-xs text-[#8A93A3] hover:text-[#F2EDE3] mt-2 py-1">Cancelar</button>
          </div>
        </>
      )}

      {resultTreino && (
        <>
          <div className="text-xs text-[#8A93A3] mb-2">Desmarca o que não quiseres incluir, depois adiciona ao treino.</div>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {resultTreino.map((it) => (
              <label key={it.id} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer ${it.selected ? "border-[#EA5B13] bg-[#EA5B13]/5" : "border-[#2E3644]"}`}>
                <input type="checkbox" checked={it.selected} onChange={() => toggleSelected(it.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{it.nome}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{it.duracao} min</span>
                  </div>
                  <div className="text-xs text-[#8A93A3] mt-0.5">{it.descricao}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => { setResultTreino(null); setError(null); }} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3]">← Gerar novamente</button>
          </div>
        </>
      )}

      {resultExercicio && (
        <div className="border border-[#2E3644] rounded-md p-3 bg-[#14181F]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium">{resultExercicio.nome}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{resultExercicio.duracaoPadrao} min</span>
          </div>
          <div className="text-xs text-[#8A93A3]">{resultExercicio.descricao}</div>
          <button onClick={() => { setResultExercicio(null); setError(null); }} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3] mt-3">← Gerar novamente</button>
        </div>
      )}

      {(resultTreino || resultExercicio) && (
        <ModalActions
          onCancel={onClose}
          saveLabel={mode === "treino" ? "Adicionar ao treino" : "Usar este exercício"}
          disabled={mode === "treino" ? !resultTreino.some((i) => i.selected) : false}
          onSave={() => {
            if (mode === "treino") onInsertTreino(resultTreino.filter((i) => i.selected));
            else onUseExercicio(resultExercicio);
          }}
        />
      )}
    </Modal>
  );
}

function habilidadeGroups() {
  const groups = [];
  const seen = new Map();
  HABILIDADES.forEach((h) => {
    const key = `${h.fase}|${h.componente}`;
    if (!seen.has(key)) {
      const g = { label: `${h.fase} — ${h.componente}`, items: [] };
      seen.set(key, g);
      groups.push(g);
    }
    seen.get(key).items.push(h);
  });
  return groups;
}

function HabilidadeSelect({ value, onChange, className, placeholderOption }) {
  const groups = habilidadeGroups();
  return (
    <select value={value} onChange={onChange} className={className || inputCls}>
      {placeholderOption && <option value="">{placeholderOption}</option>}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((h) => (
            <option key={h.id} value={h.id}>{h.nome}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/* ---------------- JOGOS ---------------- */

function JogoRow({ s, players, clubLogo, onEdit, onDelete, onTransfer }) {
  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 flex items-start gap-4 group">
      <div className="text-center shrink-0 w-14">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          {formatDateShort(s.date)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[#EA5B13]/20 text-[#EA5B13]">
          Jogo{s.jogoNumero ? ` ${s.jogoNumero}` : ""}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide truncate">
          vs {s.adversario || "Adversário por definir"}
        </div>
        <div className="text-xs text-[#8A93A3] mt-0.5">
          {s.campeonato && `${s.campeonato} · `}{s.local || "Local por definir"}{s.horario && ` · ${s.horario}`}
        </div>
        {s.resultado && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm text-[#F2EDE3] mt-1.5 font-semibold">
            {s.resultado}
          </div>
        )}
        {s.apreciacaoGeral && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.apreciacaoGeral}</div>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onTransfer} title="Copiar para outra equipa" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Copy size={14} />
        </button>
        <button onClick={() => printJogo(s, players, clubLogo)} title="Descarregar / Imprimir" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Printer size={14} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function JogosView({ sessions, players, clubLogo, onAdd, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Jogos" subtitle={`${sessions.length} jogo${sessions.length === 1 ? "" : "s"} registado${sessions.length === 1 ? "" : "s"}`} onAdd={onAdd} addLabel="Novo jogo" />
      {sorted.length === 0 ? (
        <EmptyState text="Ainda não registaste nenhum jogo. Cria a ficha de preparação do primeiro." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <JogoRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

const PERIODOS = ["1º", "2º", "3º", "4º"];

function JogoModal({ initial, players, onClose, onSave }) {
  const [form, setForm] = useState({ ...emptyJogo, ...initial });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const objetivos = form.objetivosJogo || [];
  const convocatoria = form.convocatoria || {};
  const dirigentes = form.dirigentes || [];

  const addObjetivo = () => setForm({ ...form, objetivosJogo: [...objetivos, { id: uid(), texto: "" }] });
  const updateObjetivo = (id, value) => setForm({ ...form, objetivosJogo: objetivos.map((o) => (o.id === id ? { ...o, texto: value } : o)) });
  const removeObjetivo = (id) => setForm({ ...form, objetivosJogo: objetivos.filter((o) => o.id !== id) });

  const addDirigente = () => setForm({ ...form, dirigentes: [...dirigentes, { id: uid(), nome: "", licenca: "" }] });
  const updateDirigente = (id, key, value) => setForm({ ...form, dirigentes: dirigentes.map((d) => (d.id === id ? { ...d, [key]: value } : d)) });
  const removeDirigente = (id) => setForm({ ...form, dirigentes: dirigentes.filter((d) => d.id !== id) });

  const togglePeriodo = (playerId, idx) => {
    const atual = convocatoria[playerId] || [false, false, false, false];
    const next = atual.map((v, i) => (i === idx ? !v : v));
    setForm({ ...form, convocatoria: { ...convocatoria, [playerId]: next } });
  };

  const estatisticas = form.estatisticas || {};
  const updateEstatistica = (playerId, campo, value) => {
    setForm({
      ...form,
      estatisticas: { ...estatisticas, [playerId]: { ...(estatisticas[playerId] || {}), [campo]: value } },
    });
  };

  return (
    <Modal onClose={onClose} title={form.id ? "Editar jogo" : "Novo jogo"} wide>
      <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Ficha de jogo</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Campeonato / Competição" className="col-span-2">
          <input value={form.campeonato} onChange={set("campeonato")} className={inputCls} placeholder="Ex: Torneio Interdistrital Sub-14" />
        </Field>
        <Field label="Adversário">
          <input value={form.adversario} onChange={set("adversario")} className={inputCls} placeholder="Nome da equipa" />
        </Field>
        <Field label="Jogo nº">
          <input value={form.jogoNumero} onChange={set("jogoNumero")} className={inputCls} placeholder="6" />
        </Field>
        <Field label="Data">
          <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
        </Field>
        <Field label="Horário">
          <input type="time" value={form.horario} onChange={set("horario")} className={inputCls} />
        </Field>
        <Field label="Local" className="col-span-2">
          <input value={form.local} onChange={set("local")} className={inputCls} placeholder="Pavilhão..." />
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Equipa técnica</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Treinador principal">
            <input value={form.treinadorPrincipal} onChange={set("treinadorPrincipal")} className={inputCls} />
          </Field>
          <Field label="Nº de licença">
            <input value={form.treinadorPrincipalLicenca} onChange={set("treinadorPrincipalLicenca")} className={inputCls} placeholder="Ex: 21363" />
          </Field>
          <Field label="Treinador adjunto">
            <input value={form.treinadorAdjunto} onChange={set("treinadorAdjunto")} className={inputCls} />
          </Field>
          <Field label="Nº de licença">
            <input value={form.treinadorAdjuntoLicenca} onChange={set("treinadorAdjuntoLicenca")} className={inputCls} placeholder="Ex: 21364" />
          </Field>
        </div>
        <div className="mt-3">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Dirigentes</span>
          <div className="space-y-2">
            {dirigentes.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input value={d.nome} onChange={(e) => updateDirigente(d.id, "nome", e.target.value)} className={inputCls} style={{ flex: "1 1 auto", minWidth: 0 }} placeholder="Nome do dirigente" />
                <input value={d.licenca} onChange={(e) => updateDirigente(d.id, "licenca", e.target.value)} className={inputCls} style={{ flex: "0 0 100px" }} placeholder="Nº licença" />
                <button type="button" onClick={() => removeDirigente(d.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDirigente}
            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
          >
            <Plus size={13} /> Adicionar dirigente
          </button>
        </div>
      </div>

      {players && players.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[#2E3644]">
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Convocatória — participação por período</div>
          <div style={{ maxHeight: 220, overflowY: "auto" }} className="border border-[#2E3644] rounded-md">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1E242E]">
                <tr className="text-[#8A93A3]">
                  <th className="text-left px-2 py-1.5 font-normal">Nº</th>
                  <th className="text-left px-2 py-1.5 font-normal">Nome</th>
                  {PERIODOS.map((p) => (
                    <th key={p} className="px-1.5 py-1.5 font-normal text-center">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const marks = convocatoria[p.id] || [false, false, false, false];
                  return (
                    <tr key={p.id} className="border-t border-[#2E3644]">
                      <td className="px-2 py-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.numero}</td>
                      <td className="px-2 py-1 truncate">{p.nome}</td>
                      {PERIODOS.map((_, idx) => (
                        <td key={idx} className="text-center">
                          <button
                            type="button"
                            onClick={() => togglePeriodo(p.id, idx)}
                            className={`w-5 h-5 rounded ${marks[idx] ? "bg-[#4C9A6A] text-[#14181F]" : "bg-[#14181F] border border-[#2E3644]"}`}
                          >
                            {marks[idx] ? "✓" : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {players && players.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[#2E3644]">
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Estatísticas do jogo</div>
          <div style={{ maxHeight: 260, overflow: "auto" }} className="border border-[#2E3644] rounded-md">
            <table className="text-xs" style={{ minWidth: 480 }}>
              <thead className="sticky top-0 bg-[#1E242E]">
                <tr className="text-[#8A93A3]">
                  <th className="text-left px-2 py-1.5 font-normal sticky left-0 bg-[#1E242E]" style={{ minWidth: 110 }}>Jogadora</th>
                  {ESTATISTICAS_CAMPOS.map((c) => (
                    <th key={c.key} title={c.nome} className="px-1 py-1.5 font-normal text-center" style={{ minWidth: 44 }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const stats = estatisticas[p.id] || {};
                  return (
                    <tr key={p.id} className="border-t border-[#2E3644]">
                      <td className="px-2 py-1 truncate sticky left-0 bg-[#1E242E]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {p.numero ? `${p.numero} · ` : ""}{p.nome}
                      </td>
                      {ESTATISTICAS_CAMPOS.map((c) => (
                        <td key={c.key} className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            value={stats[c.key] || ""}
                            onChange={(e) => updateEstatistica(p.id, c.key, e.target.value)}
                            className={inputCls}
                            style={{ width: 42, textAlign: "center", padding: "4px 2px" }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <span className="block text-xs text-[#8A93A3] mb-1.5">Objetivos do jogo</span>
        <div className="space-y-2">
          {objetivos.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#5A6272] w-4 shrink-0">{i + 1}</span>
              <input value={o.texto} onChange={(e) => updateObjetivo(o.id, e.target.value)} className={inputCls + " flex-1"} placeholder="Ex: Privilegiar o passe em vez de drible" />
              <button type="button" onClick={() => removeObjetivo(o.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addObjetivo}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar objetivo
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Preparação do jogo</div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Reflexão sobre a preparação">
            <textarea value={form.reflexaoPreparacao} onChange={set("reflexaoPreparacao")} className={inputCls + " resize-none"} style={{ minHeight: 90 }} placeholder="Análise do adversário, plano de jogo, contexto..." />
          </Field>
          <Field label="Palestra inicial">
            <textarea value={form.palestraInicial} onChange={set("palestraInicial")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="O que vais dizer à equipa antes do jogo..." />
          </Field>
          <Field label="Descontos de tempo e intervalo">
            <textarea value={form.descontosTempo} onChange={set("descontosTempo")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Plano para os descontos de tempo e discurso do intervalo..." />
          </Field>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Relatório (pós-jogo)</div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Resultado">
            <input value={form.resultado} onChange={set("resultado")} className={inputCls} placeholder="Ex: BC Vila Real 49 - CTM Vila Pouca 20" />
          </Field>
          <Field label="Relatório do jogo">
            <textarea value={form.conteudo} onChange={set("conteudo")} className={inputCls + " resize-none"} style={{ minHeight: 100 }} placeholder="Como correu o jogo, desempenho da equipa..." />
          </Field>
          <Field label="Apreciação geral">
            <textarea value={form.apreciacaoGeral} onChange={set("apreciacaoGeral")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Balanço final, pontos a trabalhar..." />
          </Field>
        </div>
      </div>

      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.date} />
    </Modal>
  );
}

function buildJogoPrintContent(jogo, players, clubLogo) {
  const convocatoria = jogo.convocatoria || {};
  const convocatoriaRows = (players || [])
    .map((p) => {
      const marks = convocatoria[p.id] || [false, false, false, false];
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td>${marks.map((m) => `<td style="text-align:center;">${m ? "X" : ""}</td>`).join("")}</tr>`;
    })
    .join("");

  const objetivosHtml = (jogo.objetivosJogo || [])
    .filter((o) => o.texto)
    .map((o, i) => `<tr><td style="width:24px;font-weight:600;">${i + 1}</td><td>${escapeHtml(o.texto)}</td></tr>`)
    .join("");

  const estatisticas = jogo.estatisticas || {};
  const estatisticasRows = (players || [])
    .filter((p) => estatisticas[p.id] && ESTATISTICAS_CAMPOS.some((c) => estatisticas[p.id][c.key]))
    .map((p) => {
      const stats = estatisticas[p.id] || {};
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td>${ESTATISTICAS_CAMPOS.map((c) => `<td style="text-align:center;">${escapeHtml(stats[c.key] || "0")}</td>`).join("")}</tr>`;
    })
    .join("");
  const totaisEstatisticas = ESTATISTICAS_CAMPOS.map((c) => {
    const total = (players || []).reduce((sum, p) => sum + (Number((estatisticas[p.id] || {})[c.key]) || 0), 0);
    return `<td style="text-align:center;font-weight:700;">${total}</td>`;
  }).join("");

  const infoRows = `
    <tr><td><b>Campeonato</b></td><td>${escapeHtml(jogo.campeonato || "—")}</td></tr>
    <tr><td><b>Adversário</b></td><td>${escapeHtml(jogo.adversario || "—")}</td></tr>
    <tr><td><b>Data │ Horário</b></td><td>${formatDateFull(jogo.date)} │ ${escapeHtml(jogo.horario || "—")}</td><td><b>Jogo nº</b></td><td>${escapeHtml(jogo.jogoNumero || "—")}</td></tr>
    <tr><td><b>Local</b></td><td colspan="3">${escapeHtml(jogo.local || "—")}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Jogo vs ${escapeHtml(jogo.adversario || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  table.info td { border: 1px solid #ccc; padding: 6px 8px; }
  table.list th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.list td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; margin-bottom: 10px; }
  .obs-title { font-size: 11px; font-weight: 600; color: #555; margin-bottom: 4px; text-transform: uppercase; }
  .resultado { font-size: 16px; font-weight: 700; text-align: center; padding: 10px; background: #f4f4f5; border-radius: 6px; margin-bottom: 10px; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin:0 auto 10px auto;display:block;" />` : ""}
  <h1>vs ${escapeHtml(jogo.adversario || "?")}</h1>
  <table class="info">${infoRows}</table>

  ${(jogo.treinadorPrincipal || jogo.treinadorAdjunto || (jogo.dirigentes && jogo.dirigentes.length > 0)) ? `
  <h2>Equipa técnica</h2>
  <table class="info">
    <tr><td><b>Treinador principal</b></td><td>${escapeHtml(jogo.treinadorPrincipal || "—")}</td><td><b>Nº licença</b></td><td>${escapeHtml(jogo.treinadorPrincipalLicenca || "—")}</td></tr>
    <tr><td><b>Treinador adjunto</b></td><td>${escapeHtml(jogo.treinadorAdjunto || "—")}</td><td><b>Nº licença</b></td><td>${escapeHtml(jogo.treinadorAdjuntoLicenca || "—")}</td></tr>
    ${(jogo.dirigentes || []).filter((d) => d.nome).map((d) => `<tr><td><b>Dirigente</b></td><td>${escapeHtml(d.nome)}</td><td><b>Nº licença</b></td><td>${escapeHtml(d.licenca || "—")}</td></tr>`).join("")}
  </table>` : ""}

  ${convocatoriaRows ? `
  <h2>Convocatória — participação por período</h2>
  <table class="list">
    <thead><tr><th style="width:30px;">Nº</th><th>Nome</th><th style="width:30px;text-align:center;">1º</th><th style="width:30px;text-align:center;">2º</th><th style="width:30px;text-align:center;">3º</th><th style="width:30px;text-align:center;">4º</th></tr></thead>
    <tbody>${convocatoriaRows}</tbody>
  </table>` : ""}

  ${objetivosHtml ? `
  <h2>Objetivos do jogo</h2>
  <table class="list"><tbody>${objetivosHtml}</tbody></table>` : ""}

  ${jogo.reflexaoPreparacao ? `<h2>Reflexão sobre a preparação</h2><div class="obs">${escapeHtml(jogo.reflexaoPreparacao)}</div>` : ""}
  ${jogo.palestraInicial ? `<div class="obs-title">Palestra inicial</div><div class="obs">${escapeHtml(jogo.palestraInicial)}</div>` : ""}
  ${jogo.descontosTempo ? `<div class="obs-title">Descontos de tempo e intervalo</div><div class="obs">${escapeHtml(jogo.descontosTempo)}</div>` : ""}

  ${jogo.resultado ? `<h2>Relatório do jogo</h2><div class="resultado">${escapeHtml(jogo.resultado)}</div>` : ""}
  ${jogo.conteudo ? `<div class="obs">${escapeHtml(jogo.conteudo)}</div>` : ""}
  ${jogo.apreciacaoGeral ? `<div class="obs-title">Apreciação geral</div><div class="obs">${escapeHtml(jogo.apreciacaoGeral)}</div>` : ""}

  ${estatisticasRows ? `
  <h2>Estatísticas do jogo</h2>
  <table class="list">
    <thead><tr><th style="width:30px;">Nº</th><th>Nome</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${estatisticasRows}<tr style="border-top:2px solid #14181F;"><td></td><td style="font-weight:700;">Total</td>${totaisEstatisticas}</tr></tbody>
  </table>` : ""}

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printJogo(jogo, players, clubLogo) {
  const html = buildJogoPrintContent(jogo, players, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const namePart = `vs-${jogo.adversario || "adversario"}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${jogo.date || "jogo"}-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function svgLineChartString(points, { width = 300, height = 130, color = "#EA5B13", unit = "" } = {}) {
  if (!points || points.length === 0) return "";
  const padding = { top: 12, right: 14, bottom: 20, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = points.map((p) => p.valor);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xAt = (i) => padding.left + i * xStep;
  const yAt = (v) => padding.top + innerH - ((v - min) / (max - min)) * innerH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.valor).toFixed(1)}`).join(" ");
  const dots = points.map((p, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.valor).toFixed(1)}" r="3" fill="${color}" />`).join("");
  const valueLabels = points
    .map((p, i) => `<text x="${xAt(i).toFixed(1)}" y="${yAt(p.valor) - 7}" font-size="9" fill="#555" text-anchor="middle">${escapeHtml(String(p.valor))}</text>`)
    .join("");
  const showEvery = points.length > 6 ? Math.ceil(points.length / 6) : 1;
  const xLabels = points
    .map((p, i) => (i % showEvery === 0 ? `<text x="${xAt(i).toFixed(1)}" y="${height - 5}" font-size="9" fill="#888" text-anchor="middle">${escapeHtml(p.dataLabel)}</text>` : ""))
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#ddd" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#ddd" />
    <text x="${padding.left - 4}" y="${padding.top + 4}" font-size="9" fill="#888" text-anchor="end">${escapeHtml(String(max))}${escapeHtml(unit)}</text>
    <text x="${padding.left - 4}" y="${height - padding.bottom}" font-size="9" fill="#888" text-anchor="end">${escapeHtml(String(min))}${escapeHtml(unit)}</text>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" />
    ${dots}${valueLabels}${xLabels}
  </svg>`;
}

function playerChartData(list, key) {
  return (list || [])
    .filter((item) => item.data && item[key] !== "" && item[key] != null)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((item) => ({ dataLabel: formatDateShortYear(item.data), valor: Number(item[key]) }));
}

function buildPlayerPrintContent(player, sessions, clubLogo) {
  const idade = (() => {
    if (!player.nascimento) return null;
    const nasc = new Date(player.nascimento);
    if (isNaN(nasc)) return null;
    const diff = Date.now() - nasc.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  })();

  const lesoesRows = (player.lesoes || [])
    .filter((l) => l.ano || l.descricao)
    .map((l) => `<tr><td style="width:60px;">${escapeHtml(l.ano || "—")}</td><td>${escapeHtml(l.descricao || "—")}</td></tr>`)
    .join("");

  const avaliacoesRows = [...(player.avaliacoes || [])]
    .filter((a) => a.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((a) => `<tr><td>${formatDateFull(a.data)}</td><td>${escapeHtml(a.altura || "—")}</td><td>${escapeHtml(a.peso || "—")}</td><td>${escapeHtml(a.envergadura || "—")}</td><td>${escapeHtml(a.obs || "")}</td></tr>`)
    .join("");

  const testesRows = [...(player.testesFisicos || [])]
    .filter((t) => t.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((t) => {
      const tipo = getTipoTeste(t.tipoId);
      const nome = t.tipoId === "outro" ? (t.nomePersonalizado || "Personalizado") : tipo.nome;
      const unidade = t.tipoId === "outro" ? (t.unidadePersonalizada || "") : tipo.unidade;
      return `<tr><td>${formatDateFull(t.data)}</td><td>${escapeHtml(nome)}</td><td>${escapeHtml(t.valor || "—")} ${escapeHtml(unidade)}</td><td>${escapeHtml(t.obs || "")}</td></tr>`;
    })
    .join("");

  // Gráficos de evolução (SVG estático, para funcionarem sem JavaScript no ficheiro final)
  const chartsHtml = [];
  const alturaData = playerChartData(player.avaliacoes, "altura");
  const pesoData = playerChartData(player.avaliacoes, "peso");
  const envergaduraData = playerChartData(player.avaliacoes, "envergadura");
  if (alturaData.length >= 2) chartsHtml.push({ titulo: "Altura (m)", svg: svgLineChartString(alturaData, { unit: "m" }) });
  if (pesoData.length >= 2) chartsHtml.push({ titulo: "Peso (kg)", svg: svgLineChartString(pesoData, { unit: "kg" }) });
  if (envergaduraData.length >= 2) chartsHtml.push({ titulo: "Envergadura", svg: svgLineChartString(envergaduraData, {}) });

  const testesPorTipo = {};
  (player.testesFisicos || []).forEach((t) => {
    if (!t.data || t.valor === "" || t.valor == null) return;
    testesPorTipo[t.tipoId] = testesPorTipo[t.tipoId] || [];
    testesPorTipo[t.tipoId].push(t);
  });
  Object.entries(testesPorTipo).forEach(([tipoId, list]) => {
    if (list.length < 2) return;
    const tipo = getTipoTeste(tipoId);
    const nome = tipoId === "outro" ? (list[0].nomePersonalizado || "Teste personalizado") : tipo.nome;
    const unidade = tipoId === "outro" ? (list[0].unidadePersonalizada || "") : tipo.unidade;
    chartsHtml.push({ titulo: `${nome}${unidade ? ` (${unidade})` : ""}`, svg: svgLineChartString(playerChartData(list, "valor"), { unit: "" }) });
  });

  // Estatísticas de jogo (pontos, ressaltos, etc.) ao longo dos jogos disputados
  const jogosComEstatisticas = [...(sessions || [])]
    .filter((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[player.id])
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  ESTATISTICAS_CAMPOS.forEach((c) => {
    const pontos = jogosComEstatisticas
      .filter((s) => s.estatisticas[player.id][c.key] !== "" && s.estatisticas[player.id][c.key] != null)
      .map((s) => ({ dataLabel: formatDateShortYear(s.date), valor: Number(s.estatisticas[player.id][c.key]) }));
    if (pontos.length >= 2) chartsHtml.push({ titulo: c.nome, svg: svgLineChartString(pontos, { unit: "" }) });
  });

  const estatisticasJogoTableRows = jogosComEstatisticas
    .map((s) => {
      const stats = s.estatisticas[player.id];
      return `<tr><td>${formatDateFull(s.date)}</td><td>vs ${escapeHtml(s.adversario || "?")}</td>${ESTATISTICAS_CAMPOS.map((c) => `<td style="text-align:center;">${escapeHtml(stats[c.key] || "0")}</td>`).join("")}</tr>`;
    })
    .join("");
  const estatisticasJogoTableHtml = estatisticasJogoTableRows
    ? `<h2>Estatísticas por jogo</h2>
       <table class="list">
         <thead><tr><th>Data</th><th>Adversário</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
         <tbody>${estatisticasJogoTableRows}</tbody>
       </table>`
    : "";

  const chartsBlockHtml = chartsHtml.length
    ? `<h2>Evolução</h2><div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:6px;">${chartsHtml
        .map((c) => `<div style="border:1px solid #eee;border-radius:6px;padding:8px;"><div style="font-size:11px;font-weight:600;margin-bottom:4px;">${escapeHtml(c.titulo)}</div>${c.svg}</div>`)
        .join("")}</div>`
    : "";

  // Presenças aos treinos
  const presenca = calcPresenca(player.id, sessions);
  const presencaRows = (sessions || [])
    .filter((s) => s.type === "treino" && s.realizado === true && (s.presencas || {})[player.id])
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const status = s.presencas[player.id];
      const label = status === "P" ? "Presente" : "Falta";
      const color = status === "P" ? "#2E7D4F" : "#B23A3A";
      return `<tr><td>${formatDateFull(s.date)}</td><td>${escapeHtml(s.title || "Treino")}</td><td style="color:${color};font-weight:600;">${label}</td></tr>`;
    })
    .join("");
  const presencaBlockHtml = presenca
    ? `<h2>Presenças aos treinos</h2>
       <div style="font-size:14px;font-weight:600;padding:10px 12px;background:#f4f4f5;border-radius:6px;margin-bottom:10px;">${presenca.presentes} presenças de ${presenca.total} treinos realizados · <b>${presenca.pct}% presença</b>${presenca.faltas > 0 ? ` (${presenca.faltas} falta${presenca.faltas === 1 ? "" : "s"})` : ""}</div>
       ${presencaRows ? `<table class="list"><thead><tr><th>Data</th><th>Treino</th><th style="width:90px;">Estado</th></tr></thead><tbody>${presencaRows}</tbody></table>` : ""}`
    : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(player.nome || "Jogador")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
  .avatar { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; background: #f4f4f5; border: 1px solid #ddd; }
  .avatar-placeholder { width: 90px; height: 90px; border-radius: 50%; background: #f4f4f5; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #EA5B13; }
  h1 { font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 22px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.info td { padding: 5px 8px 5px 0; }
  table.info td b { display: block; font-size: 10px; text-transform: uppercase; color: #888; }
  table.list th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.list td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:44px;width:auto;object-fit:contain;margin-bottom:12px;display:block;" />` : ""}
  <div class="header">
    ${player.foto ? `<img class="avatar" src="${player.foto}" />` : `<div class="avatar-placeholder">${escapeHtml(player.numero || "—")}</div>`}
    <div>
      <h1>${escapeHtml(player.nome || "Sem nome")}</h1>
      <div class="sub">${escapeHtml(player.posicao || "")}${player.numero ? ` · Nº ${escapeHtml(player.numero)}` : ""}${player.nascimento ? ` · ${formatDateFull(player.nascimento)}${idade !== null ? ` (${idade} anos)` : ""}` : ""}</div>
    </div>
  </div>

  <h2>Contactos</h2>
  <table class="info">
    <tr>
      <td><b>Morada</b>${escapeHtml(player.morada || "—")}</td>
      <td><b>Cidade</b>${escapeHtml(player.cidade || "—")}</td>
    </tr>
    <tr>
      <td><b>Email</b>${escapeHtml(player.email || "—")}</td>
      <td><b>Telemóvel</b>${escapeHtml(player.telemovel || "—")}</td>
    </tr>
    <tr>
      <td><b>C.C.</b>${escapeHtml(player.cc || "—")}</td>
      <td><b>NIF</b>${escapeHtml(player.nif || "—")}</td>
    </tr>
    <tr>
      <td><b>Profissão</b>${escapeHtml(player.profissao || "—")}</td>
      <td><b>Épocas no clube</b>${escapeHtml(player.epocasClube || "—")}</td>
    </tr>
  </table>

  <h2>Saúde</h2>
  <table class="info">
    <tr>
      <td><b>Medicação</b>${escapeHtml(player.medicacao || "Nenhuma")}</td>
      <td><b>Outros desportos</b>${escapeHtml(player.outrosDesportos || "Não")}</td>
    </tr>
  </table>
  ${lesoesRows ? `
  <table class="list" style="margin-top:8px;">
    <thead><tr><th>Ano</th><th>Lesão</th></tr></thead>
    <tbody>${lesoesRows}</tbody>
  </table>` : ""}

  ${chartsBlockHtml}

  ${avaliacoesRows ? `
  <h2>Avaliação corporal</h2>
  <table class="list">
    <thead><tr><th>Data</th><th>Altura (m)</th><th>Peso (kg)</th><th>Envergadura</th><th>Obs.</th></tr></thead>
    <tbody>${avaliacoesRows}</tbody>
  </table>` : ""}

  ${testesRows ? `
  <h2>Testes físicos</h2>
  <table class="list">
    <thead><tr><th>Data</th><th>Teste</th><th>Valor</th><th>Obs.</th></tr></thead>
    <tbody>${testesRows}</tbody>
  </table>` : ""}

  ${estatisticasJogoTableHtml}

  ${presencaBlockHtml}

  ${player.notas ? `<h2>Notas gerais</h2><div class="obs">${escapeHtml(player.notas)}</div>` : ""}

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function buildSeasonReportContent(team, players, sessions, library, clubLogo) {
  const temporada = team ? team.temporadaAtual : "";
  const nomeEquipa = team ? team.nome : "Equipa";
  const treinos = sessions.filter((s) => s.type === "treino");
  const treinosRealizados = treinos.filter((s) => s.realizado === true);
  const jogos = [...sessions.filter((s) => s.type === "jogo")].sort((a, b) => (a.date < b.date ? -1 : 1));

  const presencaData = players
    .map((p) => ({ p, presenca: calcPresenca(p.id, sessions) }))
    .filter((x) => x.presenca);
  const mediaPresenca = presencaData.length
    ? Math.round(presencaData.reduce((sum, x) => sum + x.presenca.pct, 0) / presencaData.length)
    : null;
  const presencaRows = presencaData
    .sort((a, b) => b.presenca.pct - a.presenca.pct)
    .map(({ p, presenca }) => `<tr><td>${escapeHtml(p.nome)}</td><td style="text-align:center;">${presenca.presentes}/${presenca.total}</td><td style="text-align:center;font-weight:600;">${presenca.pct}%</td></tr>`)
    .join("");

  const jogosRows = jogos
    .map((j) => `<tr><td>${formatDateFull(j.date)}</td><td>${escapeHtml(j.campeonato || "—")}</td><td>${escapeHtml(j.adversario || "?")}</td><td style="font-weight:600;">${escapeHtml(j.resultado || "—")}</td></tr>`)
    .join("");

  // Estatísticas gerais da equipa (somas e médias por jogo, agregando todas as jogadoras)
  const totaisEquipa = {};
  ESTATISTICAS_CAMPOS.forEach((c) => (totaisEquipa[c.key] = 0));
  let jogosComDados = 0;
  const totalPorJogador = {};
  jogos.forEach((j) => {
    const estat = j.estatisticas || {};
    if (Object.keys(estat).length === 0) return;
    jogosComDados += 1;
    Object.entries(estat).forEach(([playerId, stats]) => {
      ESTATISTICAS_CAMPOS.forEach((c) => {
        const v = Number(stats[c.key]) || 0;
        totaisEquipa[c.key] += v;
        totalPorJogador[playerId] = totalPorJogador[playerId] || {};
        totalPorJogador[playerId][c.key] = (totalPorJogador[playerId][c.key] || 0) + v;
      });
    });
  });

  const estatisticasCardsHtml = ESTATISTICAS_CAMPOS.map((c) => {
    const total = totaisEquipa[c.key];
    const media = jogosComDados ? (total / jogosComDados).toFixed(1) : "0";
    return `<div class="stat-card"><div class="num">${total}</div><div class="lbl">${escapeHtml(c.nome)} · ${media}/jogo</div></div>`;
  }).join("");

  const statsPorJogadorRows = players
    .map((p) => {
      const tot = totalPorJogador[p.id];
      if (!tot) return null;
      const jogosJogados = jogos.filter((j) => j.estatisticas && j.estatisticas[p.id]).length;
      const cells = ESTATISTICAS_CAMPOS.map((c) => {
        const total = tot[c.key] || 0;
        const media = jogosJogados ? (total / jogosJogados).toFixed(1) : "0";
        return `<td style="text-align:center;">${total} <span style="color:#999;font-size:11px;">(${media})</span></td>`;
      }).join("");
      return { pontos: tot.pontos || 0, html: `<tr><td>${escapeHtml(p.nome)}</td><td style="text-align:center;">${jogosJogados}</td>${cells}</tr>` };
    })
    .filter(Boolean)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.html)
    .join("");

  const groups = habilidadeGroups();
  const treinosPorComponente = groups.map((g) => {
    const idsSet = new Set(g.items.map((h) => h.id));
    const count = treinosRealizados.filter((t) => (t.exercicios || []).some((e) => e.categoria && idsSet.has(e.categoria))).length;
    return { label: g.label, count };
  });
  const componentesRows = treinosPorComponente
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td style="text-align:center;font-weight:600;">${c.count}</td><td style="text-align:center;">${treinosRealizados.length ? Math.round((c.count / treinosRealizados.length) * 100) : 0}%</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Relatório de Época ${escapeHtml(temporada)} — ${escapeHtml(nomeEquipa)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .stat-card { flex: 1; min-width: 110px; background: #f4f4f5; border-radius: 6px; padding: 12px; text-align: center; }
  .stat-card .num { font-size: 24px; font-weight: 700; }
  .stat-card .lbl { font-size: 10px; text-transform: uppercase; color: #888; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin-bottom:10px;display:block;" />` : ""}
  <h1>Relatório de Época</h1>
  <div class="sub">${escapeHtml(nomeEquipa)} · Época ${escapeHtml(temporada)}</div>

  <div class="stats">
    <div class="stat-card"><div class="num">${players.length}</div><div class="lbl">Jogadoras/es</div></div>
    <div class="stat-card"><div class="num">${treinosRealizados.length}</div><div class="lbl">Treinos realizados</div></div>
    <div class="stat-card"><div class="num">${jogos.length}</div><div class="lbl">Jogos</div></div>
    <div class="stat-card"><div class="num">${mediaPresenca !== null ? mediaPresenca + "%" : "—"}</div><div class="lbl">Presença média</div></div>
  </div>

  ${presencaRows ? `
  <h2>Presenças por jogadora</h2>
  <table>
    <thead><tr><th>Nome</th><th style="text-align:center;">Presenças</th><th style="text-align:center;">%</th></tr></thead>
    <tbody>${presencaRows}</tbody>
  </table>` : ""}

  ${jogosRows ? `
  <h2>Jogos da época</h2>
  <table>
    <thead><tr><th>Data</th><th>Competição</th><th>Adversário</th><th>Resultado</th></tr></thead>
    <tbody>${jogosRows}</tbody>
  </table>` : ""}

  ${jogosComDados > 0 ? `
  <h2>Estatísticas da equipa (${jogosComDados} jogo${jogosComDados === 1 ? "" : "s"} com registo)</h2>
  <div class="stats">${estatisticasCardsHtml}</div>
  ${statsPorJogadorRows ? `
  <div style="font-size:11px;font-weight:600;color:#555;margin:12px 0 4px 0;text-transform:uppercase;">Total por jogadora — total (média/jogo)</div>
  <table>
    <thead><tr><th>Jogadora</th><th style="text-align:center;">Jogos</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${statsPorJogadorRows}</tbody>
  </table>` : ""}` : ""}

  <h2>Treinos realizados por componente</h2>
  <div class="sub" style="margin-bottom:10px;">De ${treinosRealizados.length} treino${treinosRealizados.length === 1 ? "" : "s"} realizado${treinosRealizados.length === 1 ? "" : "s"} nesta época, quantos incluíram pelo menos um exercício de cada componente:</div>
  <table>
    <thead><tr><th>Componente</th><th style="text-align:center;">Treinos</th><th style="text-align:center;">%</th></tr></thead>
    <tbody>${componentesRows}</tbody>
  </table>

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printPlayer(player, sessions, clubLogo) {
  const html = buildPlayerPrintContent(player, sessions, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const namePart = (player.nome || "jogador").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `ficha-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------- BIBLIOTECA DE EXERCÍCIOS ---------------- */

function LibraryView({ library, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterFase, setFilterFase] = useState("");
  const [filterComponente, setFilterComponente] = useState("");

  const filtered = library.filter((ex) => {
    const h = getHabilidade(ex.categoria);
    if (filterFase && (!h || h.fase !== filterFase)) return false;
    if (filterComponente && (!h || h.componente !== filterComponente)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inNome = (ex.nome || "").toLowerCase().includes(q);
      const inHab = h && h.nome.toLowerCase().includes(q);
      const inDesc = (ex.descricao || "").toLowerCase().includes(q);
      if (!inNome && !inHab && !inDesc) return false;
    }
    return true;
  });

  const hasFilters = search.trim() || filterFase || filterComponente;
  const clearFilters = () => { setSearch(""); setFilterFase(""); setFilterComponente(""); };

  return (
    <div>
      <ViewHeader title="Biblioteca de exercícios" subtitle={`${library.length} exercício${library.length === 1 ? "" : "s"} guardado${library.length === 1 ? "" : "s"}`} onAdd={onAdd} addLabel="Novo exercício" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6272]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, habilidade ou descrição..."
            className={inputCls + " pl-8"}
          />
        </div>
        <select value={filterFase} onChange={(e) => setFilterFase(e.target.value)} className={inputCls + " w-auto"}>
          <option value="">Todas as fases</option>
          <option value="Defesa">Defesa</option>
          <option value="Ataque">Ataque</option>
        </select>
        <select value={filterComponente} onChange={(e) => setFilterComponente(e.target.value)} className={inputCls + " w-auto"}>
          <option value="">Todos os componentes</option>
          {COMPONENTES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3] px-2 py-2">
            Limpar
          </button>
        )}
      </div>

      {hasFilters && (
        <div className="text-xs text-[#8A93A3] mb-3">
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"} de {library.length}
        </div>
      )}

      {library.length === 0 ? (
        <EmptyState text="Ainda não tens exercícios guardados. Cria o primeiro, ou guarda um diretamente a partir de um treino." />
      ) : filtered.length === 0 ? (
        <EmptyState text="Nenhum exercício corresponde a esta pesquisa." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((ex) => (
            <div key={ex.id} className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 group">
              <div className="flex items-start gap-3">
                {ex.diagramas && ex.diagramas.length > 0 && (
                  <div className="relative shrink-0">
                    <DiagramThumbnail diagram={ex.diagramas[0]} size={44} />
                    {ex.diagramas.length > 1 && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="absolute -bottom-1 -right-1 bg-[#EA5B13] text-[#14181F] text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                        {ex.diagramas.length}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide text-sm truncate">
                      {ex.nome || "Sem nome"}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => onEdit(ex)} className="p-1 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => onDelete(ex.id)} className="p-1 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {(() => {
                      const h = getHabilidade(ex.categoria);
                      return (
                        <span
                          className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                            h && h.fase === "Defesa" ? "bg-[#D64545]/20 text-[#D64545]" : "bg-[#4C9A6A]/20 text-[#4C9A6A]"
                          }`}
                        >
                          {h ? h.fase : ""}
                        </span>
                      );
                    })()}
                    {ex.duracaoPadrao && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3]">
                        {ex.duracaoPadrao} min
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8A93A3] mb-1.5">
                    {(() => {
                      const h = getHabilidade(ex.categoria);
                      return h ? `${h.componente} · ${h.nome}` : habilidadeLabel(ex.categoria);
                    })()}
                  </div>
                  {ex.descricao && <div className="text-xs text-[#8A93A3] line-clamp-3">{ex.descricao}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ diagramas: [], ...initial });
  const [showAi, setShowAi] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar exercício" : "Novo exercício"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2">
          <input value={form.nome} onChange={set("nome")} className={inputCls} placeholder="Ex: 3x3 meio campo" />
        </Field>
        <Field label="Habilidade / categoria" className="col-span-2">
          <HabilidadeSelect value={form.categoria} onChange={set("categoria")} />
        </Field>
        <Field label="Duração padrão (min)">
          <input type="number" min="0" value={form.duracaoPadrao} onChange={set("duracaoPadrao")} className={inputCls} placeholder="15" />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[#EA5B13]/50 hover:border-[#EA5B13] text-[#EA5B13] text-xs rounded-md py-2 transition-colors"
          >
            <Sparkles size={13} /> Sugerir com IA
          </button>
        </div>
        <Field label="Descrição / instruções" className="col-span-2">
          <textarea value={form.descricao} onChange={set("descricao")} className={inputCls + " resize-none"} style={{ minHeight: 90 }} placeholder="Organização, variantes, critério de sucesso..." />
        </Field>
        <div className="col-span-2 mt-1">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Diagramas (sequência de passos)</span>
          <DiagramStepsRow diagramas={form.diagramas} onChange={(diagramas) => setForm({ ...form, diagramas })} />
        </div>
      </div>
      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.nome.trim()} />
    </Modal>
    {showAi && (
      <AiSuggestModal
        mode="exercicio"
        defaults={{ habilidade: getHabilidade(form.categoria), duracaoPadrao: form.duracaoPadrao }}
        onClose={() => setShowAi(false)}
        onUseExercicio={(item) => {
          setForm({
            ...form,
            nome: item.nome || form.nome,
            duracaoPadrao: item.duracaoPadrao || form.duracaoPadrao,
            descricao: item.descricao || form.descricao,
          });
          setShowAi(false);
        }}
      />
    )}
    </>
  );
}

/* ---------------- CALENDÁRIO ---------------- */

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

function MiniMonth({ year, month, sessions, selectedDate, onSelectDay }) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionsByDay = {};
  sessions.forEach((s) => {
    if (!s.date) return;
    const [sy, sm] = s.date.split("-").map(Number);
    if (sy === year && sm === month + 1) {
      const day = Number(s.date.split("-")[2]);
      sessionsByDay[day] = sessionsByDay[day] || [];
      sessionsByDay[day].push(s);
    }
  });

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isThisMonthSelected = selectedDate && selectedDate.y === year && selectedDate.m === month;

  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-2.5">
      <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-xs font-semibold text-center mb-1.5">
        {MESES_ABREV[month]}
      </div>
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[8px] text-[#5A6272]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const daySessions = sessionsByDay[d] || [];
          const isSelected = isThisMonthSelected && selectedDate.d === d;
          const hasGame = daySessions.some((s) => s.type === "jogo");
          const hasRealizado = daySessions.some((s) => s.type === "treino" && s.realizado === true);
          const hasPlaneado = daySessions.some((s) => s.type === "treino" && s.realizado !== true);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              style={{ aspectRatio: "1", fontSize: "9px" }}
              className={`rounded flex items-center justify-center relative ${
                isSelected ? "bg-[#EA5B13] text-[#14181F] font-semibold" : "hover:bg-white/10 text-[#8A93A3]"
              }`}
            >
              {d}
              {daySessions.length > 0 && !isSelected && (
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    hasGame ? "bg-[#EA5B13]" : hasRealizado ? "bg-[#4C9A6A]" : "bg-[#8A93A3]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({ sessions, players, clubLogo, calYear, setCalYear, selectedDate, setSelectedDate, onAddOnDay, onEdit, onDelete }) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  const dayStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const selectedSessions = selectedDate
    ? sessions.filter((s) => {
        if (!s.date) return false;
        const [sy, sm, sd] = s.date.split("-").map(Number);
        return sy === selectedDate.y && sm === selectedDate.m + 1 && sd === selectedDate.d;
      })
    : null;

  return (
    <div>
      <ViewHeader title="Calendário" subtitle="Vista do ano inteiro — treinos, jogos e planeamento" />

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => { setCalYear(calYear - 1); setSelectedDate(null); }}
          className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3]"
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-lg">
          {calYear}
        </div>
        <button
          onClick={() => { setCalYear(calYear + 1); setSelectedDate(null); }}
          className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4 text-[10px] text-[#8A93A3]">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4C9A6A] inline-block" /> Treino realizado</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#8A93A3] inline-block" /> Treino planeado</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#EA5B13] inline-block" /> Jogo</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map((m) => (
          <MiniMonth
            key={m}
            year={calYear}
            month={m}
            sessions={sessions}
            selectedDate={selectedDate}
            onSelectDay={(d) => setSelectedDate(selectedDate && selectedDate.y === calYear && selectedDate.m === m && selectedDate.d === d ? null : { y: calYear, m, d })}
          />
        ))}
      </div>

      {selectedDate && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm text-[#8A93A3]">
              {selectedDate.d} de {MESES[selectedDate.m]} de {selectedDate.y}
            </div>
            <button onClick={() => onAddOnDay(dayStr(selectedDate.y, selectedDate.m, selectedDate.d))} className="text-xs flex items-center gap-1 text-[#EA5B13] hover:text-[#FF6B1A]">
              <Plus size={14} /> Adicionar
            </button>
          </div>
          {selectedSessions.length === 0 ? (
            <EmptyState text="Sem registos neste dia." small />
          ) : (
            <div className="space-y-2">
              {selectedSessions.map((s) => (
                <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- SHARED UI ---------------- */

const inputCls = "w-full bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2 text-sm text-[#F2EDE3] placeholder-[#5A6272] focus:outline-none focus:border-[#EA5B13] focus:ring-1 focus:ring-[#EA5B13]";

function ViewHeader({ title, subtitle, onAdd, addLabel }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">
          {title}
        </h1>
        <div className="text-sm text-[#8A93A3] mt-0.5">{subtitle}</div>
      </div>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 transition-colors shrink-0">
          <Plus size={16} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function EmptyState({ text, small }) {
  return (
    <div className={`text-center text-[#5A6272] border border-dashed border-[#2E3644] rounded-lg ${small ? "py-6 text-xs" : "py-16 text-sm"}`}>
      {text}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-[#8A93A3] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-[#0A0C10]/95 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Inter', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        className={`bg-[#1E242E] border border-[#2E3644] rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <style>{FONT_IMPORT}</style>
      <style>{COLOR_FALLBACK_CSS}</style>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E3644] shrink-0">
          <h2 style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-[#F2EDE3]">
            {title}
          </h2>
          <button onClick={onClose} className="text-[#8A93A3] hover:text-[#F2EDE3]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, disabled, saveLabel = "Guardar", danger = false }) {
  return (
    <div style={{ boxShadow: "0 -8px 16px -4px rgba(0,0,0,0.4)" }} className="sticky bottom-0 -mx-5 -mb-5 mt-5 px-5 py-3.5 bg-[#1E242E] border-t border-[#2E3644] flex justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors text-[#14181F] disabled:bg-[#2E3644] disabled:text-[#5A6272] ${
          danger ? "bg-[#D64545] hover:bg-[#e05a5a]" : "bg-[#EA5B13] hover:bg-[#FF6B1A]"
        }`}
      >
        {saveLabel}
      </button>
    </div>
  );
}

function ImportBackupConfirmModal({ fileName, counts, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} title="Confirmar importação">
      <p className="text-sm text-[#F2EDE3] mb-3">
        Vais substituir <b>todos os dados atuais</b> da aplicação pelo conteúdo de{" "}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#8A93A3] text-xs break-all">{fileName}</span>:
      </p>
      <ul className="text-sm text-[#8A93A3] space-y-1 mb-4 list-disc pl-5">
        <li>{counts.players} jogador{counts.players === 1 ? "" : "es"}</li>
        <li>{counts.sessions} treino{counts.sessions === 1 ? "" : "s"}/jogo{counts.sessions === 1 ? "" : "s"}</li>
        <li>{counts.library} exercício{counts.library === 1 ? "" : "s"} na biblioteca</li>
      </ul>
      <p className="text-xs text-[#D64545]">
        Esta ação não pode ser desfeita dentro da app. Se tiveres dados atuais que ainda não exportaste, cancela e exporta-os primeiro.
      </p>
      <ModalActions onCancel={onCancel} onSave={onConfirm} saveLabel="Substituir dados" danger />
    </Modal>
  );
}

function TeamsModal({ teams, players, sessions, clubLogo, onSaveLogo, onClose, onAdd, onRename, onDelete, onFecharTemporada }) {
  const [novoNome, setNovoNome] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingNome, setEditingNome] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [closingSeasonId, setClosingSeasonId] = useState(null);
  const [novaTemporada, setNovaTemporada] = useState("");

  const countsFor = (teamId) => ({
    jogadores: players.filter((p) => p.equipaId === teamId).length,
    registos: sessions.filter((s) => s.equipaId === teamId).length,
  });

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditingNome(t.nome);
  };
  const saveEdit = () => {
    if (editingNome.trim()) onRename(editingId, editingNome.trim());
    setEditingId(null);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setLogoLoading(true);
    setLogoError(null);
    try {
      const dataUrl = await resizeImageFile(file, 240, 0.9);
      onSaveLogo(dataUrl);
    } catch (err) {
      setLogoError(err.message || "Não foi possível carregar o logotipo.");
    } finally {
      setLogoLoading(false);
    }
  };

  const startCloseSeason = (t) => {
    setClosingSeasonId(t.id);
    setNovaTemporada(nextTemporadaLabel(t.temporadaAtual));
  };
  const confirmCloseSeason = (teamId) => {
    if (novaTemporada.trim()) onFecharTemporada(teamId, novaTemporada.trim());
    setClosingSeasonId(null);
  };

  return (
    <Modal onClose={onClose} title="Gerir equipas">
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-[#2E3644]">
        <div style={{ width: 64, height: 64 }} className="rounded-lg overflow-hidden bg-[#14181F] border border-[#2E3644] flex items-center justify-center shrink-0">
          {logoLoading ? (
            <Loader2 size={18} className="animate-spin text-[#5A6272]" />
          ) : clubLogo ? (
            <img src={clubLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <Trophy size={22} className="text-[#5A6272]" />
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-1.5" style={{ fontFamily: "'Oswald', sans-serif" }}>Logotipo do clube</div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs px-3 py-2 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]">
              {clubLogo ? "Alterar" : "Adicionar logotipo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            {clubLogo && (
              <button type="button" onClick={() => onSaveLogo("")} className="text-xs text-[#D64545] hover:text-[#F2EDE3] px-2">
                Remover
              </button>
            )}
          </div>
          {logoError && <div className="text-[11px] text-[#D64545] mt-1">{logoError}</div>}
          <div className="text-[11px] text-[#5A6272] mt-1">Aparece em todos os documentos descarregados/impressos.</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {teams.map((t) => {
          const c = countsFor(t.id);
          return (
            <div key={t.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
              <div className="flex items-center gap-2">
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editingNome}
                    onChange={(e) => setEditingNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className={inputCls + " flex-1"}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.nome}</div>
                    <div className="text-[11px] text-[#8A93A3]">
                      {c.jogadores} jogador{c.jogadores === 1 ? "" : "es"} · {c.registos} registo{c.registos === 1 ? "" : "s"}
                      {t.temporadaAtual && <> · Época atual: <b className="text-[#F2EDE3]">{t.temporadaAtual}</b></>}
                    </div>
                  </div>
                )}
                <div className="flex gap-1 shrink-0">
                  {editingId === t.id ? (
                    <button onClick={saveEdit} className="text-xs px-2.5 py-1.5 rounded bg-[#EA5B13] text-[#14181F] font-medium">Guardar</button>
                  ) : (
                    <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                      <Pencil size={14} />
                    </button>
                  )}
                  {confirmingDeleteId === t.id ? (
                    <button
                      onClick={() => { onDelete(t.id); setConfirmingDeleteId(null); }}
                      className="text-xs px-2.5 py-1.5 rounded bg-[#D64545] text-[#14181F] font-medium"
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button onClick={() => setConfirmingDeleteId(t.id)} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {editingId !== t.id && (
                closingSeasonId === t.id ? (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2E3644]">
                    <span className="text-[11px] text-[#8A93A3] shrink-0">Nova época:</span>
                    <input
                      autoFocus
                      value={novaTemporada}
                      onChange={(e) => setNovaTemporada(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmCloseSeason(t.id)}
                      className={inputCls + " flex-1"}
                      placeholder="Ex: 2026/2027"
                    />
                    <button onClick={() => confirmCloseSeason(t.id)} className="text-xs px-2.5 py-1.5 rounded bg-[#EA5B13] text-[#14181F] font-medium shrink-0">Confirmar</button>
                    <button onClick={() => setClosingSeasonId(null)} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3] shrink-0">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startCloseSeason(t)}
                    className="mt-2 pt-2 border-t border-[#2E3644] w-full text-left text-[11px] text-[#EA5B13] hover:text-[#FF6B1A] flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Fechar época "{t.temporadaAtual}" e começar uma nova
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {confirmingDeleteId && (
        <div className="text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 mb-4">
          Apagar uma equipa remove também os seus jogadores e treinos/jogos. A biblioteca de exercícios não é afetada. Clica "Confirmar" outra vez para prosseguir, ou muda de ideias clicando fora.
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim()) { onAdd(novoNome); setNovoNome(""); } }}
          className={inputCls + " flex-1"}
          placeholder="Nome da nova equipa"
        />
        <button
          onClick={() => { if (novoNome.trim()) { onAdd(novoNome); setNovoNome(""); } }}
          disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-40 text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2"
        >
          <Plus size={16} /> Criar
        </button>
      </div>

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

function TransferModal({ teams, onClose, onConfirm }) {
  const [targetId, setTargetId] = useState(teams[0]?.id || "");
  return (
    <Modal onClose={onClose} title="Copiar para outra equipa">
      {teams.length === 0 ? (
        <EmptyState text="Ainda não tens outra equipa criada. Cria uma primeiro em 'Gerir equipas'." />
      ) : (
        <>
          <p className="text-sm text-[#8A93A3] mb-3">
            Cria uma cópia deste registo (exercícios, objetivos e conteúdo) noutra equipa. Presenças/convocatória e resultado não são copiados, já que dependem do plantel de cada equipa.
          </p>
          <Field label="Equipa de destino">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      <ModalActions onCancel={onClose} onSave={() => onConfirm(targetId)} disabled={teams.length === 0} saveLabel="Copiar" />
    </Modal>
  );
}

function MovePlayerModal({ player, teams, onClose, onConfirm }) {
  const [targetId, setTargetId] = useState(teams[0]?.id || "");
  return (
    <Modal onClose={onClose} title="Mudar de equipa">
      {teams.length === 0 ? (
        <EmptyState text="Ainda não tens outra equipa criada. Cria uma primeiro em 'Gerir equipas'." />
      ) : (
        <>
          <p className="text-sm text-[#F2EDE3] mb-3">
            Vais mover <b>{player.nome}</b> para outra equipa. Ela deixa de aparecer no plantel atual e passa a fazer parte do plantel de destino.
          </p>
          <Field label="Equipa de destino">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-[#8A93A3] mt-3">
            A ficha dela (contactos, saúde, avaliações, testes físicos) mantém-se intacta. O histórico de presenças/estatísticas na equipa antiga continua guardado nos treinos/jogos já registados, mas deixa de contar nas estatísticas atuais.
          </p>
        </>
      )}
      <ModalActions onCancel={onClose} onSave={() => onConfirm(targetId)} disabled={teams.length === 0} saveLabel="Mudar de equipa" />
    </Modal>
  );
}
