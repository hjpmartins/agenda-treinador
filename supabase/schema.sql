-- Esquema da base de dados da Agenda do Treinador.
-- Corre isto no SQL Editor do teu projeto Supabase (Project → SQL Editor → New query),
-- depois de teres o projeto criado. Podes colar o ficheiro inteiro de uma vez.

-- ============================================================
-- EQUIPAS
-- ============================================================
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  temporada_atual text,
  banner text,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;

create policy "utilizadores veem só as suas equipas"
  on teams for select using (auth.uid() = user_id);
create policy "utilizadores criam as suas equipas"
  on teams for insert with check (auth.uid() = user_id);
create policy "utilizadores editam as suas equipas"
  on teams for update using (auth.uid() = user_id);
create policy "utilizadores apagam as suas equipas"
  on teams for delete using (auth.uid() = user_id);

-- ============================================================
-- JOGADORES
-- ============================================================
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  nome text not null default '',
  numero text default '',
  posicao text default '',
  nascimento date,
  notas text default '',
  foto text default '',
  morada text default '',
  cidade text default '',
  cc text default '',
  nif text default '',
  profissao text default '',
  email text default '',
  telemovel text default '',
  epocas_clube text default '',
  medicacao text default '',
  outros_desportos text default '',
  lesoes jsonb not null default '[]',
  avaliacoes jsonb not null default '[]',
  testes_fisicos jsonb not null default '[]',
  -- Token secreto e único para o link pessoal da atleta no "Espaço
  -- Atletas" (ver secção mais abaixo) — não precisa de conta/password,
  -- só de ter o link.
  portal_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on players(team_id);

alter table players enable row level security;

create policy "utilizadores veem só os seus jogadores"
  on players for select using (auth.uid() = user_id);
create policy "utilizadores criam os seus jogadores"
  on players for insert with check (auth.uid() = user_id);
create policy "utilizadores editam os seus jogadores"
  on players for update using (auth.uid() = user_id);
create policy "utilizadores apagam os seus jogadores"
  on players for delete using (auth.uid() = user_id);

-- ============================================================
-- TREINOS E JOGOS (sessions)
-- ============================================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  type text not null check (type in ('treino', 'jogo')),
  date date,
  temporada text,
  title text default '',

  -- campos de treino
  objetivo text default '',
  exercicios jsonb not null default '[]',
  observacoes text default '',
  realizado boolean default false,
  presencas jsonb not null default '{}',

  -- campos comuns a treino/jogo
  adversario text default '',
  resultado text default '',
  conteudo text default '',

  -- campos específicos de jogo
  horario text default '',
  campeonato text default '',
  jogo_numero text default '',
  local text default '',
  treinador_principal text default '',
  treinador_principal_licenca text default '',
  treinador_adjunto text default '',
  treinador_adjunto_licenca text default '',
  dirigentes jsonb not null default '[]',
  convocatoria jsonb not null default '{}',
  objetivos_jogo jsonb not null default '[]',
  reflexao_preparacao text default '',
  palestra_inicial text default '',
  descontos_tempo text default '',
  apreciacao_geral text default '',
  estatisticas jsonb not null default '{}',

  created_at timestamptz not null default now()
);

create index if not exists sessions_team_id_idx on sessions(team_id);

alter table sessions enable row level security;

create policy "utilizadores veem só os seus treinos/jogos"
  on sessions for select using (auth.uid() = user_id);
create policy "utilizadores criam os seus treinos/jogos"
  on sessions for insert with check (auth.uid() = user_id);
create policy "utilizadores editam os seus treinos/jogos"
  on sessions for update using (auth.uid() = user_id);
create policy "utilizadores apagam os seus treinos/jogos"
  on sessions for delete using (auth.uid() = user_id);

-- ============================================================
-- BIBLIOTECA DE EXERCÍCIOS (partilhada entre equipas do mesmo utilizador)
-- ============================================================
create table if not exists library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default '',
  categoria text default '',
  duracao_padrao text default '',
  descricao text default '',
  diagramas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table library_items enable row level security;

