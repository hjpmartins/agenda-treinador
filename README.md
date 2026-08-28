# Agenda do Treinador

App de gestão de equipas de basquetebol (jogadores, treinos, jogos, biblioteca de exercícios, diagramas de campo e sugestões de treino com IA).

## Estado atual

Isto é o resultado da **etapa 1** do plano: a app foi transformada de um único ficheiro (`reference/agenda_treinador.jsx`, mantido como referência) num projeto Vite + React normal, com a lógica dividida em componentes por funcionalidade dentro de `src/`.

O que já está feito:

- Projeto Vite + React + Tailwind CSS, pronto a correr localmente.
- Todo o código do artefacto original dividido em `src/data`, `src/utils`, `src/print`, `src/ai`, `src/lib` e `src/components/<funcionalidade>`.
- `window.storage` (exclusivo dos artefactos do Claude.ai) substituído por `src/lib/storage.js` — por agora usa `localStorage` do browser, com a mesma "forma" de API que o Supabase vai ter, para a próxima troca ser pequena.
- A chamada direta `fetch("https://api.anthropic.com/...")` foi substituída por uma função de servidor (`api/ai-suggest.js`, para a Vercel) — o browser já não precisa (nem pode) de saber a tua chave da Anthropic.
- Manifesto PWA básico (`public/manifest.webmanifest`) e um service worker simples (`public/sw.js`), para dar para "adicionar ao ecrã principal".

O que **ainda não está feito** (próximas etapas, como combinámos):

1. Base de dados a sério — trocar `src/lib/storage.js` de localStorage para Supabase (equipas, jogadores, treinos/jogos, biblioteca).
2. Login (Supabase Auth) — cada utilizador só vê os seus próprios dados.
3. Ligar a chave da Anthropic à função `api/ai-suggest.js` (variável de ambiente na Vercel).
4. Publicar na Vercel com um URL final.
5. Ícones PNG próprios para a PWA (o ícone atual é um SVG genérico, placeholder).

## Antes de continuares: instala o Node.js

Este computador **não tem o Node.js instalado**, por isso ainda não consegui correr `npm install` nem testar a app a funcionar de verdade — só criei os ficheiros. É o único bloqueio para veres isto a funcionar no browser.

1. Vai a [nodejs.org](https://nodejs.org) e instala a versão **LTS** (recomendada).
2. Fecha e volta a abrir o terminal depois de instalar.
3. Confirma que ficou instalado:

```bash
node -v
npm -v
```

## Correr localmente

Depois de teres o Node.js instalado, a partir desta pasta:

```bash
npm install
npm run dev
```

Isto abre a app em `http://localhost:5173`. Os teus dados ficam guardados no `localStorage` do browser (por agora — antes da etapa do Supabase).

> Nota: a funcionalidade "Sugerir com IA" só funciona depois do deploy na Vercel (ou a correr `vercel dev` localmente com a variável `ANTHROPIC_API_KEY` definida), porque depende da função de servidor em `api/ai-suggest.js`.

## Estrutura do projeto

```
src/
  data/        constantes e listas fixas (posições, habilidades, tipos de teste, etc.)
  utils/       funções auxiliares (datas, normalização de dados, ids, etc.)
  print/       geração dos HTML para imprimir/descarregar (fichas, relatórios)
  ai/          chamada à função de servidor de sugestões com IA
  ui/          pequenas constantes de estilo partilhadas
  lib/storage.js   camada de armazenamento (localStorage agora, Supabase depois)
  components/
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
  App.jsx      componente principal (estado, carregar/guardar, navegação)
api/
  ai-suggest.js   função de servidor (Vercel) — proxy seguro para a Anthropic
reference/
  agenda_treinador.jsx   ficheiro original do artefacto, mantido só como referência
```

## Próximo passo

Depois de instalares o Node.js e confirmares que `npm run dev` funciona, dizes-me e avançamos para a etapa 2 (Supabase): crio as tabelas e troco `src/lib/storage.js`.
