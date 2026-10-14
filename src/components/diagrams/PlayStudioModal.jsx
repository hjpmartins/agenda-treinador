import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2 } from "lucide-react";
import { generateSequenceGif } from "../../lib/gifExport";

// O three.js (~140 kB gzip) só é descarregado quando se abre o estúdio.
const Court3DView = lazy(() => import("./court3d/Court3DView").then((m) => ({ default: m.Court3DView })));

const isEmptyStep = (d) => !d || (d.tokens.length === 0 && d.arrows.length === 0);

/**
 * Estúdio de jogadas em ecrã inteiro: desenha-se diretamente no campo de
 * madeira (vista 2D ou 3D) e reproduz-se a jogada em 3D. As alterações só
 * são gravadas no exercício ao carregar em "Guardar". Com `readOnly` serve só
 * para ver a jogada em 3D (ex: na lista da biblioteca).
 */
function PlayStudioModal({ diagramas, title, initialView = "2d", readOnly = false, onSave, onClose }) {
  const [draft, setDraft] = useState(diagramas || []);
  const [dirty, setDirty] = useState(false);
  const [gifState, setGifState] = useState(null); // null | {progress} | {error}

  const cleaned = () => draft.filter((d, i) => !(isEmptyStep(d) && draft.length === 1 && i === 0));

  const close = () => {
    if (dirty && !window.confirm("Sair sem guardar as alterações da jogada?")) return;
    onClose();
  };

  const downloadGif = async () => {
    const steps = cleaned();
    if (!steps.length) return;
    setGifState({ progress: 0 });
    try {
      const blob = await generateSequenceGif(steps, { onProgress: (progress) => setGifState({ progress }) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jogada-${steps.length}-passos.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setGifState(null);
    } catch (e) {
      setGifState({ error: e.message || "Não foi possível gerar o ficheiro." });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#14181F] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2E3644] shrink-0 flex-wrap">
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-[10px] tracking-[0.2em] uppercase text-[#EA5B13]">
            Jogada
          </div>
          <h2 style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-[#F2EDE3] truncate">
            {title || "Diagrama do exercício"}
          </h2>
        </div>
        {gifState?.error && <span className="text-xs text-[#D64545]">{gifState.error}</span>}
        <button
          type="button"
          onClick={downloadGif}
          disabled={(gifState && "progress" in gifState) || !cleaned().length}
          title="Descarregar a sequência como GIF, para enviar às jogadoras"
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-[#2E3644] text-[#C7CDD8] hover:border-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-40"
        >
          {gifState && "progress" in gifState ? (
            <>
              <Loader2 size={13} className="animate-spin" /> {Math.round(gifState.progress * 100)}%
            </>
          ) : (
            <>
              <Download size={13} /> GIF
            </>
          )}
        </button>
        {!readOnly && (
          <>
            <button type="button" onClick={close} className="px-3 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(cleaned())}
              className="px-4 py-2 text-sm font-medium rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F]"
            >
              Guardar
            </button>
          </>
        )}
        <button type="button" onClick={close} title="Fechar" className="text-[#8A93A3] hover:text-[#F2EDE3] -mr-1">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 p-2 sm:p-3">
        <Suspense
          fallback={<div className="w-full h-full rounded-lg bg-[#0B0E13] flex items-center justify-center text-sm text-[#8A93A3]">A preparar o campo…</div>}
        >
          <Court3DView
            editable={!readOnly}
            autoPlay={readOnly}
            initialView={readOnly ? "3d" : initialView}
            diagramas={diagramas}
            title={title}
            onChange={(d) => {
              setDraft(d);
              setDirty(true);
            }}
            className="w-full h-full border border-[#2E3644]"
          />
        </Suspense>
      </div>
    </div>,
    document.body
  );
}

export { PlayStudioModal };
