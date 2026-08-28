import { FULL_VB, HALF_VB, ESTATISTICAS_CAMPOS, estatisticaNumero, somaEstatistica, getTipoTeste, habilidadeGroups } from "../data";
import { escapeHtml, formatDateFull, formatDateShortYear, wavyCurvedPathD, defaultControlPoint, arrowHead, calcPresenca, playerChartData } from "../utils";

function svgHalfMarkingsStr(flipY, w, h) {
  const cx = w / 2;
  const baseline = h - 10;
  const keyTop = baseline - 120;
  const keyHalf = 50;
  const inner = `
    <rect x="${cx - keyHalf}" y="${keyTop}" width="${keyHalf * 2}" height="120" fill="#eee" stroke="#999" stroke-width="1"/>
    <circle cx="${cx}" cy="${keyTop}" r="36" fill="none" stroke="#999" stroke-width="1.5"/>
    <path d="M ${cx - 130} ${baseline} Q ${cx - 130} ${baseline - 155} ${cx} ${baseline - 155}" fill="none" stroke="#999" stroke-width="1.5"/>
    <path d="M ${cx + 130} ${baseline} Q ${cx + 130} ${baseline - 155} ${cx} ${baseline - 155}" fill="none" stroke="#999" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${baseline - 22}" r="3" fill="#999"/>
    <line x1="${cx - 20}" y1="${baseline - 4}" x2="${cx + 20}" y2="${baseline - 4}" stroke="#999" stroke-width="3"/>`;
  return flipY ? `<g transform="translate(0 ${h}) scale(1 -1)">${inner}</g>` : inner;
}

function svgCourtBackgroundStr(court, vb) {
  let bg = `<rect x="0" y="0" width="${vb.w}" height="${vb.h}" fill="#fff"/><rect x="10" y="10" width="${vb.w - 20}" height="${vb.h - 20}" fill="none" stroke="#999" stroke-width="1.5"/>`;
  if (court === "campo") {
    bg += svgHalfMarkingsStr(false, vb.w, vb.h) + svgHalfMarkingsStr(true, vb.w, vb.h);
    bg += `<line x1="10" y1="${vb.h / 2}" x2="${vb.w - 10}" y2="${vb.h / 2}" stroke="#999" stroke-width="1.5"/><circle cx="${vb.w / 2}" cy="${vb.h / 2}" r="30" fill="none" stroke="#999" stroke-width="1.5"/>`;
  } else {
    bg += svgHalfMarkingsStr(false, vb.w, vb.h);
    bg += `<line x1="10" y1="10" x2="${vb.w - 10}" y2="10" stroke="#999" stroke-width="1.5"/>`;
  }
  return bg;
}

function svgTokenStr(token) {
  const { x, y, type, number } = token;
  if (type === "ball") {
    return `<g transform="translate(${x} ${y})"><circle r="7" fill="#EA5B13"/><path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#14181F" stroke-width="1"/></g>`;
  }
  if (type === "cone") {
    return `<g transform="translate(${x} ${y})"><path d="M 0 -9 L 8 8 L -8 8 Z" fill="#E0A800" stroke="#14181F" stroke-width="1" stroke-linejoin="round"/></g>`;
  }
  if (type === "treinador") {
    return `<g transform="translate(${x} ${y})"><rect x="-10" y="-10" width="20" height="20" rx="3" fill="#fff" stroke="#14181F" stroke-width="1.5"/><text text-anchor="middle" dy="4" font-size="11" fill="#14181F" font-family="Arial" font-weight="700">T</text></g>`;
  }
  const isDef = type === "defense";
  return `<g transform="translate(${x} ${y})">
    <circle r="12" fill="${isDef ? "transparent" : "#EA5B13"}" stroke="${isDef ? "#D64545" : "#14181F"}" stroke-width="${isDef ? 2.5 : 1.5}" ${isDef ? 'stroke-dasharray="3 2"' : ""}/>
    <text text-anchor="middle" dy="4" font-size="11" fill="${isDef ? "#D64545" : "#14181F"}" font-family="Arial" font-weight="600">${escapeHtml(number)}</text>
  </g>`;
}

