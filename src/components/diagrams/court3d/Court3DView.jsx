import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Scan,
  Maximize2,
  Minimize2,
  Orbit,
  Rewind,
} from "lucide-react";
import { Court3DScene } from "./Court3DScene";
import { usePlayEditor } from "./usePlayEditor";
import { EditToolbar } from "./EditToolbar";

const SPEEDS = [0.5, 1, 1.5, 2];

function IconBtn({ onClick, title, active, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex items-center justify-center rounded-md border backdrop-blur-md transition-colors ${
        active
          ? "bg-[#EA5B13] border-[#EA5B13] text-[#14181F]"
          : "bg-[#1E242E]/80 border-[#2E3644] text-[#F2EDE3] hover:border-[#EA5B13] hover:text-[#FF6B1A]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Vista 3D de uma jogada. Com `editable`, a própria vista é o editor, tanto em
 * 2D (campo visto de cima) como em 3D (perspetiva).
 *
 * Props:
 *  - diagramas: array de diagramas {court, tokens, arrows} (um por passo) ou um
 *    único diagrama.
 *  - title: texto opcional no canto superior esquerdo.
 *  - autoPlay: começa a reproduzir assim que a cena estiver pronta.
 *  - bloom: liga/desliga o brilho pós-processado (desligar em aparelhos fracos).
 *  - onReady(scene): recebe a instância de Court3DScene (controlo externo / testes).
 *  - editable: liga o editor (na vista 2D e na 3D). Nesse modo `diagramas` só é lido na
 *    montagem (dá uma `key` diferente por jogada) e cada alteração chega por
 *    onChange(diagramas).
 *  - initialView: "3d" (por omissão) ou "2d".
 *  - className / style: dimensões do contentor (o canvas ocupa 100%).
 */
function Court3DView({ diagramas, title, autoPlay = false, bloom = true, onReady, editable = false, onChange, initialView = "3d", className = "", style }) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [state, setState] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const initialViewRef = useRef(initialView);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const scene = new Court3DScene(mountRef.current, { onStateChange: setState, bloom });
    sceneRef.current = scene;
    if (initialViewRef.current === "2d") scene.setViewMode("2d");
    onReadyRef.current?.(scene);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [bloom]);

  const editor = usePlayEditor({
    initial: Array.isArray(diagramas) ? diagramas : diagramas ? [diagramas] : [],
    onChange,
    sceneRef,
    stepIndex: state?.stepIndex ?? 0,
    editable,
    enabled: editable,
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || editable) return;
    scene.setSequence(diagramas);
    if (autoPlay) scene.ready.then(() => setTimeout(() => sceneRef.current === scene && scene.play(), 900));
  }, [diagramas, autoPlay, bloom, editable]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Atalhos de teclado quando o rato está sobre a vista (útil a apresentar).
  useEffect(() => {
    const el = rootRef.current;
    const onKey = (e) => {
      const s = sceneRef.current;
      if (!s || e.target.closest("button, input, textarea, select")) return;
      const ed = editorRef.current;
      if (editable && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (editable && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ed.redo();
      else if (editable && (e.key === "Delete" || e.key === "Backspace")) ed.deleteSelected();
      else if (editable && e.key === "Escape") ed.setMode(ed.mode);
      else if (e.key === " ") s.togglePlay();
      else if (e.key === "ArrowRight") s.nextStep();
      else if (e.key === "ArrowLeft") s.prevStep();
      else if (e.key === "q") s.rotateBy(Math.PI / 4);
      else if (e.key === "e") s.rotateBy(-Math.PI / 4);
      else if (e.key === "f") s.frame();
      else return;
      e.preventDefault();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [editable]);

  const s = sceneRef.current;
  const st = state || { stepIndex: 0, stepCount: 1, stepProgress: 0, playing: false, speed: 1, viewMode: "3d", autoRotate: false, tilt: 0.6 };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current.requestFullscreen?.();
  };

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(st.speed);
    s?.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={`flex flex-col overflow-hidden rounded-lg bg-[#0B0E13] outline-none select-none ${className}`}
      style={style}
    >
      {editable && <EditToolbar editor={editor} viewMode={st.viewMode} stepIndex={st.stepIndex} />}
      <div className="relative flex-1 min-h-0">
      <div ref={mountRef} className="absolute inset-0" />
      {/* Vinheta: escurece os cantos e puxa o olhar para o campo. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(5,7,10,0.65) 100%)" }} />

      {/* Topo: título + passos */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto min-w-0">
          {title && (
            <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wider text-sm text-[#F2EDE3] truncate drop-shadow">
              {title}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[11px] text-[#8A93A3]">
              PASSO <span className="text-[#F2EDE3]">{st.stepIndex + 1}</span>/{st.stepCount}
            </span>
          </div>
        </div>
        <div className="flex gap-1.5 pointer-events-auto">
          <div className="flex rounded-md border border-[#2E3644] bg-[#1E242E]/80 backdrop-blur-md p-0.5" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {["2d", "3d"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => s?.setViewMode(m)}
                className={`px-2.5 h-8 rounded text-xs tracking-wider uppercase transition-colors ${
                  st.viewMode === m ? "bg-[#EA5B13] text-[#14181F]" : "text-[#8A93A3] hover:text-[#F2EDE3]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <IconBtn onClick={toggleFullscreen} title={fullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </IconBtn>
        </div>
      </div>

      {/* Lateral: câmara */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
        <IconBtn onClick={() => s?.rotateBy(Math.PI / 4)} title="Rodar para a esquerda (Q)">
          <RotateCcw size={16} />
        </IconBtn>
        <IconBtn onClick={() => s?.rotateBy(-Math.PI / 4)} title="Rodar para a direita (E)">
          <RotateCw size={16} />
        </IconBtn>
        <IconBtn onClick={() => s?.zoomBy(0.8)} title="Aproximar">
          <ZoomIn size={16} />
        </IconBtn>
        <IconBtn onClick={() => s?.zoomBy(1.25)} title="Afastar">
          <ZoomOut size={16} />
        </IconBtn>
        <IconBtn onClick={() => s?.frame()} title="Enquadrar (F)">
          <Scan size={16} />
        </IconBtn>
        <IconBtn onClick={() => s?.setAutoRotate(!st.autoRotate)} title="Rotação automática" active={st.autoRotate}>
          <Orbit size={16} />
        </IconBtn>
      </div>

      {/* Fundo: reprodução + inclinação */}
      <div className="absolute left-3 right-3 bottom-3 flex flex-col gap-2">
        <div className="flex gap-1">
          {Array.from({ length: st.stepCount }).map((_, i) => {
            const fill = i < st.stepIndex ? 1 : i === st.stepIndex ? st.stepProgress : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => s?.goToStep(i)}
                title={`Passo ${i + 1}`}
                className="flex-1 h-1.5 rounded-full bg-[#2E3644]/90 overflow-hidden hover:bg-[#3A4354]"
              >
                <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: i < st.stepIndex ? "#4C9A6A" : "#EA5B13" }} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <IconBtn onClick={() => s?.reset()} title="Reiniciar">
            <Rewind size={16} />
          </IconBtn>
          <IconBtn onClick={() => s?.prevStep()} title="Passo anterior (←)">
            <SkipBack size={16} />
          </IconBtn>
          <button
            type="button"
            onClick={() => s?.togglePlay()}
            className="h-9 px-4 flex items-center gap-2 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] shadow-[0_0_24px_rgba(234,91,19,0.45)]"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {st.playing ? <Pause size={16} /> : <Play size={16} />}
            <span className="text-xs tracking-wider uppercase">{st.playing ? "Pausa" : "Reproduzir"}</span>
          </button>
          <IconBtn onClick={() => s?.nextStep()} title="Passo seguinte (→)">
            <SkipForward size={16} />
          </IconBtn>
          <button
            type="button"
            onClick={cycleSpeed}
            title="Velocidade"
            className="h-9 px-2.5 rounded-md border border-[#2E3644] bg-[#1E242E]/80 backdrop-blur-md text-[11px] text-[#F2EDE3] hover:border-[#EA5B13]"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {st.speed}×
          </button>
          <label className="ml-auto flex items-center gap-2 h-9 px-3 rounded-md border border-[#2E3644] bg-[#1E242E]/80 backdrop-blur-md">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="text-[10px] tracking-wider uppercase text-[#8A93A3]">
              Inclinação
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={st.tilt}
              onChange={(e) => s?.setTilt(Number(e.target.value))}
              className="w-24 sm:w-32 accent-[#EA5B13]"
            />
          </label>
        </div>
      </div>
      </div>
    </div>
  );
}

export { Court3DView };
