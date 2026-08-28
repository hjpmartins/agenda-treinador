import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getHabilidade } from "../../data";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions } from "../common/Modal";
import { HabilidadeSelect } from "./HabilidadeSelect";
import { DiagramStepsRow } from "../diagrams/SequencePlayer";
import { AiSuggestModal } from "../ai/AiSuggestModal";

function LibraryModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ diagramas: [], ...initial });
  const [showAi, setShowAi] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
    <Modal onClose={onClose} title={form.id ? "Editar exercício" : "Novo exercício"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2">
          <input value={form.nome} onChange={set("nome")} className={inputCls} placeholder="Ex: 3x3 meio campo" />
        </Field>
        <Field label="Habilidade / categoria" className="col-span-2">
          <HabilidadeSelect value={form.categoria} onChange={set("categoria")} />
        </Field>
        <Field label="Duração padrão (min)">
          <input type="number" min="0" value={form.duracaoPadrao} onChange={set("duracaoPadrao")} className={inputCls} placeholder="15" />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[#EA5B13]/50 hover:border-[#EA5B13] text-[#EA5B13] text-xs rounded-md py-2 transition-colors"
          >
            <Sparkles size={13} /> Sugerir com IA
          </button>
        </div>
        <Field label="Descrição / instruções" className="col-span-2">
          <textarea value={form.descricao} onChange={set("descricao")} className={inputCls + " resize-none"} style={{ minHeight: 90 }} placeholder="Organização, variantes, critério de sucesso..." />
        </Field>
        <div className="col-span-2 mt-1">
          <span className="block text-xs text-[#8A93A3] mb-1.5">Diagramas (sequência de passos)</span>
          <DiagramStepsRow diagramas={form.diagramas} onChange={(diagramas) => setForm({ ...form, diagramas })} />
        </div>
      </div>
      <ModalActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.nome.trim()} />
    </Modal>
    {showAi && (
      <AiSuggestModal
        mode="exercicio"
        defaults={{ habilidade: getHabilidade(form.categoria), duracaoPadrao: form.duracaoPadrao }}
        onClose={() => setShowAi(false)}
        onUseExercicio={(item) => {
          setForm({
            ...form,
            nome: item.nome || form.nome,
            duracaoPadrao: item.duracaoPadrao || form.duracaoPadrao,
            descricao: item.descricao || form.descricao,
          });
          setShowAi(false);
        }}
      />
    )}
    </>
  );
}

export { LibraryModal };

