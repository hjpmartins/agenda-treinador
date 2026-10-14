// Texturas para a vista 3D: madeira do campo (mesma geometria do campo 2D em
// CourtPrimitives.jsx), tampos das fichas das jogadoras e a bola. O desenho
// 2D puro (sem three.js) vive em courtCanvas.js, partilhado com a exportação
// de GIF — aqui só se envolve esse canvas numa THREE.CanvasTexture.

import * as THREE from "three";
import { seededRandom, drawCourtCanvas, drawTokenTopCanvas } from "./courtCanvas";

function createCourtTexture(court, vb, maxAnisotropy = 8) {
  const canvas = drawCourtCanvas(court, vb);

  // Assinatura discreta no avental, junto à linha lateral (só faz sentido na
  // textura 3D, em escala suficiente para se ler — fica de fora do canvas
  // partilhado com o GIF, que é pequeno demais para a mostrar).
  const ctx = canvas.getContext("2d");
  const { w, h } = vb;
  ctx.save();
  ctx.fillStyle = "rgba(242,237,227,0.22)";
  ctx.font = "600 6px Oswald, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(5, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("AGENDA DO TREINADOR", 0, 0.5);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Tampo circular das fichas. As UV da tampa de um CylinderGeometry mapeiam o
// disco ao quadrado inteiro da textura, por isso desenhamos um círculo centrado.
function createTokenTopTexture(type, number) {
  const canvas = drawTokenTopCanvas(type, number);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Textura equiretangular de uma bola de basquetebol (pele com picotado e costuras).
function createBallTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#E2581A";
  ctx.fillRect(0, 0, w, h);
  const rand = seededRandom(7);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,150,90,0.18)" : "rgba(90,30,5,0.18)";
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
  }
  ctx.strokeStyle = "#1A1410";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  for (const u of [0, 0.5]) {
    ctx.moveTo(u * w + 1, 0);
    ctx.lineTo(u * w + 1, h);
  }
  ctx.stroke();
  // Duas costuras curvas, aproximadas por sinusoides.
  for (const sign of [1, -1]) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = h / 2 + sign * h * 0.3 * Math.cos((x / w) * Math.PI * 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Espera (com limite) que as fontes da app estejam prontas, para os números
// nas fichas não saírem numa fonte de recurso.
async function ensureFonts(timeoutMs = 1500) {
  if (!document.fonts || !document.fonts.load) return;
  const loads = Promise.all([
    document.fonts.load("600 64px 'IBM Plex Mono'"),
    document.fonts.load("600 32px Oswald"),
  ]).catch(() => {});
  await Promise.race([loads, new Promise((r) => setTimeout(r, timeoutMs))]);
}

export { createCourtTexture, createTokenTopTexture, createBallTexture, ensureFonts };
