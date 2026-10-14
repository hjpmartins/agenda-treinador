import { Home, Users, Dumbbell, CheckCircle2, Swords, BookOpen, Globe, CalendarDays, PenTool, FlaskConical } from "lucide-react";

function Sidebar({ tab, setTab, playerCount, sessionCount, realizadosCount, jogosCount, libraryCount, publicLibraryCount, onOpenWhiteboard, onOpenCourt3DTest }) {
  const items = [
    { id: "inicio", label: "Início", icon: Home, count: null },
    { id: "jogadores", label: "Plantel", icon: Users, count: playerCount },
    { id: "treinos", label: "Treinos", icon: Dumbbell, count: sessionCount },
    { id: "realizados", label: "Realizados", icon: CheckCircle2, count: realizadosCount },
    { id: "jogos", label: "Jogos", icon: Swords, count: jogosCount },
    { id: "biblioteca", label: "Biblioteca", icon: BookOpen, count: libraryCount },
    { id: "biblioteca-publica", label: "Pública", icon: Globe, count: publicLibraryCount },
    { id: "calendario", label: "Calendário", icon: CalendarDays, count: null },
    // Não é um separador normal (não muda `tab`) — abre o quadro tático em
    // ecrã inteiro por cima de tudo, para poder usar-se a meio de qualquer
    // outro ecrã (ex: durante o registo de estatísticas ao vivo).
    { id: "quadro", label: "Quadro tático", icon: PenTool, count: null, action: onOpenWhiteboard },
    // Temporário: só para experimentar o novo editor 3D antes de decidir
    // substituir o editor de exercícios atual. Remover depois dos testes.
    { id: "teste3d", label: "Teste 3D", icon: FlaskConical, count: null, action: onOpenCourt3DTest },
  ];
  return (
    <aside style={{ width: 208, flexShrink: 0 }} className="bg-[#1E242E] border-r border-[#2E3644]">
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = !it.action && tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => (it.action ? it.action() : setTab(it.id))}
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

