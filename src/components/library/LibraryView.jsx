import { useState } from "react";
import { Search, Pencil, Trash2, Share2, Upload, Plus } from "lucide-react";
import { COMPONENTES, getHabilidade, habilidadeLabel } from "../../data";
import { inputCls } from "../../ui";
import { EmptyState } from "../common/Modal";
import { DiagramThumbnail } from "../diagrams/CourtPrimitives";

function LibraryView({ library, onAdd, onImportClick, onEdit, onDelete, onPublish }) {
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
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">
            Biblioteca de exercícios
          </h1>
          <div className="text-sm text-[#8A93A3] mt-0.5">
            {library.length} exercício{library.length === 1 ? "" : "s"} guardado{library.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onImportClick} className="flex items-center gap-1.5 border border-[#2E3644] hover:border-[#5A6272] text-[#F2EDE3] text-sm font-medium rounded-md px-3.5 py-2 transition-colors">
            <Upload size={16} /> Importar
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 transition-colors">
            <Plus size={16} /> Novo exercício
          </button>
        </div>
      </div>

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
                      <button onClick={() => onPublish(ex)} title="Partilhar na biblioteca pública" className="p-1 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                        <Share2 size={13} />
                      </button>
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

export { LibraryView };

