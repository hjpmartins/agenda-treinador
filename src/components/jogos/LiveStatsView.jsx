import { useState } from "react";
import { X, Undo2 } from "lucide-react";
import { LIVE_SHOT_TYPES, LIVE_STAT_BUTTONS } from "../../data";
import { formatDateFull } from "../../utils";

function LiveStatsView({ jogo, players, onClose, onSave }) {
  const [stats, setStats] = useState(jogo.estatisticas || {});
  const [history, setHistory] = useState([]); // pilha de { playerId, deltas: [{ key, delta }] } para desfazer

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

  const finish = () => onSave(stats);

  return (
    <div className="fixed inset-0 z-50 bg-[#14181F] overflow-y-auto">
      <div className="sticky top-0 z-10 bg-[#14181F] border-b border-[#2E3644] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-lg font-semibold uppercase tracking-wide truncate">
            Estatísticas ao vivo — vs {jogo.adversario || "Adversário"}
          </div>
          <div className="text-xs text-[#8A93A3]">{jogo.date ? formatDateFull(jogo.date) : ""}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {(players || []).map((p) => {
          const s = stats[p.id] || {};
          return (
            <div key={p.id} className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide text-sm truncate">
                  {p.numero ? `${p.numero} · ` : ""}{p.nome}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-lg font-bold text-[#EA5B13] shrink-0">
                  {s.pontos || 0}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] uppercase tracking-wide text-[#8A93A3]">Min. jogados</span>
                <input
                  type="number"
                  min="0"
                  value={s.minutos || ""}
                  onChange={(e) => setMinutos(p.id, e.target.value)}
                  placeholder="0"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", width: 44 }}
                  className="bg-[#14181F] border border-[#2E3644] rounded px-1.5 py-0.5 text-xs text-[#F2EDE3] text-center"
                />
              </div>

              <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] mb-2">
                {LIVE_SHOT_TYPES.map((t) => {
                  const made = Number(s[t.madeKey]) || 0;
                  const missed = Number(s[t.missKey]) || 0;
                  return `${t.label} ${made}/${made + missed}`;
                }).join("  ·  ")}
              </div>

              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {LIVE_SHOT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => bump(p.id, [{ key: t.madeKey, delta: 1 }, { key: "pontos", delta: t.pontos }])}
                    className="bg-[#14181F] hover:bg-[#4C9A6A]/20 border border-[#4C9A6A]/40 text-[#4C9A6A] text-xs font-medium rounded-md py-2 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {LIVE_SHOT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => bump(p.id, [{ key: t.missKey, delta: 1 }])}
                    className="bg-[#14181F] hover:bg-[#D64545]/20 border border-[#D64545]/40 text-[#D64545] text-xs font-medium rounded-md py-2 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {LIVE_STAT_BUTTONS.map((b, i) => (
                  <button
                    key={i}
                    onClick={() => bump(p.id, [b])}
                    className="bg-[#14181F] hover:bg-[#2E3644] border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] text-[11px] rounded-md py-1.5 transition-colors"
                  >
                    {b.label} <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s[b.key] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { LiveStatsView };
