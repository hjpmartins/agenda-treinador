import { lazy, Suspense, useState } from "react";
import { X, FlaskConical } from "lucide-react";
import { emptyDiagram } from "../../utils";

const Court3DView = lazy(() => import("./court3d/Court3DView").then((m) => ({ default: m.Court3DView })));

const EXERCICIO_EXEMPLO = {
  court: "meio",
  tokens: [
    { id: "p1", type: "offense", number: "1", x: 75, y: 160 },
    { id: "p2", type: "offense", number: "2", x: 225, y: 160 },
    { id: "p3", type: "offense", number: "3", x: 150, y: 90 },
    { id: "d1", type: "defense", number: "D", x: 160, y: 170 },
    { id: "ball", type: "ball", x: 90, y: 160 },
  ],
  arrows: [{ id: "a1", type: "passe", from: { x: 75, y: 160 }, to: { x: 225, y: 160 }, tokenId: "ball" }],
};

// Ecrã de teste temporário do novo editor 3D (court3d), vindo de outra
// conversa — serve só para experimentar em isolado, com exercícios reais da
// biblioteca em modo leitura (nada é guardado de volta na base de dados).
// Não substitui o DiagramEditor nem entra no fluxo normal da app.
function Court3DTestView({ library, onClose }) {
  const [source, setSource] = useState("exemplo");
  const [draft, setDraft] = useState([EXERCICIO_EXEMPLO]);

  const escolher = (value) => {
    setSource(value);
    if (value === "exemplo") {
      setDraft([EXERCICIO_EXEMPLO]);
      return;
    }
    if (value === "vazio") {
      setDraft([emptyDiagram("meio")]);
      return;
    }
    const item = library.find((l) => l.id === value);
    setDraft(item?.diagramas?.length ? item.diagramas : [emptyDiagram("meio")]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0E13] flex flex-col">
      <div className="shrink-0 px-4 py-2.5 flex items-center gap-3 border-b border-[#2E3644] bg-[#1E242E]">
        <FlaskConical size={16} className="text-[#EA5B13] shrink-0" />
        <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wider text-sm text-[#F2EDE3]">
          Teste — Editor 3D (não guarda nada)
        </span>
        <select
          value={source}
          onChange={(e) => escolher(e.target.value)}
          className="ml-2 text-xs bg-[#14181F] border border-[#2E3644] rounded px-2 py-1.5 text-[#F2EDE3]"
        >
          <option value="exemplo">Exemplo (2 ataque, 1 defesa, bola, passe)</option>
          <option value="vazio">Campo vazio</option>
          {library.length > 0 && <option disabled>──────────</option>}
          {library.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome || "(sem nome)"}
            </option>
          ))}
        </select>
        <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <X size={18} />
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        <Suspense fallback={<div className="p-6 text-[#8A93A3] text-sm">A carregar motor 3D…</div>}>
          <Court3DView key={source} editable initialView="2d" diagramas={draft} onChange={setDraft} className="w-full h-full" />
        </Suspense>
      </div>
    </div>
  );
}

export { Court3DTestView };
