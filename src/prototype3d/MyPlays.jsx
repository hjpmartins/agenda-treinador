import { useState } from "react";
import { Plus, Copy, Trash2, Pencil, Check, ClipboardCopy } from "lucide-react";
import { resolveFinalDiagram, emptyDiagram, uid } from "../utils";
import { DiagramEditor } from "../components/diagrams/DiagramEditor";
import { DiagramThumbnail } from "../components/diagrams/CourtPrimitives";

// Jogadas criadas no protótipo ficam guardadas só neste navegador.
const STORAGE_KEY = "prototipo3d.jogadas";

function loadPlays() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePlays(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sem armazenamento (janela privada, etc.): as jogadas duram só até fechar a página.
  }
}

function newPlay(nome, diagramas = []) {
  return { id: uid(), nome, diagramas };
}

// Botão que pede um segundo toque para confirmar (o confirm() do navegador
// não está disponível em todos os sítios onde o protótipo corre).
function ConfirmButton({ onConfirm, title, children, className = "" }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      title={armed ? "Toca outra vez para confirmar" : title}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) onConfirm();
        else {
          setArmed(true);
          setTimeout(() => setArmed(false), 2500);
        }
      }}
      className={`${className} ${armed ? "!bg-[#D64545] !text-white !border-[#D64545]" : ""}`}
    >
      {armed ? <Check size={11} /> : children}
    </button>
  );
}

/**
 * Painel de passos de uma jogada: miniaturas, editor 2D (o mesmo da app) para
 * criar/editar cada passo, duplicar e apagar.
 */
function StepsEditor({ play, onChange }) {
  const [editing, setEditing] = useState(null); // {isNew, base} | {isNew:false, index}
  const steps = play.diagramas;

  const openNew = () => {
    const base = steps.length > 0 ? resolveFinalDiagram(steps[steps.length - 1]) : emptyDiagram();
    setEditing({ isNew: true, base });
  };

  const handleSave = (diagram) => {
    if (editing.isNew) onChange([...steps, diagram]);
    else onChange(steps.map((d, i) => (i === editing.index ? diagram : d)));
    setEditing(null);
  };

  const duplicate = (i) => {
    const copy = { court: steps[i].court, tokens: steps[i].tokens.map((t) => ({ ...t })), arrows: steps[i].arrows.map((a) => ({ ...a })) };
    onChange([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]);
  };

  const smallBtn = "w-6 h-6 rounded-md border border-[#2E3644] bg-[#14181F] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272] flex items-center justify-center";

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-1">
      {steps.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setEditing({ isNew: false, index: i })} title={`Editar passo ${i + 1}`} className="relative rounded hover:ring-2 hover:ring-[#EA5B13]">
            {d.tokens.length || d.arrows.length ? (
              <DiagramThumbnail diagram={d} size={64} />
            ) : (
              <div className="w-16 h-16 rounded border border-[#2E3644] bg-[#0F1319]" />
            )}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="absolute -top-2 -left-2 bg-[#14181F] border border-[#2E3644] text-[10px] rounded-full w-5 h-5 flex items-center justify-center text-[#F2EDE3]">
              {i + 1}
            </span>
          </button>
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing({ isNew: false, index: i })} title="Editar" className={smallBtn}>
              <Pencil size={11} />
            </button>
            <button type="button" onClick={() => duplicate(i)} title="Duplicar passo" className={smallBtn}>
              <Copy size={11} />
            </button>
            <ConfirmButton onConfirm={() => onChange(steps.filter((_, idx) => idx !== i))} title="Apagar passo" className={smallBtn}>
              <Trash2 size={11} />
            </ConfirmButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={openNew}
        className="w-16 h-16 shrink-0 flex flex-col items-center justify-center gap-0.5 rounded border border-dashed border-[#5A6272] hover:border-[#EA5B13] text-[#8A93A3] hover:text-[#FF6B1A]"
        title={steps.length ? "Novo passo a partir das posições finais do anterior" : "Desenhar o primeiro passo"}
      >
        <Plus size={18} />
        <span className="text-[9px] uppercase tracking-wider" style={{ fontFamily: "'Oswald', sans-serif" }}>
          Passo
        </span>
      </button>
      {editing && <DiagramEditor initial={editing.isNew ? editing.base : steps[editing.index]} onClose={() => setEditing(null)} onSave={handleSave} />}
    </div>
  );
}

