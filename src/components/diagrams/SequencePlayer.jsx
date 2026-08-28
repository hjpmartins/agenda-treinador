import { useState, useRef } from "react";
import { Play, RotateCcw, X, Plus, Copy, Download, Loader2 } from "lucide-react";
import { HALF_VB, FULL_VB } from "../../data";
import { computeAnimatedPositions, resolveFinalDiagram, emptyDiagram } from "../../utils";
import { generateSequenceGif } from "../../lib/gifExport";
import { Modal } from "../common/Modal";
import { CourtBackground, TokenShape, ArrowShape, DiagramThumbnail } from "./CourtPrimitives";
import { DiagramEditor } from "./DiagramEditor";

function SequencePlayerModal({ diagramas, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [overrides, setOverrides] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState(null);
  const stopRef = useRef(false);

  const current = diagramas[stepIndex] || diagramas[0];
  const vb = current.court === "campo" ? FULL_VB : HALF_VB;

  const playAll = () => {
    stopRef.current = false;
    setIsPlaying(true);
    let idx = 0;
    const stepDuration = 1300;
    const pause = 350;

    const runStep = () => {
      if (stopRef.current || idx >= diagramas.length) {
        setIsPlaying(false);
        return;
      }
      setStepIndex(idx);
      const diagram = diagramas[idx];
      const start = performance.now();
      const tick = (now) => {
        if (stopRef.current) return;
        const t = Math.min(1, (now - start) / stepDuration);
        setOverrides(computeAnimatedPositions(diagram, t));
        if (t < 1) requestAnimationFrame(tick);
        else {
          idx += 1;
          setTimeout(runStep, pause);
        }
      };
      requestAnimationFrame(tick);
    };
    runStep();
  };

  const reset = () => {
    stopRef.current = true;
    setIsPlaying(false);
    setStepIndex(0);
    setOverrides(null);
  };

  const downloadGif = async () => {
    setDownloadError(null);
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const blob = await generateSequenceGif(diagramas, { onProgress: setDownloadProgress });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sequencia-${diagramas.length}-passos.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e.message || "Não foi possível gerar o ficheiro.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Sequência completa" wide>
      <div className="flex items-center gap-1.5 mb-3">
        {diagramas.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i === stepIndex ? "bg-[#EA5B13]" : i < stepIndex ? "bg-[#4C9A6A]" : "bg-[#2E3644]"}`} />
        ))}
      </div>
      <div className="bg-[#0F1319] rounded-lg overflow-hidden" style={{ aspectRatio: `${vb.w} / ${vb.h}`, maxHeight: "55vh" }}>
        <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full select-none">
          <CourtBackground court={current.court} vb={vb} />
          {current.arrows.map((a) => (
            <ArrowShape key={a.id} arrow={a} />
          ))}
          {current.tokens.map((t) => (
            <TokenShape key={t.id} token={(overrides && overrides[t.id]) || t} />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          Passo {stepIndex + 1} / {diagramas.length}
        </span>
        <div className="flex gap-2">
          <button onClick={playAll} disabled={isPlaying} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272] disabled:opacity-40">
            <Play size={13} /> Reproduzir tudo
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2E3644] hover:border-[#5A6272]">
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#2E3644] flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-[#5A6272]">Descarrega a sequência completa como um ficheiro GIF, para enviar aos jogadores.</div>
        <button
          onClick={downloadGif}
          disabled={downloading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-60 text-[#14181F] font-medium shrink-0"
        >
          {downloading ? (
            <>
              <Loader2 size={13} className="animate-spin" /> A gerar... {Math.round(downloadProgress * 100)}%
            </>
          ) : (
            <>
              <Download size={13} /> Descarregar filme (GIF)
            </>
          )}
        </button>
      </div>
      {downloadError && (
        <div className="mt-2 text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2">{downloadError}</div>
      )}

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

function DiagramStepsRow({ diagramas, onChange }) {
  const [editing, setEditing] = useState(null); // {isNew:true, base} | {isNew:false, index}
  const [playingAll, setPlayingAll] = useState(false);
  const steps = diagramas || [];

  const openNew = () => {
    const base = steps.length > 0 ? resolveFinalDiagram(steps[steps.length - 1]) : emptyDiagram();
    setEditing({ isNew: true, base });
  };
  const openEdit = (i) => setEditing({ isNew: false, index: i });

  const handleSave = (diagram) => {
    if (editing.isNew) onChange([...steps, diagram]);
    else onChange(steps.map((d, i) => (i === editing.index ? diagram : d)));
    setEditing(null);
  };

  const deleteStep = (i, e) => {
    e.stopPropagation();
    onChange(steps.filter((_, idx) => idx !== i));
  };

  // Insere uma cópia do passo i logo a seguir a ele, para o treinador variar
  // só uma parte da jogada sem ter de a redesenhar do zero.
  const duplicateStep = (i, e) => {
    e.stopPropagation();
    const copy = {
      court: steps[i].court,
      tokens: steps[i].tokens.map((t) => ({ ...t })),
      arrows: steps[i].arrows.map((a) => ({ ...a })),
    };
    onChange([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((d, i) => (
        <button key={i} type="button" onClick={() => openEdit(i)} className="relative group/step">
          <DiagramThumbnail diagram={d} size={44} />
          <span
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            className="absolute -top-1.5 -left-1.5 bg-[#14181F] border border-[#2E3644] text-[9px] rounded-full w-4 h-4 flex items-center justify-center text-[#8A93A3]"
          >
            {i + 1}
          </span>
          <span
            onClick={(e) => deleteStep(i, e)}
            className="absolute -top-1.5 -right-1.5 bg-[#D64545] text-white rounded-full w-4 h-4 hidden group-hover/step:flex items-center justify-center"
          >
            <X size={10} />
          </span>
          <span
            onClick={(e) => duplicateStep(i, e)}
            title="Duplicar este passo"
            className="absolute -bottom-1.5 -right-1.5 bg-[#2E3644] border border-[#5A6272] text-[#F2EDE3] rounded-full w-4 h-4 hidden group-hover/step:flex items-center justify-center"
          >
            <Copy size={9} />
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={openNew}
        title={steps.length > 0 ? "Continuar a partir das posições finais" : "Criar primeiro diagrama"}
        className="w-11 shrink-0 flex items-center justify-center rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]"
        style={{ aspectRatio: "1" }}
      >
        <Plus size={16} />
      </button>
      {steps.length > 1 && (
        <button
          type="button"
          onClick={() => setPlayingAll(true)}
          className="flex items-center gap-1.5 text-xs px-3 h-11 rounded border border-dashed border-[#2E3644] hover:border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3]"
        >
          <Play size={13} /> Ver sequência
        </button>
      )}
      {steps.length === 0 && <span className="text-[11px] text-[#5A6272]">Sem diagramas ainda</span>}
      {editing && (
        <DiagramEditor
          initial={editing.isNew ? editing.base : steps[editing.index]}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {playingAll && <SequencePlayerModal diagramas={steps} onClose={() => setPlayingAll(false)} />}
    </div>
  );
}

export { SequencePlayerModal, DiagramStepsRow };
