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

const CURVABLE_TYPES = new Set(["passe", "corte", "lancamento", "drible"]);
const ERASE_RADIUS = 7;

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
      const ratio = vb.w / vb.h;
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
  }, [vb.w, vb.h]);

  const getPoint = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * vb.w;
    const y = ((clientY - rect.top) / rect.height) * vb.h;
    return { x: Math.max(4, Math.min(vb.w - 4, x)), y: Math.max(4, Math.min(vb.h - 4, y)) };
  };

  const nearestToken = (pt) => diagram.tokens.find((t) => distPt(t, pt) < SNAP_DIST);

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

  const beginStroke = (e) => {
    setDrawingStroke([getPoint(e)]);
  };

  // Apaga qualquer traço de caneta que passe perto do ponto dado.
  const eraseAt = (pt) => {
    setEraserPos(pt);
    replaceCurrent((d) => {
      const strokes = (d.strokes || []).filter((s) => !s.points.some((p) => distPt(p, pt) < ERASE_RADIUS));
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
      setDrawing({ type: mode, from: { x: token.x, y: token.y, tokenId: token.id }, to: { x: token.x, y: token.y, tokenId: null } });
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
        const from = { x: drawing.from.x, y: drawing.from.y };
        const to = { x: drawing.to.x, y: drawing.to.y };
        commit((d) => ({
          ...d,
          arrows: [
            ...d.arrows,
            {
              id: uid(),
              type: drawing.type,
              from,
              to,
              control: CURVABLE_TYPES.has(drawing.type) ? defaultControlPoint(drawing.type, from, to) : undefined,
              tokenId: drawing.from.tokenId || drawing.to.tokenId || null,
            },
          ],
        }));
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
        <button onClick={() => setMode("mover")} className={`text-xs px-2.5 py-1 rounded ${mode === "mover" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          Mover
        </button>
        <button onClick={() => setMode("caneta")} title="Escrever ou desenhar livremente com a caneta ou o dedo" className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded ${mode === "caneta" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          <Pencil size={12} /> Caneta
        </button>
        <button onClick={() => setMode("borracha")} title="Apagar o que foi desenhado à mão — arrasta por cima para apagar" className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded ${mode === "borracha" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          <Eraser size={12} /> Borracha
        </button>
        {ARROW_TYPES.map((a) => (
          <button key={a.id} onClick={() => setMode(a.id)} title={a.desc} className={`text-xs px-2.5 py-1 rounded ${mode === a.id ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
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
            Arrasta para desenhar · segura <b className="text-[#F2EDE3]">Shift</b> para linha reta
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
          <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full select-none" onMouseDown={startFromCanvas} onTouchStart={startFromCanvas}>
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
              return <TokenShape key={t.id} token={pos} selected={selectedId === t.id} onMouseDown={(e) => startFromToken(e, t.id)} />;
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
