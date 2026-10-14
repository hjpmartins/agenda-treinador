import { lazy, Suspense, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Download, Share2, Loader2 } from "lucide-react";
import { generateSequenceVideo } from "../../lib/videoExport";
import { recordScene3D } from "../../lib/video3DExport";

// No telemóvel, partilha o ficheiro diretamente (a app de destino recebe-o
// logo com o tipo e o nome certos) em vez de descarregar para a pasta de
// transferências e depois ser preciso voltar a escolhê-lo na Galeria. Em
// computador não há partilha nativa, mantém-se o descarregar de sempre.
const canShareFiles = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

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
  const [exportState, setExportState] = useState(null); // null | {progress} | {error} | {ready: {blob, filename}}
  const sceneRef = useRef(null);

  const cleaned = () => draft.filter((d, i) => !(isEmptyStep(d) && draft.length === 1 && i === 0));

  const close = () => {
    if (dirty && !window.confirm("Sair sem guardar as alterações da jogada?")) return;
    onClose();
  };

  // Vídeo em vez de GIF: ao contrário de uma GIF partilhada de fora da caixa
  // de GIFs do WhatsApp (que muitas vezes chega só como uma imagem parada,
  // limitação do próprio WhatsApp), um vídeo mostra sempre pré-visualização
  // e repete em loop. Demora o tempo real da jogada a gravar — e por isso não
  // dá para gerar e partilhar no mesmo toque: o navigator.share só funciona
  // em reação direta e imediata a um toque, e vários segundos de gravação já
  // chegam tarde demais. Em telemóvel faz-se em dois tempos: gera-se o
  // vídeo, e só o toque seguinte ("Partilhar agora") é que ainda conta como
  // reação ao utilizador. Em computador não há essa restrição, descarrega-se
  // logo a seguir a gerar, sem precisar de um segundo toque.
  //
  // Grava a partir da vista onde o treinador estiver no momento do toque: em
  // 3D, grava a própria cena 3D (recordScene3D); em 2D, o campo achatado
  // (generateSequenceVideo) — o que se vê é o que fica no vídeo.
  const prepareVideo = async () => {
    const steps = cleaned();
    if (!steps.length) return;
    const is3D = sceneRef.current?.viewMode === "3d";
    setExportState({ progress: 0 });
    try {
      const { blob, extension, mimeType } = is3D
        ? await recordScene3D(sceneRef.current, { onProgress: (progress) => setExportState({ progress }) })
        : await generateSequenceVideo(steps, { onProgress: (progress) => setExportState({ progress }) });
      const filename = `jogada-${steps.length}-passos${is3D ? "-3d" : ""}.${extension}`;
      if (canShareFiles) {
        setExportState({ ready: { blob, filename, mimeType } });
      } else {
        downloadBlob(blob, filename);
        setExportState(null);
      }
    } catch (e) {
      setExportState({ error: e.message || "Não foi possível gerar o vídeo." });
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Chamado num toque novo (depois do vídeo já estar pronto), para o
  // navigator.share ainda contar como reação direta ao utilizador.
  const shareReady = async () => {
    const ready = exportState?.ready;
    if (!ready) return;
    try {
      const file = new File([ready.blob], ready.filename, { type: ready.mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title || "Jogada" });
      } else {
        downloadBlob(ready.blob, ready.filename);
      }
      setExportState(null);
    } catch (e) {
      if (e?.name === "AbortError") {
        setExportState(null); // o utilizador fechou a folha de partilha sem escolher nada
        return;
      }
      setExportState({ error: e.message || "Não foi possível partilhar o vídeo." });
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
        {exportState?.error && <span className="text-xs text-[#D64545]">{exportState.error}</span>}
        <button
          type="button"
          onClick={exportState?.ready ? shareReady : prepareVideo}
          disabled={(exportState && "progress" in exportState) || !cleaned().length}
          title={
            exportState?.ready
              ? "Partilhar o vídeo já gerado"
              : canShareFiles
                ? "Gerar a sequência em vídeo (na vista 2D ou 3D em que estiveres), para partilhar"
                : "Descarregar a sequência como vídeo (na vista 2D ou 3D em que estiveres), para enviar às jogadoras"
          }
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-[#2E3644] text-[#C7CDD8] hover:border-[#5A6272] hover:text-[#F2EDE3] disabled:opacity-40"
        >
          {exportState && "progress" in exportState ? (
            <>
              <Loader2 size={13} className="animate-spin" /> {Math.round(exportState.progress * 100)}%
            </>
          ) : exportState?.ready ? (
            <>
              <Share2 size={13} /> Partilhar agora
            </>
          ) : canShareFiles ? (
            <>
              <Share2 size={13} /> Gerar vídeo
            </>
          ) : (
            <>
              <Download size={13} /> Vídeo
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
            onReady={(scene) => {
              sceneRef.current = scene;
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
