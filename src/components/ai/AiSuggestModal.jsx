import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { uid } from "../../utils";
import { callClaudeJSON } from "../../ai";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions } from "../common/Modal";

function AiSuggestModal({ mode, defaults, onClose, onInsertTreino, onUseExercicio }) {
  const [objetivo, setObjetivo] = useState(defaults.objetivo || "");
  const [duracaoTotal, setDuracaoTotal] = useState(defaults.duracaoTotal || 90);
  const [nivel, setNivel] = useState(defaults.nivel || "");
  const [foco, setFoco] = useState("");
  const [contexto, setContexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultTreino, setResultTreino] = useState(null); // array with {selected, ...}
  const [resultExercicio, setResultExercicio] = useState(null);

  const habilidade = defaults.habilidade || null;

  const gerar = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "treino") {
        const prompt = `És um treinador assistente de basquetebol de formação, a escrever em português de Portugal.

Sugere um conjunto de exercícios práticos para um treino, com estas condições:
- Objetivo do treino: "${objetivo || "trabalho geral de fundamentos"}"
- Nível/escalão da equipa: "${nivel || "não especificado, assume formação jovem"}"
- Duração total pretendida: aproximadamente ${duracaoTotal} minutos
- Foco tático preferencial: ${foco || "equilibrado entre ataque e defesa"}

Devolve APENAS um array JSON válido, sem markdown, sem comentários, sem texto antes ou depois, com esta estrutura exata:
[
  { "nome": "Nome curto do exercício", "duracao": 15, "descricao": "Organização, critérios de êxito e variantes, em 2 a 4 frases práticas e diretas, como notas reais de treinador." }
]

Usa entre 3 e 6 exercícios, cuja soma de "duracao" (em minutos) se aproxime do total pretendido. Escreve tudo em português de Portugal.`;
        const items = await callClaudeJSON(prompt);
        if (!Array.isArray(items)) throw new Error("Resposta inesperada da IA.");
        setResultTreino(items.map((it) => ({ ...it, selected: true, id: uid() })));
      } else {
        const habLabel = habilidade ? `${habilidade.fase} · ${habilidade.componente} · ${habilidade.nome}` : "geral";
        const prompt = `És um treinador assistente de basquetebol de formação, a escrever em português de Portugal.

Sugere UM exercício de treino para trabalhar especificamente a habilidade: "${habLabel}".
${contexto ? `Contexto adicional: "${contexto}"` : ""}
${defaults.duracaoPadrao ? `Duração alvo: aproximadamente ${defaults.duracaoPadrao} minutos.` : ""}

Devolve APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com esta estrutura exata:
{ "nome": "Nome curto do exercício", "duracaoPadrao": 15, "descricao": "Organização, critérios de êxito e variantes, em 2 a 4 frases práticas e diretas, como notas reais de treinador." }

Escreve tudo em português de Portugal.`;
        const item = await callClaudeJSON(prompt);
        setResultExercicio(item);
      }
    } catch (e) {
      setError(e.message || "Ocorreu um erro ao contactar a IA.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (id) => {
    setResultTreino(resultTreino.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)));
  };

  return (
    <Modal onClose={onClose} title={mode === "treino" ? "Sugerir treino com IA" : "Sugerir exercício com IA"} wide={mode === "treino"}>
      {mode === "exercicio" && habilidade && (
        <div className="text-xs text-[#8A93A3] mb-3 bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2">
          Habilidade: <b className="text-[#F2EDE3]">{habilidade.fase} · {habilidade.componente} · {habilidade.nome}</b>
        </div>
      )}

      {!resultTreino && !resultExercicio && (
        <>
          {mode === "treino" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Objetivo do treino" className="col-span-2">
                <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inputCls} placeholder="Ex: Melhorar transição defesa-ataque" />
              </Field>
              <Field label="Duração total pretendida (min)">
                <input type="number" min="10" value={duracaoTotal} onChange={(e) => setDuracaoTotal(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Nível / escalão">
                <input value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputCls} placeholder="Ex: Sub-14, iniciantes" />
              </Field>
              <Field label="Foco tático" className="col-span-2">
                <select value={foco} onChange={(e) => setFoco(e.target.value)} className={inputCls}>
                  <option value="">Equilibrado (ataque e defesa)</option>
                  <option value="Defesa">Defesa</option>
                  <option value="Ataque">Ataque</option>
                </select>
              </Field>
            </div>
          ) : (
            <Field label="Contexto adicional (opcional)">
              <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} className={inputCls + " resize-none"} style={{ minHeight: 70 }} placeholder="Ex: para jogadoras principiantes, sem oposição" />
            </Field>
          )}

          {error && (
            <div className="mt-3 text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={gerar}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-60 text-[#14181F] text-sm font-medium rounded-md py-2.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "A gerar..." : "Gerar sugestões"}
            </button>
            <button onClick={onClose} className="w-full text-center text-xs text-[#8A93A3] hover:text-[#F2EDE3] mt-2 py-1">Cancelar</button>
          </div>
        </>
      )}

      {resultTreino && (
        <>
          <div className="text-xs text-[#8A93A3] mb-2">Desmarca o que não quiseres incluir, depois adiciona ao treino.</div>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {resultTreino.map((it) => (
              <label key={it.id} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer ${it.selected ? "border-[#EA5B13] bg-[#EA5B13]/5" : "border-[#2E3644]"}`}>
                <input type="checkbox" checked={it.selected} onChange={() => toggleSelected(it.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{it.nome}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{it.duracao} min</span>
                  </div>
                  <div className="text-xs text-[#8A93A3] mt-0.5">{it.descricao}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => { setResultTreino(null); setError(null); }} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3]">← Gerar novamente</button>
          </div>
        </>
      )}

      {resultExercicio && (
        <div className="border border-[#2E3644] rounded-md p-3 bg-[#14181F]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium">{resultExercicio.nome}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[10px] text-[#8A93A3] shrink-0">{resultExercicio.duracaoPadrao} min</span>
          </div>
          <div className="text-xs text-[#8A93A3]">{resultExercicio.descricao}</div>
          <button onClick={() => { setResultExercicio(null); setError(null); }} className="text-xs text-[#8A93A3] hover:text-[#F2EDE3] mt-3">← Gerar novamente</button>
        </div>
      )}

      {(resultTreino || resultExercicio) && (
        <ModalActions
          onCancel={onClose}
          saveLabel={mode === "treino" ? "Adicionar ao treino" : "Usar este exercício"}
          disabled={mode === "treino" ? !resultTreino.some((i) => i.selected) : false}
          onSave={() => {
            if (mode === "treino") onInsertTreino(resultTreino.filter((i) => i.selected));
            else onUseExercicio(resultExercicio);
          }}
        />
      )}
    </Modal>
  );
}

export { AiSuggestModal };

