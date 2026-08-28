import { Home, Users, Dumbbell, CheckCircle2, Swords, BookOpen, CalendarDays } from "lucide-react";

function Sidebar({ tab, setTab, playerCount, sessionCount, realizadosCount, jogosCount, libraryCount }) {
  const items = [
    { id: "inicio", label: "Início", icon: Home, count: null },
    { id: "jogadores", label: "Plantel", icon: Users, count: playerCount },
    { id: "treinos", label: "Treinos", icon: Dumbbell, count: sessionCount },
    { id: "realizados", label: "Realizados", icon: CheckCircle2, count: realizadosCount },
    { id: "jogos", label: "Jogos", icon: Swords, count: jogosCount },
    { id: "biblioteca", label: "Biblioteca", icon: BookOpen, count: libraryCount },
    { id: "calendario", label: "Calendário", icon: CalendarDays, count: null },
  ];
  return (
    <aside style={{ width: 208, flexShrink: 0 }} className="bg-[#1E242E] border-r border-[#2E3644]">
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              style={{ display: "flex", alignItems: "center" }}
              className={`gap-2.5 px-4 py-3 text-sm transition-colors border-l-2 ${
                active
                  ? "border-[#EA5B13] bg-[#EA5B13]/10 text-[#F2EDE3]"
                  : "border-transparent text-[#8A93A3] hover:text-[#F2EDE3] hover:bg-white/5"
              }`}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide">{it.label}</span>
              {it.count !== null && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }} className="text-xs bg-[#2E3644] text-[#8A93A3] rounded px-1.5 py-0.5">
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export { Sidebar };

