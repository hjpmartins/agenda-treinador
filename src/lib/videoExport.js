import { HALF_VB, FULL_VB } from "../data";
import { computeAnimatedPositions } from "../utils";
import { STEP_MS, PAUSE_MS, createFrameCaches, drawDiagramFrame } from "./diagramFrameRenderer";
import { pickMimeType, sleep } from "./mediaRecorderUtil";

// Grava a sequência completa de diagramas como um vídeo curto (mp4 ou webm,
// consoante o que o navegador souber gravar) — o mesmo campo de madeira e as
// mesmas fichas do GIF, mas em formato de vídeo, porque o WhatsApp (e a
// generalidade das apps) mostra sempre pré-visualização e repete em loop um
// vídeo partilhado, ao contrário de uma GIF partilhada de fora da sua
// própria caixa de GIFs, que muitas vezes chega só como uma imagem parada.
//
// Ao contrário da GIF (gerada instantaneamente, frame a frame), isto grava
// em tempo real — demora o tempo real da jogada a animar.
async function generateSequenceVideo(diagramas, { width: rawWidth = 480, fps = 24, onProgress } = {}) {
  if (!diagramas || diagramas.length === 0) {
    throw new Error("Não há diagramas nesta sequência.");
  }
  if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Este navegador não permite gravar vídeo.");
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error("Este navegador não sabe gravar vídeo em nenhum formato conhecido.");
  }

  const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;
  const vb0 = diagramas[0].court === "campo" ? FULL_VB : HALF_VB;
  const rawHeight = Math.round(width * (vb0.h / vb0.w));
  const height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const caches = createFrameCaches();

  // Primeiro frame antes de começar a gravar, para o vídeo não abrir com um
  // instante em branco.
  drawDiagramFrame(ctx, diagramas[0], null, width, height, caches);

  // Captura manual (0 fps = só captura quando se pede, via requestFrame): em
  // vez de confiar no relógio interno do navegador para amostrar o canvas
  // (que em alguns aparelhos/condições de carga pode perder frames), pede-se
  // explicitamente um frame a cada desenho — garante que a animação fica
  // fluida independentemente da velocidade do aparelho.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();
  track.requestFrame();

  // Soma aproximada da duração total, só para a barra de progresso.
  const totalMs = diagramas.reduce((acc, d) => {
    const hasMovement = (d.arrows || []).some((a) => a.tokenId && a.to);
    return acc + (hasMovement ? STEP_MS : 0) + PAUSE_MS;
  }, 0);
  let elapsedMs = 0;

  for (let i = 0; i < diagramas.length; i++) {
    const diagram = diagramas[i];
    const hasMovement = (diagram.arrows || []).some((a) => a.tokenId && a.to);
    if (hasMovement) {
      await new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / STEP_MS);
          drawDiagramFrame(ctx, diagram, computeAnimatedPositions(diagram, t), width, height, caches);
          track.requestFrame();
          if (onProgress) onProgress(Math.min(1, (elapsedMs + (now - start)) / totalMs));
          if (t < 1) requestAnimationFrame(tick);
          else {
            elapsedMs += STEP_MS;
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    } else {
      drawDiagramFrame(ctx, diagram, null, width, height, caches);
      track.requestFrame();
    }
    await sleep(PAUSE_MS);
    elapsedMs += PAUSE_MS;
    if (onProgress) onProgress(Math.min(1, elapsedMs / totalMs));
  }

  recorder.stop();
  await stopped;
  // Tipo "nu" (sem parâmetros de codec) para o blob partilhado — é o que uma
  // folha de partilha do sistema espera, o mimeType completo com codec é só
  // para o MediaRecorder.
  const isMp4 = mimeType.startsWith("video/mp4");
  const baseType = isMp4 ? "video/mp4" : "video/webm";
  return { blob: new Blob(chunks, { type: baseType }), mimeType: baseType, extension: isMp4 ? "mp4" : "webm" };
}

export { generateSequenceVideo };
