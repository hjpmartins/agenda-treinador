import { useEffect, useMemo, useState } from "react";
import { Court3DView } from "../components/diagrams/court3d";
import { DEMO_PLAYS } from "./demoPlays";
import { MyPlays, loadPlays, savePlays, newPlay } from "./MyPlays";

const tabCls = (active) =>
  `px-3 h-8 rounded text-xs tracking-wider uppercase transition-colors ${active ? "bg-[#EA5B13] text-[#14181F]" : "text-[#8A93A3] hover:text-[#F2EDE3]"}`;

// Página de protótipo da vista 3D, isolada da app (sem login nem Supabase).
// Abre em /prototype-3d.html. Mostra jogadas de demonstração ou as jogadas
// criadas aqui com o editor 2D da app (guardadas no navegador), e permite
// importar o JSON de uma jogada real.
function Prototype3D() {
  const [source, setSource] = useState(() => (loadPlays().length ? "minhas" : "demos"));
  const [demoId, setDemoId] = useState(DEMO_PLAYS[0].id);
  const [plays, setPlays] = useState(loadPlays);
  const [myId, setMyId] = useState(() => loadPlays()[0]?.id || null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState(null);

  useEffect(() => savePlays(plays), [plays]);

  const myPlay = plays.find((p) => p.id === myId) || null;
  const current = useMemo(() => {
    if (source === "minhas") return myPlay ? { ...myPlay, key: myPlay.id } : { key: "vazio", nome: "", diagramas: [] };
    const d = DEMO_PLAYS.find((p) => p.id === demoId);
    return { ...d, key: d.id };
  }, [source, myPlay, demoId]);

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : parsed.diagramas || [parsed.diagrama || parsed];
      if (!list.length || !list.every((d) => Array.isArray(d.tokens) && Array.isArray(d.arrows))) {
        throw new Error("Esperava um diagrama ou uma lista de diagramas com `tokens` e `arrows`.");
      }
      const p = newPlay(parsed.nome || "Jogada importada", list);
      setPlays((ps) => [...ps, p]);
      setMyId(p.id);
      setSource("minhas");
      setJsonText("");
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  // Começar a editar uma demonstração: copia-a para "As minhas jogadas".
  const copyDemo = () => {
    const d = DEMO_PLAYS.find((p) => p.id === demoId);
    const p = newPlay(`${d.nome} (cópia)`, JSON.parse(JSON.stringify(d.diagramas)));
    setPlays((ps) => [...ps, p]);
    setMyId(p.id);
    setSource("minhas");
  };

  return (
    <div className="min-h-full bg-[#14181F] text-[#F2EDE3]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif" }} className="text-[11px] tracking-[0.2em] uppercase text-[#EA5B13]">
              Protótipo
            </div>
            <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl uppercase tracking-wide">
              Vista 3D de jogadas
            </h1>
          </div>
          <div className="flex rounded-md border border-[#2E3644] bg-[#1E242E] p-0.5" style={{ fontFamily: "'Oswald', sans-serif" }}>
            <button type="button" onClick={() => setSource("minhas")} className={tabCls(source === "minhas")}>
              As minhas jogadas
            </button>
            <button type="button" onClick={() => setSource("demos")} className={tabCls(source === "demos")}>
              Demonstrações
            </button>
          </div>
        </div>

        {source === "minhas" ? (
          <MyPlays plays={plays} selectedId={myId} onSelect={setMyId} onPlaysChange={setPlays} />
        ) : (
          <div className="flex gap-1.5 flex-wrap items-center">
            {DEMO_PLAYS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDemoId(p.id)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  demoId === p.id ? "border-[#EA5B13] text-[#F2EDE3] bg-[#EA5B13]/10" : "border-[#2E3644] text-[#8A93A3] hover:border-[#5A6272]"
                }`}
              >
                {p.nome}
              </button>
            ))}
            <button type="button" onClick={copyDemo} className="text-xs px-3 py-1.5 rounded-md border border-dashed border-[#5A6272] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#EA5B13] ml-auto">
              Copiar para as minhas jogadas e editar
            </button>
          </div>
        )}

        <div>
          <div className="relative">
            <Court3DView
              key={`${source}-${current.key}`}
              diagramas={current.diagramas}
              editable={source === "minhas" && !!myPlay}
              initialView={source === "minhas" ? "2d" : "3d"}
              onChange={(diagramas) => setPlays((ps) => ps.map((p) => (p.id === myId ? { ...p, diagramas } : p)))}
              onReady={(scene) => (window.__court3d = scene)}
              title={current.nome}
              className="w-full h-[80vh] min-h-[520px] border border-[#2E3644]"
            />
          </div>
          <div className="mt-3 text-[11px] text-[#5A6272] leading-relaxed">
            Arrastar para rodar/inclinar · roda do rato ou pinça para zoom · botão direito (ou Shift) + arrastar para deslocar · teclas: espaço reproduz, ← → passos,
            Q/E rodam, F enquadra.
          </div>
        </div>

        <details className="bg-[#1E242E] border border-[#2E3644] rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Importar uma jogada (colar JSON)</summary>
          <div className="px-4 pb-4">
            <p className="text-xs text-[#8A93A3] mb-2">
              Cola um diagrama, uma lista de diagramas, ou um exercício inteiro (usa o campo <code>diagramas</code>). Fica guardada em &quot;As minhas jogadas&quot;.
            </p>
            <textarea
              id="import-json"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={5}
              className="w-full bg-[#14181F] border border-[#2E3644] rounded-md p-2 text-xs text-[#F2EDE3] focus:outline-none focus:border-[#EA5B13]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              placeholder='[{"court":"meio","tokens":[...],"arrows":[...]}]'
            />
            <div className="flex items-center gap-3 mt-2">
              <button type="button" onClick={importJson} className="text-xs px-3 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] font-medium">
                Importar e ver em 3D
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
