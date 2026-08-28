import { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Search, Plus, BookOpen, Sparkles, Trash2 } from "lucide-react";
import { HABILIDADES, getHabilidade } from "../../data";
import { uid } from "../../utils";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions } from "../common/Modal";
import { HabilidadeSelect } from "../library/HabilidadeSelect";
import { DiagramStepsRow } from "../diagrams/SequencePlayer";
import { AiSuggestModal } from "../ai/AiSuggestModal";

function SessionModal({ initial, library, players, onSaveToLibrary, onClose, onSave }) {
  const [form, setForm] = useState({ exercicios: [], observacoes: "", presencas: {}, ...initial });
  const [showPicker, setShowPicker] = useState(false);
  const [showAiTreino, setShowAiTreino] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFase, setPickerFase] = useState("");
  const [savedIds, setSavedIds] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isGame = form.type === "jogo";
  const exercicios = form.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);

  const addExercise = () => {
    setForm({ ...form, exercicios: [...exercicios, { id: uid(), nome: "", duracao: "", descricao: "", diagramas: [], categoria: "" }] });
  };
  const addFromLibrary = (item) => {
    setForm({
      ...form,
      exercicios: [...exercicios, { id: uid(), nome: item.nome, duracao: item.duracaoPadrao || "", descricao: item.descricao || "", diagramas: item.diagramas || [], categoria: item.categoria || "" }],
    });
    setShowPicker(false);
    setPickerSearch("");
  };
  const updateExercise = (id, key, value) => {
    setForm({ ...form, exercicios: exercicios.map((e) => (e.id === id ? { ...e, [key]: value } : e)) });
  };
  const removeExercise = (id) => {
    setForm({ ...form, exercicios: exercicios.filter((e) => e.id !== id) });
  };
  const moveExercise = (index, dir) => {
    const next = [...exercicios];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setForm({ ...form, exercicios: next });
  };
  const saveExerciseToLibrary = (ex) => {
    if (!ex.nome.trim()) return;
    onSaveToLibrary({ nome: ex.nome, categoria: ex.categoria || HABILIDADES[0].id, duracaoPadrao: ex.duracao || "", descricao: ex.descricao || "", diagramas: ex.diagramas || [] });
    setSavedIds({ ...savedIds, [ex.id]: true });
  };

  const filteredLibrary = (library || []).filter((l) => {
    const h = getHabilidade(l.categoria);
    if (pickerFase && (!h || h.fase !== pickerFase)) return false;
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.trim().toLowerCase();
    return l.nome.toLowerCase().includes(q) || (h && h.nome.toLowerCase().includes(q));
  });

  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar treino" : "Novo treino"} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
        </Field>
        <Field label="Título" className="col-span-2">
          <input value={form.title} onChange={set("title")} className={inputCls} placeholder="Ex: Defesa em zona" />
        </Field>

        {isGame ? (
          <>
            <Field label="Adversário">
              <input value={form.adversario} onChange={set("adversario")} className={inputCls} placeholder="Nome da equipa" />
            </Field>
            <Field label="Resultado">
              <input value={form.resultado} onChange={set("resultado")} className={inputCls} placeholder="Ex: 68-54" />
            </Field>
            <Field label="Relatório do jogo" className="col-span-2">
              <textarea value={form.conteudo} onChange={set("conteudo")} className={inputCls + " resize-none"} style={{ minHeight: 110 }} placeholder="Observações, desempenho, pontos a melhorar..." />
            </Field>
          </>
        ) : (
          <>
            <div className="col-span-2 flex items-center justify-between bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2 mb-1">
              <span className="text-sm">Este treino foi realizado?</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, realizado: true })}
                  className={`px-3 py-1 text-xs rounded ${form.realizado === true ? "bg-[#4C9A6A] text-[#14181F] font-medium" : "border border-[#2E3644] text-[#8A93A3]"}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, realizado: false })}
                  className={`px-3 py-1 text-xs rounded ${form.realizado !== true ? "bg-[#D64545] text-[#14181F] font-medium" : "border border-[#2E3644] text-[#8A93A3]"}`}
                >
                  Não
                </button>
              </div>
            </div>

            <Field label="Objetivo geral" className="col-span-2">
              <input value={form.objetivo} onChange={set("objetivo")} className={inputCls} placeholder="Ex: Melhorar transição defesa-ataque" />
            </Field>

            <div className="col-span-2 mt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8A93A3]">Exercícios do treino</span>
                {exercicios.length > 0 && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#EA5B13]">
                    Duração total: {totalMin} min
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {exercicios.map((ex, i) => (
                  <div key={ex.id} className="border border-[#2E3644] rounded-md p-3 bg-[#14181F]">
                    <div className="flex items-start gap-2">
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#5A6272] mt-2 w-4 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <input
                          value={ex.nome}
                          onChange={(e) => updateExercise(ex.id, "nome", e.target.value)}
                          className={inputCls + " col-span-3"}
                          placeholder="Nome do exercício"
                        />
                        <input
                          type="number"
                          min="0"
                          value={ex.duracao}
                          onChange={(e) => updateExercise(ex.id, "duracao", e.target.value)}
                          className={inputCls}
                          placeholder="min"
                        />
                        <div className="col-span-4">
                          <HabilidadeSelect
                            value={ex.categoria || ""}
                            onChange={(e) => updateExercise(ex.id, "categoria", e.target.value)}
                            className={inputCls + " text-xs"}
                            placeholderOption="Sem habilidade associada (opcional)"
                          />
                        </div>
                        <textarea
                          value={ex.descricao}
                          onChange={(e) => updateExercise(ex.id, "descricao", e.target.value)}
                          className={inputCls + " col-span-4 resize-none"} style={{ minHeight: 50 }}
                          placeholder="Descrição / instruções (organização, variantes, critério de sucesso...)"
                        />
                        <div className="col-span-4">
                          <DiagramStepsRow diagramas={ex.diagramas || []} onChange={(diagramas) => updateExercise(ex.id, "diagramas", diagramas)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button type="button" onClick={() => moveExercise(i, -1)} disabled={i === 0} className="p-1 text-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-20">
                          <ChevronLeft size={13} className="rotate-90" />
                        </button>
                        <button type="button" onClick={() => moveExercise(i, 1)} disabled={i === exercicios.length - 1} className="p-1 text-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-20">
                          <ChevronRight size={13} className="rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveExerciseToLibrary(ex)}
                          disabled={!ex.nome.trim() || savedIds[ex.id]}
                          title="Guardar na biblioteca"
                          className={`p-1 ${savedIds[ex.id] ? "text-[#EA5B13]" : "text-[#5A6272] hover:text-[#EA5B13]"} disabled:opacity-20`}
                        >
                          <Star size={13} fill={savedIds[ex.id] ? "currentColor" : "none"} />
                        </button>
                        <button type="button" onClick={() => removeExercise(ex.id)} className="p-1 text-[#5A6272] hover:text-[#D64545]">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showPicker && (
                <div className="mt-2 border border-[#2E3644] rounded-md bg-[#14181F] p-2">
                  <div className="flex items-center gap-2 border border-[#2E3644] rounded-md px-2 mb-1.5">
                    <Search size={13} className="text-[#5A6272] shrink-0" />
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Pesquisar por nome ou habilidade..."
                      className="w-full bg-transparent py-1.5 text-sm text-[#F2EDE3] placeholder-[#5A6272] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1 mb-1.5">
                    {["", "Defesa", "Ataque"].map((f) => (
                      <button
                        key={f || "todas"}
                        type="button"
                        onClick={() => setPickerFase(f)}
                        className={`text-[11px] px-2 py-0.5 rounded ${pickerFase === f ? "bg-[#EA5B13] text-[#14181F]" : "border border-[#2E3644] text-[#8A93A3]"}`}
                      >
                        {f || "Todas"}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-[#5A6272] self-center">{filteredLibrary.length} resultado{filteredLibrary.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLibrary.length === 0 ? (
                      <div className="text-xs text-[#5A6272] px-2 py-3 text-center">Nenhum exercício encontrado.</div>
                    ) : (
                      filteredLibrary.map((item) => {
                        const h = getHabilidade(item.categoria);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addFromLibrary(item)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm truncate">{item.nome}</span>
                              {item.duracaoPadrao && (
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{item.duracaoPadrao}min</span>
                              )}
                            </div>
                            {h && <div className="text-[10px] text-[#5A6272] truncate">{h.fase} · {h.componente} · {h.nome}</div>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={addExercise}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2.5 transition-colors"
                >
                  <Plus size={14} /> Exercício em branco
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2.5 transition-colors"
                >
                  <BookOpen size={14} /> Da biblioteca
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiTreino(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-[#EA5B13]/50 hover:border-[#EA5B13] text-[#EA5B13] text-xs rounded-md py-2.5 transition-colors"
                >
                  <Sparkles size={14} /> Sugerir com IA
                </button>
              </div>
            </div>

            {players && players.length > 0 && (
              <div className="col-span-2 mt-1">
                <span className="block text-xs text-[#8A93A3] mb-1.5">Presenças</span>
                <div style={{ maxHeight: 180, overflowY: "auto" }} className="grid grid-cols-2 gap-1.5 border border-[#2E3644] rounded-md p-2.5 bg-[#14181F]">
                  {players.map((p) => {
                    const status = (form.presencas || {})[p.id];
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs px-1.5 py-1">
                        <span className="truncate">{p.numero ? `${p.numero} · ` : ""}{p.nome}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, presencas: { ...form.presencas, [p.id]: status === "P" ? null : "P" } })}
                            className={`w-6 h-6 rounded text-[10px] font-semibold ${status === "P" ? "bg-[#4C9A6A] text-[#14181F]" : "bg-[#2E3644] text-[#8A93A3]"}`}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, presencas: { ...form.presencas, [p.id]: status === "F" ? null : "F" } })}
                            className={`w-6 h-6 rounded text-[10px] font-semibold ${status === "F" ? "bg-[#D64545] text-[#14181F]" : "bg-[#2E3644] text-[#8A93A3]"}`}
                          >
                            F
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Observações gerais" className="col-span-2 mt-1">
              <textarea value={form.observacoes} onChange={set("observacoes")} className={inputCls + " resize-none"} style={{ minHeight: 60 }} placeholder="Notas sobre o treino, avaliação geral..." />
            </Field>
          </>
        )}
      </div>
      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.date} />
    </Modal>
    {showAiTreino && (
      <AiSuggestModal
        mode="treino"
        defaults={{ objetivo: form.objetivo, duracaoTotal: totalMin > 0 ? totalMin : 90 }}
        onClose={() => setShowAiTreino(false)}
        onInsertTreino={(items) => {
          const novos = items.map((it) => ({ id: uid(), nome: it.nome, duracao: String(it.duracao || ""), descricao: it.descricao || "", diagramas: [] }));
          setForm({ ...form, exercicios: [...exercicios, ...novos] });
          setShowAiTreino(false);
        }}
      />
    )}
    </>
  );
}

export { SessionModal };

