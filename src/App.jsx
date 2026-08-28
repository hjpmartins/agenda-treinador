import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { emptyPlayer, emptySession, emptyJogo, emptyLibraryItem } from "./data";
import { uid, withTimeout, normalizePlayer, normalizeJogo, normalizeDiagramas, computeTemporadaAtual, todayStr } from "./utils";
import { buildSeasonReportContent } from "./print";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import * as db from "./lib/db";
import { AuthScreen } from "./components/auth/AuthScreen";
import { TopBar } from "./components/layout/TopBar";
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardView } from "./components/dashboard/DashboardView";
import { PlayersView } from "./components/players/PlayersView";
import { PlayerModal } from "./components/players/PlayerModal";
import { SessionsView, RealizadosView } from "./components/sessions/SessionsViews";
import { SessionModal } from "./components/sessions/SessionModal";
import { ImportModal } from "./components/sessions/ImportModal";
import { JogosView } from "./components/jogos/JogosViews";
import { JogoModal } from "./components/jogos/JogoModal";
import { LiveStatsView } from "./components/jogos/LiveStatsView";
import { LibraryView } from "./components/library/LibraryView";
import { LibraryModal } from "./components/library/LibraryModal";
import { PublicLibraryView } from "./components/library/PublicLibraryView";
import { CalendarView } from "./components/calendar/CalendarView";
import { TeamsModal } from "./components/teams/TeamsModal";
import { TransferModal, MovePlayerModal } from "./components/teams/TransferModals";
import { ImportBackupConfirmModal } from "./components/common/Modal";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState("inicio");
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [library, setLibrary] = useState([]);
  const [publicLibrary, setPublicLibrary] = useState([]);
  const [teams, setTeams] = useState([]);
  const [clubLogo, setClubLogo] = useState("");
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [viewingTemporada, setViewingTemporada] = useState(null);
  const [teamsModal, setTeamsModal] = useState(false);
  const [transferModal, setTransferModal] = useState(null); // session being transferred
  const [moveTeamModal, setMoveTeamModal] = useState(null); // player being moved
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);

  const [playerModal, setPlayerModal] = useState(null); // null | 'new' | player object
  const [importModal, setImportModal] = useState(false);
  const [libraryModal, setLibraryModal] = useState(null); // null | 'new' | item
  const [sessionModal, setSessionModal] = useState(null); // null | {date} | session object
  const [jogoModal, setJogoModal] = useState(null); // null | jogo object
  const [liveStatsModal, setLiveStatsModal] = useState(null); // null | jogo object
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null); // {y, m, d} | null
  const [importPreview, setImportPreview] = useState(null); // {parsed, fileName}

  // Sessão de autenticação: obtém a sessão inicial e fica a ouvir mudanças (login/logout).
  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (!active) return;
        setUser(session?.user || null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) setAuthLoading(false);
      });
    const unsubscribe = onAuthStateChange((session) => {
      setUser(session?.user || null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Carrega os dados do Supabase quando há um utilizador com sessão iniciada.
  useEffect(() => {
    if (!user) {
      setReady(false);
      setPlayers([]);
      setSessions([]);
      setLibrary([]);
      setPublicLibrary([]);
      setTeams([]);
      setClubLogo("");
      setActiveTeamId(null);
      setViewingTemporada(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setReady(false);
      try {
        const result = await withTimeout(db.loadAll(), 10000);
        if (cancelled) return;
        let loadedTeams = result.teams;
        const loadedPlayers = result.players.map(normalizePlayer);
        const loadedSessions = result.sessions.map((s) =>
          normalizeJogo({ ...s, exercicios: (s.exercicios || []).map(normalizeDiagramas) })
        );
        if (loadedTeams.length === 0) {
          const defaultTeam = await db.createTeam({ nome: "Equipa principal", temporadaAtual: computeTemporadaAtual() });
          loadedTeams = [defaultTeam];
        }
        loadedTeams = loadedTeams.map((t) => (t.temporadaAtual ? t : { ...t, temporadaAtual: computeTemporadaAtual() }));
        const resolvedActiveTeamId =
          result.activeTeamId && loadedTeams.some((t) => t.id === result.activeTeamId) ? result.activeTeamId : loadedTeams[0].id;
        setTeams(loadedTeams);
        setPlayers(loadedPlayers);
        setSessions(loadedSessions);
        setLibrary(result.library.map(normalizeDiagramas));
        setPublicLibrary(result.publicLibrary.map(normalizeDiagramas));
        setClubLogo(result.clubLogo || "");
        setActiveTeamId(resolvedActiveTeamId);
        setViewingTemporada((loadedTeams.find((t) => t.id === resolvedActiveTeamId) || loadedTeams[0]).temporadaAtual);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(`Não foi possível carregar os teus dados (${e.message || e}).`);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      setError(`Não foi possível terminar sessão (${e.message || e}).`);
    }
  };

  const savePlayer = async (player) => {
    try {
      if (player.id) {
        const updated = await db.updatePlayer(player.id, player);
        setPlayers(players.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await db.createPlayer({ ...player, equipaId: activeTeamId });
        setPlayers([...players, created]);
      }
      setPlayerModal(null);
    } catch (e) {
      setError(`Não foi possível guardar o jogador (${e.message || e}).`);
    }
  };

  const importPlayers = async (newPlayers) => {
    try {
      const created = await db.createPlayers(newPlayers.map((p) => ({ ...p, equipaId: activeTeamId })));
      setPlayers([...players, ...created]);
      setImportModal(false);
    } catch (e) {
      setError(`Não foi possível importar os jogadores (${e.message || e}).`);
    }
  };

  const deletePlayer = async (id) => {
    try {
      await db.deletePlayer(id);
      setPlayers(players.filter((p) => p.id !== id));
    } catch (e) {
      setError(`Não foi possível apagar o jogador (${e.message || e}).`);
    }
  };

  const saveSession = async (session) => {
    try {
      if (session.id) {
        const updated = await db.updateSession(session.id, session);
        setSessions(sessions.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const team = teams.find((t) => t.id === activeTeamId);
        const created = await db.createSession({
          ...session,
          equipaId: activeTeamId,
          temporada: team ? team.temporadaAtual : computeTemporadaAtual(),
        });
        setSessions([...sessions, created]);
      }
      setSessionModal(null);
      setJogoModal(null);
    } catch (e) {
      setError(`Não foi possível guardar (${e.message || e}).`);
    }
  };

  const saveLiveStats = async (jogo, estatisticas) => {
    try {
      const updated = await db.updateSession(jogo.id, { estatisticas });
      setSessions(sessions.map((s) => (s.id === updated.id ? updated : s)));
      setLiveStatsModal(null);
    } catch (e) {
      setError(`Não foi possível guardar as estatísticas (${e.message || e}).`);
    }
  };

  const deleteSession = async (id) => {
    try {
      await db.deleteSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (e) {
      setError(`Não foi possível apagar (${e.message || e}).`);
    }
  };

  const saveLibraryItem = async (item) => {
    try {
      let saved;
      if (item.id) {
        saved = await db.updateLibraryItem(item.id, item);
        setLibrary(library.map((l) => (l.id === saved.id ? saved : l)));
      } else {
        saved = await db.createLibraryItem(item);
        setLibrary([...library, saved]);
      }
      setLibraryModal(null);
      return saved;
    } catch (e) {
      setError(`Não foi possível guardar o exercício (${e.message || e}).`);
      return null;
    }
  };

  const deleteLibraryItem = async (id) => {
    try {
      await db.deleteLibraryItem(id);
      setLibrary(library.filter((l) => l.id !== id));
    } catch (e) {
      setError(`Não foi possível apagar o exercício (${e.message || e}).`);
    }
  };

  const addLibraryItemQuiet = async (item) => {
    // Usado ao guardar um exercício diretamente a partir de um treino, sem abrir o modal.
    try {
      const created = await db.createLibraryItem(item);
      setLibrary([...library, created]);
    } catch (e) {
      setError(`Não foi possível guardar o exercício na biblioteca (${e.message || e}).`);
    }
  };

  const publishLibraryItem = async (item) => {
    try {
      const authorLabel = (activeTeam && activeTeam.nome) || user.email;
      const published = await db.publishLibraryItem(item, authorLabel);
      setPublicLibrary([published, ...publicLibrary]);
      setImportSuccess(`"${item.nome}" partilhado na biblioteca pública.`);
    } catch (e) {
      setError(`Não foi possível partilhar o exercício (${e.message || e}).`);
    }
  };

  const unpublishLibraryItem = async (id) => {
    try {
      await db.unpublishLibraryItem(id);
      setPublicLibrary(publicLibrary.filter((l) => l.id !== id));
    } catch (e) {
      setError(`Não foi possível remover o exercício da biblioteca pública (${e.message || e}).`);
    }
  };

  const copyPublicItemToLibrary = async (item) => {
    try {
      const { id, userId, authorLabel, createdAt, ...rest } = item;
      const created = await db.createLibraryItem(rest);
      setLibrary([...library, created]);
      setImportSuccess(`"${item.nome}" adicionado à tua biblioteca.`);
    } catch (e) {
      setError(`Não foi possível carregar este exercício para a tua biblioteca (${e.message || e}).`);
    }
  };

  const addTeam = async (nome) => {
    try {
      const newTeam = await db.createTeam({ nome: nome.trim() || "Nova equipa", temporadaAtual: computeTemporadaAtual() });
      setTeams([...teams, newTeam]);
      setActiveTeamId(newTeam.id);
      setViewingTemporada(newTeam.temporadaAtual);
      await db.saveSettings({ activeTeamId: newTeam.id });
    } catch (e) {
      setError(`Não foi possível criar a equipa (${e.message || e}).`);
    }
  };

  const fecharTemporada = async (teamId, novaTemporada) => {
    try {
      const updated = await db.updateTeam(teamId, { temporadaAtual: novaTemporada });
      setTeams(teams.map((t) => (t.id === teamId ? updated : t)));
      if (teamId === activeTeamId) setViewingTemporada(novaTemporada);
    } catch (e) {
      setError(`Não foi possível fechar a época (${e.message || e}).`);
    }
  };

  const renameTeam = async (id, nome) => {
    try {
      const updated = await db.updateTeam(id, { nome });
      setTeams(teams.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(`Não foi possível mudar o nome da equipa (${e.message || e}).`);
    }
  };

  const deleteTeam = async (id) => {
    try {
      await db.deleteTeam(id); // a base de dados apaga em cascata os jogadores/treinos desta equipa
      let remaining = teams.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        remaining = [await db.createTeam({ nome: "Equipa principal", temporadaAtual: computeTemporadaAtual() })];
      }
      const nextPlayers = players.filter((p) => p.equipaId !== id);
      const nextSessions = sessions.filter((s) => s.equipaId !== id);
      const nextActiveTeamId = activeTeamId === id ? remaining[0].id : activeTeamId;
      setTeams(remaining);
      setPlayers(nextPlayers);
      setSessions(nextSessions);
      setActiveTeamId(nextActiveTeamId);
      if (nextActiveTeamId !== activeTeamId) {
        const team = remaining.find((t) => t.id === nextActiveTeamId);
        if (team) setViewingTemporada(team.temporadaAtual);
        await db.saveSettings({ activeTeamId: nextActiveTeamId });
      }
    } catch (e) {
      setError(`Não foi possível apagar a equipa (${e.message || e}).`);
    }
  };

  const switchTeam = async (id) => {
    setActiveTeamId(id);
    const team = teams.find((t) => t.id === id);
    if (team) setViewingTemporada(team.temporadaAtual);
    try {
      await db.saveSettings({ activeTeamId: id });
    } catch (e) {
      setError(`Não foi possível guardar a equipa selecionada (${e.message || e}).`);
    }
  };

  const saveClubLogo = async (dataUrl) => {
    setClubLogo(dataUrl);
    try {
      await db.saveSettings({ clubLogo: dataUrl });
    } catch (e) {
      setError(`Não foi possível guardar o logotipo (${e.message || e}).`);
    }
  };

  // Duplica um treino/jogo para outra equipa — copia o plano (exercícios, objetivos,
  // etc.) mas reinicia o que é específico do plantel (presenças/convocatória) e,
  // para treinos, reinicia "realizado" para começar como um plano novo na equipa destino.
  const transferSession = async (session, targetTeamId) => {
    try {
      const targetTeam = teams.find((t) => t.id === targetTeamId);
      const { id, ...rest } = session;
      const copy = { ...rest, equipaId: targetTeamId, temporada: targetTeam ? targetTeam.temporadaAtual : session.temporada };
      if (copy.type === "treino") {
        copy.realizado = false;
        copy.presencas = {};
      } else {
        copy.convocatoria = {};
        copy.resultado = "";
        copy.conteudo = "";
        copy.apreciacaoGeral = "";
      }
      const created = await db.createSession(copy);
      setSessions([...sessions, created]);
      setTransferModal(null);
      setImportSuccess(`Copiado para "${teams.find((t) => t.id === targetTeamId)?.nome || "outra equipa"}".`);
    } catch (e) {
      setError(`Não foi possível copiar para a outra equipa (${e.message || e}).`);
    }
  };

  const movePlayerToTeam = async (player, targetTeamId) => {
    try {
      const updated = await db.updatePlayer(player.id, { equipaId: targetTeamId });
      setPlayers(players.map((p) => (p.id === player.id ? updated : p)));
      setMoveTeamModal(null);
      setImportSuccess(`"${player.nome}" mudou para "${teams.find((t) => t.id === targetTeamId)?.nome || "outra equipa"}".`);
    } catch (e) {
      setError(`Não foi possível mudar o jogador de equipa (${e.message || e}).`);
    }
  };

  const generateSeasonReport = () => {
    const html = buildSeasonReportContent(activeTeam, teamPlayers, seasonSessions, library, clubLogo);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const namePart = (activeTeam ? activeTeam.nome : "equipa").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const temporadaPart = ((activeTeam && activeTeam.temporadaAtual) || "").replace(/[^a-z0-9]+/gi, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-epoca-${temporadaPart}-${namePart}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const data = JSON.stringify({ players, sessions, library, teams, activeTeamId, clubLogo, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda-treinador-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        setError("Não foi possível ler este ficheiro. Confirma que escolheste o .json exportado por esta aplicação.");
        return;
      }
      const valid = parsed && Array.isArray(parsed.players) && Array.isArray(parsed.sessions) && Array.isArray(parsed.library);
      if (!valid) {
        setError("Este ficheiro não parece ser uma cópia de segurança válida da Agenda do Treinador — nada foi alterado.");
        return;
      }
      setError(null);
      setImportPreview({ parsed, fileName: file.name });
    };
    reader.onerror = () => setError("Não foi possível ler este ficheiro.");
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    try {
      const { parsed } = importPreview;
      let nextTeams = parsed.teams || [];
      let nextPlayers = parsed.players.map(normalizePlayer);
      let nextSessions = parsed.sessions.map((s) => normalizeJogo({ ...s, exercicios: (s.exercicios || []).map(normalizeDiagramas) }));
      const nextLibrary = parsed.library.map(normalizeDiagramas);
      const nextClubLogo = parsed.clubLogo || "";
      if (nextTeams.length === 0) {
        const defaultTeam = { id: uid(), nome: "Equipa principal", temporadaAtual: computeTemporadaAtual() };
        nextTeams = [defaultTeam];
        nextPlayers = nextPlayers.map((p) => (p.equipaId ? p : { ...p, equipaId: defaultTeam.id }));
        nextSessions = nextSessions.map((s) => (s.equipaId ? s : { ...s, equipaId: defaultTeam.id }));
      }
      const nextActiveTeamId = parsed.activeTeamId && nextTeams.some((t) => t.id === parsed.activeTeamId) ? parsed.activeTeamId : nextTeams[0].id;

      const result = await db.replaceAllData({
        teams: nextTeams,
        players: nextPlayers,
        sessions: nextSessions,
        library: nextLibrary,
        clubLogo: nextClubLogo,
        activeTeamId: nextActiveTeamId,
      });

      setTeams(result.teams);
      setActiveTeamId(result.activeTeamId || nextActiveTeamId);
      setPlayers(result.players.map(normalizePlayer));
      setSessions(result.sessions.map((s) => normalizeJogo({ ...s, exercicios: (s.exercicios || []).map(normalizeDiagramas) })));
      setLibrary(result.library.map(normalizeDiagramas));
      setClubLogo(result.clubLogo || "");
      const novaEquipaAtiva = result.teams.find((t) => t.id === (result.activeTeamId || nextActiveTeamId));
      setViewingTemporada(novaEquipaAtiva ? novaEquipaAtiva.temporadaAtual : computeTemporadaAtual());
      setImportPreview(null);
      setImportSuccess(
        `Importado: ${nextPlayers.length} jogadores, ${nextSessions.length} treinos/jogos, ${nextLibrary.length} exercícios, ${nextTeams.length} equipa${nextTeams.length === 1 ? "" : "s"}.`
      );
      setTab("jogadores");
    } catch (e) {
      setError(`Ocorreu um erro ao aplicar os dados importados: ${e.message || e}`);
      setImportPreview(null);
    }
  };

  const teamPlayers = players.filter((p) => p.equipaId === activeTeamId);
  const teamSessions = sessions.filter((s) => s.equipaId === activeTeamId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const temporadasDisponiveis = Array.from(new Set(teamSessions.map((s) => s.temporada).filter(Boolean))).sort().reverse();
  const currentViewingTemporada = viewingTemporada || (activeTeam && activeTeam.temporadaAtual);
  if (currentViewingTemporada && !temporadasDisponiveis.includes(currentViewingTemporada)) {
    temporadasDisponiveis.unshift(currentViewingTemporada);
  }
  const seasonSessions = teamSessions.filter((s) => s.temporada === currentViewingTemporada);
  const isViewingCurrentSeason = activeTeam && currentViewingTemporada === activeTeam.temporadaAtual;

  if (authLoading) {
    return (
      <div className="min-h-full w-full bg-[#14181F] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#8A93A3]" size={22} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-full w-full bg-[#14181F] text-[#F2EDE3] flex flex-col">
      <TopBar
        onExport={exportBackup}
        onImport={handleImportFile}
        teams={teams}
        activeTeamId={activeTeamId}
        onSwitchTeam={switchTeam}
        onManageTeams={() => setTeamsModal(true)}
        temporadas={temporadasDisponiveis}
        viewingTemporada={currentViewingTemporada}
        onSwitchTemporada={setViewingTemporada}
        isCurrentSeason={isViewingCurrentSeason}
        userEmail={user.email}
        onSignOut={handleSignOut}
      />
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <Sidebar
          tab={tab}
          setTab={setTab}
          playerCount={teamPlayers.length}
          sessionCount={seasonSessions.filter((s) => s.type === "treino" && s.realizado !== true).length}
          realizadosCount={seasonSessions.filter((s) => s.type === "treino" && s.realizado === true).length}
          jogosCount={seasonSessions.filter((s) => s.type === "jogo").length}
          libraryCount={library.length}
          publicLibraryCount={publicLibrary.length}
        />
        <main className="flex-1 p-5 md:p-8 max-w-5xl">
          {!ready ? (
            <div className="flex items-center gap-2 text-[#8A93A3] mt-10">
              <Loader2 className="animate-spin" size={18} /> A carregar dados...
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 text-sm text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="shrink-0 text-[#D64545] hover:text-[#F2EDE3]"><X size={14} /></button>
                </div>
              )}
              {importSuccess && (
                <div className="mb-4 text-sm text-[#4C9A6A] bg-[#4C9A6A]/10 border border-[#4C9A6A]/30 rounded px-3 py-2 flex items-center justify-between gap-2">
                  <span>{importSuccess}</span>
                  <button onClick={() => setImportSuccess(null)} className="shrink-0 text-[#4C9A6A] hover:text-[#F2EDE3]"><X size={14} /></button>
                </div>
              )}
              {tab === "inicio" && (
                <DashboardView
                  team={activeTeam}
                  players={teamPlayers}
                  sessions={seasonSessions}
                  library={library}
                  onNavigate={setTab}
                  onGenerateReport={generateSeasonReport}
                />
              )}
              {tab === "jogadores" && (
                <PlayersView
                  players={teamPlayers}
                  sessions={seasonSessions}
                  clubLogo={clubLogo}
                  onAdd={() => setPlayerModal("new")}
                  onImportClick={() => setImportModal(true)}
                  onEdit={(p) => setPlayerModal(p)}
                  onDelete={deletePlayer}
                  onMoveTeam={(p) => setMoveTeamModal(p)}
                />
              )}
              {tab === "treinos" && (
                <SessionsView
                  sessions={seasonSessions.filter((s) => s.type === "treino" && s.realizado !== true)}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onAdd={() => setSessionModal({ ...emptySession, date: todayStr() })}
                  onEdit={(s) => setSessionModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                />
              )}
              {tab === "realizados" && (
                <RealizadosView
                  sessions={seasonSessions.filter((s) => s.type === "treino" && s.realizado === true)}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onEdit={(s) => setSessionModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                />
              )}
              {tab === "jogos" && (
                <JogosView
                  sessions={seasonSessions.filter((s) => s.type === "jogo")}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  onAdd={() => setJogoModal({ ...emptyJogo, date: todayStr() })}
                  onEdit={(s) => setJogoModal(s)}
                  onDelete={deleteSession}
                  onTransfer={(s) => setTransferModal(s)}
                  onLiveStats={(s) => setLiveStatsModal(s)}
                />
              )}
              {tab === "biblioteca" && (
                <LibraryView
                  library={library}
                  onAdd={() => setLibraryModal("new")}
                  onEdit={(item) => setLibraryModal(item)}
                  onDelete={deleteLibraryItem}
                  onPublish={publishLibraryItem}
                />
              )}
              {tab === "biblioteca-publica" && (
                <PublicLibraryView
                  publicLibrary={publicLibrary}
                  currentUserId={user.id}
                  onCopyToLibrary={copyPublicItemToLibrary}
                  onUnpublish={unpublishLibraryItem}
                />
              )}
              {tab === "calendario" && (
                <CalendarView
                  sessions={seasonSessions}
                  players={teamPlayers}
                  clubLogo={clubLogo}
                  calYear={calYear}
                  setCalYear={setCalYear}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  onAddOnDay={(dateStr) => setSessionModal({ ...emptySession, date: dateStr })}
                  onEdit={(s) => (s.type === "jogo" ? setJogoModal(s) : setSessionModal(s))}
                  onDelete={deleteSession}
                />
              )}
            </>
          )}
        </main>
      </div>

      {playerModal && (
        <PlayerModal
          initial={playerModal === "new" ? emptyPlayer : playerModal}
          sessions={teamSessions}
          onClose={() => setPlayerModal(null)}
          onSave={savePlayer}
        />
      )}
      {sessionModal && (
        <SessionModal
          initial={sessionModal}
          library={library}
          players={teamPlayers}
          onSaveToLibrary={addLibraryItemQuiet}
          onClose={() => setSessionModal(null)}
          onSave={saveSession}
        />
      )}
      {jogoModal && (
        <JogoModal
          initial={jogoModal}
          players={teamPlayers}
          onClose={() => setJogoModal(null)}
          onSave={saveSession}
        />
      )}
      {liveStatsModal && (
        <LiveStatsView
          jogo={liveStatsModal}
          players={teamPlayers}
          onClose={() => setLiveStatsModal(null)}
          onSave={(estatisticas) => saveLiveStats(liveStatsModal, estatisticas)}
        />
      )}
      {importModal && (
        <ImportModal onClose={() => setImportModal(false)} onImport={importPlayers} />
      )}
      {libraryModal && (
        <LibraryModal
          initial={libraryModal === "new" ? emptyLibraryItem : libraryModal}
          onClose={() => setLibraryModal(null)}
          onSave={saveLibraryItem}
        />
      )}
      {importPreview && (
        <ImportBackupConfirmModal
          fileName={importPreview.fileName}
          counts={{
            players: importPreview.parsed.players.length,
            sessions: importPreview.parsed.sessions.length,
            library: importPreview.parsed.library.length,
          }}
          onCancel={() => setImportPreview(null)}
          onConfirm={confirmImport}
        />
      )}
      {teamsModal && (
        <TeamsModal
          teams={teams}
          players={players}
          sessions={sessions}
          clubLogo={clubLogo}
          onSaveLogo={saveClubLogo}
          onClose={() => setTeamsModal(false)}
          onAdd={addTeam}
          onRename={renameTeam}
          onDelete={deleteTeam}
          onFecharTemporada={fecharTemporada}
        />
      )}
      {transferModal && (
        <TransferModal
          teams={teams.filter((t) => t.id !== activeTeamId)}
          onClose={() => setTransferModal(null)}
          onConfirm={(targetTeamId) => transferSession(transferModal, targetTeamId)}
        />
      )}
      {moveTeamModal && (
        <MovePlayerModal
          player={moveTeamModal}
          teams={teams.filter((t) => t.id !== activeTeamId)}
          onClose={() => setMoveTeamModal(null)}
          onConfirm={(targetTeamId) => movePlayerToTeam(moveTeamModal, targetTeamId)}
        />
      )}
    </div>
  );
}
