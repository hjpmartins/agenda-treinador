import { useEffect, useRef, useState } from "react";
import { X, Undo2, Plus, Trash2 } from "lucide-react";
import { LIVE_SHOT_TYPES, LIVE_STAT_BUTTONS } from "../../data";
import { formatDateFull, shortName } from "../../utils";
import { EmptyState } from "../common/Modal";

// Chave "fantasma" dentro de `stats` (que normalmente é indexado por id de
// jogadora) para guardar os pontos do adversário — nunca colide com um id
// real e é ignorada por todo o código que lê estatísticas por jogadora.
const OPPONENT_MARKER_ID = "_adversario";

function LiveStatsView({ jogo, players, onClose, onSave, onAutoSave }) {
  const [stats, setStats] = useState(jogo.estatisticas || {});
  const [history, setHistory] = useState([]); // pilha de { playerId, deltas: [{ key, delta }] } para desfazer
  const [onCourtIds, setOnCourtIds] = useState([]); // até 5 ids — quem está em campo agora
  const [selectedId, setSelectedId] = useState(null); // quem está selecionada para receber a próxima estatística

  // deltas: um ou mais { key, delta } aplicados de uma vez (ex: lançamento
  // convertido soma ao contador do tipo de lançamento E aos pontos).
  const bump = (playerId, deltas) => {
    setStats((prev) => {
      const playerStats = { ...(prev[playerId] || {}) };
      deltas.forEach(({ key, delta }) => {
        playerStats[key] = (Number(playerStats[key]) || 0) + delta;
      });
      return { ...prev, [playerId]: playerStats };
    });
    setHistory((prev) => [...prev, { playerId, deltas }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setStats((prev) => {
      const playerStats = { ...(prev[last.playerId] || {}) };
      last.deltas.forEach(({ key, delta }) => {
        playerStats[key] = (Number(playerStats[key]) || 0) - delta;
      });
      return { ...prev, [last.playerId]: playerStats };
    });
    setHistory((prev) => prev.slice(0, -1));
  };

  const setMinutos = (playerId, value) => {
    setStats((prev) => ({ ...prev, [playerId]: { ...(prev[playerId] || {}), minutos: value } }));
  };

  // Limpa todas as estatísticas registadas (jogadoras + marcador) para
  // recomeçar o registo do zero — o jogo em si mantém-se, só isto é apagado.
  const clearStats = () => {
    if (Object.keys(stats).length === 0) return;
    const ok = window.confirm(
      "Isto apaga todas as estatísticas já registadas neste jogo (jogadoras e marcador). O jogo não é apagado. Continuar?"
    );
    if (!ok) return;
    setStats({});
    setHistory([]);
  };

  const placarNos = (players || []).reduce((sum, p) => sum + (Number(stats[p.id]?.pontos) || 0), 0);
  const placarAdversario = Number(stats[OPPONENT_MARKER_ID]?.pontos) || 0;

  const finish = () => {
    // Enquanto o marcador tiver sido usado, o resultado do jogo acompanha-o
    // sempre que se grava — incluindo ao continuar o registo depois do
    // intervalo, para não ficar preso no valor que tinha ao intervalo.
    const resultado = placarNos > 0 || placarAdversario > 0 ? `${placarNos} - ${placarAdversario}` : undefined;
    onSave(stats, resultado);
  };

  // Gravação automática em segundo plano: sempre que os dados mudam, grava
  // (com um pequeno atraso) para não perder nada se o ecrã fechar sem se
  // tocar em "Concluir" (ex: gesto de arrastar para trás no telemóvel).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!onAutoSave) return;
    const timer = setTimeout(() => onAutoSave(stats), 1000);
    return () => clearTimeout(timer);
  }, [stats, onAutoSave]);

  // No telemóvel, o gesto de arrastar o dedo para trás normalmente fecha a
  // página inteira (não há navegação por rotas nesta app), o que fazia este
  // ecrã "desaparecer" e perder tudo o que ainda não tinha sido gravado.
  // Ao criar uma entrada extra no histórico, esse gesto passa a disparar
  // "popstate" em vez de sair da app — apanhamo-lo e tratamo-lo como um
  // "Concluir" normal (grava e fecha).
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    window.history.pushState({ liveStatsGuard: true }, "");
    let backTriggered = false;
    const handlePopState = () => {
      backTriggered = true;
      finishRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!backTriggered) window.history.back();
    };
  }, []);

  // Aviso extra caso se tente fechar o separador ou recarregar a página
  // enquanto o registo ao vivo está aberto.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const addToCourt = (id) => {
    if (onCourtIds.includes(id) || onCourtIds.length >= 5) return;
    setOnCourtIds((prev) => [...prev, id]);
    setSelectedId(id);
  };
  const removeFromCourt = (id) => {
    setOnCourtIds((prev) => prev.filter((x) => x !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };
  const substitute = (benchId, courtId) => {
    setOnCourtIds((prev) => prev.map((id) => (id === courtId ? benchId : id)));
    setSelectedId((prev) => (prev === courtId ? benchId : prev));
  };

  // Arrastar uma jogadora do banco para cima de uma que está em campo troca
  // as duas (substituição num gesto só); arrastar para uma vaga vazia só
  // adiciona. Usa Pointer Events (em vez da API de Drag and Drop nativa,
  // que não funciona bem em ecrãs táteis) para resultar tanto em tablet
  // como em computador. Um toque simples (sem arrastar) continua a só
  // adicionar à vaga seguinte, como antes.
  const dragGhostRef = useRef(null);
  const dragInfoRef = useRef(null); // { playerId, startX, startY, dragging }
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null); // id em campo, "EMPTY", ou null

  const moveGhost = (x, y) => {
    if (dragGhostRef.current) {
      dragGhostRef.current.style.left = `${x}px`;
      dragGhostRef.current.style.top = `${y}px`;
    }
  };

  const endDrag = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    dragInfoRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const onPointerMove = (e) => {
    const info = dragInfoRef.current;
    if (!info) return;
    if (!info.dragging && Math.hypot(e.clientX - info.startX, e.clientY - info.startY) > 6) {
      info.dragging = true;
      setDraggingId(info.playerId);
    }
    if (info.dragging) {
      moveGhost(e.clientX, e.clientY);
      const slotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-court-slot]");
      setDropTargetId(slotEl ? slotEl.dataset.courtSlot : null);
    }
  };

  const onPointerUp = (e) => {
    const info = dragInfoRef.current;
    if (info?.dragging) {
      const slotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-court-slot]");
      const targetId = slotEl?.dataset.courtSlot;
      if (targetId === "EMPTY") addToCourt(info.playerId);
      else if (targetId && targetId !== info.playerId) substitute(info.playerId, targetId);
    } else if (info) {
      addToCourt(info.playerId);
    }
    endDrag();
  };

  const startDrag = (e, playerId) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragInfoRef.current = { playerId, startX: e.clientX, startY: e.clientY, dragging: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const byId = Object.fromEntries((players || []).map((p) => [p.id, p]));
  const onCourt = onCourtIds.map((id) => byId[id]).filter(Boolean);
  const bench = (players || []).filter((p) => !onCourtIds.includes(p.id));
  const selectedPlayer = selectedId ? byId[selectedId] : null;
  const s = selectedPlayer ? stats[selectedPlayer.id] || {} : {};

  return (
    <div className="fixed inset-0 z-50 bg-[#14181F] flex flex-col">
      <div className="shrink-0 bg-[#14181F] border-b border-[#2E3644] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-lg font-semibold uppercase tracking-wide truncate">
            Estatísticas ao vivo — vs {jogo.adversario || "Adversário"}
          </div>
          <div className="text-xs text-[#8A93A3]">{jogo.date ? formatDateFull(jogo.date) : ""}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={clearStats}
            disabled={Object.keys(stats).length === 0}
            title="Limpar todas as estatísticas registadas (não apaga o jogo)"
            className="p-2 rounded hover:bg-[#D64545]/20 disabled:opacity-40 disabled:hover:bg-transparent text-[#8A93A3] hover:text-[#D64545] transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-40 disabled:hover:border-[#2E3644] text-[#F2EDE3] text-sm font-medium rounded-md px-3 py-2 transition-colors"
          >
            <Undo2 size={15} /> Desfazer
          </button>
          <button onClick={finish} className="bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-4 py-2 transition-colors">
            Concluir
          </button>
          <button onClick={finish} title="Fechar (guarda o que já registaste)" className="p-2 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Em ecrãs largos (tablet em modo paisagem) usa duas colunas lado a
          lado, cada uma com o seu próprio scroll, para dar para ver tudo —
          marcador, plantel e registo da jogadora — sem andar com a página
          para cima e para baixo durante o jogo. */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="p-4 sm:p-6 max-w-2xl mx-auto lg:max-w-none lg:h-full lg:grid lg:grid-cols-[400px_1fr] lg:gap-5">
          <div className="lg:h-full lg:overflow-y-auto lg:pr-4 lg:border-r lg:border-[#2E3644]">
            <div className="mb-4 bg-[#1E242E] border border-[#2E3644] rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 text-center">
                <div className="text-[10px] uppercase tracking-wide text-[#8A93A3] mb-1 truncate">Nós</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-3xl font-bold text-[#F2EDE3] leading-none mb-1.5">
                  {placarNos}
                </div>
                <div className="text-[9px] text-[#5A6272] uppercase tracking-wide py-1">Soma das jogadoras</div>
              </div>
              <div className="text-[#5A6272] text-sm font-bold shrink-0">—</div>
              <div className="flex-1 text-center">
                <div className="text-[10px] uppercase tracking-wide text-[#8A93A3] mb-1 truncate">{jogo.adversario || "Adversário"}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-3xl font-bold text-[#F2EDE3] leading-none mb-1.5">
                  {placarAdversario}
                </div>
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => bump(OPPONENT_MARKER_ID, [{ key: "pontos", delta: n }])}
                      className="bg-[#14181F] hover:bg-[#D64545]/20 border border-[#D64545]/40 text-[#D64545] text-xs font-medium rounded px-2 py-1 transition-colors"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Banco</div>
              {bench.length === 0 ? (
                <div className="text-xs text-[#5A6272]">Todas as jogadoras estão em campo.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {bench.map((p) => (
                    <button
                      key={p.id}
                      onPointerDown={(e) => startDrag(e, p.id)}
                      title="Toca para pôr em campo, ou arrasta para cima de uma jogadora para a substituir"
                      style={{ touchAction: "none" }}
                      className={`flex items-center gap-1 bg-[#1E242E] border border-[#2E3644] hover:border-[#5A6272] text-[#F2EDE3] rounded-md px-2 py-1.5 text-xs transition-colors select-none cursor-grab active:cursor-grabbing ${
                        draggingId === p.id ? "opacity-30" : onCourt.length >= 5 ? "opacity-70" : ""
                      }`}
                    >
                      <Plus size={11} /> {p.numero ? `${p.numero} · ` : ""}{shortName(p.nome)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4 lg:mb-0">
              <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
                Em campo ({onCourt.length}/5)
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const p = onCourt[i];
                  if (!p) {
                    return (
                      <div
                        key={i}
                        data-court-slot="EMPTY"
                        className={`border border-dashed rounded-lg h-16 flex items-center justify-center text-[10px] uppercase tracking-wide transition-colors ${
                          dropTargetId === "EMPTY" ? "border-[#EA5B13] text-[#EA5B13] bg-[#EA5B13]/10" : "border-[#2E3644] text-[#5A6272]"
                        }`}
                      >
                        Vazio
                      </div>
                    );
                  }
                  const active = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      data-court-slot={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`relative rounded-lg h-16 flex flex-col items-center justify-center gap-0.5 border-2 transition-colors ${
                        dropTargetId === p.id
                          ? "border-[#EA5B13] bg-[#EA5B13]/20"
                          : active
                          ? "border-[#EA5B13] bg-[#EA5B13]/10"
                          : "border-[#2E3644] bg-[#1E242E] hover:border-[#5A6272]"
                      }`}
                    >
                      <span style={{ fontFamily: "'Oswald', sans-serif" }} className="text-lg font-bold leading-none">{p.numero || "—"}</span>
                      <span className="text-[9px] text-[#8A93A3] truncate max-w-full px-1">{shortName(p.nome)}</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); removeFromCourt(p.id); }}
                        title="Tirar de campo"
                        className="absolute -top-1.5 -right-1.5 bg-[#1E242E] border border-[#2E3644] rounded-full p-0.5 text-[#8A93A3] hover:text-[#D64545] cursor-pointer"
                      >
                        <X size={10} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 lg:mt-0 lg:h-full lg:overflow-y-auto">
            {!selectedPlayer ? (
              <EmptyState text="Toca numa jogadora em campo para começar a registar estatísticas." />
            ) : (
              <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 lg:p-5">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide truncate lg:text-lg">
                    {selectedPlayer.numero ? `${selectedPlayer.numero} · ` : ""}{selectedPlayer.nome}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-2xl lg:text-3xl font-bold text-[#EA5B13] shrink-0">
                    {s.pontos || 0}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-[#8A93A3]">Min. jogados</span>
                  <input
                    type="number"
                    min="0"
                    value={s.minutos || ""}
                    onChange={(e) => setMinutos(selectedPlayer.id, e.target.value)}
                    placeholder="0"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", width: 44 }}
                    className="bg-[#14181F] border border-[#2E3644] rounded px-1.5 py-0.5 text-xs text-[#F2EDE3] text-center"
                  />
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs lg:text-sm text-[#8A93A3] mb-3">
                  {LIVE_SHOT_TYPES.map((t) => {
                    const made = Number(s[t.madeKey]) || 0;
                    const missed = Number(s[t.missKey]) || 0;
                    return `${t.label} ${made}/${made + missed}`;
                  }).join("  ·  ")}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  {LIVE_SHOT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => bump(selectedPlayer.id, [{ key: t.madeKey, delta: 1 }, { key: "pontos", delta: t.pontos }])}
                      className="bg-[#14181F] hover:bg-[#4C9A6A]/20 border border-[#4C9A6A]/40 text-[#4C9A6A] text-sm lg:text-base font-medium rounded-md py-3 lg:py-5 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {LIVE_SHOT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => bump(selectedPlayer.id, [{ key: t.missKey, delta: 1 }])}
                      className="bg-[#14181F] hover:bg-[#D64545]/20 border border-[#D64545]/40 text-[#D64545] text-sm lg:text-base font-medium rounded-md py-3 lg:py-5 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {LIVE_STAT_BUTTONS.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => bump(selectedPlayer.id, [b])}
                      className="bg-[#14181F] hover:bg-[#2E3644] border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] text-xs lg:text-sm rounded-md py-2.5 lg:py-4 transition-colors"
                    >
                      {b.label} <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s[b.key] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {draggingId && (
        <div
          ref={dragGhostRef}
          className="fixed z-[200] pointer-events-none -translate-x-1/2 -translate-y-1/2 bg-[#EA5B13] text-[#14181F] rounded-lg px-3 py-1.5 shadow-lg text-sm font-bold flex items-center gap-1 whitespace-nowrap"
        >
          {byId[draggingId]?.numero ? `${byId[draggingId].numero} · ` : ""}{shortName(byId[draggingId]?.nome || "")}
        </div>
      )}
    </div>
  );
}

export { LiveStatsView };
