// Edição de uma jogada diretamente no campo da vista 2D (madeira, vista de
// cima). Mesmas regras do DiagramEditor da app — arrastar fichas, desenhar
// setas a partir de uma jogadora (ou tocar na de partida e depois na de
// destino), curvar setas pela pega do meio, desfazer/refazer — mas sobre a
// sequência inteira de passos, com o motor 3D a fazer o desenho.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { HALF_VB, FULL_VB } from "../../../data";
import { uid, distPt, emptyDiagram, defaultControlPoint, resolveFinalDiagram } from "../../../utils";

const CURVABLE_TYPES = new Set(["passe", "corte", "lancamento", "drible", "handoff"]);
const SNAP_DIST = 14;
const DRAWING_ID = "__a_desenhar";

function historyReducer(state, action) {
  const current = state.history[state.index];
  const apply = (u) => (typeof u === "function" ? u(current) : u);
  switch (action.type) {
    case "commit": {
      const truncated = state.history.slice(0, state.index + 1);
      return { history: [...truncated, apply(action.updater)], index: truncated.length };
    }
    case "replaceCurrent": {
      const history = state.history.slice();
      history[state.index] = apply(action.updater);
      return { ...state, history };
    }
    case "undo":
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case "redo":
      return state.index < state.history.length - 1 ? { ...state, index: state.index + 1 } : state;
    default:
      return state;
  }
}

function quad(a, t) {
  const c = a.control || defaultControlPoint(a.type, a.from, a.to);
  const mt = 1 - t;
  return { x: mt * mt * a.from.x + 2 * mt * t * c.x + t * t * a.to.x, y: mt * mt * a.from.y + 2 * mt * t * c.y + t * t * a.to.y };
}

function distToArrow(a, pt) {
  if (a.at) return distPt(a.at, pt);
  if (!a.from || !a.to) return Infinity;
  let best = Infinity;
  for (let i = 0; i <= 24; i++) best = Math.min(best, distPt(quad(a, i / 24), pt));
  return best;
}

function snapAngle(from, raw) {
  const dist = Math.hypot(raw.x - from.x, raw.y - from.y);
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(raw.y - from.y, raw.x - from.x) / step) * step;
  return { x: from.x + dist * Math.cos(angle), y: from.y + dist * Math.sin(angle) };
}

/**
 * @param initial  sequência inicial (array de diagramas)
 * @param onChange chamado com a sequência nova a cada alteração
 * @param sceneRef ref para o Court3DScene
 * @param stepIndex passo atualmente mostrado na cena
 */