function svgArrowStr(arrow) {
  const color = "#555";
  if (arrow.type === "bloqueio") {
    // Compatibilidade com bloqueios antigos (ponto único, sempre na horizontal).
    if (arrow.at) {
      const { x, y } = arrow.at;
      return `<g transform="translate(${x} ${y})"><line x1="-9" y1="0" x2="9" y2="0" stroke="${color}" stroke-width="4"/></g>`;
    }
    const { from, to } = arrow;
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const { from, to } = arrow;
  const isShot = arrow.type === "lancamento";
  const isDrible = arrow.type === "drible";
  const control = arrow.control || defaultControlPoint(arrow.type, from, to);
  const d = isDrible ? wavyCurvedPathD(from, control, to) : `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  const dash = arrow.type === "passe" || isShot ? 'stroke-dasharray="6 4"' : "";
  const tipFrom = control;
  const tip = isShot
    ? `<circle cx="${to.x}" cy="${to.y}" r="6" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${to.x}" cy="${to.y}" r="2" fill="${color}"/>`
    : `<path d="${arrowHead(tipFrom.x, tipFrom.y, to.x, to.y)}" stroke="${color}" stroke-width="2" fill="none"/>`;
  return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" ${dash}/>${tip}`;
}

// "positionOverrides" (opcional, mapa id → {x,y}) permite desenhar os tokens numa
// posição intermédia da animação, em vez da posição base do diagrama — usado para
// gerar os frames do GIF da sequência (ver src/lib/gifExport.js).
function diagramToSvgString(diagram, width = 150, positionOverrides = null) {
  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const height = Math.round(width * (vb.h / vb.w));
  const tokens = positionOverrides ? diagram.tokens.map((t) => positionOverrides[t.id] || t) : diagram.tokens;
  const inner = svgCourtBackgroundStr(diagram.court, vb) + diagram.arrows.map(svgArrowStr).join("") + tokens.map(svgTokenStr).join("");
  return `<svg viewBox="0 0 ${vb.w} ${vb.h}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #ddd;border-radius:4px;">${inner}</svg>`;
}

function buildSessionPrintContent(session, players, clubLogo) {
  const isGame = session.type === "jogo";
  const exercicios = session.exercicios || [];
  const totalMin = exercicios.reduce((sum, e) => sum + (Number(e.duracao) || 0), 0);
  const presencas = session.presencas || {};
  const presentesRows = (players || [])
    .map((p) => {
      const st = presencas[p.id];
      const label = st === "P" ? "Presente" : st === "F" ? "Falta" : "—";
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td><td>${label}</td></tr>`;
    })
    .join("");

  const exerciciosHtml = exercicios
    .map(
      (e, i) => `
      <tr>
        <td style="text-align:center;font-weight:600;">${i + 1}</td>
        <td style="text-align:center;">${escapeHtml(e.duracao || "-")}'</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(e.nome || "Exercício")}</div>
          ${e.descricao ? `<div style="white-space:pre-wrap;color:#444;margin-top:2px;">${escapeHtml(e.descricao)}</div>` : ""}
          ${e.diagramas && e.diagramas.length > 0 ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            ${e.diagramas.map((d, idx) => `
              <div style="text-align:center;">
                ${diagramToSvgString(d, 150)}
                <div style="font-size:10px;color:#999;margin-top:2px;">Passo ${idx + 1}</div>
              </div>`).join("")}
          </div>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const title = escapeHtml(session.title || (isGame ? `vs ${session.adversario || "?"}` : "Treino"));

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; margin-bottom: 20px; padding: 12px 16px; background: #f4f4f5; border-radius: 6px; }
  .meta div b { display: block; font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; }
  .presencas-grid { columns: 2; column-gap: 24px; }
  .presencas-grid table { break-inside: avoid; }
  footer { margin-top: 30px; font-size: 11px; color: #999; text-align: center; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin-bottom:10px;display:block;" />` : ""}
  <h1>${title}</h1>
  <div class="sub">${isGame ? "Jogo" : "Treino"} · ${formatDateFull(session.date)}</div>
  <div class="meta">
    ${isGame
      ? `<div><b>Adversário</b>${escapeHtml(session.adversario || "—")}</div><div><b>Resultado</b>${escapeHtml(session.resultado || "—")}</div>`
      : `<div><b>Objetivo</b>${escapeHtml(session.objetivo || "—")}</div><div><b>Duração total</b>${totalMin} min</div><div><b>Nº exercícios</b>${exercicios.length}</div>`
    }
  </div>

  ${!isGame && exercicios.length > 0 ? `
  <h2>Exercícios</h2>
  <table>
    <thead><tr><th style="width:30px;">#</th><th style="width:60px;">Tempo</th><th>Descrição</th></tr></thead>
    <tbody>${exerciciosHtml}</tbody>
  </table>` : ""}

  ${(isGame ? session.conteudo : session.observacoes) ? `
  <h2>${isGame ? "Relatório do jogo" : "Observações"}</h2>
  <div class="obs">${escapeHtml(isGame ? session.conteudo : session.observacoes)}</div>` : ""}

  ${!isGame && players && players.length > 0 ? `
  <h2>Presenças</h2>
  <div class="presencas-grid">
    <table>
      <thead><tr><th style="width:30px;">Nº</th><th>Nome</th><th style="width:70px;">Estado</th></tr></thead>
      <tbody>${presentesRows}</tbody>
    </table>
  </div>` : ""}

  <footer>Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printSession(session, players, clubLogo) {
  const html = buildSessionPrintContent(session, players, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const isGame = session.type === "jogo";
  const namePart = (session.title || (isGame ? `vs-${session.adversario || "adversario"}` : "treino")).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.date || "treino"}-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildJogoPrintContent(jogo, players, clubLogo) {
  const convocatoria = jogo.convocatoria || {};
  const convocatoriaRows = (players || [])
    .map((p) => {
      const marks = convocatoria[p.id] || [false, false, false, false];
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td>${marks.map((m) => `<td style="text-align:center;">${m ? "X" : ""}</td>`).join("")}</tr>`;
    })
    .join("");

  const objetivosHtml = (jogo.objetivosJogo || [])
    .filter((o) => o.texto)
    .map((o, i) => `<tr><td style="width:24px;font-weight:600;">${i + 1}</td><td>${escapeHtml(o.texto)}</td></tr>`)
    .join("");

  const estatisticas = jogo.estatisticas || {};
  const estatisticasRows = (players || [])
    .filter((p) => estatisticas[p.id] && ESTATISTICAS_CAMPOS.some((c) => estatisticaNumero(c, estatisticas[p.id]) > 0))
    .map((p) => {
      const stats = estatisticas[p.id] || {};
      return `<tr><td>${escapeHtml(p.numero || "")}</td><td>${escapeHtml(p.nome)}</td>${ESTATISTICAS_CAMPOS.map((c) => `<td style="text-align:center;">${escapeHtml(somaEstatistica(c, [stats]))}</td>`).join("")}</tr>`;
    })
    .join("");
  const totaisEstatisticas = ESTATISTICAS_CAMPOS.map((c) => {
    const total = somaEstatistica(c, (players || []).map((p) => estatisticas[p.id] || {}));
    return `<td style="text-align:center;font-weight:700;">${total}</td>`;
  }).join("");

  const infoRows = `
    <tr><td><b>Campeonato</b></td><td>${escapeHtml(jogo.campeonato || "—")}</td></tr>
    <tr><td><b>Adversário</b></td><td>${escapeHtml(jogo.adversario || "—")}</td></tr>
    <tr><td><b>Data │ Horário</b></td><td>${formatDateFull(jogo.date)} │ ${escapeHtml(jogo.horario || "—")}</td><td><b>Jogo nº</b></td><td>${escapeHtml(jogo.jogoNumero || "—")}</td></tr>
    <tr><td><b>Local</b></td><td colspan="3">${escapeHtml(jogo.local || "—")}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Jogo vs ${escapeHtml(jogo.adversario || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  table.info td { border: 1px solid #ccc; padding: 6px 8px; }
  table.list th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.list td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; margin-bottom: 10px; }
  .obs-title { font-size: 11px; font-weight: 600; color: #555; margin-bottom: 4px; text-transform: uppercase; }
  .resultado { font-size: 16px; font-weight: 700; text-align: center; padding: 10px; background: #f4f4f5; border-radius: 6px; margin-bottom: 10px; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin:0 auto 10px auto;display:block;" />` : ""}
  <h1>vs ${escapeHtml(jogo.adversario || "?")}</h1>
  <table class="info">${infoRows}</table>

  ${(jogo.treinadorPrincipal || jogo.treinadorAdjunto || (jogo.dirigentes && jogo.dirigentes.length > 0)) ? `
  <h2>Equipa técnica</h2>
  <table class="info">
    <tr><td><b>Treinador principal</b></td><td>${escapeHtml(jogo.treinadorPrincipal || "—")}</td><td><b>Nº licença</b></td><td>${escapeHtml(jogo.treinadorPrincipalLicenca || "—")}</td></tr>
    <tr><td><b>Treinador adjunto</b></td><td>${escapeHtml(jogo.treinadorAdjunto || "—")}</td><td><b>Nº licença</b></td><td>${escapeHtml(jogo.treinadorAdjuntoLicenca || "—")}</td></tr>
    ${(jogo.dirigentes || []).filter((d) => d.nome).map((d) => `<tr><td><b>Dirigente</b></td><td>${escapeHtml(d.nome)}</td><td><b>Nº licença</b></td><td>${escapeHtml(d.licenca || "—")}</td></tr>`).join("")}
  </table>` : ""}

  ${convocatoriaRows ? `
  <h2>Convocatória — participação por período</h2>
  <table class="list">
    <thead><tr><th style="width:30px;">Nº</th><th>Nome</th><th style="width:30px;text-align:center;">1º</th><th style="width:30px;text-align:center;">2º</th><th style="width:30px;text-align:center;">3º</th><th style="width:30px;text-align:center;">4º</th></tr></thead>
    <tbody>${convocatoriaRows}</tbody>
  </table>` : ""}

  ${objetivosHtml ? `
  <h2>Objetivos do jogo</h2>
  <table class="list"><tbody>${objetivosHtml}</tbody></table>` : ""}

  ${jogo.reflexaoPreparacao ? `<h2>Reflexão sobre a preparação</h2><div class="obs">${escapeHtml(jogo.reflexaoPreparacao)}</div>` : ""}
  ${jogo.palestraInicial ? `<div class="obs-title">Palestra inicial</div><div class="obs">${escapeHtml(jogo.palestraInicial)}</div>` : ""}
  ${jogo.descontosTempo ? `<div class="obs-title">Descontos de tempo e intervalo</div><div class="obs">${escapeHtml(jogo.descontosTempo)}</div>` : ""}

  ${jogo.resultado ? `<h2>Relatório do jogo</h2><div class="resultado">${escapeHtml(jogo.resultado)}</div>` : ""}
  ${jogo.conteudo ? `<div class="obs">${escapeHtml(jogo.conteudo)}</div>` : ""}
  ${jogo.apreciacaoGeral ? `<div class="obs-title">Apreciação geral</div><div class="obs">${escapeHtml(jogo.apreciacaoGeral)}</div>` : ""}

  ${estatisticasRows ? `
  <h2>Estatísticas do jogo</h2>
  <table class="list">
    <thead><tr><th style="width:30px;">Nº</th><th>Nome</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${estatisticasRows}<tr style="border-top:2px solid #14181F;"><td></td><td style="font-weight:700;">Total</td>${totaisEstatisticas}</tr></tbody>
  </table>` : ""}

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printJogo(jogo, players, clubLogo) {
  const html = buildJogoPrintContent(jogo, players, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const namePart = `vs-${jogo.adversario || "adversario"}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${jogo.date || "jogo"}-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function svgLineChartString(points, { width = 300, height = 130, color = "#EA5B13", unit = "" } = {}) {
  if (!points || points.length === 0) return "";
  const padding = { top: 12, right: 14, bottom: 20, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = points.map((p) => p.valor);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xAt = (i) => padding.left + i * xStep;
  const yAt = (v) => padding.top + innerH - ((v - min) / (max - min)) * innerH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.valor).toFixed(1)}`).join(" ");
  const dots = points.map((p, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.valor).toFixed(1)}" r="3" fill="${color}" />`).join("");
  const valueLabels = points
    .map((p, i) => `<text x="${xAt(i).toFixed(1)}" y="${yAt(p.valor) - 7}" font-size="9" fill="#555" text-anchor="middle">${escapeHtml(String(p.valor))}</text>`)
    .join("");
  const showEvery = points.length > 6 ? Math.ceil(points.length / 6) : 1;
  const xLabels = points
    .map((p, i) => (i % showEvery === 0 ? `<text x="${xAt(i).toFixed(1)}" y="${height - 5}" font-size="9" fill="#888" text-anchor="middle">${escapeHtml(p.dataLabel)}</text>` : ""))
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#ddd" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#ddd" />
    <text x="${padding.left - 4}" y="${padding.top + 4}" font-size="9" fill="#888" text-anchor="end">${escapeHtml(String(max))}${escapeHtml(unit)}</text>
    <text x="${padding.left - 4}" y="${height - padding.bottom}" font-size="9" fill="#888" text-anchor="end">${escapeHtml(String(min))}${escapeHtml(unit)}</text>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" />
    ${dots}${valueLabels}${xLabels}
  </svg>`;
}

function buildPlayerPrintContent(player, sessions, clubLogo) {
  const idade = (() => {
    if (!player.nascimento) return null;
    const nasc = new Date(player.nascimento);
    if (isNaN(nasc)) return null;
    const diff = Date.now() - nasc.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  })();

  const lesoesRows = (player.lesoes || [])
    .filter((l) => l.ano || l.descricao)
    .map((l) => `<tr><td style="width:60px;">${escapeHtml(l.ano || "—")}</td><td>${escapeHtml(l.descricao || "—")}</td></tr>`)
    .join("");

  const avaliacoesRows = [...(player.avaliacoes || [])]
    .filter((a) => a.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((a) => `<tr><td>${formatDateFull(a.data)}</td><td>${escapeHtml(a.altura || "—")}</td><td>${escapeHtml(a.peso || "—")}</td><td>${escapeHtml(a.envergadura || "—")}</td><td>${escapeHtml(a.obs || "")}</td></tr>`)
    .join("");

  const testesRows = [...(player.testesFisicos || [])]
    .filter((t) => t.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((t) => {
      const tipo = getTipoTeste(t.tipoId);
      const nome = t.tipoId === "outro" ? (t.nomePersonalizado || "Personalizado") : tipo.nome;
      const unidade = t.tipoId === "outro" ? (t.unidadePersonalizada || "") : tipo.unidade;
      return `<tr><td>${formatDateFull(t.data)}</td><td>${escapeHtml(nome)}</td><td>${escapeHtml(t.valor || "—")} ${escapeHtml(unidade)}</td><td>${escapeHtml(t.obs || "")}</td></tr>`;
    })
    .join("");

  // Gráficos de evolução (SVG estático, para funcionarem sem JavaScript no ficheiro final)
  const chartsHtml = [];
  const alturaData = playerChartData(player.avaliacoes, "altura");
  const pesoData = playerChartData(player.avaliacoes, "peso");
  const envergaduraData = playerChartData(player.avaliacoes, "envergadura");
  if (alturaData.length >= 2) chartsHtml.push({ titulo: "Altura (m)", svg: svgLineChartString(alturaData, { unit: "m" }) });
  if (pesoData.length >= 2) chartsHtml.push({ titulo: "Peso (kg)", svg: svgLineChartString(pesoData, { unit: "kg" }) });
  if (envergaduraData.length >= 2) chartsHtml.push({ titulo: "Envergadura", svg: svgLineChartString(envergaduraData, {}) });

  const testesPorTipo = {};
  (player.testesFisicos || []).forEach((t) => {
    if (!t.data || t.valor === "" || t.valor == null) return;
    testesPorTipo[t.tipoId] = testesPorTipo[t.tipoId] || [];
    testesPorTipo[t.tipoId].push(t);
  });
  Object.entries(testesPorTipo).forEach(([tipoId, list]) => {
    if (list.length < 2) return;
    const tipo = getTipoTeste(tipoId);
    const nome = tipoId === "outro" ? (list[0].nomePersonalizado || "Teste personalizado") : tipo.nome;
    const unidade = tipoId === "outro" ? (list[0].unidadePersonalizada || "") : tipo.unidade;
    chartsHtml.push({ titulo: `${nome}${unidade ? ` (${unidade})` : ""}`, svg: svgLineChartString(playerChartData(list, "valor"), { unit: "" }) });
  });

  // Estatísticas de jogo (pontos, ressaltos, etc.) ao longo dos jogos disputados
  const jogosComEstatisticas = [...(sessions || [])]
    .filter((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[player.id])
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  ESTATISTICAS_CAMPOS.forEach((c) => {
    const pontos = jogosComEstatisticas
      .filter((s) => c.madeKey || (s.estatisticas[player.id][c.key] !== "" && s.estatisticas[player.id][c.key] != null))
      .map((s) => ({ dataLabel: formatDateShortYear(s.date), valor: estatisticaNumero(c, s.estatisticas[player.id]) }));
    if (pontos.length >= 2) chartsHtml.push({ titulo: c.nome, svg: svgLineChartString(pontos, { unit: "" }) });
  });

  const estatisticasJogoTableRows = jogosComEstatisticas
    .map((s) => {
      const stats = s.estatisticas[player.id];
      return `<tr><td>${formatDateFull(s.date)}</td><td>vs ${escapeHtml(s.adversario || "?")}</td>${ESTATISTICAS_CAMPOS.map((c) => `<td style="text-align:center;">${escapeHtml(somaEstatistica(c, [stats]))}</td>`).join("")}</tr>`;
    })
    .join("");
  const estatisticasJogoTableHtml = estatisticasJogoTableRows
    ? `<h2>Estatísticas por jogo</h2>
       <table class="list">
         <thead><tr><th>Data</th><th>Adversário</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
         <tbody>${estatisticasJogoTableRows}</tbody>
       </table>`
    : "";

  const chartsBlockHtml = chartsHtml.length
    ? `<h2>Evolução</h2><div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:6px;">${chartsHtml
        .map((c) => `<div style="border:1px solid #eee;border-radius:6px;padding:8px;"><div style="font-size:11px;font-weight:600;margin-bottom:4px;">${escapeHtml(c.titulo)}</div>${c.svg}</div>`)
        .join("")}</div>`
    : "";

  // Presenças aos treinos
  const presenca = calcPresenca(player.id, sessions);
  const presencaRows = (sessions || [])
    .filter((s) => s.type === "treino" && s.realizado === true && (s.presencas || {})[player.id])
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const status = s.presencas[player.id];
      const label = status === "P" ? "Presente" : "Falta";
      const color = status === "P" ? "#2E7D4F" : "#B23A3A";
      return `<tr><td>${formatDateFull(s.date)}</td><td>${escapeHtml(s.title || "Treino")}</td><td style="color:${color};font-weight:600;">${label}</td></tr>`;
    })
    .join("");
  const presencaBlockHtml = presenca
    ? `<h2>Presenças aos treinos</h2>
       <div style="font-size:14px;font-weight:600;padding:10px 12px;background:#f4f4f5;border-radius:6px;margin-bottom:10px;">${presenca.presentes} presenças de ${presenca.total} treinos realizados · <b>${presenca.pct}% presença</b>${presenca.faltas > 0 ? ` (${presenca.faltas} falta${presenca.faltas === 1 ? "" : "s"})` : ""}</div>
       ${presencaRows ? `<table class="list"><thead><tr><th>Data</th><th>Treino</th><th style="width:90px;">Estado</th></tr></thead><tbody>${presencaRows}</tbody></table>` : ""}`
    : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(player.nome || "Jogador")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
  .avatar { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; background: #f4f4f5; border: 1px solid #ddd; }
  .avatar-placeholder { width: 90px; height: 90px; border-radius: 50%; background: #f4f4f5; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #EA5B13; }
  h1 { font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 22px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.info td { padding: 5px 8px 5px 0; }
  table.info td b { display: block; font-size: 10px; text-transform: uppercase; color: #888; }
  table.list th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.list td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .obs { font-size: 13px; white-space: pre-wrap; background: #f4f4f5; padding: 12px; border-radius: 6px; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:44px;width:auto;object-fit:contain;margin-bottom:12px;display:block;" />` : ""}
  <div class="header">
    ${player.foto ? `<img class="avatar" src="${player.foto}" />` : `<div class="avatar-placeholder">${escapeHtml(player.numero || "—")}</div>`}
    <div>
      <h1>${escapeHtml(player.nome || "Sem nome")}</h1>
      <div class="sub">${escapeHtml(player.posicao || "")}${player.numero ? ` · Nº ${escapeHtml(player.numero)}` : ""}${player.nascimento ? ` · ${formatDateFull(player.nascimento)}${idade !== null ? ` (${idade} anos)` : ""}` : ""}</div>
    </div>
  </div>

  <h2>Contactos</h2>
  <table class="info">
    <tr>
      <td><b>Morada</b>${escapeHtml(player.morada || "—")}</td>
      <td><b>Cidade</b>${escapeHtml(player.cidade || "—")}</td>
    </tr>
    <tr>
      <td><b>Email</b>${escapeHtml(player.email || "—")}</td>
      <td><b>Telemóvel</b>${escapeHtml(player.telemovel || "—")}</td>
    </tr>
    <tr>
      <td><b>C.C.</b>${escapeHtml(player.cc || "—")}</td>
      <td><b>NIF</b>${escapeHtml(player.nif || "—")}</td>
    </tr>
    <tr>
      <td><b>Profissão</b>${escapeHtml(player.profissao || "—")}</td>
      <td><b>Épocas no clube</b>${escapeHtml(player.epocasClube || "—")}</td>
    </tr>
  </table>

  <h2>Saúde</h2>
  <table class="info">
    <tr>
      <td><b>Medicação</b>${escapeHtml(player.medicacao || "Nenhuma")}</td>
      <td><b>Outros desportos</b>${escapeHtml(player.outrosDesportos || "Não")}</td>
    </tr>
  </table>
  ${lesoesRows ? `
  <table class="list" style="margin-top:8px;">
    <thead><tr><th>Ano</th><th>Lesão</th></tr></thead>
    <tbody>${lesoesRows}</tbody>
  </table>` : ""}

  ${chartsBlockHtml}

  ${avaliacoesRows ? `
  <h2>Avaliação corporal</h2>
  <table class="list">
    <thead><tr><th>Data</th><th>Altura (m)</th><th>Peso (kg)</th><th>Envergadura</th><th>Obs.</th></tr></thead>
    <tbody>${avaliacoesRows}</tbody>
  </table>` : ""}

  ${testesRows ? `
  <h2>Testes físicos</h2>
  <table class="list">
    <thead><tr><th>Data</th><th>Teste</th><th>Valor</th><th>Obs.</th></tr></thead>
    <tbody>${testesRows}</tbody>
  </table>` : ""}

  ${estatisticasJogoTableHtml}

  ${presencaBlockHtml}

  ${player.notas ? `<h2>Notas gerais</h2><div class="obs">${escapeHtml(player.notas)}</div>` : ""}

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function buildSeasonReportContent(team, players, sessions, library, clubLogo) {
  const temporada = team ? team.temporadaAtual : "";
  const nomeEquipa = team ? team.nome : "Equipa";
  const treinos = sessions.filter((s) => s.type === "treino");
  const treinosRealizados = treinos.filter((s) => s.realizado === true);
  const jogos = [...sessions.filter((s) => s.type === "jogo")].sort((a, b) => (a.date < b.date ? -1 : 1));

  const presencaData = players
    .map((p) => ({ p, presenca: calcPresenca(p.id, sessions) }))
    .filter((x) => x.presenca);
  const mediaPresenca = presencaData.length
    ? Math.round(presencaData.reduce((sum, x) => sum + x.presenca.pct, 0) / presencaData.length)
    : null;
  const presencaRows = presencaData
    .sort((a, b) => b.presenca.pct - a.presenca.pct)
    .map(({ p, presenca }) => `<tr><td>${escapeHtml(p.nome)}</td><td style="text-align:center;">${presenca.presentes}/${presenca.total}</td><td style="text-align:center;font-weight:600;">${presenca.pct}%</td></tr>`)
    .join("");

  const jogosRows = jogos
    .map((j) => `<tr><td>${formatDateFull(j.date)}</td><td>${escapeHtml(j.campeonato || "—")}</td><td>${escapeHtml(j.adversario || "?")}</td><td style="font-weight:600;">${escapeHtml(j.resultado || "—")}</td></tr>`)
    .join("");

  // Estatísticas gerais da equipa (somas e médias por jogo, agregando todas as jogadoras)
  let jogosComDados = 0;
  const statsEquipa = []; // todos os registos de estatísticas de todas as jogadoras em todos os jogos
  const statsPorJogador = {}; // playerId -> lista de registos (um por jogo)
  jogos.forEach((j) => {
    const estat = j.estatisticas || {};
    if (Object.keys(estat).length === 0) return;
    jogosComDados += 1;
    Object.entries(estat).forEach(([playerId, stats]) => {
      statsEquipa.push(stats);
      statsPorJogador[playerId] = statsPorJogador[playerId] || [];
      statsPorJogador[playerId].push(stats);
    });
  });
  const somaNumero = (campo, statsList) => statsList.reduce((sum, s) => sum + estatisticaNumero(campo, s), 0);
  const pontosCampo = ESTATISTICAS_CAMPOS.find((c) => c.key === "pontos");

  const estatisticasCardsHtml = ESTATISTICAS_CAMPOS.map((c) => {
    const total = somaEstatistica(c, statsEquipa);
    const media = jogosComDados ? (somaNumero(c, statsEquipa) / jogosComDados).toFixed(1) : "0";
    return `<div class="stat-card"><div class="num">${total}</div><div class="lbl">${escapeHtml(c.nome)} · ${media}/jogo</div></div>`;
  }).join("");

  const statsPorJogadorRows = players
    .map((p) => {
      const statsList = statsPorJogador[p.id];
      if (!statsList) return null;
      const jogosJogados = statsList.length;
      const cells = ESTATISTICAS_CAMPOS.map((c) => {
        const total = somaEstatistica(c, statsList);
        const media = jogosJogados ? (somaNumero(c, statsList) / jogosJogados).toFixed(1) : "0";
        return `<td style="text-align:center;">${total} <span style="color:#999;font-size:11px;">(${media})</span></td>`;
      }).join("");
      return { pontos: somaNumero(pontosCampo, statsList), html: `<tr><td>${escapeHtml(p.nome)}</td><td style="text-align:center;">${jogosJogados}</td>${cells}</tr>` };
    })
    .filter(Boolean)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.html)
    .join("");

  const groups = habilidadeGroups();
  const treinosPorComponente = groups.map((g) => {
    const idsSet = new Set(g.items.map((h) => h.id));
    const count = treinosRealizados.filter((t) => (t.exercicios || []).some((e) => e.categoria && idsSet.has(e.categoria))).length;
    return { label: g.label, count };
  });
  const componentesRows = treinosPorComponente
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td style="text-align:center;font-weight:600;">${c.count}</td><td style="text-align:center;">${treinosRealizados.length ? Math.round((c.count / treinosRealizados.length) * 100) : 0}%</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Relatório de Época ${escapeHtml(temporada)} — ${escapeHtml(nomeEquipa)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181F; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 2px solid #14181F; padding-bottom: 4px; margin: 24px 0 10px 0; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .stat-card { flex: 1; min-width: 110px; background: #f4f4f5; border-radius: 6px; padding: 12px; text-align: center; }
  .stat-card .num { font-size: 24px; font-weight: 700; }
  .stat-card .lbl { font-size: 10px; text-transform: uppercase; color: #888; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .print-btn { display: inline-block; margin-bottom: 20px; padding: 10px 18px; background: #EA5B13; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 12px; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  ${clubLogo ? `<img src="${clubLogo}" style="height:50px;width:auto;object-fit:contain;margin-bottom:10px;display:block;" />` : ""}
  <h1>Relatório de Época</h1>
  <div class="sub">${escapeHtml(nomeEquipa)} · Época ${escapeHtml(temporada)}</div>

  <div class="stats">
    <div class="stat-card"><div class="num">${players.length}</div><div class="lbl">Jogadoras/es</div></div>
    <div class="stat-card"><div class="num">${treinosRealizados.length}</div><div class="lbl">Treinos realizados</div></div>
    <div class="stat-card"><div class="num">${jogos.length}</div><div class="lbl">Jogos</div></div>
    <div class="stat-card"><div class="num">${mediaPresenca !== null ? mediaPresenca + "%" : "—"}</div><div class="lbl">Presença média</div></div>
  </div>

  ${presencaRows ? `
  <h2>Presenças por jogadora</h2>
  <table>
    <thead><tr><th>Nome</th><th style="text-align:center;">Presenças</th><th style="text-align:center;">%</th></tr></thead>
    <tbody>${presencaRows}</tbody>
  </table>` : ""}

  ${jogosRows ? `
  <h2>Jogos da época</h2>
  <table>
    <thead><tr><th>Data</th><th>Competição</th><th>Adversário</th><th>Resultado</th></tr></thead>
    <tbody>${jogosRows}</tbody>
  </table>` : ""}

  ${jogosComDados > 0 ? `
  <h2>Estatísticas da equipa (${jogosComDados} jogo${jogosComDados === 1 ? "" : "s"} com registo)</h2>
  <div class="stats">${estatisticasCardsHtml}</div>
  ${statsPorJogadorRows ? `
  <div style="font-size:11px;font-weight:600;color:#555;margin:12px 0 4px 0;text-transform:uppercase;">Total por jogadora — total (média/jogo)</div>
  <table>
    <thead><tr><th>Jogadora</th><th style="text-align:center;">Jogos</th>${ESTATISTICAS_CAMPOS.map((c) => `<th style="text-align:center;" title="${escapeHtml(c.nome)}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${statsPorJogadorRows}</tbody>
  </table>` : ""}` : ""}

  <h2>Treinos realizados por componente</h2>
  <div class="sub" style="margin-bottom:10px;">De ${treinosRealizados.length} treino${treinosRealizados.length === 1 ? "" : "s"} realizado${treinosRealizados.length === 1 ? "" : "s"} nesta época, quantos incluíram pelo menos um exercício de cada componente:</div>
  <table>
    <thead><tr><th>Componente</th><th style="text-align:center;">Treinos</th><th style="text-align:center;">%</th></tr></thead>
    <tbody>${componentesRows}</tbody>
  </table>

  <footer style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Gerado pela Agenda do Treinador</footer>
</body>
</html>`;
}

function printPlayer(player, sessions, clubLogo) {
  const html = buildPlayerPrintContent(player, sessions, clubLogo);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const namePart = (player.nome || "jogador").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `ficha-${namePart}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export {
  svgHalfMarkingsStr,
  svgCourtBackgroundStr,
  svgTokenStr,
  svgArrowStr,
  diagramToSvgString,
  buildSessionPrintContent,
  printSession,
  buildJogoPrintContent,
  printJogo,
  svgLineChartString,
  buildPlayerPrintContent,
  buildSeasonReportContent,
  printPlayer,
};

