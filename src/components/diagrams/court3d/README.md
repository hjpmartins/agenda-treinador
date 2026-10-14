# Vista 3D de jogadas (protótipo)

Vista de uma jogada num campo de madeira, com dois modos: **2D** (vista de cima)
e **3D** (perspetiva, câmara orbital, reprodução animada passo a passo). Com
`editable`, a própria vista é o editor, tanto em 2D como em 3D: as jogadas
desenham-se diretamente no campo de madeira, sem o editor de fundo preto.
Em 3D, arrastar uma ficha (ou desenhar uma seta) edita; arrastar o chão vazio
em "Mover" roda a câmara; botão direito / dois dedos rodam e deslocam sempre.

Protótipo isolado (sem login): `npm run dev` e abrir
`http://localhost:5173/prototype-3d.html`. Também é incluído no build, por isso
fica disponível em `/prototype-3d.html` em qualquer deploy.

## Ficheiros

| Ficheiro | O que faz |
| --- | --- |
| `Court3DScene.js` | Motor three.js sem React: cena, luzes, cestos, fichas, bola, câmara, input (rato/toque) e reprodução. |
| `Court3DView.jsx` | Invólucro React com os controlos (2D/3D, rodar, zoom, enquadrar, rotação automática, ecrã inteiro, reproduzir/passos, velocidade, inclinação). |
| `textures.js` | Texturas procedimentais em canvas: madeira + marcações (mesma geometria de `CourtPrimitives.jsx`), tampos das fichas, bola. |
| `arrows3d.js` | Setas como fitas no soalho, com shader próprio (tracejado, revelação progressiva, halo). |
| `usePlayEditor.js` | Lógica de edição (mesmas regras do `DiagramEditor`: arrastar fichas, setas com `tokenId`, toque-toque, curvar pela pega, desfazer/refazer) aplicada à sequência inteira de passos. Os toques chegam da cena já em coordenadas do diagrama (raycast ao soalho). |
| `EditToolbar.jsx` | Barra de edição (ação, adicionar fichas, passos, campo). |
| `playAnimation.js` | Amostra um passo no instante t. As posições x/y vêm de `computeAnimatedPositions` (mesmas regras do leitor 2D); aqui só se acrescenta a altura da bola (passe em arco, drible a saltar, lançamento ao cesto). |

Não há imagens nem modelos para carregar — tudo é gerado em código. A única
dependência nova é `three`.

## Usar no projeto principal

```jsx
import { lazy, Suspense } from "react";
// lazy: o three.js (~140 kB gzip) só é descarregado quando se abre a vista 3D.
const Court3DView = lazy(() => import("../diagrams/court3d/Court3DView").then((m) => ({ default: m.Court3DView })));

<Suspense fallback={null}>
  <Court3DView diagramas={exercicio.diagramas} title={exercicio.nome} className="w-full h-[70vh]" />
</Suspense>
```

Para editar: `<Court3DView key={jogada.id} editable initialView="2d" diagramas={jogada.diagramas} onChange={(d) => guardar(d)} />`
(com `editable`, `diagramas` só é lido na montagem — muda a `key` para trocar de jogada).

Props: `diagramas` (array de passos ou um diagrama), `title`, `autoPlay`, `editable`, `onChange`, `initialView`,
`bloom` (desligar em aparelhos fracos), `onReady(scene)` (acesso ao motor para
controlo externo), `className`/`style` (tamanho do contentor).

Um sítio natural para o botão "Ver em 3D" é o `SequencePlayerModal` em
`../SequencePlayer.jsx`, que já recebe os mesmos `diagramas`.

## Campos novos (opcionais) nas setas

- `waypoints: [{x,y},{x,y}]` — as 2 pegas da curva em S (bloqueio, corte, drible, lançamento).
- `targetId` — num passe, a jogadora que recebe. O fim do passe acompanha
  sempre o sítio para onde ela se desloca nesse passo (`syncPasses` em
  `usePlayEditor.js`).

Ambos são ignorados por código antigo; as jogadas antigas continuam iguais.

## Controlos

- Arrastar: rodar (horizontal) e inclinar (vertical) · roda do rato / pinça: zoom
- Botão direito ou Shift + arrastar, ou dois dedos: deslocar
- Teclado (com a vista focada): espaço reproduz/pausa, ← → passos, Q/E rodam 45°, F enquadra

## Notas de desenho

- 1 unidade do diagrama = 5 cm (campo de 15 m = 300 unidades); aro a 61 unidades (3,05 m).
- As fichas rodam com a câmara para os números ficarem sempre direitos.
- Modo 2D = câmara de cima com FOV de 10° (quase ortográfica); a troca 2D↔3D
  anima ângulo e FOV ao mesmo tempo (efeito "dolly zoom").
- O enquadramento automático calcula a distância a que o campo e os cestos cabem
  no ecrã (`_fitGoal`), por isso funciona em qualquer proporção de ecrã.
