import { useState, useRef } from "react";
import { Trash2, Play, RotateCcw } from "lucide-react";
import { HALF_VB, FULL_VB, ARROW_TYPES } from "../../data";
import { uid, distPt, emptyDiagram, computeAnimatedPositions } from "../../utils";
import { inputCls } from "../../ui";
import { Modal, ModalActions } from "../common/Modal";
import { CourtBackground, TokenShape, ArrowShape } from "./CourtPrimitives";

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

export { DiagramEditor };

