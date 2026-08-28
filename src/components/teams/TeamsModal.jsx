import { useState } from "react";
import { Loader2, Trophy, Pencil, Trash2, CheckCircle2, Plus } from "lucide-react";
import { resizeImageFile, nextTemporadaLabel } from "../../utils";
import { inputCls } from "../../ui";
import { Modal } from "../common/Modal";

function TeamsModal({ teams, players, sessions, clubLogo, onSaveLogo, onClose, onAdd, onRename, onDelete, onFecharTemporada }) {
  const [novoNome, setNovoNome] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingNome, setEditingNome] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [closingSeasonId, setClosingSeasonId] = useState(null);
  const [novaTemporada, setNovaTemporada] = useState("");

  const countsFor = (teamId) => ({
    jogadores: players.filter((p) => p.equipaId === teamId).length,
    registos: sessions.filter((s) => s.equipaId === teamId).length,
  });

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditingNome(t.nome);
  };
  const saveEdit = () => {
    if (editingNome.trim()) onRename(editingId, editingNome.trim());
    setEditingId(null);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setLogoLoading(true);
    setLogoError(null);
    try {
      const dataUrl = await resizeImageFile(file, 240, 0.9);
      onSaveLogo(dataUrl);
    } catch (err) {
      setLogoError(err.message || "Não foi possível carregar o logotipo.");
    } finally {
      setLogoLoading(false);
    }
  };

  const startCloseSeason = (t) => {
    setClosingSeasonId(t.id);
    setNovaTemporada(nextTemporadaLabel(t.temporadaAtual));
  };
  const confirmCloseSeason = (teamId) => {
    if (novaTemporada.trim()) onFecharTemporada(teamId, novaTemporada.trim());
    setClosingSeasonId(null);
  };

  return (
    <Modal onClose={onClose} title="Gerir equipas">
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-[#2E3644]">
        <div style={{ width: 64, height: 64 }} className="rounded-lg overflow-hidden bg-[#14181F] border border-[#2E3644] flex items-center justify-center shrink-0">
          {logoLoading ? (
            <Loader2 size={18} className="animate-spin text-[#5A6272]" />
          ) : clubLogo ? (
            <img src={clubLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <Trophy size={22} className="text-[#5A6272]" />
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-1.5" style={{ fontFamily: "'Oswald', sans-serif" }}>Logotipo do clube</div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs px-3 py-2 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]">
              {clubLogo ? "Alterar" : "Adicionar logotipo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            {clubLogo && (
              <button type="button" onClick={() => onSaveLogo("")} className="text-xs text-[#D64545] hover:text-[#F2EDE3] px-2">
                Remover
              </button>
            )}
          </div>
          {logoError && <div className="text-[11px] text-[#D64545] mt-1">{logoError}</div>}
          <div className="text-[11px] text-[#5A6272] mt-1">Aparece em todos os documentos descarregados/impressos.</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {teams.map((t) => {
          const c = countsFor(t.id);
          return (
            <div key={t.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
              <div className="flex items-center gap-2">
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editingNome}
                    onChange={(e) => setEditingNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className={inputCls + " flex-1"}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.nome}</div>
                    <div className="text-[11px] text-[#8A93A3]">
                      {c.jogadores} jogador{c.jogadores === 1 ? "" : "es"} · {c.registos} registo{c.registos === 1 ? "" : "s"}
                      {t.temporadaAtual && <> · Época atual: <b className="text-[#F2EDE3]">{t.temporadaAtual}</b></>}
                    </div>
                  </div>
                )}
                <div className="flex gap-1 shrink-0">
                  {editingId === t.id ? (
                    <button onClick={saveEdit} className="text-xs px-2.5 py-1.5 rounded bg-[#EA5B13] text-[#14181F] font-medium">Guardar</button>
                  ) : (
                    <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
                      <Pencil size={14} />
                    </button>
                  )}
                  {confirmingDeleteId === t.id ? (
                    <button
                      onClick={() => { onDelete(t.id); setConfirmingDeleteId(null); }}
                      className="text-xs px-2.5 py-1.5 rounded bg-[#D64545] text-[#14181F] font-medium"
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button onClick={() => setConfirmingDeleteId(t.id)} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {editingId !== t.id && (
                closingSeasonId === t.id ? (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2E3644]">
                    <span className="text-[11px] text-[#8A93A3] shrink-0">Nova época:</span>
                    <input
                      autoFocus
                      value={novaTemporada}
                      onChange={(e) => setNovaTemporada(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmCloseSeason(t.id)}
                      className={inputCls + " flex-1"}
                      placeholder="Ex: 2026/2027"
                    />
                    <button onClick={() => confirmCloseSeason(t.id)} className="text-xs px-2.5 py-1.5 rounded bg-[#EA5B13] text-[#14181F] font-medium shrink-0">Confirmar</button>
                    <button onClick={() => setClosingSeasonId(null)} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3] shrink-0">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startCloseSeason(t)}
                    className="mt-2 pt-2 border-t border-[#2E3644] w-full text-left text-[11px] text-[#EA5B13] hover:text-[#FF6B1A] flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Fechar época "{t.temporadaAtual}" e começar uma nova
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {confirmingDeleteId && (
        <div className="text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 mb-4">
          Apagar uma equipa remove também os seus jogadores e treinos/jogos. A biblioteca de exercícios não é afetada. Clica "Confirmar" outra vez para prosseguir, ou muda de ideias clicando fora.
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim()) { onAdd(novoNome); setNovoNome(""); } }}
          className={inputCls + " flex-1"}
          placeholder="Nome da nova equipa"
        />
        <button
          onClick={() => { if (novoNome.trim()) { onAdd(novoNome); setNovoNome(""); } }}
          disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-40 text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2"
        >
          <Plus size={16} /> Criar
        </button>
      </div>

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

export { TeamsModal };

