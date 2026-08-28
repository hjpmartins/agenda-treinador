# Agenda do Treinador

App de gestão de equipas de basquetebol (jogadores, treinos, jogos, biblioteca de exercícios, diagramas de campo e sugestões de treino com IA).

**Publicada em:** https://agenda-treinador-murex.vercel.app

> Usa sempre este link (o domínio de produção do projeto). Os links com um código aleatório no meio (ex: `agenda-treinador-xxxxx-hjpm.vercel.app`) apontam para um deploy específico e fixo no tempo — nunca atualizam sozinhos.

## Estado atual

O projeto passou de um único ficheiro de artefacto (`reference/agenda_treinador.jsx`, mantido como referência) para uma aplicação real, publicada e a funcionar:

- ✅ Projeto Vite + React + Tailwind CSS, com o código dividido em componentes por funcionalidade dentro de `src/`.
- ✅ Base de dados a sério: Supabase (Postgres) com 5 tabelas (`teams`, `players`, `sessions`, `library_items`, `app_settings`), todas com Row Level Security — cada utilizador só vê e edita os seus próprios dados. Esquema em `supabase/schema.sql`.
- ✅ Login por email/palavra-passe (Supabase Auth) — ecrã em `src/components/auth/AuthScreen.jsx`.
- ✅ Publicada na Vercel, ligada ao repositório GitHub (`hjpmartins/agenda-treinador`) — cada push a `main` faz deploy automático.
- ✅ Manifesto PWA (`public/manifest.webmanifest`) e service worker (`public/sw.js`), para "adicionar ao ecrã principal".
- ⏸️ **Sugestões com IA**: a função de servidor (`api/ai-suggest.js`) está pronta e configurada com uma chave da Anthropic, mas essa conta ainda não tem créditos — por isso o botão "Sugerir com IA" dá erro até adicionares saldo em [console.anthropic.com → Plans & Billing](https://console.anthropic.com), ou decidires trocar para uma API gratuita (ex: Google Gemini). O resto da app funciona de forma totalmente independente disto.
- ⏸️ Ícone da PWA ainda é um placeholder genérico (`public/icon.svg`) — substitui por um com o logotipo do clube quando quiseres.

## Correr localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Precisa de um ficheiro `.env.local` (não incluído no repositório) com:

```
VITE_SUPABASE_URL=https://vtugtfhzestrgamgybzm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_RPrjWpALXkmNc1xxdbkhZg_PEQ8DB-B
```

(ver `.env.example` para o modelo completo, incluindo a variável da Anthropic usada só em produção/Vercel).

## Estrutura do projeto

```
src/
  data/        constantes e listas fixas (posições, habilidades, tipos de teste, etc.)
  utils/       funções auxiliares (datas, normalização de dados, ids, etc.)
  print/       geração dos HTML para imprimir/descarregar (fichas, relatórios)
  ai/          chamada à função de servidor de sugestões com IA
  ui/          pequenas constantes de estilo partilhadas
  lib/
    supabaseClient.js   cliente Supabase (usa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
    auth.js             login, registo, logout, sessão
    db.js                camada de acesso às tabelas (mapeia camelCase <-> snake_case)
  components/
    auth/        ecrã de login/registo
    layout/      TopBar, Sidebar
    dashboard/   painel inicial
    players/     plantel, ficha de jogador, evolução
    sessions/    treinos, treinos realizados, importar lista
    jogos/       jogos e ficha de jogo
    diagrams/    editor de diagramas de campo
    ai/          modal de sugestões com IA
    library/     biblioteca de exercícios
    calendar/    calendário anual
    teams/       gestão de equipas, transferências
    common/      Modal, Field, EmptyState, etc.
  App.jsx      componente principal (autenticação, estado, carregar/guardar, navegação)
api/
  ai-suggest.js   função de servidor (Vercel) — proxy seguro para a Anthropic
supabase/
  schema.sql   esquema das tabelas + políticas de Row Level Security
reference/
  agenda_treinador.jsx   ficheiro original do artefacto, mantido só como referência
```

## Publicar alterações

Qualquer alteração que faças (localmente, ou comigo) só chega ao site publicado depois de:

```bash
git add -A
git commit -m "descrição da alteração"
git push
```

A Vercel deteta o push automaticamente e faz um novo deploy em cerca de 1 minuto.

## Por resolver, quando quiseres

1. Créditos na conta Anthropic (ou trocar para uma API de IA gratuita) para a funcionalidade "Sugerir com IA" voltar a funcionar.
2. Ícone PNG próprio para a PWA, com o logotipo do clube.
