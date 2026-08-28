import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { HALF_VB, FULL_VB } from "../data";
import { computeAnimatedPositions } from "../utils";
import { diagramToSvgString } from "../print";

function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível desenhar um dos passos do diagrama."));
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
  });
}

const STEP_FRAMES = 16; // frames por transição de movimento dentro de um passo
const STEP_MS = 1400; // duração da transição, igual à animação do editor
const PAUSE_MS = 550; // pausa no fim de cada passo, antes de avançar para o seguinte

// Gera um GIF animado com a sequência completa de diagramas (do início ao fim),
// reproduzindo o movimento de cada passo tal como o "Ver sequência" já faz no
// editor. Devolve uma Promise que resolve com o Blob do ficheiro .gif.
async function generateSequenceGif(diagramas, { width = 320, onProgress } = {}) {
  if (!diagramas || diagramas.length === 0) {
    throw new Error("Não há diagramas nesta sequência.");
  }

  const vb0 = diagramas[0].court === "campo" ? FULL_VB : HALF_VB;
  const height = Math.round(width * (vb0.h / vb0.w));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const gif = GIFEncoder();

  const addFrame = async (diagram, overrides, delay) => {
    const svgStr = diagramToSvgString(diagram, width, overrides);
    const img = await svgToImage(svgStr);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  };

  const total = diagramas.length;
  for (let i = 0; i < total; i++) {
    const diagram = diagramas[i];
    const hasMovement = (diagram.arrows || []).some((a) => a.tokenId && a.to);
    if (hasMovement) {
      for (let f = 0; f <= STEP_FRAMES; f++) {
        const t = f / STEP_FRAMES;
        const overrides = computeAnimatedPositions(diagram, t);
        const isLastFrame = f === STEP_FRAMES;
        await addFrame(diagram, overrides, isLastFrame ? PAUSE_MS : Math.round(STEP_MS / STEP_FRAMES));
      }
    } else {
      await addFrame(diagram, null, PAUSE_MS);
    }
    if (onProgress) onProgress((i + 1) / total);
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

export { generateSequenceGif };
