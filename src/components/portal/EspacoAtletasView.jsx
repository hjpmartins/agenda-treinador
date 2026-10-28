// Lado do treinador do Espaço Atletas: publicar avisos e perguntas, e ver
// o que as atletas já responderam/confirmaram/reportaram pelo link pessoal
// delas (ver AtletaPortalApp.jsx + src/lib/portalDb.js). As atletas em si
// nunca passam por aqui — só o treinador, com a sessão normal da app.

import { useState } from "react";
import { Megaphone, HelpCircle, CalendarCheck, HeartPulse, MessageCircle, Plus, Trash2 } from "lucide-react";
import { formatDateFull } from "../../utils";
import { EmptyState, Field } from "../common/Modal";
import { inputCls } from "../../ui";

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-[#EA5B13]" />
        <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function AvisosSection({ avisos, onCreate, onDelete }) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    onCreate({ titulo: titulo.trim(), texto: texto.trim() });
    setTitulo("");
    setTexto("");
  };

  return (
    <SectionCard title="Avisos" icon={Megaphone}>
      <form onSubmit={submit} className="flex flex-col gap-2 mb-4 pb-4 border-b border-[#2E3644]">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do aviso" className={inputCls} />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Texto (opcional)" className={inputCls + " resize-none"} style={{ minHeight: 50 }} />
        <button type="submit" disabled={!titulo.trim()} className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-40 text-[#14181F] font-medium">
          <Plus size={14} /> Publicar
        </button>
      </form>
      {avisos.length === 0 ? (
        <EmptyState text="Ainda não publicaste nenhum aviso." small />
      ) : (
        <div className="space-y-2">
          {avisos.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 border border-[#2E3644] rounded-md p-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.titulo}</div>
                {a.texto && <div className="text-xs text-[#8A93A3] mt-0.5 whitespace-pre-wrap">{a.texto}</div>}
              </div>
              <button onClick={() => { if (window.confirm("Apagar este aviso?")) onDelete(a.id); }} title="Apagar" className="p-1 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545] shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PerguntasSection({ players, perguntas, respostas, onCreate, onFechar, onDelete }) {
  const [texto, setTexto] = useState("");
  const [opcoes, setOpcoes] = useState(["Sim", "Não"]);

  const alterarOpcao = (i, value) => setOpcoes((list) => list.map((o, idx) => (idx === i ? value : o)));
  const removerOpcao = (i) => setOpcoes((list) => list.filter((_, idx) => idx !== i));
  const adicionarOpcao = () => setOpcoes((list) => [...list, ""]);

  const opcoesValidas = opcoes.map((o) => o.trim()).filter(Boolean);
  const podeSubmeter = texto.trim() && opcoesValidas.length >= 2;

  const submit = (e) => {
    e.preventDefault();
    if (!podeSubmeter) return;
    onCreate({ texto: texto.trim(), opcoes: opcoesValidas });
    setTexto("");
    setOpcoes(["Sim", "Não"]);
  };

  return (
    <SectionCard title="Perguntas" icon={HelpCircle}>
      <form onSubmit={submit} className="flex flex-col gap-2 mb-4 pb-4 border-b border-[#2E3644]">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex: Treino extra sexta-feira às 16h?" className={inputCls} />
        <Field label="Opções de resposta (como nas sondagens do WhatsApp)">
          <div className="flex flex-col gap-1.5">
            {opcoes.map((op, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={op} onChange={(e) => alterarOpcao(i, e.target.value)} placeholder={`Opção ${i + 1}`} className={inputCls} />
                {opcoes.length > 2 && (
                  <button type="button" onClick={() => removerOpcao(i)} title="Remover opção" className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545] shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={adicionarOpcao} className="flex items-center gap-1 text-xs mt-1.5 text-[#EA5B13] hover:text-[#FF6B1A]">
            <Plus size={12} /> Adicionar opção
          </button>
        </Field>
        <button type="submit" disabled={!podeSubmeter} className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-40 text-[#14181F] font-medium">
          <Plus size={14} /> Lançar pergunta
        </button>
      </form>
      {perguntas.length === 0 ? (
        <EmptyState text="Ainda não lançaste nenhuma pergunta." small />
      ) : (
        <div className="space-y-3">
          {perguntas.map((q) => {
            const respostasDaPergunta = respostas.filter((r) => r.perguntaId === q.id);
            const respondidoIds = new Set(respostasDaPergunta.map((r) => r.playerId));
            const porResponder = players.filter((p) => !respondidoIds.has(p.id));
            return (
              <div key={q.id} className="border border-[#2E3644] rounded-md p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{q.texto}</div>
                  <div className="flex gap-1 shrink-0">
                    {q.ativa && (
                      <button onClick={() => onFechar(q.id)} title="Fechar pergunta (deixa de aparecer no Espaço Atletas)" className="text-[11px] px-2 py-1 rounded border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272]">
                        Fechar
                      </button>
                    )}
                    <button onClick={() => { if (window.confirm("Apagar esta pergunta e as respostas?")) onDelete(q.id); }} title="Apagar" className="p-1 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {!q.ativa && <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-[#5A6272]">Fechada</span>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {respostasDaPergunta.map((r) => {
                    const p = players.find((pl) => pl.id === r.playerId);
                    return (
                      <span key={r.playerId} className="text-[11px] bg-[#14181F] border border-[#2E3644] rounded px-1.5 py-0.5">
                        {p ? p.nome : "?"} — <b className="text-[#F2EDE3]">{r.resposta}</b>
                      </span>
                    );
                  })}
                </div>
                {porResponder.length > 0 && (
                  <div className="mt-1.5 text-[11px] text-[#D64545]">
                    Por responder: {porResponder.map((p) => p.nome).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function RsvpSection({ players, sessions, rsvps }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const proximos = sessions.filter((s) => s.type === "treino" && s.date >= todayStr).sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <SectionCard title="Presenças confirmadas (RSVP)" icon={CalendarCheck}>
      {proximos.length === 0 ? (
        <EmptyState text="Sem treinos agendados a partir de hoje." small />
      ) : (
        <div className="space-y-3">
          {proximos.map((s) => {
            const doTreino = rsvps.filter((r) => r.sessionId === s.id);
            const vao = doTreino.filter((r) => r.status === "vou");
            const naoVao = doTreino.filter((r) => r.status === "nao_vou");
            const respondidoIds = new Set(doTreino.map((r) => r.playerId));
            const semResposta = players.filter((p) => !respondidoIds.has(p.id));
            const nomeDe = (playerId) => players.find((p) => p.id === playerId)?.nome || "?";
            return (
              <div key={s.id} className="border border-[#2E3644] rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{formatDateFull(s.date)} — {s.title || "Treino"}</div>
                  <div className="text-xs text-[#8A93A3] shrink-0">
                    <span className="text-[#4C9A6A]">{vao.length} vão</span> · <span className="text-[#D64545]">{naoVao.length} não</span> · {semResposta.length} por confirmar
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  {vao.length > 0 && (
                    <div className="text-[#4C9A6A]">Vão: {vao.map((r) => nomeDe(r.playerId)).join(", ")}</div>
                  )}
                  {naoVao.length > 0 && (
                    <div className="text-[#D64545]">
                      Não vão: {naoVao.map((r) => (r.motivo ? `${nomeDe(r.playerId)} (${r.motivo})` : nomeDe(r.playerId))).join(", ")}
                    </div>
                  )}
                  {semResposta.length > 0 && (
                    <div className="text-[#8A93A3]">Por confirmar: {semResposta.map((p) => p.nome).join(", ")}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function LesoesSection({ players, lesoesReportadas, onMarcarRevisto, onAdicionarAoHistorico }) {
  const pendentes = lesoesReportadas.filter((l) => l.estado === "pendente");
  return (
    <SectionCard title="Lesões / estados reportados" icon={HeartPulse}>
      {pendentes.length === 0 ? (
        <EmptyState text="Sem reportes pendentes." small />
      ) : (
        <div className="space-y-2">
          {pendentes.map((l) => {
            const p = players.find((pl) => pl.id === l.playerId);
            return (
              <div key={l.id} className="border border-[#D64545]/30 rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{p ? p.nome : "Jogadora"}</div>
                  <div className="text-[11px] text-[#5A6272] shrink-0">{l.createdAt ? formatDateFull(l.createdAt.slice(0, 10)) : ""}</div>
                </div>
                <div className="text-sm text-[#C7CDD8] mt-1 whitespace-pre-wrap">{l.texto}</div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => onAdicionarAoHistorico(l)} className="text-xs px-2.5 py-1.5 rounded-md bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] font-medium">
                    Adicionar ao histórico da ficha
                  </button>
                  <button onClick={() => onMarcarRevisto(l.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272]">
                    Marcar como revisto
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function MensagensSection({ players, mensagens, onMarcarRevisto }) {
  const pendentes = mensagens.filter((m) => m.estado === "pendente");
  return (
    <SectionCard title="Mensagens das atletas" icon={MessageCircle}>
      {pendentes.length === 0 ? (
        <EmptyState text="Sem mensagens pendentes." small />
      ) : (
        <div className="space-y-2">
          {pendentes.map((m) => {
            const p = players.find((pl) => pl.id === m.playerId);
            return (
              <div key={m.id} className="border border-[#2E3644] rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{p ? p.nome : "Jogadora"}</div>
                  <div className="text-[11px] text-[#5A6272] shrink-0">{m.createdAt ? formatDateFull(m.createdAt.slice(0, 10)) : ""}</div>
                </div>
                <div className="text-sm text-[#C7CDD8] mt-1 whitespace-pre-wrap">{m.texto}</div>
                <button onClick={() => onMarcarRevisto(m.id)} className="mt-2 text-xs px-2.5 py-1.5 rounded-md border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272]">
                  Marcar como lida
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function EspacoAtletasView({
  players,
  sessions,
  avisos,
  onCreateAviso,
  onDeleteAviso,
  perguntas,
  respostas,
  onCreatePergunta,
  onFecharPergunta,
  onDeletePergunta,
  rsvps,
  lesoesReportadas,
  onMarcarLesaoRevista,
  onAdicionarAoHistorico,
  mensagens,
  onMarcarMensagemRevista,
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide">Espaço Atletas</h1>
        <div className="text-sm text-[#8A93A3] mt-0.5">
          Avisos, perguntas e confirmações partilhados com as atletas através do link pessoal de cada uma (ficha do jogador → ícone de link).
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AvisosSection avisos={avisos} onCreate={onCreateAviso} onDelete={onDeleteAviso} />
        <PerguntasSection players={players} perguntas={perguntas} respostas={respostas} onCreate={onCreatePergunta} onFechar={onFecharPergunta} onDelete={onDeletePergunta} />
        <RsvpSection players={players} sessions={sessions} rsvps={rsvps} />
        <LesoesSection players={players} lesoesReportadas={lesoesReportadas} onMarcarRevisto={onMarcarLesaoRevista} onAdicionarAoHistorico={onAdicionarAoHistorico} />
        <MensagensSection players={players} mensagens={mensagens} onMarcarRevisto={onMarcarMensagemRevista} />
      </div>
    </div>
  );
}

export { EspacoAtletasView };
