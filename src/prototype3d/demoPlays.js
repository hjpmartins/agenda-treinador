// Jogadas de demonstração para o protótipo da vista 3D, no mesmo formato que o
// editor 2D grava (court/tokens/arrows, um diagrama por passo). Os passos
// seguintes partem das posições finais do anterior, como faz o "+" do editor.

import { resolveFinalDiagram } from "../utils";

const off = (id, number, x, y) => ({ id, type: "offense", number, x, y });
const def = (id, number, x, y) => ({ id, type: "defense", number, x, y });
const ball = (x, y) => ({ id: "b", type: "ball", x, y });
const arrow = (id, type, tokenId, from, to, control) => ({ id, type, tokenId, from, to, ...(control ? { control } : {}) });

// Encadeia passos: cada passo recebe os tokens finais do anterior e só define as setas.
function chain(court, tokens, stepsArrows) {
  const out = [];
  let current = { court, tokens, arrows: [] };
  stepsArrows.forEach((makeArrows) => {
    const pos = Object.fromEntries(current.tokens.map((t) => [t.id, { x: t.x, y: t.y }]));
    const diagram = { court, tokens: current.tokens.map((t) => ({ ...t })), arrows: makeArrows(pos) };
    out.push(diagram);
    current = resolveFinalDiagram(diagram);
  });
  return out;
}

// Pick-and-roll central com passe para o poste a rolar e lançamento.
const pickAndRoll = chain(
  "meio",
  [
    off("o1", 1, 150, 95),
    ball(160, 101),
    off("o2", 2, 255, 215),
    off("o3", 3, 45, 215),
    off("o4", 4, 85, 285),
    off("o5", 5, 200, 170),
    def("d1", 1, 150, 122),
    def("d2", 2, 238, 232),
    def("d3", 3, 62, 232),
    def("d4", 4, 102, 270),
    def("d5", 5, 190, 192),
    { id: "c", type: "treinador", x: 278, y: 40 },
  ],
  [
    // 1. O 5 sobe para bloquear o defensor do base.
    (p) => [arrow("a1", "bloqueio", "o5", p.o5, { x: 168, y: 122 })],
    // 2. O base sai em drible pelo bloqueio; o 5 rola para o cesto; o 4 sobe.
    (p) => [
      arrow("a2", "drible", "o1", p.o1, { x: 222, y: 175 }, { x: 214, y: 100 }),
      arrow("a3", "corte", "o5", p.o5, { x: 165, y: 255 }, { x: 196, y: 196 }),
      arrow("a4", "corte", "o4", p.o4, { x: 70, y: 150 }, { x: 60, y: 220 }),
      arrow("a5", "corte", "d1", p.d1, { x: 205, y: 160 }, { x: 188, y: 120 }),
      arrow("a6", "corte", "d5", p.d5, { x: 196, y: 170 }),
    ],
    // 3. Passe picado para o 5 a rolar; o 2 abre para o canto.
    (p) => [
      arrow("a7", "passe", "b", p.b, { x: 168, y: 250 }),
      arrow("a8", "corte", "o2", p.o2, { x: 268, y: 300 }, { x: 278, y: 250 }),
      arrow("a9", "corte", "d5", p.d5, { x: 178, y: 228 }),
    ],
    // 4. Lançamento.
    (p) => [arrow("a10", "lancamento", "b", p.b, { x: 150, y: 288 })],
  ]
);

// Contra-ataque a campo inteiro: ressalto, passe de saída, drible, passe e bandeja.
const fastBreak = chain(
  "campo",
  [
    off("o5", 5, 150, 492),
    ball(160, 486),
    off("o1", 1, 70, 440),
    off("o2", 2, 232, 470),
    off("o3", 3, 100, 480),
    off("o4", 4, 190, 505),
    def("d1", 1, 150, 330),
    def("d2", 2, 210, 380),
    { id: "k1", type: "cone", x: 40, y: 280 },
    { id: "k2", type: "cone", x: 260, y: 280 },
  ],
  [
    (p) => [
      arrow("f1", "passe", "b", p.b, { x: 78, y: 436 }),
      arrow("f2", "corte", "o2", p.o2, { x: 262, y: 300 }, { x: 262, y: 400 }),
      arrow("f3", "corte", "o3", p.o3, { x: 38, y: 320 }, { x: 40, y: 430 }),
    ],
    (p) => [
      arrow("f4", "drible", "o1", p.o1, { x: 150, y: 235 }, { x: 140, y: 380 }),
      arrow("f5", "corte", "o2", p.o2, { x: 252, y: 115 }, { x: 268, y: 200 }),
      arrow("f6", "corte", "o3", p.o3, { x: 48, y: 115 }, { x: 32, y: 200 }),
      arrow("f7", "corte", "o5", p.o5, { x: 150, y: 330 }),
      arrow("f8", "corte", "d1", p.d1, { x: 150, y: 130 }, { x: 160, y: 220 }),
      arrow("f9", "corte", "d2", p.d2, { x: 200, y: 160 }, { x: 225, y: 260 }),
    ],
    (p) => [
      arrow("f10", "passe", "b", p.b, { x: 244, y: 118 }),
      arrow("f11", "corte", "o3", p.o3, { x: 110, y: 70 }, { x: 70, y: 70 }),
      arrow("f12", "corte", "d2", p.d2, { x: 222, y: 112 }),
    ],
    (p) => [
      arrow("f13", "drible", "o2", p.o2, { x: 178, y: 52 }, { x: 236, y: 52 }),
      arrow("f14", "corte", "d1", p.d1, { x: 158, y: 80 }),
    ],
    (p) => [arrow("f15", "lancamento", "b", p.b, { x: 150, y: 32 })],
  ]
);

// Hand-off na lateral seguido de entrada (mostra o hand-off a passar a bola).
const handoff = chain(
  "meio",
  [
    off("o4", 4, 80, 140),
    ball(90, 146),
    off("o2", 2, 40, 250),
    off("o1", 1, 220, 120),
    def("d4", 4, 95, 160),
    def("d2", 2, 58, 240),
    { id: "k1", type: "cone", x: 150, y: 200 },
  ],
  [
    (p) => [
      arrow("h1", "drible", "o4", p.o4, { x: 62, y: 178 }, { x: 60, y: 150 }),
      arrow("h2", "corte", "o2", p.o2, { x: 50, y: 190 }, { x: 30, y: 215 }),
    ],
    (p) => [arrow("h3", "handoff", "o4", p.o4, { x: 62, y: 176 })],
    (p) => [
      arrow("h4", "drible", "o2", p.o2, { x: 130, y: 268 }, { x: 80, y: 260 }),
      arrow("h5", "corte", "o4", p.o4, { x: 95, y: 110 }),
      arrow("h6", "corte", "d2", p.d2, { x: 104, y: 262 }),
    ],
    (p) => [arrow("h7", "lancamento", "b", p.b, { x: 150, y: 288 })],
  ]
);

const DEMO_PLAYS = [
  { id: "pnr", nome: "Pick-and-roll central", diagramas: pickAndRoll },
  { id: "fb", nome: "Contra-ataque 3x2", diagramas: fastBreak },
  { id: "ho", nome: "Hand-off lateral", diagramas: handoff },
];

export { DEMO_PLAYS };
