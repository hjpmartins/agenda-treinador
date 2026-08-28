import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MESES, MESES_ABREV, DIAS_SEMANA } from "../../data";
import { ViewHeader, EmptyState } from "../common/Modal";
import { SessionRow } from "../sessions/SessionsViews";

function MiniMonth({ year, month, sessions, selectedDate, onSelectDay }) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionsByDay = {};
  sessions.forEach((s) => {
    if (!s.date) return;
    const [sy, sm] = s.date.split("-").map(Number);
    if (sy === year && sm === month + 1) {
      const day = Number(s.date.split("-")[2]);
      sessionsByDay[day] = sessionsByDay[day] || [];
      sessionsByDay[day].push(s);
    }
  });

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isThisMonthSelected = selectedDate && selectedDate.y === year && selectedDate.m === month;

  return (
    <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-2.5">
      <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-xs font-semibold text-center mb-1.5">
        {MESES_ABREV[month]}
      </div>
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[8px] text-[#5A6272]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const daySessions = sessionsByDay[d] || [];
          const isSelected = isThisMonthSelected && selectedDate.d === d;
          const hasGame = daySessions.some((s) => s.type === "jogo");
          const hasRealizado = daySessions.some((s) => s.type === "treino" && s.realizado === true);
          const hasPlaneado = daySessions.some((s) => s.type === "treino" && s.realizado !== true);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              style={{ aspectRatio: "1", fontSize: "9px" }}
              className={`rounded flex items-center justify-center relative ${
                isSelected ? "bg-[#EA5B13] text-[#14181F] font-semibold" : "hover:bg-white/10 text-[#8A93A3]"
              }`}
            >
              {d}
              {daySessions.length > 0 && !isSelected && (
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    hasGame ? "bg-[#EA5B13]" : hasRealizado ? "bg-[#4C9A6A]" : "bg-[#8A93A3]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({ sessions, players, clubLogo, calYear, setCalYear, selectedDate, setSelectedDate, onAddOnDay, onEdit, onDelete }) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  const dayStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const selectedSessions = selectedDate
    ? sessions.filter((s) => {
        if (!s.date) return false;
        const [sy, sm, sd] = s.date.split("-").map(Number);
        return sy === selectedDate.y && sm === selectedDate.m + 1 && sd === selectedDate.d;
      })
    : null;

  return (
    <div>
      <ViewHeader title="Calendário" subtitle="Vista do ano inteiro — treinos, jogos e planeamento" />

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => { setCalYear(calYear - 1); setSelectedDate(null); }}
          className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3]"
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold text-lg">
          {calYear}
        </div>
        <button
          onClick={() => { setCalYear(calYear + 1); setSelectedDate(null); }}
          className="p-1.5 rounded hover:bg-white/10 text-[#8A93A3]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4 text-[10px] text-[#8A93A3]">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4C9A6A] inline-block" /> Treino realizado</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#8A93A3] inline-block" /> Treino planeado</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#EA5B13] inline-block" /> Jogo</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map((m) => (
          <MiniMonth
            key={m}
            year={calYear}
            month={m}
            sessions={sessions}
            selectedDate={selectedDate}
            onSelectDay={(d) => setSelectedDate(selectedDate && selectedDate.y === calYear && selectedDate.m === m && selectedDate.d === d ? null : { y: calYear, m, d })}
          />
        ))}
      </div>

      {selectedDate && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide text-sm text-[#8A93A3]">
              {selectedDate.d} de {MESES[selectedDate.m]} de {selectedDate.y}
            </div>
            <button onClick={() => onAddOnDay(dayStr(selectedDate.y, selectedDate.m, selectedDate.d))} className="text-xs flex items-center gap-1 text-[#EA5B13] hover:text-[#FF6B1A]">
              <Plus size={14} /> Adicionar
            </button>
          </div>
          {selectedSessions.length === 0 ? (
            <EmptyState text="Sem registos neste dia." small />
          ) : (
            <div className="space-y-2">
              {selectedSessions.map((s) => (
                <SessionRow key={s.id} s={s} players={players} clubLogo={clubLogo} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { MiniMonth, CalendarView };

