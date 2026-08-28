import { supabase } from "./supabaseClient";

// Cada entidade da app (players, sessions, ...) usa nomes de campos em
// camelCase, mas o Postgres/Supabase usa snake_case. Estes mapas convertem
// nos dois sentidos para que o resto da app não precise de saber a diferença.

const PLAYER_FIELDS = {
  equipaId: "team_id",
  epocasClube: "epocas_clube",
  outrosDesportos: "outros_desportos",
  testesFisicos: "testes_fisicos",
};

const SESSION_FIELDS = {
  equipaId: "team_id",
  jogoNumero: "jogo_numero",
  treinadorPrincipal: "treinador_principal",
  treinadorPrincipalLicenca: "treinador_principal_licenca",
  treinadorAdjunto: "treinador_adjunto",
  treinadorAdjuntoLicenca: "treinador_adjunto_licenca",
  objetivosJogo: "objetivos_jogo",
  reflexaoPreparacao: "reflexao_preparacao",
  palestraInicial: "palestra_inicial",
  descontosTempo: "descontos_tempo",
  apreciacaoGeral: "apreciacao_geral",
};

const LIBRARY_FIELDS = {
  duracaoPadrao: "duracao_padrao",
};

const TEAM_FIELDS = {
  temporadaAtual: "temporada_atual",
};

// Colunas do tipo "date" no Postgres não aceitam string vazia (só uma data
// válida ou null) — ao contrário das colunas de texto, onde "" é normal.
const DATE_FIELDS = ["nascimento", "date"];

function toDb(fieldMap, obj) {
  const row = {};
  for (const [key, value] of Object.entries(obj)) {
    // O id é gerido à parte: gerado pela BD em criações novas, indicado via
    // .eq("id", ...) em updates, ou reposto explicitamente em replaceAllData.
    if (key === "id") continue;
    const dbKey = fieldMap[key] || key;
    row[dbKey] = DATE_FIELDS.includes(key) && value === "" ? null : value;
  }
  return row;
}

function fromDb(fieldMap, row) {
  const reverseMap = Object.fromEntries(Object.entries(fieldMap).map(([js, db]) => [db, js]));
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const jsKey = reverseMap[key] || key;
    obj[jsKey] = DATE_FIELDS.includes(jsKey) && value === null ? "" : value;
  }
  return obj;
}

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sem sessão iniciada.");
  return data.user.id;
}

// ---------------- Equipas ----------------

async function listTeams() {
  const { data, error } = await supabase.from("teams").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => fromDb(TEAM_FIELDS, row));
}

async function createTeam(team) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("teams")
    .insert({ ...toDb(TEAM_FIELDS, team), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(TEAM_FIELDS, data);
}

async function updateTeam(id, patch) {
  const { data, error } = await supabase.from("teams").update(toDb(TEAM_FIELDS, patch)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(TEAM_FIELDS, data);
}

async function deleteTeam(id) {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Jogadores ----------------

async function listPlayers() {
  const { data, error } = await supabase.from("players").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => fromDb(PLAYER_FIELDS, row));
}

async function createPlayer(player) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("players")
    .insert({ ...toDb(PLAYER_FIELDS, player), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(PLAYER_FIELDS, data);
}

async function createPlayers(players) {
  const userId = await getUserId();
  const rows = players.map((p) => ({ ...toDb(PLAYER_FIELDS, p), user_id: userId }));
  const { data, error } = await supabase.from("players").insert(rows).select();
  if (error) throw error;
  return data.map((row) => fromDb(PLAYER_FIELDS, row));
}

async function updatePlayer(id, patch) {
  const { data, error } = await supabase.from("players").update(toDb(PLAYER_FIELDS, patch)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(PLAYER_FIELDS, data);
}

async function deletePlayer(id) {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Treinos e jogos ----------------

async function listSessions() {
  const { data, error } = await supabase.from("sessions").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => fromDb(SESSION_FIELDS, row));
}

async function createSession(session) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ ...toDb(SESSION_FIELDS, session), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(SESSION_FIELDS, data);
}

async function updateSession(id, patch) {
  const { data, error } = await supabase.from("sessions").update(toDb(SESSION_FIELDS, patch)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(SESSION_FIELDS, data);
}

async function deleteSession(id) {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Biblioteca de exercícios ----------------

async function listLibrary() {
  const { data, error } = await supabase.from("library_items").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => fromDb(LIBRARY_FIELDS, row));
}

async function createLibraryItem(item) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("library_items")
    .insert({ ...toDb(LIBRARY_FIELDS, item), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(LIBRARY_FIELDS, data);
}

async function updateLibraryItem(id, patch) {
  const { data, error } = await supabase.from("library_items").update(toDb(LIBRARY_FIELDS, patch)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(LIBRARY_FIELDS, data);
}

async function deleteLibraryItem(id) {
  const { error } = await supabase.from("library_items").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Definições (logótipo, equipa ativa) ----------------

async function getSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return { clubLogo: "", activeTeamId: null };
  return { clubLogo: data.club_logo || "", activeTeamId: data.active_team_id || null };
}

async function saveSettings(patch) {
  const userId = await getUserId();
  const row = { user_id: userId };
  if ("clubLogo" in patch) row.club_logo = patch.clubLogo;
  if ("activeTeamId" in patch) row.active_team_id = patch.activeTeamId;
  const { error } = await supabase.from("app_settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

// ---------------- Carregar tudo de uma vez / importar cópia de segurança ----------------

async function loadAll() {
  const [teams, players, sessions, library, settings] = await Promise.all([
    listTeams(),
    listPlayers(),
    listSessions(),
    listLibrary(),
    getSettings(),
  ]);
  return { teams, players, sessions, library, ...settings };
}

// Substitui TODOS os dados do utilizador pelos de uma cópia de segurança importada.
async function replaceAllData({ teams, players, sessions, library, clubLogo, activeTeamId }) {
  const userId = await getUserId();
  await Promise.all([
    supabase.from("players").delete().eq("user_id", userId),
    supabase.from("sessions").delete().eq("user_id", userId),
    supabase.from("library_items").delete().eq("user_id", userId),
    supabase.from("teams").delete().eq("user_id", userId),
  ]);

  const teamRows = teams.map((t) => ({ ...toDb(TEAM_FIELDS, t), user_id: userId, id: t.id }));
  if (teamRows.length > 0) {
    const { error } = await supabase.from("teams").insert(teamRows);
    if (error) throw error;
  }

  const playerRows = players.map((p) => ({ ...toDb(PLAYER_FIELDS, p), user_id: userId, id: p.id }));
  if (playerRows.length > 0) {
    const { error } = await supabase.from("players").insert(playerRows);
    if (error) throw error;
  }

  const sessionRows = sessions.map((s) => ({ ...toDb(SESSION_FIELDS, s), user_id: userId, id: s.id }));
  if (sessionRows.length > 0) {
    const { error } = await supabase.from("sessions").insert(sessionRows);
    if (error) throw error;
  }

  const libraryRows = library.map((l) => ({ ...toDb(LIBRARY_FIELDS, l), user_id: userId, id: l.id }));
  if (libraryRows.length > 0) {
    const { error } = await supabase.from("library_items").insert(libraryRows);
    if (error) throw error;
  }

  await saveSettings({ clubLogo: clubLogo || "", activeTeamId: activeTeamId || null });

  return loadAll();
}

export {
  loadAll,
  replaceAllData,
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  listPlayers,
  createPlayer,
  createPlayers,
  updatePlayer,
  deletePlayer,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  listLibrary,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  getSettings,
  saveSettings,
};
