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
