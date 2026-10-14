import { useMemo, useState } from "react";
import { Court3DView } from "../components/diagrams/court3d";
import { DEMO_PLAYS } from "./demoPlays";

// Página de protótipo da vista 3D, isolada da app (sem login nem Supabase).
// Abre em /prototype-3d.html. Permite escolher uma jogada de demonstração ou
// colar o JSON de uma jogada real (o campo `diagramas` de um exercício).
function Prototype3D() {
  const [playId, setPlayId] = useState(DEMO_PLAYS[0].id);
  const [custom, setCustom] = useState(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState(null);

  const current = useMemo(() => {
    if (custom) return custom;
    return DEMO_PLAYS.find((p) => p.id === playId);
  }, [playId, custom]);

  const loadJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : parsed.diagramas || [parsed.diagrama || parsed];
      if (!list.length || !list.every((d) => Array.isArray(d.tokens) && Array.isArray(d.arrows))) {
        throw new Error("Esperava um diagrama ou uma lista de diagramas com `tokens` e `arrows`.");
      }
      setCustom({ id: "custom", nome: parsed.nome || "Jogada colada", diagramas: list });
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  return (
    <div className="min-h-full bg-[#14181F] text-[#F2EDE3]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-[11px] tracking-[0.2em] uppercase text-[#EA5B13]">
              Protótipo
            </div>
            <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl uppercase tracking-wide">
              Vista 3D de jogadas
            </h1>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DEMO_PLAYS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCustom(null);
                  setPlayId(p.id);
                }}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  !custom && playId === p.id ? "border-[#EA5B13] text-[#F2EDE3] bg-[#EA5B13]/10" : "border-[#2E3644] text-[#8A93A3] hover:border-[#5A6272]"
                }`}
              >
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        <Court3DView
          key={current.id}
          diagramas={current.diagramas}
          onReady={(scene) => (window.__court3d = scene)} title={current.nome}
          className="w-full h-[72vh] min-h-[420px] border border-[#2E3644]"
        />

        <div className="mt-3 text-[11px] text-[#5A6272] leading-relaxed">
          Arrastar para rodar/inclinar · roda do rato ou pinça para zoom · botão direito (ou Shift) + arrastar para deslocar ·
          teclas: espaço reproduz, ← → passos, Q/E rodam, F enquadra.
        </div>

        <details className="mt-4 bg-[#1E242E] border border-[#2E3644] rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Testar com uma jogada real (colar JSON)</summary>
          <div className="px-4 pb-4">
            <p className="text-xs text-[#8A93A3] mb-2">
              Cola um diagrama, uma lista de diagramas, ou um exercício inteiro (usa o campo <code>diagramas</code>).
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={6}
              className="w-full bg-[#14181F] border border-[#2E3644] rounded-md p-2 text-xs text-[#F2EDE3] focus:outline-none focus:border-[#EA5B13]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              placeholder='[{"court":"meio","tokens":[...],"arrows":[...]}]'
            />
            <div className="flex items-center gap-3 mt-2">
              <button type="button" onClick={loadJson} className="text-xs px-3 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] font-medium">
                Ver em 3D
              </button>
              {jsonError && <span className="text-xs text-[#D64545]">{jsonError}</span>}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export { Prototype3D };