function usePlayEditor({ initial, onChange, sceneRef, stepIndex, editable, enabled }) {
  const [hist, dispatch] = useReducer(historyReducer, null, () => ({
    history: [initial && initial.length ? initial : [emptyDiagram()]],
    index: 0,
  }));
  const steps = hist.history[hist.index];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const court = steps[0].court === "campo" ? "campo" : "meio";
  const vb = court === "campo" ? FULL_VB : HALF_VB;

  const [mode, setModeState] = useState("mover");
  const [selectedId, setSelectedId] = useState(null);
  const [pendingFrom, setPendingFrom] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const dragRef = useRef(null); // {kind: 'token'|'control', id}

  const commit = useCallback((u) => dispatch({ type: "commit", updater: u }), []);
  const replaceCurrent = useCallback((u) => dispatch({ type: "replaceCurrent", updater: u }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  // Avisa o "dono" da jogada sempre que a sequência muda (não na montagem).
  const firstRender = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChangeRef.current?.(steps);
  }, [steps]);

  const idx = Math.min(stepIndex, steps.length - 1);
  const updateStep = (fn) => (list) => list.map((d, i) => (i === idx ? fn(d) : d));

  // O que a cena desenha: a sequência + a seta a meio de ser desenhada.
  const wantStep = useRef(null); // passo a mostrar depois de criar/apagar passos
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !editable) return;
    const target = wantStep.current ?? idx;
    wantStep.current = null;
    const shown = drawing
      ? steps.map((d, i) =>
          i === idx ? { ...d, arrows: [...d.arrows, { id: DRAWING_ID, type: drawing.type, from: drawing.from, to: drawing.to, tokenId: null }] } : d
        )
      : steps;
    scene.setSequence(shown, { keep: true, stepIndex: target });
  }, [steps, drawing, idx, sceneRef, editable]);

  const selectedArrow = step.arrows.find((a) => a.id === selectedId);
  const handle =
    enabled && mode === "mover" && selectedArrow && CURVABLE_TYPES.has(selectedArrow.type)
      ? selectedArrow.control || defaultControlPoint(selectedArrow.type, selectedArrow.from, selectedArrow.to)
      : null;

  useEffect(() => {
    sceneRef.current?.setEditOverlay(
      enabled ? { selectedId: drawing ? null : selectedId, pendingId: pendingFrom?.tokenId || null, handle } : {}
    );
  }, [enabled, selectedId, pendingFrom, handle, drawing, sceneRef]);

  const nearestToken = (pt) => {
    let best = null;
    let bestD = SNAP_DIST;
    step.tokens.forEach((t) => {
      const d = distPt(t, pt) - (t.type === "ball" ? 4 : 0); // bola é pequena: dá-lhe prioridade
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    });
    return best;
  };

  const addArrow = (type, from, to, tokenId) =>
    commit(
      updateStep((d) => ({
        ...d,
        arrows: [
          ...d.arrows,
          { id: uid(), type, from, to, control: CURVABLE_TYPES.has(type) ? defaultControlPoint(type, from, to) : undefined, tokenId: tokenId || null },
        ],
      }))
    );

  const handler = (ev) => {
    const scene = sceneRef.current;
    if (ev.phase === "down" && scene && (scene.playing || scene.t > 0)) scene.goToStep(idx);
    const pt = { x: ev.x, y: ev.y };

    if (ev.phase === "cancel") {
      dragRef.current = null;
      setDrawing(null);
      return;
    }

    if (ev.phase === "down") {
      if (mode === "mover") {
        if (handle && distPt(handle, pt) < 10) {
          commit((l) => l);
          dragRef.current = { kind: "control", id: selectedId };
          return;
        }
        const tk = nearestToken(pt);
        if (tk) {
          commit((l) => l);
          dragRef.current = { kind: "token", id: tk.id, dx: tk.x - pt.x, dy: tk.y - pt.y };
          setSelectedId(tk.id);
          return;
        }
        const arrow = step.arrows.reduce((best, a) => {
          const d = distToArrow(a, pt);
          return d < 9 && (!best || d < best.d) ? { a, d } : best;
        }, null);
        setSelectedId(arrow ? arrow.a.id : null);
        return;
      }
      const near = nearestToken(pt);
      const from = near ? { x: near.x, y: near.y, tokenId: near.id } : { ...pt, tokenId: null };
      setDrawing({ type: mode, from, to: { x: from.x, y: from.y, tokenId: null } });
      return;
    }

    if (ev.phase === "move") {
      const drag = dragRef.current;
      if (drag?.kind === "token") {
        const x = Math.max(4, Math.min(vb.w - 4, pt.x + drag.dx));
        const y = Math.max(4, Math.min(vb.h - 4, pt.y + drag.dy));
        replaceCurrent(updateStep((d) => ({ ...d, tokens: d.tokens.map((t) => (t.id === drag.id ? { ...t, x, y } : t)) })));
      } else if (drag?.kind === "control") {
        replaceCurrent(updateStep((d) => ({ ...d, arrows: d.arrows.map((a) => (a.id === drag.id ? { ...a, control: pt } : a)) })));
      } else if (drawing) {
        const near = nearestToken(pt);
        let to = near && near.id !== drawing.from.tokenId ? { x: near.x, y: near.y } : pt;
        if (!near && ev.shiftKey) to = snapAngle(drawing.from, pt);
        setDrawing({ ...drawing, to: { ...to, tokenId: near ? near.id : null } });
      }
      return;
    }

    if (ev.phase === "up") {
      if (dragRef.current) {
        dragRef.current = null;
        return;
      }
      if (!drawing) return;
      const isTiny = distPt(drawing.from, drawing.to) < 6;
      if (!isTiny) {
        addArrow(drawing.type, { x: drawing.from.x, y: drawing.from.y }, { x: drawing.to.x, y: drawing.to.y }, drawing.from.tokenId || drawing.to.tokenId);
        setPendingFrom(null);
      } else if (drawing.from.tokenId) {
        // Toque sem arrastar: escolhe a jogadora de partida; o toque seguinte completa a seta.
        if (!pendingFrom) setPendingFrom(drawing.from);
        else if (pendingFrom.tokenId === drawing.from.tokenId) setPendingFrom(null);
        else {
          addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
          setPendingFrom(null);
        }
      } else if (pendingFrom) {
        addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
        setPendingFrom(null);
      }
      setDrawing(null);
    }
  };

  const hover = (pt) => {
    if (mode !== "mover") return "crosshair";
    if (handle && distPt(handle, pt) < 10) return "grab";
    return nearestToken(pt) ? "grab" : "default";
  };

  // Liga o editor à cena só quando a edição está ativa.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setEditHandler(enabled ? (ev) => handlerRef.current(ev) : null, enabled ? (pt) => hoverRef.current(pt) : null);
    return () => scene.setEditHandler(null);
  }, [enabled, sceneRef]);

  /* ------------------------------ ações ------------------------------ */

  const setMode = (m) => {
    setModeState(m);
    setPendingFrom(null);
    setDrawing(null);
  };

  // Nova ficha num sítio livre perto do centro (em espiral), para não ficar
  // empilhada em cima das outras.
  const freeSpot = (pref) => {
    for (let r = 0; r < 160; r += 6) {
      for (let k = 0; k < Math.max(1, r / 3); k++) {
        const a = (k / Math.max(1, r / 3)) * Math.PI * 2;
        const p = { x: pref.x + Math.cos(a) * r, y: pref.y + Math.sin(a) * r };
        if (p.x < 20 || p.x > vb.w - 20 || p.y < 20 || p.y > vb.h - 20) continue;
        if (step.tokens.every((t) => distPt(t, p) > 30)) return p;
      }
    }
    return pref;
  };

  const nextNumber = (type) => {
    const used = step.tokens.filter((t) => t.type === type).map((t) => Number(t.number));
    for (let i = 1; i <= 9; i++) if (!used.includes(i)) return i;
    return used.length + 1;
  };

  const addToken = (type) => {
    if (type === "ball" && step.tokens.some((t) => t.type === "ball")) return;
    let pref = { x: vb.w / 2, y: court === "campo" ? vb.h * 0.7 : vb.h * 0.45 };
    if (type === "ball") {
      const holder = step.tokens.find((t) => t.type === "offense");
      if (holder) pref = { x: holder.x + 10, y: holder.y - 8 };
    }
    const p = type === "ball" && step.tokens.some((t) => t.type === "offense") ? pref : freeSpot(pref);
    const token = { id: uid(), type, number: type === "offense" || type === "defense" ? nextNumber(type) : "", x: p.x, y: p.y };
    // Fichas novas entram em todos os passos a partir deste, para a
    // jogadora não desaparecer no passo seguinte.
    commit((list) => list.map((d, i) => (i >= idx ? { ...d, tokens: [...d.tokens, { ...token }] } : d)));
    setSelectedId(token.id);
    setModeState("mover");
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commit(updateStep((d) => ({ ...d, tokens: d.tokens.filter((t) => t.id !== selectedId), arrows: d.arrows.filter((a) => a.id !== selectedId && a.tokenId !== selectedId) })));
    setSelectedId(null);
  };

  const setCourt = (c) => commit((list) => list.map((d) => ({ ...d, court: c })));

  // Passo novo a seguir ao atual, com as fichas nas posições finais dele.
  const addStep = () => {
    commit((list) => [...list.slice(0, idx + 1), resolveFinalDiagram(list[idx]), ...list.slice(idx + 1)]);
    wantStep.current = idx + 1;
    setSelectedId(null);
  };

  const duplicateStep = () => {
    commit((list) => [...list.slice(0, idx + 1), { court: list[idx].court, tokens: list[idx].tokens.map((t) => ({ ...t })), arrows: list[idx].arrows.map((a) => ({ ...a, id: uid() })) }, ...list.slice(idx + 1)]);
    wantStep.current = idx + 1;
  };

  const deleteStep = () => {
    commit((list) => (list.length > 1 ? list.filter((_, i) => i !== idx) : [{ ...emptyDiagram(list[0].court) }]));
    setSelectedId(null);
    wantStep.current = Math.max(0, idx - 1);
  };

  return {
    steps,
    court,
    mode,
    setMode,
    selectedId,
    pendingFrom,
    addToken,
    deleteSelected,
    setCourt,
    addStep,
    duplicateStep,
    deleteStep,
    undo,
    redo,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.history.length - 1,
    hasBall: step.tokens.some((t) => t.type === "ball"),
  };
}

export { usePlayEditor };
