import { useState, useRef, useReducer, useEffect, useCallback } from "react";
import { Trash2, Play, RotateCcw, Undo2, Redo2 } from "lucide-react";
import { HALF_VB, FULL_VB, ARROW_TYPES } from "../../data";
import { uid, distPt, emptyDiagram, computeAnimatedPositions, defaultControlPoint } from "../../utils";
import { inputCls } from "../../ui";
import { Modal, ModalActions } from "../common/Modal";
import { CourtBackground, TokenShape, ArrowShape } from "./CourtPrimitives";

// Tipos de seta cuja curva pode ser ajustada arrastando um ponto de controlo.
// "bloqueio" mantém-se sempre reto (uma parede não se curva) — por isso fica de fora.
const CURVABLE_TYPES = new Set(["passe", "corte", "lancamento", "drible", "handoff"]);

// Histórico de estados do diagrama, para permitir desfazer/refazer.
// "commit" grava um novo ponto no histórico (ações discretas: adicionar/apagar,
// terminar de desenhar uma seta...). "replaceCurrent" substitui só o ponto atual,
// sem criar entradas novas — usado durante um arrasto contínuo (mousemove), para
// não encher o histórico com uma entrada por cada pixel de movimento.
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

function DiagramEditor({ initial, onClose, onSave }) {
  const [historyState, dispatchHistory] = useReducer(historyReducer, { history: [initial || emptyDiagram()], index: 0 });
  const diagram = historyState.history[historyState.index];
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.history.length - 1;
  const commit = useCallback((updater) => dispatchHistory({ type: "commit", updater }), []);
  const replaceCurrent = useCallback((updater) => dispatchHistory({ type: "replaceCurrent", updater }), []);
  const undo = useCallback(() => dispatchHistory({ type: "undo" }), []);
  const redo = useCallback(() => dispatchHistory({ type: "redo" }), []);

  const [mode, setMode] = useState("mover"); // 'mover' | arrow type id
  const [dragId, setDragId] = useState(null);
  const [dragControlId, setDragControlId] = useState(null); // id da seta cujo ponto de curva está a ser arrastado
  const [drawing, setDrawing] = useState(null); // {type, from:{x,y,tokenId}, to:{x,y,tokenId}}
  const [pendingFrom, setPendingFrom] = useState(null); // { x, y, tokenId } — jogador de partida já escolhido por toque, à espera do destino
  const [selectedId, setSelectedId] = useState(null);
  const [animPositions, setAnimPositions] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
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
  }, [undo, redo]);

  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const SNAP_DIST = 14;
  // Distância usada só para detetar "quem tem bola": tem de ser maior que o
  // SNAP_DIST de arrasto, porque o raio do jogador (12) + o raio da bola (7)
  // já dá ~19 entre centros quando ficam com as bordas encostadas — com 14
  // nunca entrava em efeito mesmo com a bola visivelmente ao lado do jogador.
  const BALL_HOLD_DIST = 26;

  // Aceita tanto eventos de rato como de touch (telemóvel/tablet).
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

  // "Quem tem bola": o jogador mais próximo da bola, dentro de uma distância
  // curta — usado para que um Passe ou Lançamento iniciado a partir dele saia
  // sempre da bola (e não do jogador), para a animação funcionar e a seta
  // começar no sítio certo, sem o treinador ter de acertar exatamente no
  // ícone pequeno da bola.
  const findBallHolder = () => {
    const ball = diagram.tokens.find((t) => t.type === "ball");
    if (!ball) return null;
    const holder = diagram.tokens.find((t) => t.type !== "ball" && t.type !== "cone" && t.type !== "treinador" && distPt(t, ball) < BALL_HOLD_DIST);
    return holder ? { ball, holder } : null;
  };

  // Para Passe/Lançamento: se o toque/arrasto começar no jogador que tem a
  // bola, a seta começa mesmo na bola (não no jogador) — ver findBallHolder.
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

  // Troca de modo cancela sempre um jogador de partida que estivesse à
  // espera de um destino (tocar em "Mover" ou noutra ação a meio do gesto).
  const changeMode = (next) => {
    setMode(next);
    setPendingFrom(null);
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

  // ---- Pointer down: start dragging a token, or start drawing an arrow (bloqueio incluído) ----
  const startFromToken = (e, tokenId) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const token = diagram.tokens.find((t) => t.id === tokenId);
    if (mode === "mover") {
      commit((d) => d); // ponto de partida no histórico, antes do arrasto começar
      setDragId(tokenId);
      setSelectedId(tokenId);
    } else {
      const origin = resolveArrowOrigin(mode, token);
      setDrawing({ type: mode, from: { x: origin.x, y: origin.y, tokenId: origin.id }, to: { x: origin.x, y: origin.y, tokenId: null } });
    }
  };

  // Arrastar o ponto de controlo de uma curva já desenhada (só disponível em modo "Mover", com a seta selecionada).
  const startControlDrag = (e, arrowId) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    commit((d) => d);
    setDragControlId(arrowId);
  };

  const startFromCanvas = (e) => {
    if (e.cancelable) e.preventDefault();
    const pt = getPoint(e);
    if (mode === "mover") {
      setSelectedId(null);
      return;
    }
    setDrawing({ type: mode, from: { ...pt, tokenId: null }, to: { ...pt, tokenId: null } });
  };

  // ---- Pointer move: update drag or live preview of the arrow being drawn ----
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
    if (drawing) {
      if (e.cancelable) e.preventDefault();
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
    if (dragControlId) {
      setDragControlId(null);
      return;
    }
    if (drawing) {
      const isTiny = distPt(drawing.from, drawing.to) < 6;
      if (!isTiny) {
        // Arrastou mesmo — desenha a seta diretamente, como já acontecia.
        addArrow(drawing.type, { x: drawing.from.x, y: drawing.from.y }, { x: drawing.to.x, y: drawing.to.y }, drawing.from.tokenId || drawing.to.tokenId || null);
        setPendingFrom(null);
      } else if (drawing.from.tokenId) {
        // Toque rápido (sem arrastar) num jogador: em vez de descartar,
        // guarda-o como ponto de partida — o próximo toque (noutro jogador
        // ou no campo) completa a seta sozinho, sem ser preciso arrastar.
        if (!pendingFrom) {
          setPendingFrom({ x: drawing.from.x, y: drawing.from.y, tokenId: drawing.from.tokenId });
        } else if (drawing.from.tokenId === pendingFrom.tokenId) {
          setPendingFrom(null); // tocou no mesmo outra vez — cancela a escolha
        } else {
          addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
          setPendingFrom(null);
        }
      } else if (pendingFrom) {
        // Segundo toque em campo vazio (ex: lançamento para o cesto, corte
        // para espaço livre) — completa a seta na mesma, sem precisar de jogador de destino.
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
    <Modal onClose={onClose} title="Diagrama do exercício" wide>
      <div className="flex flex-wrap items-center gap-2 mb-3">
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

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-[#8A93A3] mr-1">Modo:</span>
        <button onClick={() => changeMode("mover")} className={`text-xs px-2.5 py-1 rounded ${mode === "mover" ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
          Mover
        </button>
        {ARROW_TYPES.map((a) => (
          <button key={a.id} onClick={() => changeMode(a.id)} title={a.desc} className={`text-xs px-2.5 py-1 rounded ${mode === a.id ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}>
            {a.label}
          </button>
        ))}
        {mode !== "mover" && (
          <span className="text-[11px] text-[#8A93A3] ml-1">
            {pendingFrom ? (
              <>Agora toca no jogador (ou ponto) de destino · ou toca outra vez no mesmo para cancelar</>
            ) : (
              <>
                Arrasta para desenhar, ou toca no jogador de partida e depois no de destino · segura <b className="text-[#F2EDE3]">Shift</b> ao arrastar para linha reta
                {mode === "passe" && <> · <b className="text-[#F2EDE3]">Passe</b> não desloca o jogador, só a bola (sai sempre dela, mesmo tocando no jogador que a tem) — usa Corte para o movimento do passador</>}
                {mode === "lancamento" && <> · <b className="text-[#F2EDE3]">Lançamento</b> desloca só a bola, terminando no alvo (ex: o cesto) — sai sempre da bola, mesmo tocando no jogador que a tem</>}
                {mode === "bloqueio" && <> · o traço fica orientado na direção que arrastares, e ao reproduzir o jogador desloca-se até ao fim da linha e para lá</>}
                {mode === "handoff" && <> · <b className="text-[#F2EDE3]">Hand-off</b> desloca a jogadora com bola até à companheira — a bola fica com quem recebe</>}
                {CURVABLE_TYPES.has(mode) && <> · depois de desenhada, seleciona-a em <b className="text-[#F2EDE3]">Mover</b> e arrasta o ponto do meio para curvar</>}
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <div
          ref={wrapRef}
          className="bg-[#0F1319] rounded-lg overflow-hidden touch-none"
          style={{ aspectRatio: `${vb.w} / ${vb.h}`, maxHeight: diagram.court === "campo" ? "70vh" : "50vh", maxWidth: "100%" }}
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
              const isPendingOrigin = pendingFrom && pendingFrom.tokenId === t.id;
              return <TokenShape key={t.id} token={pos} selected={selectedId === t.id || isPendingOrigin} onMouseDown={(e) => startFromToken(e, t.id)} />;
            })}
          </svg>
        </div>
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

export { DiagramEditor };

