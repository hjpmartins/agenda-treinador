import { useState } from "react";
import { Loader2, Users, Trash2, Plus, TrendingUp } from "lucide-react";
import { POSICOES, TIPOS_TESTE, getTipoTeste } from "../../data";
import { uid, todayStr, resizeImageFile } from "../../utils";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions } from "../common/Modal";
import { EvolucaoModal } from "./Evolucao";

function PlayerModal({ initial, sessions, onClose, onSave }) {
  const [form, setForm] = useState({ lesoes: [], avaliacoes: [], testesFisicos: [], ...initial });
  const [showEvolucao, setShowEvolucao] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const lesoes = form.lesoes || [];
  const avaliacoes = form.avaliacoes || [];
  const testesFisicos = form.testesFisicos || [];

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true);
    setFotoError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      setForm((f) => ({ ...f, foto: dataUrl }));
    } catch (err) {
      setFotoError(err.message || "Não foi possível carregar a foto.");
    } finally {
      setFotoLoading(false);
    }
  };

  const addLesao = () => setForm({ ...form, lesoes: [...lesoes, { id: uid(), ano: "", descricao: "" }] });
  const updateLesao = (id, key, value) => setForm({ ...form, lesoes: lesoes.map((l) => (l.id === id ? { ...l, [key]: value } : l)) });
  const removeLesao = (id) => setForm({ ...form, lesoes: lesoes.filter((l) => l.id !== id) });

  const addAvaliacao = () => setForm({ ...form, avaliacoes: [...avaliacoes, { id: uid(), data: todayStr(), altura: "", peso: "", envergadura: "", obs: "" }] });
  const updateAvaliacao = (id, key, value) => setForm({ ...form, avaliacoes: avaliacoes.map((a) => (a.id === id ? { ...a, [key]: value } : a)) });
  const removeAvaliacao = (id) => setForm({ ...form, avaliacoes: avaliacoes.filter((a) => a.id !== id) });
  const sortedAvaliacoes = [...avaliacoes].sort((a, b) => (a.data < b.data ? 1 : -1));

  const addTeste = () => setForm({ ...form, testesFisicos: [...testesFisicos, { id: uid(), data: todayStr(), tipoId: TIPOS_TESTE[0].id, nomePersonalizado: "", unidadePersonalizada: "", valor: "", obs: "" }] });
  const updateTeste = (id, key, value) => setForm({ ...form, testesFisicos: testesFisicos.map((t) => (t.id === id ? { ...t, [key]: value } : t)) });
  const removeTeste = (id) => setForm({ ...form, testesFisicos: testesFisicos.filter((t) => t.id !== id) });
  const sortedTestes = [...testesFisicos].sort((a, b) => (a.data < b.data ? 1 : -1));

  const temEstatisticasJogo = (sessions || []).some((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[form.id || "__novo__"]);
  const temDadosEvolucao = avaliacoes.length > 0 || testesFisicos.length > 0 || temEstatisticasJogo;

  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar jogador" : "Novo jogador"} wide>
      <div className="flex items-center gap-4 mb-4">
        <div style={{ width: 72, height: 72 }} className="rounded-full overflow-hidden bg-[#14181F] border border-[#2E3644] flex items-center justify-center shrink-0">
          {fotoLoading ? (
            <Loader2 size={20} className="animate-spin text-[#5A6272]" />
          ) : form.foto ? (
            <img src={form.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Users size={26} className="text-[#5A6272]" />
          )}
        </div>
        <div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs px-3 py-2 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]">
              {form.foto ? "Alterar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            </label>
            {form.foto && (
              <button type="button" onClick={() => setForm({ ...form, foto: "" })} className="text-xs text-[#D64545] hover:text-[#F2EDE3] px-2">
                Remover
              </button>
            )}
          </div>
          {fotoError && <div className="text-[11px] text-[#D64545] mt-1">{fotoError}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2">
          <input value={form.nome} onChange={set("nome")} className={inputCls} placeholder="Nome do jogador" />
        </Field>
        <Field label="Número">
          <input value={form.numero} onChange={set("numero")} className={inputCls} placeholder="7" />
        </Field>
        <Field label="Posição">
          <select value={form.posicao} onChange={set("posicao")} className={inputCls}>
            {POSICOES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Data de nascimento">
          <input type="date" value={form.nascimento} onChange={set("nascimento")} className={inputCls} />
        </Field>
        <Field label="Épocas no clube">
          <input type="number" min="0" value={form.epocasClube} onChange={set("epocasClube")} className={inputCls} placeholder="1" />
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Contactos</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morada" className="col-span-2">
            <input value={form.morada} onChange={set("morada")} className={inputCls} placeholder="Rua, nº" />
          </Field>
          <Field label="Cidade">
            <input value={form.cidade} onChange={set("cidade")} className={inputCls} />
          </Field>
          <Field label="Profissão">
            <input value={form.profissao} onChange={set("profissao")} className={inputCls} placeholder="Estudante" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
          </Field>
          <Field label="Telemóvel">
            <input value={form.telemovel} onChange={set("telemovel")} className={inputCls} />
          </Field>
          <Field label="C.C.">
            <input value={form.cc} onChange={set("cc")} className={inputCls} />
          </Field>
          <Field label="NIF">
            <input value={form.nif} onChange={set("nif")} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Saúde</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Medicação">
            <input value={form.medicacao} onChange={set("medicacao")} className={inputCls} placeholder="Nenhuma" />
          </Field>
          <Field label="Outros desportos">
            <input value={form.outrosDesportos} onChange={set("outrosDesportos")} className={inputCls} placeholder="Não" />
          </Field>
        </div>
        <div className="mt-3">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Histórico de lesões</span>
          <div className="space-y-2">
            {lesoes.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <input value={l.ano} onChange={(e) => updateLesao(l.id, "ano", e.target.value)} className={inputCls + " w-24"} placeholder="Ano" />
                <input value={l.descricao} onChange={(e) => updateLesao(l.id, "descricao", e.target.value)} className={inputCls + " flex-1"} placeholder="Descrição da lesão" />
                <button type="button" onClick={() => removeLesao(l.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLesao}
            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
          >
            <Plus size={13} /> Adicionar lesão
          </button>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-[#8A93A3]" style={{ fontFamily: "'Oswald', sans-serif" }}>Avaliação corporal</div>
          {temDadosEvolucao && (
            <button type="button" onClick={() => setShowEvolucao(true)} className="flex items-center gap-1 text-[11px] text-[#EA5B13] hover:text-[#FF6B1A]">
              <TrendingUp size={13} /> Ver evolução
            </button>
          )}
        </div>
        <div className="space-y-2">
          {sortedAvaliacoes.map((a) => (
            <div key={a.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
              <div className="grid grid-cols-4 gap-2">
                <input type="date" value={a.data} onChange={(e) => updateAvaliacao(a.id, "data", e.target.value)} className={inputCls} />
                <input value={a.altura} onChange={(e) => updateAvaliacao(a.id, "altura", e.target.value)} className={inputCls} placeholder="Altura (m)" />
                <input value={a.peso} onChange={(e) => updateAvaliacao(a.id, "peso", e.target.value)} className={inputCls} placeholder="Peso (kg)" />
                <div className="flex gap-1">
                  <input value={a.envergadura} onChange={(e) => updateAvaliacao(a.id, "envergadura", e.target.value)} className={inputCls} placeholder="Envergadura" />
                  <button type="button" onClick={() => removeAvaliacao(a.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  value={a.obs}
                  onChange={(e) => updateAvaliacao(a.id, "obs", e.target.value)}
                  className={inputCls + " col-span-4"}
                  placeholder="Observações (opcional)"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAvaliacao}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar avaliação
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Testes físicos (velocidade, agilidade, força, resistência)</div>
        <div className="space-y-2">
          {sortedTestes.map((t) => {
            const tipo = getTipoTeste(t.tipoId);
            return (
              <div key={t.id} className="border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
                <div className="grid grid-cols-4 gap-2">
                  <select value={t.tipoId} onChange={(e) => updateTeste(t.id, "tipoId", e.target.value)} className={inputCls + " col-span-2"}>
                    {["Velocidade", "Agilidade", "Força", "Resistência", "Outro"].map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {TIPOS_TESTE.filter((tt) => tt.categoria === cat).map((tt) => (
                          <option key={tt.id} value={tt.id}>{tt.nome}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input type="date" value={t.data} onChange={(e) => updateTeste(t.id, "data", e.target.value)} className={inputCls} />
                  <div className="flex gap-1">
                    <input value={t.valor} onChange={(e) => updateTeste(t.id, "valor", e.target.value)} className={inputCls} placeholder={`Valor${tipo.unidade ? ` (${tipo.unidade})` : ""}`} />
                    <button type="button" onClick={() => removeTeste(t.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {t.tipoId === "outro" && (
                    <input
                      value={t.nomePersonalizado}
                      onChange={(e) => updateTeste(t.id, "nomePersonalizado", e.target.value)}
                      className={inputCls + " col-span-2"}
                      placeholder="Nome do teste"
                    />
                  )}
                  {t.tipoId === "outro" && (
                    <input
                      value={t.unidadePersonalizada || ""}
                      onChange={(e) => updateTeste(t.id, "unidadePersonalizada", e.target.value)}
                      className={inputCls + " col-span-2"}
                      placeholder="Unidade (ex: s, cm, m)"
                    />
                  )}
                  <input
                    value={t.obs}
                    onChange={(e) => updateTeste(t.id, "obs", e.target.value)}
                    className={inputCls + " col-span-4"}
                    placeholder="Observações (opcional)"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addTeste}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar teste físico
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <Field label="Notas gerais">
          <textarea value={form.notas} onChange={set("notas")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Pontos fortes, comportamento, outras observações..." />
        </Field>
      </div>

      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.nome.trim()} />
    </Modal>
    {showEvolucao && (
      <EvolucaoModal player={form} sessions={sessions} onClose={() => setShowEvolucao(false)} />
    )}
    </>
  );
}

export { PlayerModal };

