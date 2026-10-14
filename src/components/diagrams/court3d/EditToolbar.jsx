import { useState } from "react";
import { MousePointer2, Undo2, Redo2, Trash2, Plus, Copy, Check } from "lucide-react";
import { ARROW_TYPES } from "../../../data";

const TOKENS = [
  { type: "offense", label: "Ataque", swatch: "bg-[#EA5B13]" },
  { type: "defense", label: "Defesa", swatch: "border-2 border-dashed border-[#D64545]" },
  { type: "ball", label: "Bola", swatch: "bg-[#E2581A] w-2.5 h-2.5" },
  { type: "cone", label: "Cone", swatch: "bg-[#F2C744] [clip-path:polygon(50%_0,100%_100%,0_100%)]" },
  { type: "treinador", label: "Treinador", swatch: "bg-[#F2EDE3] rounded-[2px]" },
];

const HINTS = {
  mover: "Arrasta as fichas para as posicionar. Toca numa seta para a selecionar e arrasta a pega laranja para a curvar.",
  mover3d: "Arrasta as fichas para as mover; arrastar no chão vazio roda a câmara. Toca numa seta para a selecionar e arrasta a pega laranja para a curvar.",
  passe: "Arrasta da jogadora com bola até quem recebe (ou toca numa e depois na outra). O passe só desloca a bola.",
  drible: "Arrasta da jogadora com bola até onde termina o drible. A bola vai com ela.",
  corte: "Arrasta da jogadora até ao destino do corte.",
  bloqueio: "Arrasta da jogadora que bloqueia até ao sítio do bloqueio.",
  lancamento: "Arrasta da bola (ou de quem lança) até ao cesto.",
  handoff: "Arrasta da jogadora com bola até à companheira que a recebe.",
};

const btn = "h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs transition-colors disabled:opacity-35 disabled:pointer-events-none";
const idle = "border border-[#2E3644] text-[#C7CDD8] hover:border-[#5A6272] hover:text-[#F2EDE3]";
const active = "bg-[#EA5B13] text-[#14181F] border border-[#EA5B13]";

function Group({ label, children }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span style={{ fontFamily: "'Oswald', sans-serif" }} className="text-[10px] tracking-[0.14em] uppercase text-[#5A6272] mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Barra de edição por cima da vista (aparece com `editable`). */
function EditToolbar({ editor, viewMode, stepIndex }) {
  const [confirmStep, setConfirmStep] = useState(false);

  const e = editor;
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-[#1E242E] border-b border-[#2E3644]">
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <Group label="Ação">
          <button type="button" onClick={() => e.setMode("mover")} className={`${btn} ${e.mode === "mover" ? active : idle}`}>
            <MousePointer2 size={13} /> Mover
          </button>
          {ARROW_TYPES.map((a) => (
            <button key={a.id} type="button" onClick={() => e.setMode(a.id)} title={a.desc} className={`${btn} ${e.mode === a.id ? active : idle}`}>
              {a.label}
            </button>
          ))}
        </Group>
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={e.undo} disabled={!e.canUndo} title="Desfazer (Ctrl+Z)" className={`${btn} ${idle}`}>
            <Undo2 size={14} />
          </button>
          <button type="button" onClick={e.redo} disabled={!e.canRedo} title="Refazer (Ctrl+Y)" className={`${btn} ${idle}`}>
            <Redo2 size={14} />
          </button>
          <button type="button" onClick={e.deleteSelected} disabled={!e.selectedId} title="Apagar selecionado (Delete)" className={`${btn} ${idle} hover:!border-[#D64545] hover:!text-[#D64545]`}>
            <Trash2 size={13} /> Apagar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <Group label="Adicionar">
          {TOKENS.map((t) => (
            <button key={t.type} type="button" onClick={() => e.addToken(t.type)} disabled={t.type === "ball" && e.hasBall} className={`${btn} ${idle}`}>
              <span className={`inline-block w-3 h-3 rounded-full ${t.swatch}`} /> {t.label}
            </button>
          ))}
        </Group>
        <Group label={`Passo ${stepIndex + 1}/${e.steps.length}`}>
          <button type="button" onClick={e.addStep} title="Novo passo a partir das posições finais deste" className={`${btn} ${idle}`}>
            <Plus size={13} /> Novo passo
          </button>
          <button type="button" onClick={e.duplicateStep} title="Duplicar este passo" className={`${btn} ${idle}`}>
            <Copy size={13} />
          </button>
          <button
            type="button"
            title={confirmStep ? "Toca outra vez para apagar" : "Apagar este passo"}
            onClick={() => {
              if (confirmStep) {
                e.deleteStep();
                setConfirmStep(false);
              } else {
                setConfirmStep(true);
                setTimeout(() => setConfirmStep(false), 2500);
              }
            }}
            className={`${btn} ${confirmStep ? "bg-[#D64545] border border-[#D64545] text-white" : idle}`}
          >
            {confirmStep ? <Check size={13} /> : <Trash2 size={13} />}
          </button>
        </Group>
        <select
          id="edit-court"
          value={e.court}
          onChange={(ev) => e.setCourt(ev.target.value)}
          className="h-8 ml-auto bg-[#14181F] border border-[#2E3644] rounded-md px-2 text-xs text-[#F2EDE3] focus:outline-none focus:border-[#EA5B13]"
        >
          <option value="meio">Meio campo</option>
          <option value="campo">Campo inteiro</option>
        </select>
      </div>

      <div className="text-[11px] text-[#8A93A3]">
        {e.pendingFrom ? "Agora toca na jogadora (ou no ponto) de destino · toca outra vez na mesma para cancelar." : HINTS[e.mode === "mover" && viewMode === "3d" ? "mover3d" : e.mode]}
        {e.mode !== "mover" && viewMode === "3d" && !e.pendingFrom && <span className="text-[#5A6272]"> · Para rodar a câmara enquanto desenhas: botão direito, dois dedos ou as setas à direita.</span>}
        {e.mode !== "mover" && !e.pendingFrom && <span className="text-[#5A6272]"> · Shift ao arrastar para linha reta.</span>}
      </div>
    </div>
  );
}

export { EditToolbar };
