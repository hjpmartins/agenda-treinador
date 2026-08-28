import { Trophy, Settings, Upload, LogOut } from "lucide-react";

function TopBar({ onExport, onImport, teams, activeTeamId, onSwitchTeam, onManageTeams, temporadas, viewingTemporada, onSwitchTemporada, isCurrentSeason, userEmail, onSignOut }) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#1E242E] border-b border-[#2E3644] shrink-0 gap-3 flex-wrap">
      <div className="flex items-center gap-2 shrink-0">
        <Trophy size={18} className="text-[#EA5B13] shrink-0" />
        <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-sm whitespace-nowrap">
          Agenda do Treinador
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0 flex-wrap">
        {teams && teams.length > 0 && (
          <>
            <select
              value={activeTeamId || ""}
              onChange={(e) => onSwitchTeam(e.target.value)}
              className="bg-[#14181F] border border-[#2E3644] rounded-md text-sm px-2.5 py-1.5 max-w-[160px] truncate"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            {temporadas && temporadas.length > 0 && (
              <select
                value={viewingTemporada || ""}
                onChange={(e) => onSwitchTemporada(e.target.value)}
                title={isCurrentSeason ? "Época atual" : "A ver uma época arquivada"}
                className={`border rounded-md text-sm px-2.5 py-1.5 max-w-[110px] ${isCurrentSeason ? "bg-[#14181F] border-[#2E3644]" : "bg-[#EA5B13]/10 border-[#EA5B13]/40 text-[#EA5B13]"}`}
              >
                {temporadas.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <button onClick={onManageTeams} title="Gerir equipas" className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 shrink-0">
              <Settings size={16} />
            </button>
            <div className="w-px h-5 bg-[#2E3644] mx-0.5 shrink-0" />
          </>
        )}
        <button onClick={onExport} title="Exportar cópia de segurança" className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 shrink-0">
          <Upload size={16} className="rotate-180" />
        </button>
        <label
          htmlFor="backup-import-input"
          title="Importar cópia de segurança"
          className="p-2 rounded text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5 cursor-pointer flex items-center shrink-0"
        >
          <Upload size={16} />
        </label>
        <input
          id="backup-import-input"
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ""; }}
        />
        <div className="w-px h-5 bg-[#2E3644] mx-0.5 shrink-0" />
        {userEmail && <span className="text-xs text-[#5A6272] hidden sm:inline truncate max-w-[140px]">{userEmail}</span>}
        <button onClick={onSignOut} title="Sair" className="p-2 rounded text-[#8A93A3] hover:text-[#D64545] hover:bg-white/5 shrink-0">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export { TopBar };

