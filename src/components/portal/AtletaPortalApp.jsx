// Espaço Atletas: ecrã próprio, aberto por um link pessoal (sem conta nem
// password — ver portal_token em supabase/schema.sql e src/lib/portalDb.js).
// Nada daqui usa a sessão/autenticação do treinador nem os componentes da
// app principal (Sidebar, TopBar, ...) — é montado à parte em main.jsx,
// antes de qualquer lógica do treinador correr.

import { useEffect, useState } from "react";
import { Loader2, Megaphone, CalendarDays, HeartPulse, CheckCircle2, Circle } from "lucide-react";
import * as portalDb from "../../lib/portalDb";
import { DiagramThumbnail } from "../diagrams/CourtPrimitives";
import { todayStr, formatDateFull } from "../../utils";

function Shell({ children }) {
  return (
    <div className="min-h-full w-full bg-[#14181F] text-[#F2EDE3] flex items-center justify-center p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {children}
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-[#EA5B13]" />
        <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function AtletaPortalApp({ token }) {
  const [state, setState] = useState("loading"); // loading | invalid | ready
  const [dados, setDados] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [treinos, setTreinos] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [lesaoTexto, setLesaoTexto] = useState("");
  const [lesaoEnviada, setLesaoEnviada] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await portalDb.getDados(token);
        if (!d) {
          if (!cancelled) setState("invalid");
          return;
        }
        const [av, tr, pg] = await Promise.all([portalDb.getAvisos(token), portalDb.getTreinos(token), portalDb.getPerguntas(token)]);
        if (cancelled) return;
        setDados(d);
        setAvisos(av);
        setTreinos(tr);
        setPerguntas(pg);
        setState("ready");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const responder = async (perguntaId, opcao) => {
    setBusyId(perguntaId);
    try {
      await portalDb.setResposta(token, perguntaId, opcao);
      setPerguntas((list) => list.map((q) => (q.id === perguntaId ? { ...q, resposta: opcao } : q)));
    } catch {
      // mantém a pergunta por responder — a atleta pode tentar outra vez
    } finally {
      setBusyId(null);
    }
  };

  const confirmarRsvp = async (sessionId, status) => {
    setBusyId(sessionId);
    try {
      await portalDb.setRsvp(token, sessionId, status);
      setTreinos((list) => list.map((s) => (s.id === sessionId ? { ...s, rsvp: status } : s)));
    } catch {
      // ignora — o botão mantém-se por confirmar
    } finally {
      setBusyId(null);
    }
  };

  const enviarLesao = async (e) => {
    e.preventDefault();
    if (!lesaoTexto.trim()) return;
    setBusyId("lesao");
    try {
      await portalDb.reportarLesao(token, lesaoTexto.trim());
      setLesaoTexto("");
      setLesaoEnviada(true);
      setTimeout(() => setLesaoEnviada(false), 4000);
    } catch {
      // deixa o texto no formulário para a atleta tentar outra vez
    } finally {
      setBusyId(null);
    }
  };

  if (state === "loading") {
    return (
      <Shell>
        <Loader2 className="animate-spin text-[#5A6272]" size={24} />
      </Shell>
    );
  }

  if (state === "invalid") {
    return (
      <Shell>
        <div className="text-center max-w-xs">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold mb-2">Link inválido</div>
          <div className="text-sm text-[#8A93A3]">Este link não existe ou já não é válido. Pede ao treinador um link novo.</div>
        </div>
      </Shell>
    );
  }

  const hojeStr = todayStr();
  const perguntasPorResponder = perguntas.filter((q) => q.resposta == null);
  // Só o próximo treino — os antigos não interessam às atletas aqui.
  const proximoTreino = treinos.filter((s) => s.date >= hojeStr).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;

  return (
    <div className="min-h-full w-full bg-[#14181F] text-[#F2EDE3]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-xl mx-auto p-4 pb-16">
        <div className="mb-5 pt-2">
          <div className="text-[10px] tracking-[0.2em] uppercase text-[#EA5B13]" style={{ fontFamily: "'Oswald', sans-serif" }}>Espaço Atletas</div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">Olá, {dados.nome}</h1>
          <div className="text-sm text-[#8A93A3]">{dados.equipaNome}</div>
        </div>

        {perguntasPorResponder.length > 0 && (
          <Card title="Por responder" icon={Megaphone}>
            <div className="space-y-3">
              {perguntasPorResponder.map((q) => (
                <div key={q.id} className="border border-[#EA5B13]/40 bg-[#EA5B13]/5 rounded-md p-3">
                  <div className="text-sm mb-2">{q.texto}</div>
                  <div className="flex flex-wrap gap-2">
                    {q.opcoes.map((op) => (
                      <button
                        key={op}
                        disabled={busyId === q.id}
                        onClick={() => responder(q.id, op)}
                        className="px-3.5 py-1.5 text-sm rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] font-medium disabled:opacity-50"
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Avisos" icon={Megaphone}>
          {avisos.length === 0 ? (
            <div className="text-sm text-[#5A6272]">Sem avisos por agora.</div>
          ) : (
            <div className="space-y-3">
              {avisos.map((a) => (
                <div key={a.id} className="border-b border-[#2E3644] last:border-0 pb-3 last:pb-0">
                  <div className="text-sm font-medium">{a.titulo}</div>
                  {a.texto && <div className="text-sm text-[#C7CDD8] mt-0.5 whitespace-pre-wrap">{a.texto}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Próximo treino" icon={CalendarDays}>
          {!proximoTreino ? (
            <div className="text-sm text-[#5A6272]">Sem treinos agendados.</div>
          ) : (
            <div className="border border-[#2E3644] rounded-md p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">{formatDateFull(proximoTreino.date)}</div>
                <div className="flex gap-1.5">
                  <button
                    disabled={busyId === proximoTreino.id}
                    onClick={() => confirmarRsvp(proximoTreino.id, "vou")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border disabled:opacity-50 ${
                      proximoTreino.rsvp === "vou" ? "bg-[#4C9A6A]/20 border-[#4C9A6A] text-[#4C9A6A]" : "border-[#2E3644] text-[#8A93A3] hover:border-[#5A6272]"
                    }`}
                  >
                    {proximoTreino.rsvp === "vou" ? <CheckCircle2 size={12} /> : <Circle size={12} />} Vou
                  </button>
                  <button
                    disabled={busyId === proximoTreino.id}
                    onClick={() => confirmarRsvp(proximoTreino.id, "nao_vou")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border disabled:opacity-50 ${
                      proximoTreino.rsvp === "nao_vou" ? "bg-[#D64545]/20 border-[#D64545] text-[#D64545]" : "border-[#2E3644] text-[#8A93A3] hover:border-[#5A6272]"
                    }`}
                  >
                    {proximoTreino.rsvp === "nao_vou" ? <CheckCircle2 size={12} /> : <Circle size={12} />} Não vou
                  </button>
                </div>
              </div>
              <div className="text-sm font-medium">{proximoTreino.title || "Treino"}</div>
              {proximoTreino.objetivo && <div className="text-xs text-[#8A93A3] mt-0.5">Objetivo: {proximoTreino.objetivo}</div>}
              {proximoTreino.observacoes && <div className="text-xs text-[#8A93A3] mt-1 whitespace-pre-wrap">{proximoTreino.observacoes}</div>}
              {(proximoTreino.exercicios || []).length > 0 && (
                <div className="mt-2.5 space-y-2.5">
                  {proximoTreino.exercicios.map((e, i) => (
                    <div key={e.id || i} className="bg-[#14181F] border border-[#2E3644] rounded-md p-2.5">
                      <div className="text-xs font-medium">
                        {e.nome || "Exercício"} {e.duracao ? <span className="text-[#5A6272]">· {e.duracao}'</span> : null}
                      </div>
                      {e.descricao && <div className="text-xs text-[#8A93A3] mt-1 whitespace-pre-wrap">{e.descricao}</div>}
                      {(e.diagramas || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {e.diagramas.map((d, idx) => (
                            <DiagramThumbnail key={idx} diagram={d} size={64} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="Reportar lesão / estado" icon={HeartPulse}>
          {lesaoEnviada ? (
            <div className="flex items-center gap-2 text-sm text-[#4C9A6A]">
              <CheckCircle2 size={15} /> Enviado — o treinador vai ver.
            </div>
          ) : (
            <form onSubmit={enviarLesao}>
              <textarea
                value={lesaoTexto}
                onChange={(e) => setLesaoTexto(e.target.value)}
                placeholder="Ex: dor no tornozelo desde o treino de ontem..."
                className="w-full bg-[#14181F] border border-[#2E3644] rounded-md px-3 py-2 text-sm text-[#F2EDE3] resize-none focus:outline-none focus:border-[#EA5B13]"
                style={{ minHeight: 70 }}
              />
              <button
                type="submit"
                disabled={!lesaoTexto.trim() || busyId === "lesao"}
                className="mt-2 px-3.5 py-2 text-sm font-medium rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-40 text-[#14181F]"
              >
                Enviar
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export { AtletaPortalApp };
