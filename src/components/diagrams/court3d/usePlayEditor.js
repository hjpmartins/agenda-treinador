// Edição de uma jogada diretamente no campo da vista 2D (madeira, vista de
// cima). Mesmas regras do DiagramEditor da app — arrastar fichas, desenhar
// setas a partir de uma jogadora (ou tocar na de partida e depois na de
// destino), curvar setas pela pega do meio, desfazer/refazer — mas sobre a
// sequência inteira de passos, com o motor 3D a fazer o desenho.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { HALF_VB, FULL_VB } from "../../../data";
import { uid, distPt, emptyDiagram, defaultControlPoint, resolveFinalDiagram, positionOnArrow, hasWaypoints} from "../../../utils";

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

// Setas que aceitam pontos de mudança de direção.
const WAYPOINT_TYPES = new Set(["drible", "corte", "bloqueio", "lancamento"]);

// Seta com o ponto de controlo por omissão preenchido (para a desenhar/medir
// tal como aparece no ecrã).
function withControl(a) {
  if (a.control || hasWaypoints(a) || !CURVABLE_TYPES.has(a.type)) return a;
  return { ...a, control: defaultControlPoint(a.type, a.from, a.to) };
}

function distToArrow(a, pt) {
  if (a.at) return distPt(a.at, pt);
  if (!a.from || !a.to) return Infinity;
  const full = withControl(a);
  let best = Infinity;
  for (let i = 0; i <= 40; i++) best = Math.min(best, distPt(positionOnArrow(full, i / 40), pt));
  return best;
}

// Bloqueio, corte, drible e lançamento têm sempre 2 pegas por onde a linha
// passa (curva em S). Setas antigas sem pontos mostram-nas a 1/3 e 2/3 do
// caminho atual; ao arrastar uma, os dois pontos ficam gravados.
function defaultWaypoints(a) {
  const full = withControl(a);
  return [positionOnArrow(full, 1 / 3), positionOnArrow(full, 2 / 3)];
}

// Pegas da seta selecionada: 2 pontos da curva em S, ou a pega única de
// curva do passe / hand-off.
function arrowHandles(a) {
  if (!a || a.at || !a.from || !a.to) return [];
  if (WAYPOINT_TYPES.has(a.type)) {
    const wps = hasWaypoints(a) ? a.waypoints : defaultWaypoints(a);
    return wps.map((w, i) => ({ kind: "wp", index: i, x: w.x, y: w.y }));
  }
  if (CURVABLE_TYPES.has(a.type)) {
    const c = a.control || defaultControlPoint(a.type, a.from, a.to);
    return [{ kind: "control", x: c.x, y: c.y }];
  }
  return [];
}

// Para onde se desloca uma ficha neste passo (fim da sua seta de corte,
// drible, bloqueio ou hand-off), ou null se fica parada.
function movementEnd(diagram, tokenId) {
  let end = null;
  diagram.arrows.forEach((a) => {
    if (a.tokenId === tokenId && a.to && a.type !== "passe" && a.type !== "lancamento") end = { x: a.to.x, y: a.to.y };
  });
  return end;
}

