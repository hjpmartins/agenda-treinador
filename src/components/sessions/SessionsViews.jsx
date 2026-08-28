import { Copy, Printer, Pencil, Trash2 } from "lucide-react";
import { formatDateShort } from "../../utils";
import { printSession } from "../../print";
import { ViewHeader, EmptyState } from "../common/Modal";

function SessionsView({ sessions, players, clubLogo, onAdd, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Treinos e jogos" subtitle={`${sessions.length} registo${sessions.length === 1 ? "" : "s"} por realizar/planeado${sessions.length === 1 ? "" : "s"}`} onAdd={onAdd} addLabel="Novo registo" />
      {sorted.length === 0 ? (
        <EmptyState text="Sem treinos ou jogos planeados. Cria o primeiro registo — depois de realizado, marca-o como concluído e ele passa para a aba Realizados." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RealizadosView({ sessions, players, clubLogo, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Treinos realizados" subtitle={`${sessions.length} treino${sessions.length === 1 ? "" : "s"} concluído${sessions.length === 1 ? "" : "s"}`} />
      {sorted.length === 0 ? (
        <EmptyState text="Ainda não marcaste nenhum treino como realizado. Vai à aba Treinos, edita um registo e marca 'Sim' em 'Este treino foi realizado?'." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ s, players, clubLogo, onEdit, onDelete, onTransfer }) {
  const isGame = s.type === "jogo";
  const exercicios = s.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);
  const naoRealizado = !isGame && s.realizado === false;
  return (
    <div className={`bg-[#1E242E] border rounded-lg p-4 flex items-start gap-4 group ${naoRealizado ? "border-[#D64545]/30 opacity-70" : "border-[#2E3644]"}`}>
      <div className="text-center shrink-0 w-14">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          {formatDateShort(s.date)}
        </div>
        <div className={`mt-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${isGame ? "bg-[#EA5B13]/20 text-[#EA5B13]" : "bg-[#4C9A6A]/20 text-[#4C9A6A]"}`}>
          {isGame ? "Jogo" : "Treino"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide truncate">
            {s.title || (isGame ? `vs ${s.adversario || "?"}` : "Treino")}
          </div>
          {naoRealizado && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider bg-[#D64545]/20 text-[#D64545] rounded px-1.5 py-0.5">Não realizado</span>
          )}
        </div>
        {isGame ? (
          <div className="text-xs text-[#8A93A3] mt-0.5">Adversário: {s.adversario || "—"} {s.resultado && `· Resultado: ${s.resultado}`}</div>
        ) : (
          <>
            {s.objetivo && <div className="text-xs text-[#8A93A3] mt-0.5">Objetivo: {s.objetivo}</div>}
            {exercicios.length > 0 && (
              <div className="text-xs text-[#8A93A3] mt-0.5">
                {exercicios.length} exercício{exercicios.length === 1 ? "" : "s"} · {totalMin} min
              </div>
            )}
          </>
        )}
        {isGame && s.conteudo && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.conteudo}</div>}
        {!isGame && exercicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {exercicios.slice(0, 4).map((e) => (
              <span key={e.id} className="text-[10px] bg-[#14181F] border border-[#2E3644] rounded px-1.5 py-0.5 text-[#8A93A3]">
                {e.nome || "Exercício"}
              </span>
            ))}
            {exercicios.length > 4 && (
              <span className="text-[10px] text-[#5A6272] px-1">+{exercicios.length - 4}</span>
            )}
          </div>
        )}
        {!isGame && s.observacoes && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.observacoes}</div>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onTransfer && (
          <button onClick={onTransfer} title="Copiar para outra equipa" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
            <Copy size={14} />
          </button>
        )}
        <button onClick={() => printSession(s, players, clubLogo)} title="Descarregar / Imprimir" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Printer size={14} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#D64545]/20 text-[#8A93A3] hover:text-[#D64545]">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export { SessionsView, RealizadosView, SessionRow };
