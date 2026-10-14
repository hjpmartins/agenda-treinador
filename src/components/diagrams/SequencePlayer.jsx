import { useState } from "react";
import { Pencil, Box, Plus } from "lucide-react";
import { DiagramThumbnail } from "./CourtPrimitives";
import { PlayStudioModal } from "./PlayStudioModal";

/**
 * Diagramas de um exercício (sequência de passos) dentro dos formulários da
 * biblioteca e das sessões. Mostra uma pré-visualização e abre o estúdio de
 * jogadas (campo de madeira, edição em 2D ou 3D, reprodução em 3D).
 */
function DiagramStepsRow({ diagramas, onChange, title }) {
  const [studio, setStudio] = useState(null); // null | "2d" | "3d"
  const steps = diagramas || [];
  const btn = "flex items-center gap-1.5 text-xs px-3 h-9 rounded-md border transition-colors";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.length > 0 ? (
        <>
          <button type="button" onClick={() => setStudio("2d")} title="Editar a jogada" className="relative rounded hover:ring-2 hover:ring-[#EA5B13]">
            <DiagramThumbnail diagram={steps[steps.length - 1]} size={44} />
          </button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[11px] text-[#8A93A3] mr-1">
            {steps.length} {steps.length === 1 ? "passo" : "passos"}
          </span>
          <button type="button" onClick={() => setStudio("2d")} className={`${btn} border-[#2E3644] text-[#C7CDD8] hover:border-[#5A6272] hover:text-[#F2EDE3]`}>
            <Pencil size={13} /> Editar jogada
          </button>
          <button type="button" onClick={() => setStudio("3d")} className={`${btn} border-[#EA5B13]/60 text-[#FF6B1A] hover:border-[#EA5B13] hover:bg-[#EA5B13]/10`}>
            <Box size={13} /> Ver em 3D
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setStudio("2d")} className={`${btn} border-dashed border-[#5A6272] text-[#8A93A3] hover:border-[#EA5B13] hover:text-[#FF6B1A]`}>
          <Plus size={14} /> Desenhar jogada
        </button>
      )}
      {studio && (
        <PlayStudioModal
          diagramas={steps}
          title={title}
          initialView={studio}
          onClose={() => setStudio(null)}
          onSave={(d) => {
            onChange(d);
            setStudio(null);
          }}
        />
      )}
    </div>
  );
}

export { DiagramStepsRow };