create policy "utilizadores veem só a sua biblioteca"
  on library_items for select using (auth.uid() = user_id);
create policy "utilizadores criam na sua biblioteca"
  on library_items for insert with check (auth.uid() = user_id);
create policy "utilizadores editam a sua biblioteca"
  on library_items for update using (auth.uid() = user_id);
create policy "utilizadores apagam da sua biblioteca"
  on library_items for delete using (auth.uid() = user_id);

-- ============================================================
-- BIBLIOTECA PÚBLICA (exercícios partilhados entre treinadores)
-- Cada linha é uma cópia independente de um exercício, publicada por um
-- treinador a partir da sua biblioteca privada. Visível a todos os
-- utilizadores com sessão iniciada; só o autor pode apagar a sua publicação.
-- ============================================================
create table if not exists public_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_label text default '',
  nome text not null default '',
  categoria text default '',
  duracao_padrao text default '',
  descricao text default '',
  diagramas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public_library_items enable row level security;

create policy "utilizadores com sessão iniciada veem a biblioteca pública"
  on public_library_items for select using (auth.role() = 'authenticated');
create policy "utilizadores publicam os seus próprios exercícios"
  on public_library_items for insert with check (auth.uid() = user_id);
create policy "utilizadores apagam o que publicaram"
  on public_library_items for delete using (auth.uid() = user_id);

-- ============================================================
-- DEFINIÇÕES DA APP (logótipo do clube, equipa ativa)
-- Uma linha por utilizador.
-- ============================================================
create table if not exists app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  club_logo text default '',
  active_team_id uuid references teams(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy "utilizadores veem só as suas definições"
  on app_settings for select using (auth.uid() = user_id);
create policy "utilizadores criam as suas definições"
  on app_settings for insert with check (auth.uid() = user_id);
create policy "utilizadores editam as suas definições"
  on app_settings for update using (auth.uid() = user_id);

-- ============================================================
-- ESPAÇO ATLETAS — avisos, perguntas, RSVP e lesões reportadas
-- As atletas não têm conta Supabase: entram por um link pessoal com o
-- portal_token da ficha delas (ver players acima). Por isso estas tabelas
-- só dão acesso de leitura/escrita ao treinador (dono) por RLS — o acesso
-- da atleta passa sempre pelas funções "portal_*" mais abaixo, que validam
-- o token no servidor antes de ler/gravar nada.
-- ============================================================

create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  titulo text not null default '',
  texto text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists avisos_team_id_idx on avisos(team_id);

alter table avisos enable row level security;

create policy "treinador vê os seus avisos"
  on avisos for select using (auth.uid() = user_id);
create policy "treinador cria avisos"
  on avisos for insert with check (auth.uid() = user_id);
create policy "treinador edita os seus avisos"
  on avisos for update using (auth.uid() = user_id);
create policy "treinador apaga os seus avisos"
  on avisos for delete using (auth.uid() = user_id);

create table if not exists perguntas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  texto text not null default '',
  opcoes jsonb not null default '["Sim", "Não"]',
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists perguntas_team_id_idx on perguntas(team_id);

alter table perguntas enable row level security;

create policy "treinador vê as suas perguntas"
  on perguntas for select using (auth.uid() = user_id);
create policy "treinador cria perguntas"
  on perguntas for insert with check (auth.uid() = user_id);
create policy "treinador edita as suas perguntas"
  on perguntas for update using (auth.uid() = user_id);
create policy "treinador apaga as suas perguntas"
  on perguntas for delete using (auth.uid() = user_id);

create table if not exists respostas_perguntas (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references perguntas(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  resposta text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pergunta_id, player_id)
);

alter table respostas_perguntas enable row level security;

create policy "treinador vê as respostas às suas perguntas"
  on respostas_perguntas for select using (
    exists (select 1 from perguntas q where q.id = pergunta_id and q.user_id = auth.uid())
  );

create table if not exists presencas_rsvp (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null check (status in ('vou', 'nao_vou')),
  -- Motivo de "não vou" (pedido à atleta quando responde que não vai).
  motivo text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);

alter table presencas_rsvp enable row level security;

create policy "treinador vê os rsvps dos seus treinos"
  on presencas_rsvp for select using (
    exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create table if not exists lesoes_reportadas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  texto text not null default '',
  estado text not null default 'pendente' check (estado in ('pendente', 'revisto')),
  created_at timestamptz not null default now()
);

alter table lesoes_reportadas enable row level security;

create policy "treinador vê as lesões reportadas dos seus jogadores"
  on lesoes_reportadas for select using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );
