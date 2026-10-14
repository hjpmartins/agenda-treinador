// Desenho 2D puro em <canvas> do campo de madeira e do tampo das fichas —
// sem depender de three.js — para poder ser partilhado entre a textura da
// vista 3D (texturas.js) e a exportação de GIF (gifExport.js), e as duas
// aparências ficarem sempre iguais.

const PX = 4; // pixéis de textura por unidade do viewBox do diagrama

// Gerador pseudo-aleatório com semente fixa: a madeira sai sempre igual, em
// vez de mudar de aspeto cada vez que se desenha.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWood(ctx, wPx, hPx, rand) {
  const plankW = 7.5 * PX;
  for (let x0 = 0; x0 < wPx; x0 += plankW) {
    let y = -rand() * 140 * PX;
    while (y < hPx) {
      const len = (55 + rand() * 110) * PX;
      // Ácer envernizado, ligeiramente escurecido para não gritar contra a UI escura.
      const l = 38 + rand() * 9;
      const hue = 29 + rand() * 6;
      ctx.fillStyle = `hsl(${hue} ${42 + rand() * 10}% ${l}%)`;
      ctx.fillRect(x0, y, plankW, len);

      // Veios: linhas finas e onduladas ao longo da tábua.
      const grains = 5 + Math.floor(rand() * 5);
      for (let g = 0; g < grains; g++) {
        const gx = x0 + rand() * plankW;
        const amp = 0.4 + rand() * 1.6;
        const freq = 0.004 + rand() * 0.012;
        const phase = rand() * 10;
        ctx.strokeStyle = `rgba(${70 + rand() * 30}, ${38 + rand() * 15}, 12, ${0.05 + rand() * 0.11})`;
        ctx.lineWidth = 0.6 + rand() * 1.6;
        ctx.beginPath();
        for (let yy = y; yy <= y + len; yy += 6) {
          const xx = Math.min(x0 + plankW - 1, Math.max(x0 + 1, gx + Math.sin(yy * freq + phase) * amp));
          if (yy === y) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      // Variação de tom ao longo da tábua.
      const grad = ctx.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, `rgba(255,220,170,${rand() * 0.06})`);
      grad.addColorStop(1, `rgba(40,20,5,${rand() * 0.08})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y, plankW, len);
      // Junta no topo da tábua.
      ctx.fillStyle = "rgba(30,15,5,0.35)";
      ctx.fillRect(x0, y, plankW, 1);
      y += len;
    }
    // Junta lateral entre colunas de tábuas.
    ctx.fillStyle = "rgba(25,12,4,0.28)";
    ctx.fillRect(x0, 0, 1, hPx);
  }

  // Grão fino (ruído) para a madeira não parecer plástico.
  const img = ctx.getImageData(0, 0, wPx, hPx);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Mesmas medidas que HalfMarkings em CourtPrimitives.jsx (cesto junto à linha
// de fundo em baixo; flipY para a outra metade do campo inteiro).
function drawHalf(ctx, w, h, flipY, paint) {
  ctx.save();
  if (flipY) {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  }
  const cx = w / 2;
  const baseline = h - 10;
  const keyTop = baseline - 120;
  const keyHalf = 50;

  if (paint) {
    ctx.fillStyle = "rgba(24,40,64,0.92)";
    ctx.fillRect(cx - keyHalf, keyTop, keyHalf * 2, 120);
    ctx.fillStyle = "rgba(234,91,19,0.85)";
    ctx.fillRect(cx - keyHalf + 3, keyTop + 3, 3, 117 - 3);
    ctx.fillRect(cx + keyHalf - 6, keyTop + 3, 3, 117 - 3);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.rect(cx - keyHalf, keyTop, keyHalf * 2, 120);
  ctx.moveTo(cx + 36, keyTop);
  ctx.arc(cx, keyTop, 36, 0, Math.PI * 2);
  ctx.moveTo(cx - 130, baseline);
  ctx.quadraticCurveTo(cx - 130, baseline - 155, cx, baseline - 155);
  ctx.moveTo(cx + 130, baseline);
  ctx.quadraticCurveTo(cx + 130, baseline - 155, cx, baseline - 155);
  ctx.stroke();
  ctx.restore();
}

// Desenha o campo (madeira + marcações) num canvas novo de w*px × h*px.
function drawCourtCanvas(court, vb, px = PX) {
  const { w, h } = vb;
  const canvas = document.createElement("canvas");
  canvas.width = w * px;
  canvas.height = h * px;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(court === "campo" ? 1977 : 2024);

  drawWood(ctx, canvas.width, canvas.height, rand);

  ctx.scale(px, px);
  const full = court === "campo";

  // Zona fora das linhas (avental) em madeira tingida escura.
  ctx.fillStyle = "rgba(16,19,25,0.72)";
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.rect(10, 10, w - 20, h - 20);
  ctx.fill("evenodd");

  drawHalf(ctx, w, h, false, true);
  if (full) {
    drawHalf(ctx, w, h, true, true);
    ctx.fillStyle = "rgba(234,91,19,0.82)";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(234,91,19,0.82)";
    ctx.beginPath();
    ctx.arc(w / 2, 10, 30, 0, Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(242,237,227,0.94)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeRect(10, 10, w - 20, h - 20);
  drawHalf(ctx, w, h, false, false);
  if (full) {
    drawHalf(ctx, w, h, true, false);
    ctx.beginPath();
    ctx.moveTo(10, h / 2);
    ctx.lineTo(w - 10, h / 2);
    ctx.moveTo(w / 2 + 30, h / 2);
    ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(w / 2, 10, 30, 0, Math.PI);
    ctx.stroke();
  }

  return canvas;
}

// Tampo circular de uma ficha (jogadora ou treinador), num canvas quadrado novo.
function drawTokenTopCanvas(type, number, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const r = size / 2;
  const isDef = type === "defense";

  if (type === "treinador") {
    ctx.fillStyle = "#F2EDE3";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#14181F";
    ctx.font = "600 150px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T", r, r + 8);
  } else if (isDef) {
    ctx.fillStyle = "#1A1F28";
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#D64545";
    ctx.lineWidth = 22;
    ctx.setLineDash([34, 20]);
    ctx.beginPath();
    ctx.arc(r, r, r - 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const g = ctx.createRadialGradient(r * 0.75, r * 0.7, 10, r, r, r);
    g.addColorStop(0, "#FF7A33");
    g.addColorStop(1, "#E0560F");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,24,31,0.55)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(r, r, r - 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (type !== "treinador" && number != null && number !== "") {
    const label = String(number);
    ctx.fillStyle = isDef ? "#D64545" : "#14181F";
    const fs = label.length > 2 ? 86 : label.length > 1 ? 110 : 130;
    ctx.font = `600 ${fs}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r, r + 6);
  }

  return c;
}

export { PX, seededRandom, drawCourtCanvas, drawTokenTopCanvas };
