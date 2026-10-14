// Escolha do formato de gravação — partilhado entre a exportação de vídeo
// 2D (canvas normal) e 3D (captura da própria cena three.js).
function pickMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  // mp4/h264 primeiro: é o que o Safari/iOS grava nativamente, e o mais
  // compatível ao partilhar para fora da app. Pede-se sempre com o codec
  // explícito (avc1/h264) — "video/mp4" sozinho já se viu alguns navegadores
  // dizerem que sim e depois gravarem VP9 lá dentro (ficheiro inválido,
  // rotulado mp4 mas ilegível como tal). Nos navegadores que só sabem
  // gravar webm (a generalidade do Android), cai-se para esse.
  const candidates = [
    'video/mp4;codecs="avc1.42E01E"',
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { pickMimeType, sleep };