create policy "treinador marca as lesões reportadas como revistas"
  on lesoes_reportadas for update using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );

-- Mensagem livre de uma atleta para o treinador (não é sobre lesão/estado
-- — é a caixa de "quero dizer-te uma coisa").
create table if not exists mensagens_atletas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  texto text not null default '',
  estado text not null default 'pendente' check (estado in ('pendente', 'revisto')),
  created_at timestamptz not null default now()
);

alter table mensagens_atletas enable row level security;

create policy "treinador vê as mensagens das suas atletas"
  on mensagens_atletas for select using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );
create policy "treinador marca as mensagens como revistas"
  on mensagens_atletas for update using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );

-- Convocatória para um jogo em concreto, dirigida só às jogadoras
-- selecionadas (diferente da "Convocatória — participação por período"
-- da ficha de jogo, que é o relatório oficial para a federação).
create table if not exists convocatorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  titulo text not null default '',
  data date,
  hora text default '',
  ponto_encontro text default '',
  refeicao text default '',
  jogadoras_ids jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists convocatorias_team_id_idx on convocatorias(team_id);

alter table convocatorias enable row level security;

create policy "treinador vê as suas convocatórias"
  on convocatorias for select using (auth.uid() = user_id);
create policy "treinador cria convocatórias"
  on convocatorias for insert with check (auth.uid() = user_id);
create policy "treinador edita as suas convocatórias"
  on convocatorias for update using (auth.uid() = user_id);
create policy "treinador apaga as suas convocatórias"
  on convocatorias for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Funções do portal (acesso da atleta, sem conta, só com o token).
-- "security definer" + "grant ... to anon": a função corre com
-- privilégios próprios (ignora as políticas acima) mas só faz exatamente
-- o que está escrito aqui dentro — sempre a validar o token primeiro.
-- ------------------------------------------------------------

create or replace function portal_get_dados(p_token uuid)
returns table (player_id uuid, nome text, team_id uuid, equipa_nome text)
language sql security definer set search_path = public as $$
  select p.id, p.nome, p.team_id, t.nome
  from players p
  join teams t on t.id = p.team_id
  where p.portal_token = p_token;
$$;
grant execute on function portal_get_dados(uuid) to anon;

-- Dados para os gráficos de evolução (altura/peso/envergadura, testes
-- físicos e estatísticas de jogo) — a mesma informação que o treinador vê
-- no botão "Ver evolução" da ficha, só que já filtrada para esta atleta.
create or replace function portal_get_evolucao(p_token uuid)
returns table (avaliacoes jsonb, testes_fisicos jsonb, jogos jsonb)
language sql security definer set search_path = public as $$
  select
    p.avaliacoes,
    p.testes_fisicos,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('date', s.date, 'adversario', s.adversario, 'estatisticas', s.estatisticas -> p.id::text) order by s.date)
        from sessions s
        where s.team_id = p.team_id and s.type = 'jogo' and s.estatisticas ? p.id::text
      ),
      '[]'::jsonb
    ) as jogos
  from players p
  where p.portal_token = p_token;
$$;
grant execute on function portal_get_evolucao(uuid) to anon;

create or replace function portal_get_avisos(p_token uuid)
returns setof avisos
language sql security definer set search_path = public as $$
  select a.*
  from avisos a
  join players p on p.team_id = a.team_id
  where p.portal_token = p_token
  order by a.created_at desc;
