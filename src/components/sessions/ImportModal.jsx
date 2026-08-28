import { useState } from "react";
import { parseRosterText } from "../../utils";
import { inputCls } from "../../ui";
import { Modal } from "../common/Modal";

function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseRosterText(text) : [];

  return (
    <Modal onClose={onClose} title="Importar lista de jogadores">
      <p className="text-xs text-[#8A93A3] mb-3">
        Cola a lista com <span className="text-[#F2EDE3]">número, nome e posição</span> por linha (como copiaste de um documento ou folha de cálculo).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputCls + " resize-none"}
        style={{ minHeight: 160, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}
        placeholder={"11;Ana Cláudia Dias Bastos;Poste\n8;Carlota Brigas Raquel;Base\n\n(também aceita listas separadas por tabs ou espaços)"}
      />
      {text.trim() && (
        <div className="mt-3 border border-[#2E3644] rounded-md max-h-40 overflow-y-auto">
          {parsed.length === 0 ? (
            <div className="text-xs text-[#D64545] px-3 py-2">Não consegui reconhecer nenhuma linha válida.</div>
          ) : (
            parsed.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-[#2E3644] last:border-b-0">
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#EA5B13] w-6 shrink-0">{p.numero}</span>
                <span className="flex-1 truncate">{p.nome}</span>
                <span className="text-[#8A93A3] shrink-0">{p.posicao}</span>
              </div>
            ))
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">
          Cancelar
        </button>
        <button
          onClick={() => onImport(parsed)}
          disabled={parsed.length === 0}
          className="px-4 py-2 text-sm font-medium bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:bg-[#2E3644] disabled:text-[#5A6272] text-[#14181F] rounded-md transition-colors"
        >
          Importar {parsed.length > 0 ? `(${parsed.length})` : ""}
        </button>
      </div>
    </Modal>
  );
}

export { ImportModal };

