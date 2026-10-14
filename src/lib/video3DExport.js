import { pickMimeType } from "./mediaRecorderUtil";

// Grava a cena 3D tal como está a ser vista (o próprio <canvas> do three.js)
// a reproduzir a sequência completa uma vez, do início ao fim — para um
// vídeo "a sério" em 3D, em vez do campo achatado em 2D (ver
// src/lib/videoExport.js). Usa a cena já montada e visível (`scene`, uma
// instância de Court3DScene — ver Court3DView.jsx/onReady), por isso mostra
// exatamente o que o treinador está a ver, incluindo os passos já editados.
//
// A captura é manual (captureStream(0) + requestFrame a cada frame
// renderizado, via scene.onFrame — ver Court3DScene.js) em vez de pedir um
// fps fixo ao navegador, para não perder frames da animação em aparelhos
// mais lentos.
async function recordScene3D(scene, { onProgress } = {}) {
  if (!scene || !scene.renderer) {
    throw new Error("A vista 3D ainda não está pronta.");
  }
  if (!scene.steps || !scene.steps.length) {
    throw new Error("Não há diagramas nesta sequência.");
  }
  const canvas = scene.renderer.domElement;
  if (!canvas.captureStream) {
    throw new Error("Este navegador não permite gravar vídeo.");
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error("Este navegador não sabe gravar vídeo em nenhum formato conhecido.");
  }

  // Põe a câmara em 3D e no início da jogada antes de começar — se já lá
  // estava, isto não faz nada (setViewMode/goToStep ignoram-no sem alterar
  // o enquadramento atual).
  scene.setViewMode("3d");
  scene.goToStep(0);
  // Dá tempo à câmara para assentar na posição 3D (transição suave, não
  // instantânea) antes de a gravação começar.
  await new Promise((resolve) => setTimeout(resolve, 650));

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  const totalSteps = scene.steps.length;
  const prevOnStateChange = scene.onStateChange;
  let started = false;

  recorder.start();
  scene.onFrame = () => track.requestFrame();
  track.requestFrame();

  await new Promise((resolve) => {
    scene.onStateChange = (state) => {
      prevOnStateChange(state);
      if (state.playing) started = true;
      if (onProgress) onProgress(Math.min(1, (state.stepIndex + state.stepProgress) / totalSteps));
      if (started && !state.playing) resolve();
    };
    scene.play();
  });

  scene.onFrame = null;
  scene.onStateChange = prevOnStateChange;
  recorder.stop();
  await stopped;

  const isMp4 = mimeType.startsWith("video/mp4");
  const baseType = isMp4 ? "video/mp4" : "video/webm";
  return { blob: new Blob(chunks, { type: baseType }), mimeType: baseType, extension: isMp4 ? "mp4" : "webm" };
}

export { recordScene3D };