$$;
grant execute on function portal_get_avisos(uuid) to anon;

-- Só as convocatórias de jogos ainda não passados, e só as que incluem a
-- própria atleta (o resto do plantel não precisa de ver uma convocatória
-- que não é para elas).
create or replace function portal_get_convocatorias(p_token uuid)
returns table (id uuid, titulo text, data date, hora text, ponto_encontro text, refeicao text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.titulo, c.data, c.hora, c.ponto_encontro, c.refeicao, c.created_at
  from convocatorias c
  join players p on p.team_id = c.team_id
  where p.portal_token = p_token
    and c.jogadoras_ids ? p.id::text
    and (c.data is null or c.data >= current_date)
  order by c.data asc nulls last, c.created_at desc;
$$;
grant execute on function portal_get_convocatorias(uuid) to anon;

-- O "returns table" muda de forma (acrescenta rsvp_motivo) — tem de se
-- apagar a versão antiga antes, o Postgres não deixa mudar isto em cima.
drop function if exists portal_get_treinos(uuid);

create or replace function portal_get_treinos(p_token uuid)
returns table (
  id uuid, date date, title text, objetivo text, exercicios jsonb,
  observacoes text, realizado boolean, rsvp text, rsvp_motivo text
)
language sql security definer set search_path = public as $$
  select s.id, s.date, s.title, s.objetivo, s.exercicios, s.observacoes, s.realizado, r.status, r.motivo
  from sessions s
  join players p on p.team_id = s.team_id
  left join presencas_rsvp r on r.session_id = s.id and r.player_id = p.id
  where p.portal_token = p_token
    and s.type = 'treino'
    and s.date >= (current_date - interval '7 days')
  order by s.date asc;
$$;
grant execute on function portal_get_treinos(uuid) to anon;

create or replace function portal_get_perguntas(p_token uuid)
returns table (id uuid, texto text, opcoes jsonb, created_at timestamptz, resposta text)
language sql security definer set search_path = public as $$
  select q.id, q.texto, q.opcoes, q.created_at, r.resposta
  from perguntas q
  join players p on p.team_id = q.team_id
  left join respostas_perguntas r on r.pergunta_id = q.id and r.player_id = p.id
  where p.portal_token = p_token and q.ativa = true
  order by q.created_at desc;
$$;
grant execute on function portal_get_perguntas(uuid) to anon;

create or replace function portal_set_resposta(p_token uuid, p_pergunta_id uuid, p_resposta text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
  v_team_id uuid;
begin
  select p.id, p.team_id into v_player_id, v_team_id from players p where p.portal_token = p_token;
  if v_player_id is null then
    raise exception 'token inválido';
  end if;
  if not exists (select 1 from perguntas q where q.id = p_pergunta_id and q.team_id = v_team_id) then
    raise exception 'pergunta não encontrada';
  end if;
  insert into respostas_perguntas (pergunta_id, player_id, resposta)
  values (p_pergunta_id, v_player_id, p_resposta)
  on conflict (pergunta_id, player_id) do update set resposta = excluded.resposta, updated_at = now();
end;
$$;
grant execute on function portal_set_resposta(uuid, uuid, text) to anon;

-- Assinatura antiga (sem motivo) — remove-se antes de recriar com o
-- parâmetro novo, para não ficar com as duas versões em simultâneo.
drop function if exists portal_set_rsvp(uuid, uuid, text);

create or replace function portal_set_rsvp(p_token uuid, p_session_id uuid, p_status text, p_motivo text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
  v_team_id uuid;
begin
  select p.id, p.team_id into v_player_id, v_team_id from players p where p.portal_token = p_token;
  if v_player_id is null then
    raise exception 'token inválido';
  end if;
  if not exists (select 1 from sessions s where s.id = p_session_id and s.team_id = v_team_id) then
    raise exception 'treino não encontrado';
  end if;
  insert into presencas_rsvp (session_id, player_id, status, motivo)
  values (p_session_id, v_player_id, p_status, coalesce(p_motivo, ''))
  on conflict (session_id, player_id) do update set status = excluded.status, motivo = excluded.motivo, updated_at = now();
end;
$$;
grant execute on function portal_set_rsvp(uuid, uuid, text, text) to anon;

create or replace function portal_send_mensagem(p_token uuid, p_texto text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
begin
  select p.id into v_player_id from players p where p.portal_token = p_token;
  if v_player_id is null then
    raise exception 'token inválido';
  end if;
  insert into mensagens_atletas (player_id, texto) values (v_player_id, p_texto);
end;
$$;
grant execute on function portal_send_mensagem(uuid, text) to anon;

create or replace function portal_report_lesao(p_token uuid, p_texto text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
begin
  select p.id into v_player_id from players p where p.portal_token = p_token;
  if v_player_id is null then
    raise exception 'token inválido';
  end if;
  insert into lesoes_reportadas (player_id, texto) values (v_player_id, p_texto);
end;
$$;
grant execute on function portal_report_lesao(uuid, text) to anon;

-- ============================================================
-- MIGRAÇÕES (para projetos criados antes de uma coluna existir)
-- Corre isto se já tinhas a base de dados criada antes desta alteração —
-- "if not exists" torna seguro correr outra vez sem dar erro.
-- ============================================================

-- Foto de capa de cada equipa (banner no topo do Início).
alter table teams add column if not exists banner text;

-- Token do link pessoal de cada atleta (Espaço Atletas) — se já tinhas
-- jogadores, cada um recebe aqui um token novo e único.
alter table players add column if not exists portal_token uuid unique default gen_random_uuid();

-- Tabelas e funções novas do Espaço Atletas (avisos, perguntas, RSVP,
-- lesões reportadas): não existiam antes desta versão. Como são tabelas
-- inteiramente novas (ainda não tens as políticas delas criadas), corre
-- também, uma única vez, o bloco inteiro
-- "-- ESPAÇO ATLETAS — avisos, perguntas, RSVP e lesões reportadas"
-- lá mais acima neste ficheiro (da linha do título até à linha
-- "grant execute on function portal_report_lesao(uuid, text) to anon;",
-- logo antes desta secção de migrações). Não coles o ficheiro inteiro —
-- as políticas das tabelas que já tens (teams, players, sessions, ...)
-- dariam erro de "já existe" se as corresses outra vez.

-- Motivo da falta, mensagens livres das atletas, e o novo formato do
-- RSVP/treinos (se já tinhas corrido o bloco do Espaço Atletas antes
-- desta versão) — este bloco é seguro correr mais do que uma vez.
alter table presencas_rsvp add column if not exists motivo text default '';

create table if not exists mensagens_atletas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  texto text not null default '',
  estado text not null default 'pendente' check (estado in ('pendente', 'revisto')),
  created_at timestamptz not null default now()
);
alter table mensagens_atletas enable row level security;
drop policy if exists "treinador vê as mensagens das suas atletas" on mensagens_atletas;
create policy "treinador vê as mensagens das suas atletas"
  on mensagens_atletas for select using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );
drop policy if exists "treinador marca as mensagens como revistas" on mensagens_atletas;
create policy "treinador marca as mensagens como revistas"
  on mensagens_atletas for update using (
    exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
  );

drop function if exists portal_get_treinos(uuid);
create function portal_get_treinos(p_token uuid)
returns table (
  id uuid, date date, title text, objetivo text, exercicios jsonb,
  observacoes text, realizado boolean, rsvp text, rsvp_motivo text
)
language sql security definer set search_path = public as $$
  select s.id, s.date, s.title, s.objetivo, s.exercicios, s.observacoes, s.realizado, r.status, r.motivo
  from sessions s
  join players p on p.team_id = s.team_id
  left join presencas_rsvp r on r.session_id = s.id and r.player_id = p.id
  where p.portal_token = p_token and s.type = 'treino' and s.date >= (current_date - interval '7 days')
  order by s.date asc;
$$;
grant execute on function portal_get_treinos(uuid) to anon;

drop function if exists portal_set_rsvp(uuid, uuid, text);
create function portal_set_rsvp(p_token uuid, p_session_id uuid, p_status text, p_motivo text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
  v_team_id uuid;
begin
  select p.id, p.team_id into v_player_id, v_team_id from players p where p.portal_token = p_token;
  if v_player_id is null then raise exception 'token inválido'; end if;
  if not exists (select 1 from sessions s where s.id = p_session_id and s.team_id = v_team_id) then
    raise exception 'treino não encontrado';
  end if;
  insert into presencas_rsvp (session_id, player_id, status, motivo)
  values (p_session_id, v_player_id, p_status, coalesce(p_motivo, ''))
  on conflict (session_id, player_id) do update set status = excluded.status, motivo = excluded.motivo, updated_at = now();
end;
$$;
grant execute on function portal_set_rsvp(uuid, uuid, text, text) to anon;

create or replace function portal_send_mensagem(p_token uuid, p_texto text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
begin
  select p.id into v_player_id from players p where p.portal_token = p_token;
  if v_player_id is null then raise exception 'token inválido'; end if;
  insert into mensagens_atletas (player_id, texto) values (v_player_id, p_texto);
end;
$$;
grant execute on function portal_send_mensagem(uuid, text) to anon;

-- Convocatória de jogo (título, data, hora, ponto de encontro, refeição e
-- quais jogadoras do plantel são convocadas) — tabela nova, não existia
-- antes desta versão.
create table if not exists convocatorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  titulo text not null default '',
  data date,
  hora text default '',
  ponto_encontro text default '',
  refeicao text default '',
  jogadoras_ids jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists convocatorias_team_id_idx on convocatorias(team_id);
alter table convocatorias enable row level security;
drop policy if exists "treinador vê as suas convocatórias" on convocatorias;
create policy "treinador vê as suas convocatórias"
  on convocatorias for select using (auth.uid() = user_id);
drop policy if exists "treinador cria convocatórias" on convocatorias;
create policy "treinador cria convocatórias"
  on convocatorias for insert with check (auth.uid() = user_id);
drop policy if exists "treinador edita as suas convocatórias" on convocatorias;
create policy "treinador edita as suas convocatórias"
  on convocatorias for update using (auth.uid() = user_id);
drop policy if exists "treinador apaga as suas convocatórias" on convocatorias;
create policy "treinador apaga as suas convocatórias"
  on convocatorias for delete using (auth.uid() = user_id);

create or replace function portal_get_convocatorias(p_token uuid)
returns table (id uuid, titulo text, data date, hora text, ponto_encontro text, refeicao text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.titulo, c.data, c.hora, c.ponto_encontro, c.refeicao, c.created_at
  from convocatorias c
  join players p on p.team_id = c.team_id
  where p.portal_token = p_token
    and c.jogadoras_ids ? p.id::text
    and (c.data is null or c.data >= current_date)
  order by c.data asc nulls last, c.created_at desc;
$$;
grant execute on function portal_get_convocatorias(uuid) to anon;

-- Evolução (altura/peso/envergadura, testes físicos e estatísticas de
-- jogo) no portal da atleta — função nova, não existia antes desta versão.
create or replace function portal_get_evolucao(p_token uuid)
returns table (avaliacoes jsonb, testes_fisicos jsonb, jogos jsonb)
language sql security definer set search_path = public as $$
  select
    p.avaliacoes,
    p.testes_fisicos,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('date', s.date, 'adversario', s.adversario, 'estatisticas', s.estatisticas -> p.id::text) order by s.date)
        from sessions s
        where s.team_id = p.team_id and s.type = 'jogo' and s.estatisticas ? p.id::text
      ),
      '[]'::jsonb
    ) as jogos
  from players p
  where p.portal_token = p_token;
$$;
grant execute on function portal_get_evolucao(uuid) to anon;
