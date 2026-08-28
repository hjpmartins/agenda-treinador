import { useState } from "react";
import { parseFibaExercicios } from "../../utils";
import { inputCls } from "../../ui";
import { Modal } from "../common/Modal";

function LibraryImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseFibaExercicios(text) : [];

  return (
    <Modal onClose={onClose} title="Importar exercícios (colar texto)">
      <p className="text-xs text-[#8A93A3] mb-3">
        Abre um exercício na plataforma de origem, seleciona tudo (<span className="text-[#F2EDE3]">Ctrl+A</span>) e copia. Podes colar
        vários exercícios seguidos de uma vez — cada "Título:" começa um novo exercício. A categoria fica por definir; escolhe-a depois
        ao editar cada um. Os diagramas não são importados, têm de ser desenhados aqui.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputCls + " resize-none"}
        style={{ minHeight: 220, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}
        placeholder={'Título: 1 contra 1 em quadra inteira\nAutor: FCB\n\nDescrição\n1-1 em quadra inteira...\n\n(cola aqui o texto copiado da página do exercício)'}
      />
      {text.trim() && (
        <div className="mt-3 border border-[#2E3644] rounded-md max-h-52 overflow-y-auto">
          {parsed.length === 0 ? (
            <div className="text-xs text-[#D64545] px-3 py-2">Não consegui reconhecer nenhum exercício — confirma que colaste o texto com a linha "Título:".</div>
          ) : (
            parsed.map((ex, i) => (
              <div key={i} className="px-3 py-2 text-xs border-b border-[#2E3644] last:border-b-0">
                <div className="font-semibold text-[#F2EDE3] mb-0.5">{ex.nome}</div>
                <div className="text-[#8A93A3] line-clamp-2">{ex.descricao || "Sem descrição"}</div>
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

export { LibraryImportModal };
