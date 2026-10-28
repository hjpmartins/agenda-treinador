// Acesso do Espaço Atletas (link pessoal, sem conta) às funções RPC
// "portal_*" da base de dados (ver supabase/schema.sql) — o mesmo cliente
// Supabase da app, mas sem sessão: o token da atleta é a credencial, não
// um login. Cada função valida o token no lado do servidor antes de ler
// ou gravar seja o que for.

import { supabase } from "./supabaseClient";

async function getDados(token) {
  const { data, error } = await supabase.rpc("portal_get_dados", { p_token: token });
  if (error) throw error;
  const row = data && data[0];
  if (!row) return null;
  return { playerId: row.player_id, nome: row.nome, teamId: row.team_id, equipaNome: row.equipa_nome };
}

async function getAvisos(token) {
  const { data, error } = await supabase.rpc("portal_get_avisos", { p_token: token });
  if (error) throw error;
  return (data || []).map((a) => ({ id: a.id, titulo: a.titulo, texto: a.texto, createdAt: a.created_at }));
}

async function getTreinos(token) {
  const { data, error } = await supabase.rpc("portal_get_treinos", { p_token: token });
  if (error) throw error;
  return (data || []).map((s) => ({
    id: s.id,
    date: s.date,
    title: s.title,
    objetivo: s.objetivo,
    exercicios: s.exercicios || [],
    observacoes: s.observacoes,
    realizado: s.realizado,
    rsvp: s.rsvp,
    rsvpMotivo: s.rsvp_motivo,
  }));
}

async function getConvocatorias(token) {
  const { data, error } = await supabase.rpc("portal_get_convocatorias", { p_token: token });
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    data: c.data,
    hora: c.hora,
    pontoEncontro: c.ponto_encontro,
    refeicao: c.refeicao,
    createdAt: c.created_at,
  }));
}

async function getEvolucao(token) {
  const { data, error } = await supabase.rpc("portal_get_evolucao", { p_token: token });
  if (error) throw error;
  const row = data && data[0];
  if (!row) return { avaliacoes: [], testesFisicos: [], jogos: [] };
  return { avaliacoes: row.avaliacoes || [], testesFisicos: row.testes_fisicos || [], jogos: row.jogos || [] };
}

async function getPerguntas(token) {
  const { data, error } = await supabase.rpc("portal_get_perguntas", { p_token: token });
  if (error) throw error;
  return (data || []).map((q) => ({ id: q.id, texto: q.texto, opcoes: q.opcoes || [], createdAt: q.created_at, resposta: q.resposta }));
}

async function setResposta(token, perguntaId, resposta) {
  const { error } = await supabase.rpc("portal_set_resposta", { p_token: token, p_pergunta_id: perguntaId, p_resposta: resposta });
  if (error) throw error;
}

async function setRsvp(token, sessionId, status, motivo = "") {
  const { error } = await supabase.rpc("portal_set_rsvp", { p_token: token, p_session_id: sessionId, p_status: status, p_motivo: motivo });
  if (error) throw error;
}

async function reportarLesao(token, texto) {
  const { error } = await supabase.rpc("portal_report_lesao", { p_token: token, p_texto: texto });
  if (error) throw error;
}

async function enviarMensagem(token, texto) {
  const { error } = await supabase.rpc("portal_send_mensagem", { p_token: token, p_texto: texto });
  if (error) throw error;
}

export { getDados, getAvisos, getTreinos, getConvocatorias, getEvolucao, getPerguntas, setResposta, setRsvp, reportarLesao, enviarMensagem };