/**
 * "As minhas jogadas": lista de jogadas guardadas no navegador, com nome,
 * passos editáveis e cópia em JSON (para colar mais tarde noutro lado).
 */
function MyPlays({ plays, selectedId, onSelect, onPlaysChange }) {
  const [copied, setCopied] = useState(false);
  const [jsonFallback, setJsonFallback] = useState(null);
  const selected = plays.find((p) => p.id === selectedId) || null;

  const update = (changes) => onPlaysChange(plays.map((p) => (p.id === selectedId ? { ...p, ...changes } : p)));

  const create = () => {
    const p = newPlay(`Jogada ${plays.length + 1}`);
    onPlaysChange([...plays, p]);
    onSelect(p.id);
  };

  const remove = () => {
    const rest = plays.filter((p) => p.id !== selectedId);
    onPlaysChange(rest);
    onSelect(rest.length ? rest[rest.length - 1].id : null);
  };

  const copyJson = async () => {
    const text = JSON.stringify({ nome: selected.nome, diagramas: selected.diagramas });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setJsonFallback(text);
    }
  };

  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {plays.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              p.id === selectedId ? "border-[#EA5B13] text-[#F2EDE3] bg-[#EA5B13]/10" : "border-[#2E3644] text-[#8A93A3] hover:border-[#5A6272]"
            }`}
          >
            {p.nome || "Sem nome"}
          </button>
        ))}
        <button type="button" onClick={create} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] font-medium">
          <Plus size={13} /> Nova jogada
        </button>
      </div>

      {selected ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              id="play-name"
              value={selected.nome}
              onChange={(e) => update({ nome: e.target.value })}
              placeholder="Nome da jogada"
              className="flex-1 min-w-[160px] bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-1.5 text-sm text-[#F2EDE3] focus:outline-none focus:border-[#EA5B13]"
            />
            <button type="button" onClick={copyJson} disabled={!selected.diagramas.length} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272] disabled:opacity-40">
              {copied ? <Check size={13} /> : <ClipboardCopy size={13} />} {copied ? "Copiado" : "Copiar JSON"}
            </button>
            <ConfirmButton onConfirm={remove} title="Apagar jogada" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#2E3644] text-[#8A93A3] hover:text-[#D64545] hover:border-[#D64545]">
              <Trash2 size={13} /> Apagar
            </ConfirmButton>
          </div>
          {jsonFallback && (
            <textarea
              id="play-json"
              readOnly
              value={jsonFallback}
              onFocus={(e) => e.target.select()}
              rows={3}
              className="w-full bg-[#14181F] border border-[#2E3644] rounded-md p-2 text-[11px] text-[#F2EDE3]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            />
          )}
          <StepsEditor play={selected} onChange={(diagramas) => update({ diagramas })} />
          <p className="text-[11px] text-[#5A6272]">
            Toca em <span className="text-[#8A93A3]">+ Passo</span> para desenhar no editor 2D. Cada passo novo começa nas posições finais do anterior. A vista 3D atualiza quando guardas.
            As jogadas ficam guardadas só neste navegador.
          </p>
        </>
      ) : (
        <p className="text-sm text-[#8A93A3]">Ainda não tens jogadas. Carrega em <span className="text-[#F2EDE3]">Nova jogada</span> para começar.</p>
      )}
    </div>
  );
}

export { MyPlays, loadPlays, savePlays, newPlay };
