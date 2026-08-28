import { Copy, Printer, Pencil, Trash2 } from "lucide-react";
import { formatDateShort } from "../../utils";
import { printJogo } from "../../print";
import { ViewHeader, EmptyState } from "../common/Modal";

function JogoRow({ s, players, clubLogo, onEdit, onDelete, onTransfer }) {
  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-4 flex items-start gap-4 group">
      <div className="text-center shrink-0 w-14">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs text-[#8A93A3]">
          {formatDateShort(s.date)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[#EA5B13]/20 text-[#EA5B13]">
          Jogo{s.jogoNumero ? ` ${s.jogoNumero}` : ""}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: "'Oswald', sans-serif" }} className="font-semibold uppercase tracking-wide truncate">
          vs {s.adversario || "Adversário por definir"}
        </div>
        <div className="text-xs text-[#8A93A3] mt-0.5">
          {s.campeonato && `${s.campeonato} · `}{s.local || "Local por definir"}{s.horario && ` · ${s.horario}`}
        </div>
        {s.resultado && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm text-[#F2EDE3] mt-1.5 font-semibold">
            {s.resultado}
          </div>
        )}
        {s.apreciacaoGeral && <div className="text-xs text-[#8A93A3] mt-1.5 line-clamp-2">{s.apreciacaoGeral}</div>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onTransfer} title="Copiar para outra equipa" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
          <Copy size={14} />
        </button>
        <button onClick={() => printJogo(s, players, clubLogo)} title="Descarregar / Imprimir" className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3] hover:text-[#F2EDE3]">
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

function JogosView({ sessions, players, clubLogo, onAdd, onEdit, onDelete, onTransfer }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <ViewHeader title="Jogos" subtitle={`${sessions.length} jogo${sessions.length === 1 ? "" : "s"} registado${sessions.length === 1 ? "" : "s"}`} onAdd={onAdd} addLabel="Novo jogo" />
      {sorted.length === 0 ? (
        <EmptyState text="Ainda não registaste nenhum jogo. Cria a ficha de preparação do primeiro." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <JogoRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} onTransfer={() => onTransfer(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

export { JogoRow, JogosView };
