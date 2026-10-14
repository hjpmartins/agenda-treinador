import { useState, useRef, useReducer, useEffect, useCallback } from "react";
import { X, Trash2, Play, RotateCcw, Undo2, Redo2, Pencil, Eraser } from "lucide-react";
import { HALF_VB, FULL_VB, ARROW_TYPES } from "../../data";
import { uid, distPt, emptyDiagram, computeAnimatedPositions, defaultControlPoint } from "../../utils";
import { inputCls } from "../../ui";
import { CourtBackground, TokenShape, ArrowShape } from "../diagrams/CourtPrimitives";

// Traço livre (caneta/dedo) — para escrever ou desenhar à mão, sem ficar
// preso aos tipos de seta predefinidos. Um único ponto (toque rápido, ex:
// um pingo de um "í") desenha-se como um pontinho em vez de uma linha.
function StrokeShape({ points }) {
  if (points.length < 2) {
    return <circle cx={points[0].x} cy={points[0].y} r="1.6" fill="#F2EDE3" />;
  }
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="none"
      stroke="#F2EDE3"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// Quadro tático em ecrã inteiro para desenhar uma jogada num instante (ex:
// num desconto de tempo, durante o jogo) — sem gravar em lado nenhum, só
// para mostrar à equipa. Usa a mesma lógica de desenho do editor de
// diagramas dos exercícios (arrastar jogadores, desenhar setas, reproduzir
// o movimento), mas em ecrã inteiro e dimensionado ao ecrã que estiver a
// ser usado, em vez de preso ao tamanho de uma modal.

const CURVABLE_TYPES = new Set(["passe", "corte", "lancamento", "drible", "handoff"]);
const ERASE_RADIUS = 7;

// Distância de um ponto ao segmento [a,b] — usada para apagar um traço
// tocando em qualquer sítio da linha desenhada, não só perto de um dos
// pontos amostrados (um arrasto rápido só regista alguns pontos, por isso
// tocar a meio de um troço entre dois deles também tem de contar).
function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distPt(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return distPt(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function strokeNearPoint(stroke, pt) {
  if (stroke.points.length < 2) return distPt(stroke.points[0], pt) < ERASE_RADIUS;
  for (let i = 0; i < stroke.points.length - 1; i++) {
    if (distToSegment(pt, stroke.points[i], stroke.points[i + 1]) < ERASE_RADIUS) return true;
  }
  return false;
}
// Espaço extra à volta das linhas do campo, para colocar jogadoras fora de
// campo (ex: jogadas de bola parada / reposições de linha lateral ou fundo).
const COURT_MARGIN = 40;

function historyReducer(state, action) {
  const current = state.history[state.index];
  if (action.type === "commit") {
    const next = typeof action.updater === "function" ? action.updater(current) : action.updater;
    const truncated = state.history.slice(0, state.index + 1);
    return { history: [...truncated, next], index: truncated.length };
  }
  if (action.type === "replaceCurrent") {
    const next = typeof action.updater === "function" ? action.updater(current) : action.updater;
    const history = state.history.slice();
    history[state.index] = next;
    return { ...state, history };
  }
  if (action.type === "undo") return { ...state, index: Math.max(0, state.index - 1) };
  if (action.type === "redo") return { ...state, index: Math.min(state.history.length - 1, state.index + 1) };
  return state;
}

function WhiteboardView({ onClose }) {
  const [historyState, dispatchHistory] = useReducer(historyReducer, { history: [{ ...emptyDiagram(), strokes: [] }], index: 0 });
  const diagram = historyState.history[historyState.index];
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.history.length - 1;
  const commit = useCallback((updater) => dispatchHistory({ type: "commit", updater }), []);
  const replaceCurrent = useCallback((updater) => dispatchHistory({ type: "replaceCurrent", updater }), []);
  const undo = useCallback(() => dispatchHistory({ type: "undo" }), []);
  const redo = useCallback(() => dispatchHistory({ type: "redo" }), []);

  const [mode, setMode] = useState("mover"); // 'mover' | tipo de seta
  const [dragId, setDragId] = useState(null);
  const [dragControlId, setDragControlId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [pendingFrom, setPendingFrom] = useState(null); // { x, y, tokenId } — jogadora de partida já escolhida por toque, à espera do destino
  const [drawingStroke, setDrawingStroke] = useState(null); // pontos do traço de caneta a ser desenhado agora
  const [erasing, setErasing] = useState(false);
  const [eraserPos, setEraserPos] = useState(null); // posição atual da borracha, só para mostrar o círculo
  const [selectedId, setSelectedId] = useState(null);
  const [animPositions, setAnimPositions] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wrapRef = useRef(null);
  const boxRef = useRef(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, onClose]);

  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  // Dimensões do SVG: as linhas do campo mantêm o tamanho de sempre (vb),
  // mas o viewBox é maior à volta — dá para arrastar jogadoras, bola, etc.
  // para fora das linhas sem ficarem presas à margem do campo em si.
  const outerW = vb.w + COURT_MARGIN * 2;
  const outerH = vb.h + COURT_MARGIN * 2;
  const SNAP_DIST = 14;

  // Ajusta o tamanho do campo ao espaço disponível no ecrã (em vez de um
  // limite fixo em vh, como no editor de diagramas dentro de uma modal) —
  // cresce o máximo possível sem distorcer, em qualquer tamanho de ecrã.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const compute = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (!availW || !availH) return;
      const ratio = outerW / outerH;
      let width = availW;
      let height = width / ratio;
      if (height > availH) {
        height = availH;
        width = height * ratio;
      }
      setBoxSize({ width, height });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [outerW, outerH]);

  const getPoint = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * outerW - COURT_MARGIN;
    const y = ((clientY - rect.top) / rect.height) * outerH - COURT_MARGIN;
    return {
      x: Math.max(4 - COURT_MARGIN, Math.min(vb.w - 4 + COURT_MARGIN, x)),
      y: Math.max(4 - COURT_MARGIN, Math.min(vb.h - 4 + COURT_MARGIN, y)),
    };
  };

  const nearestToken = (pt) => diagram.tokens.find((t) => distPt(t, pt) < SNAP_DIST);

  // "Quem tem bola": a jogadora mais próxima da bola, dentro de uma distância
  // curta — usado para que um Passe ou Lançamento iniciado a partir dela saia
  // sempre da bola (e não da jogadora), para a animação funcionar e a seta
  // começar no sítio certo, sem o treinador ter de acertar exatamente no
  // ícone pequeno da bola.
  const findBallHolder = () => {
    const ball = diagram.tokens.find((t) => t.type === "ball");
    if (!ball) return null;
    const holder = diagram.tokens.find((t) => t.type !== "ball" && t.type !== "cone" && t.type !== "treinador" && distPt(t, ball) < SNAP_DIST);
    return holder ? { ball, holder } : null;
  };

  // Para Passe/Lançamento: se o toque/arrasto começar na jogadora que tem a
  // bola, a seta começa mesmo na bola (não na jogadora) — ver findBallHolder.
  const resolveArrowOrigin = (type, token) => {
    if (type !== "passe" && type !== "lancamento") return token;
    const possession = findBallHolder();
    if (possession && possession.holder.id === token.id) return possession.ball;
    return token;
  };

  const snapAngle = (from, raw) => {
    const dx = raw.x - from.x;
    const dy = raw.y - from.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 12;
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
    commit((d) => ({ ...d, tokens: [...d.tokens, token] }));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commit((d) => ({
      ...d,
      tokens: d.tokens.filter((t) => t.id !== selectedId),
      arrows: d.arrows.filter((a) => a.id !== selectedId),
    }));
    setSelectedId(null);
  };

  const clearAll = () => {
    if (diagram.tokens.length === 0 && diagram.arrows.length === 0 && (diagram.strokes || []).length === 0) return;
    if (!window.confirm("Limpar tudo o que está desenhado no quadro?")) return;
    commit((d) => ({ ...d, tokens: [], arrows: [], strokes: [] }));
    setSelectedId(null);
  };

  // Troca de modo cancela sempre uma jogadora de partida que estivesse à
  // espera de um destino (tocar em "Mover" ou noutra ação a meio do gesto).
  const changeMode = (next) => {
    setMode(next);
    setPendingFrom(null);
  };

  const beginStroke = (e) => {
    setDrawingStroke([getPoint(e)]);
  };

  const addArrow = (type, from, to, tokenId) => {
    commit((d) => ({
      ...d,
      arrows: [
        ...d.arrows,
        {
          id: uid(),
          type,
          from,
          to,
          control: CURVABLE_TYPES.has(type) ? defaultControlPoint(type, from, to) : undefined,
          tokenId: tokenId || null,
        },
      ],
    }));
  };

  // Apaga qualquer traço de caneta que passe perto do ponto dado.
  const eraseAt = (pt) => {
    setEraserPos(pt);
    replaceCurrent((d) => {
      const strokes = (d.strokes || []).filter((s) => !strokeNearPoint(s, pt));
      return strokes.length === (d.strokes || []).length ? d : { ...d, strokes };
    });
  };

  const beginErase = (e) => {
    commit((d) => d); // ponto de partida — o arrasto inteiro da borracha desfaz-se de uma vez com "Desfazer"
    setErasing(true);
    eraseAt(getPoint(e));
  };

  const startFromToken = (e, tokenId) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (mode === "caneta") {
      beginStroke(e);
      return;
    }
    if (mode === "borracha") {
      beginErase(e);
      return;
    }
    const token = diagram.tokens.find((t) => t.id === tokenId);
    if (mode === "mover") {
      commit((d) => d);
      setDragId(tokenId);
      setSelectedId(tokenId);
    } else {
      const origin = resolveArrowOrigin(mode, token);
      setDrawing({ type: mode, from: { x: origin.x, y: origin.y, tokenId: origin.id }, to: { x: origin.x, y: origin.y, tokenId: null } });
    }
  };

  const startControlDrag = (e, arrowId) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    commit((d) => d);
    setDragControlId(arrowId);
  };

  const startFromCanvas = (e) => {
    if (e.cancelable) e.preventDefault();
    if (mode === "caneta") {
      beginStroke(e);
      return;
    }
    if (mode === "borracha") {
      beginErase(e);
      return;
    }
    const pt = getPoint(e);
    if (mode === "mover") {
      setSelectedId(null);
      return;
    }
    setDrawing({ type: mode, from: { ...pt, tokenId: null }, to: { ...pt, tokenId: null } });
  };

  const handleMouseMove = (e) => {
    if (dragId) {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      replaceCurrent((d) => ({ ...d, tokens: d.tokens.map((t) => (t.id === dragId ? { ...t, x: pt.x, y: pt.y } : t)) }));
      return;
    }
    if (dragControlId) {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      replaceCurrent((d) => ({ ...d, arrows: d.arrows.map((a) => (a.id === dragControlId ? { ...a, control: pt } : a)) }));
      return;
    }
    if (drawingStroke) {
      if (e.cancelable) e.preventDefault();
      const pt = getPoint(e);
      setDrawingStroke((prev) => [...prev, pt]);
      return;
    }
    if (erasing) {
      if (e.cancelable) e.preventDefault();
      eraseAt(getPoint(e));
      return;
    }
    if (drawing) {
      if (e.cancelable) e.preventDefault();
      let raw = getPoint(e);
      const near = nearestToken(raw);
      let pt = near ? { x: near.x, y: near.y } : raw;
      if (!near && e.shiftKey) pt = snapAngle(drawing.from, raw);
      setDrawing({ ...drawing, to: { x: pt.x, y: pt.y, tokenId: near ? near.id : null } });
    }
  };

  const handleMouseUp = () => {
    if (dragId) {
      setDragId(null);
      return;
    }
    if (dragControlId) {
      setDragControlId(null);
      return;
    }
    if (drawingStroke) {
      commit((d) => ({ ...d, strokes: [...(d.strokes || []), { id: uid(), points: drawingStroke }] }));
      setDrawingStroke(null);
      return;
    }
    if (erasing) {
      setErasing(false);
      setEraserPos(null);
      return;
    }
    if (drawing) {
      const isTiny = distPt(drawing.from, drawing.to) < 6;
      if (!isTiny) {
        // Arrastou mesmo — desenha a seta diretamente, como já acontecia.
        addArrow(drawing.type, { x: drawing.from.x, y: drawing.from.y }, { x: drawing.to.x, y: drawing.to.y }, drawing.from.tokenId || drawing.to.tokenId || null);
        setPendingFrom(null);
      } else if (drawing.from.tokenId) {
        // Toque rápido (sem arrastar) numa jogadora: em vez de descartar,
        // guarda-a como ponto de partida — o próximo toque (noutra jogadora
        // ou no campo) completa a seta sozinho, sem ser preciso arrastar.
        if (!pendingFrom) {
          setPendingFrom({ x: drawing.from.x, y: drawing.from.y, tokenId: drawing.from.tokenId });
        } else if (drawing.from.tokenId === pendingFrom.tokenId) {
          setPendingFrom(null); // tocou na mesma outra vez — cancela a escolha
        } else {
          addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
          setPendingFrom(null);
        }
      } else if (pendingFrom) {
        // Segundo toque em campo vazio (ex: lançamento para o cesto, corte
        // para espaço livre) — completa a seta na mesma, sem precisar de jogadora de destino.
        addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
        setPendingFrom(null);
      }
      setDrawing(null);
    }
  };

  const playAnimation = () => {
    const hasMovement = diagram.arrows.some((a) => a.tokenId && a.to);
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
    <div className="fixed inset-0 z-[60] bg-[#14181F] flex flex-col">
      <div className="shrink-0 bg-[#14181F] border-b border-[#2E3644] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-lg font-semibold uppercase tracking-wide">
          Quadro tático
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={clearAll}
            disabled={diagram.tokens.length === 0 && diagram.arrows.length === 0 && (diagram.strokes || []).length === 0}
            title="Limpar tudo"
            className="p-2 rounded hover:bg-[#D64545]/20 disabled:opacity-40 disabled:hover:bg-transparent text-[#8A93A3] hover:text-[#D64545] transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} title="Fechar" className="p-2 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-4 sm:px-6 pt-3 flex flex-wrap items-center gap-2">
        <select value={diagram.court} onChange={(e) => { const court = e.target.value; commit((d) => ({ ...d, court })); }} className={inputCls + " w-auto"}>
          <option value="meio">Meio campo</option>
          <option value="campo">Campo inteiro</option>
        </select>
        <div className="w-px h-6 bg-[#2E3644]" />
        <button onClick={() => addToken("offense")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Ataque</button>
        <button onClick={() => addToken("defense")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Defesa</button>
        <button onClick={() => addToken("ball")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Bola</button>
        <button onClick={() => addToken("cone")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Cone</button>
        <button onClick={() => addToken("treinador")} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">+ Treinador</button>
        <div className="w-px h-6 bg-[#2E3644]" />
        <button onClick={deleteSelected} disabled={!selectedId} className="text-xs px-2.5 py-1.5 rounded border border-[#2E3644] hover:border-[#D64545] hover:text-[#D64545] disabled:opacity-30">
          <Trash2 size={13} className="inline -mt-0.5 mr-1" /> Apagar selecionado
        </button>
        <div className="w-px h-6 bg-[#2E3644]" />
        <div className="flex gap-2 shrink-0">
          <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="text-xs px-2 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-30">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)" className="text-xs px-2 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-30">
            <Redo2 size={14} />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-4 sm:px-6 pt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-[#8A93A3] mr-1">Modo:</span>
        <button onClick={() => changeMode("mover")} className={`text-xs px-2.5 py-1 rounded ${mode === "mover" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          Mover
        </button>
        <button onClick={() => changeMode("caneta")} title="Escrever ou desenhar livremente com a caneta ou o dedo" className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded ${mode === "caneta" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          <Pencil size={12} /> Caneta
        </button>
        <button onClick={() => changeMode("borracha")} title="Apagar o que foi desenhado à mão — arrasta por cima para apagar" className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded ${mode === "borracha" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          <Eraser size={12} /> Borracha
        </button>
        {ARROW_TYPES.map((a) => (
          <button key={a.id} onClick={() => changeMode(a.id)} title={a.desc} className={`text-xs px-2.5 py-1 rounded ${mode === a.id ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
            {a.label}
          </button>
        ))}
        {mode === "caneta" && (
          <span className="text-[11px] text-[#8A93A3] ml-1 hidden sm:inline">Arrasta com o dedo ou a caneta para escrever ou desenhar</span>
        )}
        {mode === "borracha" && (
          <span className="text-[11px] text-[#8A93A3] ml-1 hidden sm:inline">Arrasta por cima do que desenhaste com a caneta para apagar</span>
        )}
        {mode !== "mover" && mode !== "caneta" && mode !== "borracha" && (
          <span className="text-[11px] text-[#8A93A3] ml-1 hidden sm:inline">
            {pendingFrom ? (
              <>Agora toca na jogadora (ou ponto) de destino · ou toca outra vez na mesma para cancelar</>
            ) : (
              <>
                Arrasta para desenhar, ou toca na jogadora de partida e depois na de destino · segura <b className="text-[#F2EDE3]">Shift</b> ao arrastar para linha reta
                {(mode === "passe" || mode === "lancamento") && <> · sai sempre da bola, mesmo tocando na jogadora que a tem</>}
              </>
            )}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={playAnimation} disabled={isPlaying} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-40">
            <Play size={13} /> Reproduzir
          </button>
          <button onClick={resetAnimation} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
      </div>

      <div ref={boxRef} className="flex-1 min-h-0 flex items-center justify-center p-3">
        <div
          ref={wrapRef}
          style={{ width: boxSize.width || "auto", height: boxSize.height || "auto" }}
          className="bg-[#0F1319] rounded-lg overflow-hidden touch-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onTouchCancel={handleMouseUp}
        >
          <svg
            viewBox={`${-COURT_MARGIN} ${-COURT_MARGIN} ${outerW} ${outerH}`}
            className="w-full h-full select-none"
            onMouseDown={startFromCanvas}
            onTouchStart={startFromCanvas}
          >
            <CourtBackground court={diagram.court} vb={vb} />
            {diagram.arrows.map((a) => {
              const onSelect = (e) => { e.stopPropagation(); if (mode === "mover") setSelectedId(a.id); };
              const isSelectedCurvable = mode === "mover" && selectedId === a.id && CURVABLE_TYPES.has(a.type);
              const control = isSelectedCurvable ? a.control || defaultControlPoint(a.type, a.from, a.to) : null;
              return (
                <g key={a.id}>
                  <ArrowShape arrow={a} selected={selectedId === a.id} onMouseDown={onSelect} />
                  {isSelectedCurvable && (
                    <circle
                      cx={control.x}
                      cy={control.y}
                      r="6"
                      fill="#EA5B13"
                      stroke="#F2EDE3"
                      strokeWidth="1.5"
                      style={{ cursor: "grab" }}
                      onMouseDown={(e) => startControlDrag(e, a.id)}
                      onTouchStart={(e) => startControlDrag(e, a.id)}
                    />
                  )}
                </g>
              );
            })}
            {drawing && (
              <ArrowShape arrow={{ type: drawing.type, from: drawing.from, to: drawing.to }} selected={false} />
            )}
            {diagram.tokens.map((t) => {
              const pos = (animPositions && animPositions[t.id]) || t;
              const isPendingOrigin = pendingFrom && pendingFrom.tokenId === t.id;
              return <TokenShape key={t.id} token={pos} selected={selectedId === t.id || isPendingOrigin} onMouseDown={(e) => startFromToken(e, t.id)} />;
            })}
            {(diagram.strokes || []).map((s) => (
              <StrokeShape key={s.id} points={s.points} />
            ))}
            {drawingStroke && <StrokeShape points={drawingStroke} />}
            {erasing && eraserPos && (
              <circle cx={eraserPos.x} cy={eraserPos.y} r={ERASE_RADIUS} fill="#D64545" fillOpacity="0.25" stroke="#D64545" strokeWidth="1" />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

export { WhiteboardView };