// Passes dirigidos a uma jogadora (targetId) apontam sempre para onde ela vai
// estar no fim do passo: o fim do seu deslocamento, ou a posição dela se não
// se mexer. Corre depois de cada alteração, por isso acompanha cortes
// desenhados antes ou depois do passe, e fichas arrastadas.
function syncPasses(list) {
  let changed = false;
  const out = list.map((d) => {
    let stepChanged = false;
    const arrows = d.arrows.map((a) => {
      if (a.type !== "passe" || !a.targetId) return a;
      const target = d.tokens.find((t) => t.id === a.targetId);
      if (!target) return a;
      const end = movementEnd(d, target.id) || { x: target.x, y: target.y };
      if (Math.abs(end.x - a.to.x) < 0.01 && Math.abs(end.y - a.to.y) < 0.01) return a;
      // A curva acompanha, se o utilizador ainda não a tiver mexido.
      const oldDefault = defaultControlPoint(a.type, a.from, a.to);
      const keepDefault = !a.control || distPt(a.control, oldDefault) < 0.5;
      stepChanged = true;
      return { ...a, to: end, control: keepDefault ? defaultControlPoint(a.type, a.from, end) : a.control };
    });
    if (!stepChanged) return d;
    changed = true;
    return { ...d, arrows };
  });
  return changed ? out : list;
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
  // Aviso curto quando uma ação é recusada (ex: passe sem bola).
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const notify = (msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const dragRef = useRef(null); // {kind: 'token'|'control', id}

  const withSync = (u) => (list) => syncPasses(typeof u === "function" ? u(list) : u);
  const commit = useCallback((u) => dispatch({ type: "commit", updater: withSync(u) }), []);
  const replaceCurrent = useCallback((u) => dispatch({ type: "replaceCurrent", updater: withSync(u) }), []);
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
  // As pegas da seta selecionada aparecem em qualquer ação (logo depois de
  // desenhar a seta, por exemplo), não só em "Mover".
  const handles = enabled && !drawing ? arrowHandles(selectedArrow) : [];
  const handlesKey = JSON.stringify(handles);

  useEffect(() => {
    sceneRef.current?.setEditOverlay(
      enabled ? { selectedId: drawing ? null : selectedId, pendingId: pendingFrom?.tokenId || null, handles: JSON.parse(handlesKey) } : {}
    );
  }, [enabled, selectedId, pendingFrom, handlesKey, drawing, sceneRef]);

  const handleAt = (pt) => {
    let best = null;
    let bestD = 10;
    handles.forEach((h) => {
      const d = distPt(h, pt);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    });
    return best;
  };

  // Lançamento: perto de um cesto (ou a apontar para o aro em 3D) encaixa no cesto.
  const snapToHoop = (ev, pt) => {
    if (ev.hoop) return { x: ev.x, y: ev.y, hoop: true };
    const rim = (ev.rims || []).find((r) => distPt(r, pt) < 30);
    return rim ? { x: rim.x, y: rim.y, hoop: true } : null;
  };

  // Recetora de um passe junto a pt: pela posição atual da jogadora ou pelo
  // sítio para onde ela se desloca neste passo. Devolve {token, end}.
  const receiverAt = (pt, ballId) => {
    let best = null;
    let bestD = SNAP_DIST + 4;
    step.tokens.forEach((t) => {
      if (t.type === "ball" || t.type === "cone" || t.id === ballId) return;
      const end = movementEnd(step, t.id) || { x: t.x, y: t.y };
      const d = Math.min(distPt(t, pt), distPt(end, pt));
      if (d < bestD) {
        best = { token: t, end };
        bestD = d;
      }
    });
    // Quem tem a bola não recebe o próprio passe.
    if (best && ballOf(best.token.id)?.id === ballId) return null;
    return best;
  };

  const ballBusy = (ballId) => step.arrows.some((a) => (a.type === "passe" || a.type === "lancamento") && a.tokenId === ballId);

  // Passe e lançamento movem a bola: se se começa na jogadora, usa a bola dela.
  const ballOf = (tokenId) => {
    const tk = step.tokens.find((t) => t.id === tokenId);
    if (!tk || tk.type === "ball") return tk || null;
    let best = null;
    let bestD = 24;
    step.tokens.forEach((b) => {
      if (b.type !== "ball") return;
      const d = distPt(b, tk);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    });
    return best;
  };

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

  const addArrow = (type, from, to, tokenId, targetId = null) => {
    if ((type === "passe" || type === "lancamento") && tokenId) {
      const ball = ballOf(tokenId);
      if (ball) {
        from = { x: ball.x, y: ball.y };
        tokenId = ball.id;
      }
    }
    const id = uid();
    // A seta nova fica selecionada, para as pegas aparecerem logo.
    setSelectedId(id);
    commit(
      updateStep((d) => ({
        ...d,
        arrows: [
          ...d.arrows,
          WAYPOINT_TYPES.has(type)
            ? { id, type, from, to, waypoints: defaultWaypoints({ type, from, to }), tokenId: tokenId || null }
            : {
                id,
                type,
                from,
                to,
                control: CURVABLE_TYPES.has(type) ? defaultControlPoint(type, from, to) : undefined,
                tokenId: tokenId || null,
                // Passe para uma jogadora: segue-a até onde ela se desloca.
                ...(type === "passe" && targetId ? { targetId } : {}),
              },
        ],
      }))
    );
  };

  const updateArrow = (id, fn, replace = false) => (replace ? replaceCurrent : commit)(updateStep((d) => ({ ...d, arrows: d.arrows.map((a) => (a.id === id ? fn(a) : a)) })));

  const handler = (ev) => {
    const scene = sceneRef.current;
    if (ev.phase === "down" && scene && (scene.playing || scene.t > 0)) scene.goToStep(idx);
    const pt = { x: ev.x, y: ev.y };

    // Em 3D, arrastar no chão vazio em "Mover" fica para a câmara (devolve
    // false); o clique simples chega depois como "tap".
    if (ev.phase === "tap") {
      const arrow = step.arrows.reduce((best, a) => {
        const d = distToArrow(a, pt);
        return d < 9 && (!best || d < best.d) ? { a, d } : best;
      }, null);
      setSelectedId(arrow ? arrow.a.id : null);
      return;
    }

    if (ev.phase === "cancel") {
      dragRef.current = null;
      setDrawing(null);
      return;
    }

    if (ev.phase === "down") {
      // Tocar numa pega (em qualquer ação) passa logo para "Mover" e arrasta-a.
      const h = handleAt(pt);
      if (h) {
        if (mode !== "mover") {
          setModeState("mover");
          setPendingFrom(null);
        }
      }
      if (h || mode === "mover") {
        if (h) {
          commit((l) => l);
          if (h.kind === "control") dragRef.current = { kind: "control", id: selectedId };
          else {
            // Seta sem pontos gravados: grava os dois de omissão antes de arrastar.
            updateArrow(selectedId, (a) => (hasWaypoints(a) ? a : { ...a, waypoints: defaultWaypoints(a), control: undefined }), true);
            dragRef.current = { kind: "wp", id: selectedId, index: h.index };
          }
          return;
        }
        const tk = nearestToken(pt);
        if (tk) {
          commit((l) => l);
          dragRef.current = { kind: "token", id: tk.id, dx: tk.x - pt.x, dy: tk.y - pt.y };
          setSelectedId(tk.id);
          return;
        }
        if (ev.view === "3d") return false;
        const arrow = step.arrows.reduce((best, a) => {
          const d = distToArrow(a, pt);
          return d < 9 && (!best || d < best.d) ? { a, d } : best;
        }, null);
        setSelectedId(arrow ? arrow.a.id : null);
        return;
      }
      const near = nearestToken(pt);
      const isBallAction = mode === "passe" || mode === "lancamento";
      // Passe e lançamento só começam em quem tem bola (ou na própria bola),
      // e cada bola só pode ter um passe/lançamento por passo.
      if (isBallAction && !pendingFrom) {
        const ball = near ? ballOf(near.id) : null;
        if (!ball) {
          notify(mode === "passe" ? "Só quem tem bola pode passar." : "Só quem tem bola pode lançar.");
          return;
        }
        if (ballBusy(ball.id)) {
          notify("Esta bola já tem um passe ou lançamento neste passo. Cria um passo novo (ou apaga a seta) para outro.");
          return;
        }
        setDrawing({ type: mode, from: { x: ball.x, y: ball.y, tokenId: ball.id }, to: { x: ball.x, y: ball.y, tokenId: null } });
        return;
      }
      // Segundo toque de um passe: aceita a recetora ou o sítio para onde ela vai.
      if (mode === "passe" && pendingFrom) {
        const rec = receiverAt(pt, pendingFrom.tokenId);
        if (rec) {
          setDrawing({ type: mode, from: { ...rec.end, tokenId: rec.token.id }, to: { ...rec.end, tokenId: null } });
          return;
        }
      }
      const hoopPt = mode === "lancamento" && pendingFrom && !near ? snapToHoop(ev, pt) : null;
      const from = near ? { x: near.x, y: near.y, tokenId: near.id } : { ...(hoopPt || pt), tokenId: null };
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
        updateArrow(drag.id, (a) => ({ ...a, control: pt }), true);
      } else if (drag?.kind === "wp") {
        updateArrow(drag.id, (a) => ({ ...a, waypoints: a.waypoints.map((w, i) => (i === drag.index ? { x: pt.x, y: pt.y } : w)) }), true);
      } else if (drawing) {
        const hoopPt = drawing.type === "lancamento" ? snapToHoop(ev, pt) : null;
        if (drawing.type === "passe") {
          const rec = receiverAt(pt, drawing.from.tokenId);
          if (rec) {
            setDrawing({ ...drawing, to: { ...rec.end, tokenId: rec.token.id } });
            return;
          }
        }
        const near = hoopPt ? null : nearestToken(pt);
        let to = hoopPt || (near && near.id !== drawing.from.tokenId ? { x: near.x, y: near.y } : pt);
        if (!near && !hoopPt && ev.shiftKey) to = snapAngle(drawing.from, pt);
        setDrawing({ ...drawing, to: { x: to.x, y: to.y, tokenId: near ? near.id : null } });
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
        addArrow(drawing.type, { x: drawing.from.x, y: drawing.from.y }, { x: drawing.to.x, y: drawing.to.y }, drawing.from.tokenId || drawing.to.tokenId, drawing.to.tokenId);
        setPendingFrom(null);
      } else if (drawing.from.tokenId) {
        // Toque sem arrastar: escolhe a jogadora de partida; o toque seguinte completa a seta.
        if (!pendingFrom) setPendingFrom(drawing.from);
        else if (pendingFrom.tokenId === drawing.from.tokenId || ballOf(drawing.from.tokenId)?.id === pendingFrom.tokenId) setPendingFrom(null);
        else {
          addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId, drawing.from.tokenId);
          setPendingFrom(null);
        }
      } else if (pendingFrom) {
        addArrow(mode, { x: pendingFrom.x, y: pendingFrom.y }, { x: drawing.from.x, y: drawing.from.y }, pendingFrom.tokenId);
        setPendingFrom(null);
      }
      setDrawing(null);
    }
  };

  const hover = (pt, view) => {
    if (handleAt(pt)) return "move";
    if (mode !== "mover") return "crosshair";
    if (nearestToken(pt)) return "move";
    return view === "3d" ? "grab" : "default";
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
    let pref = { x: vb.w / 2, y: court === "campo" ? vb.h * 0.7 : vb.h * 0.45 };
    let p = null;
    if (type === "ball") {
      // Bola nova vai para a primeira atacante que ainda não tem bola.
      const balls = step.tokens.filter((t) => t.type === "ball");
      const holder = step.tokens.find((t) => t.type === "offense" && balls.every((b) => distPt(b, t) > 24));
      if (holder) p = { x: Math.min(vb.w - 8, holder.x + 10), y: Math.max(8, holder.y - 8) };
    }
    if (!p) p = freeSpot(pref);
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
    notice,
    selectedCurve: selectedArrow && !selectedArrow.at ? (WAYPOINT_TYPES.has(selectedArrow.type) ? "s" : CURVABLE_TYPES.has(selectedArrow.type) ? "c" : null) : null,
  };
}

export { usePlayEditor };
