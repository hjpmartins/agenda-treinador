import { Printer } from "lucide-react";
import { HABILIDADES } from "../../data";
import { todayStr, countTreinosRealizados, calcPresenca, diasParaAniversario, formatDateShort } from "../../utils";
import { ViewHeader, EmptyState } from "../common/Modal";

function DashboardView({ team, players, sessions, library, onNavigate, onGenerateReport }) {
  const hojeStr = todayStr();
  const treinosJogos = sessions.filter((s) => s.type === "treino" || s.type === "jogo");

  const proximos = treinosJogos
    .filter((s) => s.date >= hojeStr && !(s.type === "treino" && s.realizado === true))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3);

  const porConfirmar = sessions.filter((s) => s.type === "treino" && s.date < hojeStr && s.realizado !== true);

  const treinosRealizados = countTreinosRealizados(sessions);
  const jogosDaEpoca = sessions.filter((s) => s.type === "jogo");

  const presencaBaixa = players
    .map((p) => ({ p, presenca: calcPresenca(p.id, sessions) }))
    .filter((x) => x.presenca && x.presenca.total >= 3 && x.presenca.pct < 50);

  const aniversarios = players
    .map((p) => ({ p, dias: diasParaAniversario(p.nascimento) }))
    .filter((x) => x.dias !== null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const totalHabilidades = HABILIDADES.length;
  const tocadas = new Set(library.map((ex) => ex.categoria).filter(Boolean)).size;
  const pctPlano = totalHabilidades ? Math.round((tocadas / totalHabilidades) * 100) : 0;

  return (
    <div>
      <ViewHeader title={`Olá! ${team ? `— ${team.nome}` : ""}`} subtitle={team && team.temporadaAtual ? `Época ${team.temporadaAtual}` : ""} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{players.length}</div>
          <div className="text-xs text-[#8A93A3]">Jogadoras/es</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{treinosRealizados}</div>
          <div className="text-xs text-[#8A93A3]">Treinos realizados</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{jogosDaEpoca.length}</div>
          <div className="text-xs text-[#8A93A3]">Jogos</div>
        </div>
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-3.5">
          <div className="text-2xl font-bold" style={{ fontFamily: "'Oswald', sans-serif" }}>{pctPlano}%</div>
          <div className="text-xs text-[#8A93A3]">Plano cumprido</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Próximos</span>
            <button onClick={() => onNavigate("calendario")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver calendário</button>
          </div>
          {proximos.length === 0 ? (
            <EmptyState text="Nada agendado. Cria um treino ou jogo." small />
          ) : (
            <div className="space-y-2">
              {proximos.map((s) => {
                const isGame = s.type === "jogo";
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3] w-12 shrink-0">{formatDateShort(s.date)}</div>
                    <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 ${isGame ? "bg-[#EA5B13]/20 text-[#EA5B13]" : "bg-[#4C9A6A]/20 text-[#4C9A6A]"}`}>
                      {isGame ? "Jogo" : "Treino"}
                    </span>
                    <span className="truncate">{isGame ? `vs ${s.adversario || "?"}` : (s.title || "Treino")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Por confirmar</span>
            {porConfirmar.length > 0 && <button onClick={() => onNavigate("treinos")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver treinos</button>}
          </div>
          {porConfirmar.length === 0 ? (
            <EmptyState text="Tudo em dia — sem treinos passados por confirmar." small />
          ) : (
            <div className="text-sm text-[#D64545]">
              {porConfirmar.length} treino{porConfirmar.length === 1 ? "" : "s"} já passou{porConfirmar.length === 1 ? "" : "aram"} a data e ainda não {porConfirmar.length === 1 ? "foi" : "foram"} marcado{porConfirmar.length === 1 ? "" : "s"} como realizado{porConfirmar.length === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Presença baixa</span>
            {presencaBaixa.length > 0 && <button onClick={() => onNavigate("jogadores")} className="text-xs text-[#EA5B13] hover:text-[#FF6B1A]">Ver plantel</button>}
          </div>
          {presencaBaixa.length === 0 ? (
            <EmptyState text="Ninguém abaixo de 50% de presença." small />
          ) : (
            <div className="space-y-1.5">
              {presencaBaixa.map(({ p, presenca }) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.nome}</span>
                  <span className="text-[#D64545] text-xs shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{presenca.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Aniversários próximos</span>
          </div>
          {aniversarios.length === 0 ? (
            <EmptyState text="Nenhum aniversário nos próximos 30 dias." small />
          ) : (
            <div className="space-y-1.5">
              {aniversarios.map(({ p, dias }) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.nome}</span>
                  <span className="text-[#8A93A3] text-xs shrink-0">{dias === 0 ? "Hoje!" : `em ${dias} dia${dias === 1 ? "" : "s"}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm font-semibold">Relatório de fim de época</div>
          <div className="text-xs text-[#8A93A3] mt-0.5">Resumo completo desta época — presenças, resultados, plano cumprido — pronto a descarregar.</div>
        </div>
        <button onClick={onGenerateReport} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 shrink-0">
          <Printer size={15} /> Gerar relatório
        </button>
      </div>
    </div>
  );
}

export { DashboardView };

