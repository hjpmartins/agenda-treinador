import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { emptyJogo, PERIODOS } from "../../data";
import { uid } from "../../utils";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions } from "../common/Modal";

function JogoModal({ initial, players, onClose, onSave }) {
  const [form, setForm] = useState({ ...emptyJogo, ...initial });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const objetivos = form.objetivosJogo || [];
  const convocatoria = form.convocatoria || {};
  const dirigentes = form.dirigentes || [];

  const addObjetivo = () => setForm({ ...form, objetivosJogo: [...objetivos, { id: uid(), texto: "" }] });
  const updateObjetivo = (id, value) => setForm({ ...form, objetivosJogo: objetivos.map((o) => (o.id === id ? { ...o, texto: value } : o)) });
  const removeObjetivo = (id) => setForm({ ...form, objetivosJogo: objetivos.filter((o) => o.id !== id) });

  const addDirigente = () => setForm({ ...form, dirigentes: [...dirigentes, { id: uid(), nome: "", licenca: "" }] });
  const updateDirigente = (id, key, value) => setForm({ ...form, dirigentes: dirigentes.map((d) => (d.id === id ? { ...d, [key]: value } : d)) });
  const removeDirigente = (id) => setForm({ ...form, dirigentes: dirigentes.filter((d) => d.id !== id) });

  const togglePeriodo = (playerId, idx) => {
    const atual = convocatoria[playerId] || [false, false, false, false];
    const next = atual.map((v, i) => (i === idx ? !v : v));
    setForm({ ...form, convocatoria: { ...convocatoria, [playerId]: next } });
  };

  return (
    <Modal onClose={onClose} title={form.id ? "Editar jogo" : "Novo jogo"} wide>
      <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Ficha de jogo</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Campeonato / Competição" className="col-span-2">
          <input value={form.campeonato} onChange={set("campeonato")} className={inputCls} placeholder="Ex: Torneio Interdistrital Sub-14" />
        </Field>
        <Field label="Adversário">
          <input value={form.adversario} onChange={set("adversario")} className={inputCls} placeholder="Nome da equipa" />
        </Field>
        <Field label="Jogo nº">
          <input value={form.jogoNumero} onChange={set("jogoNumero")} className={inputCls} placeholder="6" />
        </Field>
        <Field label="Data">
          <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
        </Field>
        <Field label="Horário">
          <input type="time" value={form.horario} onChange={set("horario")} className={inputCls} />
        </Field>
        <Field label="Local" className="col-span-2">
          <input value={form.local} onChange={set("local")} className={inputCls} placeholder="Pavilhão..." />
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Equipa técnica</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Treinador principal">
            <input value={form.treinadorPrincipal} onChange={set("treinadorPrincipal")} className={inputCls} />
          </Field>
          <Field label="Nº de licença">
            <input value={form.treinadorPrincipalLicenca} onChange={set("treinadorPrincipalLicenca")} className={inputCls} placeholder="Ex: 21363" />
          </Field>
          <Field label="Treinador adjunto">
            <input value={form.treinadorAdjunto} onChange={set("treinadorAdjunto")} className={inputCls} />
          </Field>
          <Field label="Nº de licença">
            <input value={form.treinadorAdjuntoLicenca} onChange={set("treinadorAdjuntoLicenca")} className={inputCls} placeholder="Ex: 21364" />
          </Field>
        </div>
        <div className="mt-3">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Dirigentes</span>
          <div className="space-y-2">
            {dirigentes.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input value={d.nome} onChange={(e) => updateDirigente(d.id, "nome", e.target.value)} className={inputCls} style={{ flex: "1 1 auto", minWidth: 0 }} placeholder="Nome do dirigente" />
                <input value={d.licenca} onChange={(e) => updateDirigente(d.id, "licenca", e.target.value)} className={inputCls} style={{ flex: "0 0 100px" }} placeholder="Nº licença" />
                <button type="button" onClick={() => removeDirigente(d.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDirigente}
            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
          >
            <Plus size={13} /> Adicionar dirigente
          </button>
        </div>
      </div>

      {players && players.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[#2E3644]">
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Convocatória — participação por período</div>
          <div style={{ maxHeight: 220, overflowY: "auto" }} className="border border-[#2E3644] rounded-md">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1E242E]">
                <tr className="text-[#8A93A3]">
                  <th className="text-left px-2 py-1.5 font-normal">Nº</th>
                  <th className="text-left px-2 py-1.5 font-normal">Nome</th>
                  {PERIODOS.map((p) => (
                    <th key={p} className="px-1.5 py-1.5 font-normal text-center">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const marks = convocatoria[p.id] || [false, false, false, false];
                  return (
                    <tr key={p.id} className="border-t border-[#2E3644]">
                      <td className="px-2 py-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.numero}</td>
                      <td className="px-2 py-1 truncate">{p.nome}</td>
                      {PERIODOS.map((_, idx) => (
                        <td key={idx} className="text-center">
                          <button
                            type="button"
                            onClick={() => togglePeriodo(p.id, idx)}
                            className={`w-5 h-5 rounded ${marks[idx] ? "bg-[#4C9A6A] text-[#14181F]" : "bg-[#14181F] border border-[#2E3644]"}`}
                          >
                            {marks[idx] ? "✓" : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <span className="block text-xs text-[#8A93A3] mb-1.5">Objetivos do jogo</span>
        <div className="space-y-2">
          {objetivos.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#5A6272] w-4 shrink-0">{i + 1}</span>
              <input value={o.texto} onChange={(e) => updateObjetivo(o.id, e.target.value)} className={inputCls + " flex-1"} placeholder="Ex: Privilegiar o passe em vez de drible" />
              <button type="button" onClick={() => removeObjetivo(o.id)} className="p-1.5 text-[#5A6272] hover:text-[#D64545] shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addObjetivo}
          className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] text-xs rounded-md py-2 transition-colors"
        >
          <Plus size={13} /> Adicionar objetivo
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Preparação do jogo</div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Reflexão sobre a preparação">
            <textarea value={form.reflexaoPreparacao} onChange={set("reflexaoPreparacao")} className={inputCls + " resize-none"} style={{ minHeight: 90 }} placeholder="Análise do adversário, plano de jogo, contexto..." />
          </Field>
          <Field label="Palestra inicial">
            <textarea value={form.palestraInicial} onChange={set("palestraInicial")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="O que vais dizer à equipa antes do jogo..." />
          </Field>
          <Field label="Descontos de tempo e intervalo">
            <textarea value={form.descontosTempo} onChange={set("descontosTempo")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Plano para os descontos de tempo e discurso do intervalo..." />
          </Field>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#2E3644]">
        <div className="text-xs uppercase tracking-wide text-[#8A93A3] mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Relatório (pós-jogo)</div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Resultado">
            <input value={form.resultado} onChange={set("resultado")} className={inputCls} placeholder="Ex: BC Vila Real 49 - CTM Vila Pouca 20" />
          </Field>
          <Field label="Relatório do jogo">
            <textarea value={form.conteudo} onChange={set("conteudo")} className={inputCls + " resize-none"} style={{ minHeight: 100 }} placeholder="Como correu o jogo, desempenho da equipa..." />
          </Field>
          <Field label="Apreciação geral">
            <textarea value={form.apreciacaoGeral} onChange={set("apreciacaoGeral")} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Balanço final, pontos a trabalhar..." />
          </Field>
        </div>
      </div>

      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.date} />
    </Modal>
  );
}

export { JogoModal };

