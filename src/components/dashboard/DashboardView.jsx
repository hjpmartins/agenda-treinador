import { useState } from "react";
import { Printer, Camera, Loader2, X } from "lucide-react";
import { todayStr, countTreinosRealizados, calcPresenca, diasParaAniversario, formatDateShort, resizeImageFile } from "../../utils";
import { EmptyState } from "../common/Modal";

function DashboardView({ team, players, sessions, onNavigate, onGenerateReport, onSaveBanner }) {
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerError, setBannerError] = useState(null);
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

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBannerLoading(true);
    setBannerError(null);
    try {
      const dataUrl = await resizeImageFile(file, 1000, 0.82);
      onSaveBanner(dataUrl);
    } catch (err) {
      setBannerError(err.message || "Não foi possível carregar a foto.");
    } finally {
      setBannerLoading(false);
    }
  };

  return (
    <div>
      <div
        className="relative rounded-lg overflow-hidden mb-2 border border-[#2E3644] bg-[#1E242E]"
        style={{ height: 160, backgroundImage: team?.banner ? `url(${team.banner})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {team?.banner && (
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,12,16,0.05) 0%, rgba(10,12,16,0.8) 100%)" }} />
        )}
        <div className="absolute bottom-0 left-0 p-4">
          <h1 style={{ fontFamily: "'Oswald', sans-serif" }} className="text-2xl font-semibold uppercase tracking-wide text-[#F2EDE3]">
            Olá! {team ? `— ${team.nome}` : ""}
          </h1>
          <div className="text-sm text-[#C7CDD8] mt-0.5">{team && team.temporadaAtual ? `Época ${team.temporadaAtual}` : ""}</div>
        </div>
        {team && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            <label className="cursor-pointer flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-[#0A0C10]/60 hover:bg-[#0A0C10]/80 text-[#F2EDE3] backdrop-blur-sm transition-colors">
              {bannerLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {team.banner ? "Alterar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} disabled={bannerLoading} />
            </label>
            {team.banner && (
              <button onClick={() => onSaveBanner("")} title="Remover foto" className="p-1.5 rounded-md bg-[#0A0C10]/60 hover:bg-[#0A0C10]/80 text-[#F2EDE3] backdrop-blur-sm transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>
      {bannerError && <div className="text-xs text-[#D64545] mb-3">{bannerError}</div>}

      <div className="grid grid-cols-3 gap-3 mb-5">
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
          <div className="text-xs text-[#8A93A3] mt-0.5">Resumo completo desta época — presenças, resultados — pronto a descarregar.</div>
        </div>
        <button onClick={onGenerateReport} className="flex items-center gap-1.5 bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium rounded-md px-3.5 py-2 shrink-0">
          <Printer size={15} /> Gerar relatório
        </button>
      </div>
    </div>
  );
}

export { DashboardView };

