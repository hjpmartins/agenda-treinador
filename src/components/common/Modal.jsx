import { Plus, X } from "lucide-react";

function ViewHeader({ title, subtitle, onAdd, addLabel }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">
          {title}
        </h1>
        <div className="text-sm text-[#8A93A3] mt-0.5">{subtitle}</div>
      </div>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 transition-colors shrink-0">
          <Plus size={16} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function EmptyState({ text, small }) {
  return (
    <div className={`text-center text-[#5A6272] border border-dashed border-[#2E3644] rounded-lg ${small ? "py-6 text-xs" : "py-16 text-sm"}`}>
      {text}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-[#8A93A3] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-[#0A0C10]/95 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Inter', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        className={`bg-[#1E242E] border border-[#2E3644] rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E3644] shrink-0">
          <h2 style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-[#F2EDE3]">
            {title}
          </h2>
          <button onClick={onClose} className="text-[#8A93A3] hover:text-[#F2EDE3]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, disabled, saveLabel = "Guardar", danger = false }) {
  return (
    <div style={{ boxShadow: "0 -8px 16px -4px rgba(0,0,0,0.4)" }} className="sticky bottom-0 -mx-5 -mb-5 mt-5 px-5 py-3.5 bg-[#1E242E] border-t border-[#2E3644] flex justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors text-[#14181F] disabled:bg-[#2E3644] disabled:text-[#5A6272] ${
          danger ? "bg-[#D64545] hover:bg-[#e05a5a]" : "bg-[#EA5B13] hover:bg-[#FF6B1A]"
        }`}
      >
        {saveLabel}
      </button>
    </div>
  );
}

function ImportBackupConfirmModal({ fileName, counts, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} title="Confirmar importação">
      <p className="text-sm text-[#F2EDE3] mb-3">
        Vais substituir <b>todos os dados atuais</b> da aplicação pelo conteúdo de{" "}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#8A93A3] text-xs break-all">{fileName}</span>:
      </p>
      <ul className="text-sm text-[#8A93A3] space-y-1 mb-4 list-disc pl-5">
        <li>{counts.players} jogador{counts.players === 1 ? "" : "es"}</li>
        <li>{counts.sessions} treino{counts.sessions === 1 ? "" : "s"}/jogo{counts.sessions === 1 ? "" : "s"}</li>
        <li>{counts.library} exercício{counts.library === 1 ? "" : "s"} na biblioteca</li>
      </ul>
      <p className="text-xs text-[#D64545]">
        Esta ação não pode ser desfeita dentro da app. Se tiveres dados atuais que ainda não exportaste, cancela e exporta-os primeiro.
      </p>
      <ModalActions onCancel={onCancel} onSave={onConfirm} saveLabel="Substituir dados" danger />
    </Modal>
  );
}

export { ViewHeader, EmptyState, Field, Modal, ModalActions, ImportBackupConfirmModal };

