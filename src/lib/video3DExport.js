import { pickMimeType } from "./mediaRecorderUtil";

// Tamanho fixo do vídeo 3D, independente do que estiver visível no ecrã no
// momento — gravar diretamente do <canvas> ao vivo dava vídeos com má
// qualidade (canvas pequeno num telemóvel em pé) e proporções estranhas
// (bandas pretas), consoante o tamanho que o estúdio calhasse ter aberto.
// 16:9 é a proporção que as apps (incluindo o WhatsApp) tratam melhor.
const EXPORT_WIDTH = 960;
const EXPORT_HEIGHT = 540;

// Grava a sequência de diagramas numa cena 3D própria, criada só para isto —
// escondida fora do ecrã, com tamanho fixo — em vez da cena ao vivo que o
// treinador está a ver (essa fica livre para continuar a ser usada/editada,
// e o vídeo sai sempre com a mesma qualidade e proporção, seja qual for o
// aparelho ou o tamanho da janela).
async function recordDiagramasVideo3D(diagramas, { onProgress, camera } = {}) {
  if (!diagramas || !diagramas.length) {
    throw new Error("Não há diagramas nesta sequência.");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Este navegador não permite gravar vídeo.");
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error("Este navegador não sabe gravar vídeo em nenhum formato conhecido.");
  }
  // Importado aqui dentro (não no topo do ficheiro): o three.js (~140 kB
  // gzip) só pode entrar no bundle principal da app se for importado de
  // forma estática nalgum sítio — com import() aqui dentro, só é pedido
  // quando esta função é mesmo chamada, e partilha o mesmo pedaço (chunk)
  // já carregado pela vista 3D do editor (ver Court3DView.jsx).
  const { Court3DScene } = await import("../components/diagrams/court3d/Court3DScene");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${EXPORT_WIDTH}px`;
  container.style.height = `${EXPORT_HEIGHT}px`;
  document.body.appendChild(container);

  const scene = new Court3DScene(container, { bloom: true, intro: false, preserveDrawingBuffer: true });
  try {
    await scene.ready;
    scene.setSequence(diagramas);
    // Herda o ângulo e a inclinação da câmara que o treinador tinha na vista
    // ao vivo (não a distância/zoom — essa depende da proporção do ecrã
    // onde estava aberta; deixa-se o enquadramento próprio desta cena, já
    // calculado para o tamanho fixo do vídeo, encarregar-se de caber bem o
    // campo, só rodado/inclinado como o treinador o tinha deixado).
    if (camera) {
      scene.cam.az = camera.az;
      scene.cam.polar = camera.polar;
      scene.goal.az = camera.az;
      scene.goal.polar = camera.polar;
    }
    // Dá tempo à câmara para assentar no enquadramento inicial antes de
    // começar a gravar (a transição é suave, não instantânea).
    await new Promise((resolve) => setTimeout(resolve, 700));

    const canvas = scene.renderer.domElement;
    if (!canvas.captureStream) {
      throw new Error("Este navegador não permite gravar vídeo.");
    }

    // Captura automática a fps fixo (igual ao que já se usa para o vídeo 2D,
    // que sempre funcionou) — não a captura manual (fps=0 + requestFrame a
    // cada desenho) que esta função usava antes: funcionava bem a testar
    // aqui, mas continuou a dar ficheiros que o WhatsApp recusava em
    // telemóvel e tablet reais, mesmo depois de corrigido o
    // preserveDrawingBuffer. A captura automática é o caminho muito mais
    // testado/comum para gravar um <canvas>, mais garantias de compatibilidade.
    const FPS = 24;
    const stream = canvas.captureStream(FPS);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    const totalSteps = scene.steps.length;
    let started = false;

    recorder.start();

    await new Promise((resolve) => {
      scene.onStateChange = (state) => {
        if (state.playing) started = true;
        if (onProgress) onProgress(Math.min(1, (state.stepIndex + state.stepProgress) / totalSteps));
        if (started && !state.playing) resolve();
      };
      scene.play();
    });

    recorder.stop();
    await stopped;

    const isMp4 = mimeType.startsWith("video/mp4");
    const baseType = isMp4 ? "video/mp4" : "video/webm";
    return { blob: new Blob(chunks, { type: baseType }), mimeType: baseType, extension: isMp4 ? "mp4" : "webm" };
  } finally {
    scene.dispose();
    container.remove();
  }
}

export { recordDiagramasVideo3D };
