import { Upload, Plus, ArrowRightLeft, Printer, Pencil, Trash2 } from "lucide-react";
import { countTreinosRealizados, calcPresenca } from "../../utils";
import { printPlayer } from "../../print";
import { EmptyState } from "../common/Modal";

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

export { PlayersView };

