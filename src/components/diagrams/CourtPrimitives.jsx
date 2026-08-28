import { HALF_VB, FULL_VB } from "../../data";
import { wavyPathD, arcPathD, arrowHead } from "../../utils";

function HalfMarkings({ flipY = false, w = HALF_VB.w, h = HALF_VB.h }) {
  // Drawn for a court with baseline at bottom (y = h-10), hoop area near baseline, centered on w/2.
  const cx = w / 2;
  const baseline = h - 10;
  const keyTop = baseline - 120;
  const keyHalf = 50;
  const g = (
    <g stroke="#3A4354" strokeWidth="2" fill="none">
      <rect x={cx - keyHalf} y={keyTop} width={keyHalf * 2} height="120" fill="#1E2A38" />
      <circle cx={cx} cy={keyTop} r="36" />
      <path d={`M ${cx - 130} ${baseline} Q ${cx - 130} ${baseline - 155} ${cx} ${baseline - 155}`} />
      <path d={`M ${cx + 130} ${baseline} Q ${cx + 130} ${baseline - 155} ${cx} ${baseline - 155}`} />
      <circle cx={cx} cy={baseline - 22} r="3" fill="#3A4354" stroke="none" />
      <line x1={cx - 20} y1={baseline - 4} x2={cx + 20} y2={baseline - 4} strokeWidth="3" />
    </g>
  );
  return flipY ? <g transform={`translate(0 ${h}) scale(1 -1)`}>{g}</g> : g;
}

function CourtSvgDefs() {
  return (
    <defs>
      <pattern id="woodgrain" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#1A1F28" />
        <line x1="0" y1="0" x2="0" y2="10" stroke="#20262F" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

function CourtBackground({ court, vb }) {
  return (
    <>
      <CourtSvgDefs />
      <rect x="0" y="0" width={vb.w} height={vb.h} fill="url(#woodgrain)" />
      <rect x="10" y="10" width={vb.w - 20} height={vb.h - 20} fill="none" stroke="#3A4354" strokeWidth="2" />
      {court === "campo" ? (
        <>
          <HalfMarkings w={vb.w} h={vb.h} flipY={false} />
          <HalfMarkings w={vb.w} h={vb.h} flipY={true} />
          <line x1="10" y1={vb.h / 2} x2={vb.w - 10} y2={vb.h / 2} stroke="#3A4354" strokeWidth="2" />
          <circle cx={vb.w / 2} cy={vb.h / 2} r="30" fill="none" stroke="#3A4354" strokeWidth="2" />
        </>
      ) : (
        <>
          <HalfMarkings w={vb.w} h={vb.h} flipY={false} />
          <line x1="10" y1="10" x2={vb.w - 10} y2="10" stroke="#3A4354" strokeWidth="2" />
        </>
      )}
    </>
  );
}

/* ---------------- TOKENS E SETAS DO DIAGRAMA ---------------- */

function TokenShape({ token, onMouseDown, selected }) {
  const { x, y, type, number } = token;
  if (type === "ball") {
    return (
      <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "grab" }}>
        <circle r="7" fill="#EA5B13" stroke={selected ? "#F2EDE3" : "none"} strokeWidth="2" />
        <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#14181F" strokeWidth="1" />
      </g>
    );
  }
  if (type === "cone") {
    return (
      <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "grab" }}>
        <path d="M 0 -9 L 8 8 L -8 8 Z" fill="#F2C744" stroke={selected ? "#F2EDE3" : "#14181F"} strokeWidth={selected ? 2 : 1} strokeLinejoin="round" />
      </g>
    );
  }
  const isDef = type === "defense";
  return (
    <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "grab" }}>
      <circle r="12" fill={isDef ? "transparent" : "#EA5B13"} stroke={isDef ? "#D64545" : selected ? "#F2EDE3" : "#14181F"} strokeWidth={isDef ? 2.5 : selected ? 2.5 : 1.5} strokeDasharray={isDef ? "3 2" : "none"} />
      <text textAnchor="middle" dy="4" fontSize="11" fill={isDef ? "#D64545" : "#14181F"} fontFamily="'IBM Plex Mono', monospace" fontWeight="600">
        {number}
      </text>
    </g>
  );
}

function ArrowShape({ arrow, onMouseDown, selected }) {
  const color = selected ? "#F2EDE3" : "#C7CDD8";
  if (arrow.type === "bloqueio") {
    const { x, y } = arrow.at;
    return (
      <g transform={`translate(${x} ${y})`} onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
        <line x1="-9" y1="0" x2="9" y2="0" stroke={color} strokeWidth="4" />
      </g>
    );
  }
  const { from, to } = arrow;
  const isShot = arrow.type === "lancamento";
  let d;
  if (arrow.type === "drible") d = wavyPathD(from.x, from.y, to.x, to.y);
  else if (isShot) d = arcPathD(from.x, from.y, to.x, to.y);
  else d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: "pointer" }}>
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeDasharray={arrow.type === "passe" || isShot ? "6 4" : "none"} />
      {isShot ? (
        <g transform={`translate(${to.x} ${to.y})`}>
          <circle r="6" fill="none" stroke={color} strokeWidth="2" />
          <circle r="2" fill={color} />
        </g>
      ) : (
        <path d={arrowHead(from.x, from.y, to.x, to.y)} stroke={color} strokeWidth="2" fill="none" />
      )}
    </g>
  );
}

function DiagramThumbnail({ diagram, size = 56 }) {
  if (!diagram || (diagram.tokens.length === 0 && diagram.arrows.length === 0)) return null;
  const vb = diagram.court === "campo" ? FULL_VB : HALF_VB;
  const ratio = vb.h / vb.w;
  return (
    <div style={{ width: size, height: size * ratio }} className="rounded overflow-hidden border border-[#2E3644] shrink-0">
      <svg viewBox={`0 0 ${vb.w} ${vb.h}`} className="w-full h-full">
        <CourtBackground court={diagram.court} vb={vb} />
        {diagram.arrows.map((a) => (
          <ArrowShape key={a.id} arrow={a} />
        ))}
        {diagram.tokens.map((t) => (
          <TokenShape key={t.id} token={t} />
        ))}
      </svg>
    </div>
  );
}

export { HalfMarkings, CourtSvgDefs, CourtBackground, TokenShape, ArrowShape, DiagramThumbnail };

