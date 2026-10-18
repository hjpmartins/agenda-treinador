import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Line, Polygon, Polyline } from 'react-native-svg';
import {
  addStroke,
  clearMoment,
  crossedMoment,
  findMoment,
  normalizeTrim,
  undoStroke,
  type Moment,
  type Point,
  type Stroke,
  type Tool,
} from '../lib/annotations';
import { formatClock } from '../lib/format';
import { doubleTapZoom, NO_ZOOM, pinchZoom, type XY, type Zoom } from '../lib/zoom';
import { clipTitle, getNotes, setNotes, useNotesVersion } from '../remote/notesStore';
import { colors, radius, space } from '../theme';
import { shareClip } from './exportShare';
import { MotivePicker } from './MotivePicker';
import { PlayerPicker, playersShort } from './PlayerPicker';
import { TitleEditor } from './TitleEditor';

export type AnalysisItem = { id: string; uri: string; title: string };

const PEN_COLORS = ['#FFD60A', '#FF3B30', '#FFFFFF'];
const RATES = [0.25, 0.5, 1, 2];
const FRAME_MS = 1000 / 30;
/** Duração mínima de um corte. */
const MIN_TRIM_MS = 1000;

/**
 * Leitor para analisar clips no tablet: câmara lenta, imagem a imagem, cortar,
 * desenhar por cima da imagem parada e escolher o motivo. Com vários clips
 * (ex.: todos os de um motivo, no desconto de tempo) passa de um para o outro.
 */
export function AnalysisPlayer({
  items,
  startIndex = 0,
  onClose,
}: {
  items: AnalysisItem[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const item = items[index];
  if (!item) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <ClipAnalysis
        key={item.id}
        item={item}
        position={items.length > 1 ? `${index + 1}/${items.length}` : null}
        onPrev={index > 0 ? () => setIndex(index - 1) : null}
        onNext={index < items.length - 1 ? () => setIndex(index + 1) : null}
        onClose={onClose}
      />
    </Modal>
  );
}

type Mode = 'view' | 'draw' | 'trim';

function ClipAnalysis({
  item,
  position,
  onPrev,
  onNext,
  onClose,
}: {
  item: AnalysisItem;
  position: string | null;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}) {
  useNotesVersion();
  // O ecrã inteiro passa por baixo das barras do Android: os botões ficam dentro da zona segura.
  const insets = useSafeAreaInsets();
  const notes = getNotes(item.id);
  const moments = notes.moments ?? [];

  const player = useVideoPlayer(item.uri, (p) => {
    p.timeUpdateEventInterval = 0.05;
    p.preservesPitch = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRate] = useState(1);
  const [mode, setMode] = useState<Mode>('view');
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [pickMotive, setPickMotive] = useState(false);
  const [pickPlayers, setPickPlayers] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  /** Corte enquanto se arrastam as pegas (só se grava ao largar). */
  const [trimDrag, setTrimDrag] = useState<{ startMs: number; endMs: number } | null>(null);

  const trim = trimDrag ?? normalizeTrim(notes.trim, durationMs);
  const startMs = trim?.startMs ?? 0;
  const endMs = trim?.endMs ?? durationMs;

  const prevMs = useRef(0);
  const stoppedAt = useRef<number | null>(null);
  const started = useRef(false);
  /** Evita passar duas vezes ao clip seguinte (fim do corte + fim do ficheiro). */
  const ended = useRef(false);
  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    onNext?.();
  };

  const seek = (ms: number) => {
    const t = Math.max(0, Math.min(ms, durationMs || ms));
    player.currentTime = t / 1000;
    prevMs.current = t;
    setCurrentMs(t);
  };

  // Ao carregar: duração, início do corte e arranque automático.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'readyToPlay' || started.current) return;
    started.current = true;
    const d = Math.round(player.duration * 1000);
    setDurationMs(d);
    const t = normalizeTrim(getNotes(item.id).trim, d);
    if (t) {
      player.currentTime = t.startMs / 1000;
      prevMs.current = t.startMs;
      setCurrentMs(t.startMs);
    }
    player.play();
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const cur = Math.round(currentTime * 1000);
    const prev = prevMs.current;
    prevMs.current = cur;
    if (!player.playing) {
      setCurrentMs(cur);
      return;
    }
    // Para nos desenhos (uma vez por passagem).
    const hit = crossedMoment(getNotes(item.id).moments, prev, cur);
    if (hit && stoppedAt.current !== hit.atMs) {
      stoppedAt.current = hit.atMs;
      player.pause();
      player.currentTime = hit.atMs / 1000;
      prevMs.current = hit.atMs;
      setCurrentMs(hit.atMs);
      return;
    }
    if (stoppedAt.current != null && cur > stoppedAt.current + 300) stoppedAt.current = null;
    // Fim do corte: passa ao seguinte (lista) ou para.
    if (durationMs > 0 && cur >= endMs - 30) {
      player.pause();
      finish();
      return;
    }
    setCurrentMs(cur);
  });

  useEventListener(player, 'playToEnd', finish);

  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
      return;
    }
    setMode('view');
    if (currentMs >= endMs - 50) seek(startMs);
    ended.current = false;
    player.play();
  };

  const step = (dir: 1 | -1) => {
    player.pause();
    seek(Math.min(endMs, Math.max(startMs, currentMs + dir * FRAME_MS)));
  };

  // ------------------------------------------------------------ desenho
  const shownMoment: Moment | undefined = !isPlaying ? findMoment(moments, currentMs) : undefined;

  const toolRef = useRef({ tool, color, box, currentMs });
  toolRef.current = { tool, color, box, currentMs };
  const draftRef = useRef<Stroke | null>(null);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { tool: t, color: c } = toolRef.current;
          const p = toPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, toolRef.current.box);
          draftRef.current = { tool: t, color: c, points: [p, p] };
          setDraft(draftRef.current);
        },
        onPanResponderMove: (e) => {
          const d = draftRef.current;
          if (!d) return;
          const p = toPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, toolRef.current.box);
          draftRef.current = d.tool === 'free' ? { ...d, points: [...d.points, p] } : { ...d, points: [d.points[0], p] };
          setDraft(draftRef.current);
        },
        onPanResponderRelease: () => {
          const d = draftRef.current;
          draftRef.current = null;
          setDraft(null);
          if (!d || tooSmall(d)) return;
          const at = toolRef.current.currentMs;
          setNotes(item.id, { moments: addStroke(getNotes(item.id).moments, at, d) });
        },
        onPanResponderTerminate: () => {
          draftRef.current = null;
          setDraft(null);
        },
      }),
    [item.id]
  );

  const onVideoLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.min(width, (height * 16) / 9);
    const h = (w * 9) / 16;
    setBox({ x: (width - w) / 2, y: (height - h) / 2, w, h });
  };

  // ------------------------------------------------------------ zoom (dois dedos / dois toques)
  const zoomRef = useRef({ zoom, box });
  zoomRef.current = { zoom, box };
  const zoomPan = useMemo(() => {
    let origin = { x: 0, y: 0 };
    let base: { zoom: Zoom; mid: XY; dist: number; touches: number } | null = null;
    let tap: { at: number; p: XY; moved: boolean } | null = null;
    let lastTap: { at: number; p: XY } | null = null;
    const read = (e: any): { mid: XY; dist: number; n: number } => {
      const t: { pageX: number; pageY: number }[] = e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent];
      const pts = t.slice(0, 2).map((p) => ({ x: p.pageX - origin.x, y: p.pageY - origin.y }));
      const mid = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
      const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
      return { mid, dist, n: pts.length };
    };
    const rebase = (e: any) => {
      const r = read(e);
      base = { zoom: zoomRef.current.zoom, mid: r.mid, dist: r.dist, touches: r.n };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // Canto da caixa no ecrã (a camada não tem filhos: locationX é relativo a ela).
        origin = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
        rebase(e);
        tap = { at: Date.now(), p: read(e).mid, moved: false };
      },
      onPanResponderMove: (e) => {
        const r = read(e);
        if (!base || base.touches !== r.n) return rebase(e);
        const { w, h } = zoomRef.current.box;
        if (tap && Math.hypot(r.mid.x - tap.p.x, r.mid.y - tap.p.y) > 10) tap.moved = true;
        if (r.n === 2) {
          if (tap) tap.moved = true;
          setZoom(pinchZoom(base.zoom, base.mid, base.dist, r.mid, r.dist, w, h));
        } else if (base.zoom.s > 1) {
          // Um dedo com zoom: arrastar a imagem.
          setZoom(pinchZoom(base.zoom, base.mid, 1, r.mid, 1, w, h));
        }
      },
      onPanResponderRelease: () => {
        base = null;
        const t = tap;
        tap = null;
        if (!t || t.moved || Date.now() - t.at > 300) return;
        if (lastTap && t.at - lastTap.at < 350) {
          const { w, h } = zoomRef.current.box;
          setZoom(doubleTapZoom(zoomRef.current.zoom, t.p, w, h));
          lastTap = null;
        } else {
          lastTap = { at: t.at, p: t.p };
        }
      },
      onPanResponderTerminate: () => {
        base = null;
        tap = null;
      },
    });
  }, []);
  const zoomed = zoom.s > 1.01;

  // ------------------------------------------------------------ corte (pegas na barra)
  const fullTrim = () => trim ?? { startMs: 0, endMs: durationMs };
  const dragTrim = (which: 'start' | 'end', ms: number) => {
    const t = trimDrag ?? fullTrim();
    const next =
      which === 'start'
        ? { startMs: Math.max(0, Math.min(ms, t.endMs - MIN_TRIM_MS)), endMs: t.endMs }
        : { startMs: t.startMs, endMs: Math.min(durationMs, Math.max(ms, t.startMs + MIN_TRIM_MS)) };
    setTrimDrag(next);
    // Mostra a imagem onde está a pega.
    player.pause();
    seek(which === 'start' ? next.startMs : next.endMs);
  };
  const commitTrim = () => {
    if (!trimDrag) return;
    setNotes(item.id, { trim: normalizeTrim(trimDrag, durationMs) });
    setTrimDrag(null);
  };

  const strokesToShow = [...(mode === 'draw' ? findMoment(moments, currentMs)?.strokes ?? [] : shownMoment?.strokes ?? [])];
  if (draft) strokesToShow.push(draft);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.videoArea} onLayout={onVideoLayout}>
        <View style={[styles.videoBox, { left: box.x, top: box.y, width: box.w, height: box.h }]}>
          {/* textureView: necessário para o zoom (a surfaceView não acompanha a escala). */}
          <View
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.s }] }]}
          >
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
              surfaceType="textureView"
            />
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {strokesToShow.map((s, i) => (
                <StrokeShape key={i} stroke={s} w={box.w} h={box.h} />
              ))}
            </Svg>
          </View>
          {mode === 'draw' ? (
            <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
          ) : (
            <View style={StyleSheet.absoluteFill} {...zoomPan.panHandlers} />
          )}
        </View>
        <View style={styles.topBar}>
          <Pressable
            style={styles.flex}
            onPress={() => {
              player.pause();
              setEditTitle(true);
            }}
          >
            <Text style={styles.title} numberOfLines={1}>
              {position ? `${position} · ` : ''}
              {clipTitle(item.id, item.title)}
              <Text style={styles.pen}>{'  ✎'}</Text>
            </Text>
          </Pressable>
          <Pressable onPress={() => setPickPlayers(true)} style={[styles.motiveChip, { borderColor: '#2D7FF9' }]}>
            <Text style={styles.motiveText}>{playersShort(notes.players) ?? 'Jogadoras…'}</Text>
          </Pressable>
          <Pressable onPress={() => setPickMotive(true)} style={styles.motiveChip}>
            <Text style={styles.motiveText}>{notes.motive ?? 'Motivo…'}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        {shownMoment && mode === 'view' ? <Text style={styles.momentHint}>Desenho · ▶ para continuar</Text> : null}
        {zoomed ? (
          <Pressable onPress={() => setZoom(NO_ZOOM)} style={styles.zoomChip}>
            <Text style={styles.zoomText}>🔍 {zoom.s.toFixed(1).replace('.', ',')}x · Repor</Text>
          </Pressable>
        ) : null}
      </View>

      {mode === 'trim' && durationMs > 0 ? (
        <TrimBar
          currentMs={currentMs}
          durationMs={durationMs}
          trim={fullTrim()}
          onDrag={dragTrim}
          onRelease={commitTrim}
          onSeek={(ms) => {
            player.pause();
            seek(ms);
          }}
        />
      ) : (
        <ScrubBar
          currentMs={currentMs}
          durationMs={durationMs}
          trim={trim}
          moments={moments}
          onSeek={(ms) => {
            player.pause();
            seek(ms);
          }}
        />
      )}

      {mode === 'draw' ? (
        <View style={styles.toolbar}>
          {(['arrow', 'circle', 'free'] as Tool[]).map((t) => (
            <Btn key={t} label={{ arrow: '↗ Seta', circle: '◯ Círculo', free: '✎ Livre' }[t]} on={tool === t} onPress={() => setTool(t)} />
          ))}
          <View style={styles.sep} />
          {PEN_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
          ))}
          <View style={styles.sep} />
          <Btn label="↶ Desfazer" onPress={() => setNotes(item.id, { moments: undoStroke(moments, currentMs) })} />
          <Btn label="Apagar" onPress={() => setNotes(item.id, { moments: clearMoment(moments, currentMs) })} />
          <View style={styles.flex} />
          <Btn label="Concluído" primary onPress={() => setMode('view')} />
        </View>
      ) : mode === 'trim' ? (
        <View style={styles.toolbar}>
          <Text style={[styles.info, styles.flex]}>
            Arrasta as pegas laranja: a da esquerda é o início, a da direita o fim.{'\n'}
            <Text style={styles.infoMuted}>
              {formatClock(startMs)} → {formatClock(endMs)} · fica com {formatClock(endMs - startMs)}
            </Text>
          </Text>
          <Btn
            label="▶ Ver o corte"
            onPress={() => {
              seek(startMs);
              ended.current = false;
              player.play();
            }}
          />
          <Btn label="Repor" onPress={() => setNotes(item.id, { trim: null })} />
          <Btn label="Concluído" primary onPress={() => setMode('view')} />
        </View>
      ) : null}

      <View style={styles.controls}>
        {onPrev ? <Btn label="⏮" onPress={onPrev} /> : null}
        <Btn label="−3s" onPress={() => seek(Math.max(startMs, currentMs - 3000))} />
        <Btn label="◀ 1" onPress={() => step(-1)} />
        <Btn label={isPlaying ? '❚❚' : '▶'} primary big onPress={togglePlay} />
        <Btn label="1 ▶" onPress={() => step(1)} />
        {onNext ? <Btn label="⏭" onPress={onNext} /> : null}
        <View style={styles.sep} />
        {RATES.map((r) => (
          <Btn key={r} label={r === 1 ? '1x' : `${String(r).replace('.', ',')}x`} on={rate === r} onPress={() => setRate(r)} />
        ))}
        <View style={styles.flex} />
        <Text style={styles.time}>
          {formatClock(Math.max(0, currentMs - startMs))} / {formatClock(Math.max(0, endMs - startMs))}
        </Text>
        <Btn
          label="✏ Desenhar"
          on={mode === 'draw'}
          onPress={() => {
            player.pause();
            // Desenha-se sobre a imagem inteira (sem zoom), para os traços ficarem no sítio certo.
            setZoom(NO_ZOOM);
            setMode(mode === 'draw' ? 'view' : 'draw');
          }}
        />
        <Btn
          label="↗ Enviar"
          onPress={() => {
            player.pause();
            shareClip(item.id, item.uri, item.title);
          }}
        />
        <Btn
          label="✂ Cortar"
          on={mode === 'trim'}
          onPress={() => {
            player.pause();
            setMode(mode === 'trim' ? 'view' : 'trim');
          }}
        />
      </View>

      {editTitle ? <TitleEditor clip={{ id: item.id, name: item.title }} onClose={() => setEditTitle(false)} /> : null}
      <PlayerPicker
        visible={pickPlayers}
        selected={notes.players ?? []}
        onChange={(players) => setNotes(item.id, { players })}
        onClose={() => setPickPlayers(false)}
      />
      <MotivePicker
        visible={pickMotive}
        current={notes.motive ?? null}
        onPick={(m) => {
          setNotes(item.id, { motive: m });
          setPickMotive(false);
        }}
        onClose={() => setPickMotive(false)}
      />
    </View>
  );
}

function toPoint(x: number, y: number, box: { w: number; h: number }): Point {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [clamp(x / (box.w || 1)), clamp(y / (box.h || 1))];
}

function tooSmall(s: Stroke): boolean {
  const [a, b] = [s.points[0], s.points[s.points.length - 1]];
  return s.tool !== 'free' && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02;
}

/** Desenha um traço (coordenadas 0..1) numa área w×h. */
export function StrokeShape({ stroke, w, h }: { stroke: Stroke; w: number; h: number }) {
  const width = Math.max(3, w * 0.006);
  const pts = stroke.points.map(([x, y]) => [x * w, y * h] as const);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (stroke.tool === 'circle') {
    return (
      <Ellipse
        cx={(a[0] + b[0]) / 2}
        cy={(a[1] + b[1]) / 2}
        rx={Math.abs(b[0] - a[0]) / 2}
        ry={Math.abs(b[1] - a[1]) / 2}
        stroke={stroke.color}
        strokeWidth={width}
        fill="none"
      />
    );
  }
  if (stroke.tool === 'free') {
    return (
      <Polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        stroke={stroke.color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }
  // Seta: linha + ponta triangular.
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const head = Math.max(12, w * 0.03);
  const left = [b[0] - head * Math.cos(angle - 0.45), b[1] - head * Math.sin(angle - 0.45)];
  const right = [b[0] - head * Math.cos(angle + 0.45), b[1] - head * Math.sin(angle + 0.45)];
  const base = [b[0] - head * 0.8 * Math.cos(angle), b[1] - head * 0.8 * Math.sin(angle)];
  return (
    <>
      <Line x1={a[0]} y1={a[1]} x2={base[0]} y2={base[1]} stroke={stroke.color} strokeWidth={width} strokeLinecap="round" />
      <Polygon points={`${b[0]},${b[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`} fill={stroke.color} />
    </>
  );
}

function ScrubBar({
  currentMs,
  durationMs,
  trim,
  moments,
  onSeek,
}: {
  currentMs: number;
  durationMs: number;
  trim: { startMs: number; endMs: number } | null;
  moments: Moment[];
  onSeek: (ms: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const seekAt = (x: number) => durationMs > 0 && onSeek((Math.max(0, Math.min(x, width)) / width) * durationMs);
  const ref = useRef({ seekAt });
  ref.current = { seekAt };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => ref.current.seekAt(e.nativeEvent.locationX),
        onPanResponderMove: (e) => ref.current.seekAt(e.nativeEvent.locationX),
      }),
    []
  );
  const pct = (ms: number) => `${durationMs > 0 ? (ms / durationMs) * 100 : 0}%` as const;
  return (
    <View style={styles.scrub} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View style={styles.scrubTrack} pointerEvents="none">
        {trim ? (
          <View style={[styles.scrubTrim, { left: pct(trim.startMs), width: pct(trim.endMs - trim.startMs) }]} />
        ) : null}
        <View style={[styles.scrubFill, { width: pct(currentMs) }]} />
        {moments.map((m) => (
          <View key={m.atMs} style={[styles.scrubMoment, { left: pct(m.atMs) }]} />
        ))}
      </View>
    </View>
  );
}

/** Barra do corte: duas pegas para arrastar (início e fim) e a imagem acompanha a pega. */
function TrimBar({
  currentMs,
  durationMs,
  trim,
  onDrag,
  onRelease,
  onSeek,
}: {
  currentMs: number;
  durationMs: number;
  trim: { startMs: number; endMs: number };
  onDrag: (which: 'start' | 'end', ms: number) => void;
  onRelease: () => void;
  onSeek: (ms: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const ref = useRef({ width, durationMs, trim, onDrag, onRelease, onSeek });
  ref.current = { width, durationMs, trim, onDrag, onRelease, onSeek };
  const pan = useMemo(() => {
    let which: 'start' | 'end' | null = null;
    const msAt = (x: number) => {
      const r = ref.current;
      return (Math.max(0, Math.min(x - HANDLE_W, r.width - 2 * HANDLE_W)) / Math.max(1, r.width - 2 * HANDLE_W)) * r.durationMs;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const r = ref.current;
        const ms = msAt(e.nativeEvent.locationX);
        // Toca na pega mais próxima; no meio, longe das duas, só muda a imagem.
        const toPx = (t: number) => (t / Math.max(1, r.durationMs)) * (r.width - 2 * HANDLE_W) + HANDLE_W;
        const dStart = Math.abs(e.nativeEvent.locationX - toPx(r.trim.startMs));
        const dEnd = Math.abs(e.nativeEvent.locationX - toPx(r.trim.endMs));
        which = Math.min(dStart, dEnd) > 48 ? null : dStart <= dEnd ? 'start' : 'end';
        if (which) r.onDrag(which, ms);
        else r.onSeek(ms);
      },
      onPanResponderMove: (e) => {
        const ms = msAt(e.nativeEvent.locationX);
        if (which) ref.current.onDrag(which, ms);
        else ref.current.onSeek(ms);
      },
      onPanResponderRelease: () => {
        if (which) ref.current.onRelease();
        which = null;
      },
      onPanResponderTerminate: () => {
        if (which) ref.current.onRelease();
        which = null;
      },
    });
  }, []);
  const inner = Math.max(1, width - 2 * HANDLE_W);
  const x = (ms: number) => HANDLE_W + (ms / Math.max(1, durationMs)) * inner;
  const sx = x(trim.startMs);
  const ex = x(trim.endMs);
  return (
    <View style={styles.trimBar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.trimTrack, { left: HANDLE_W, right: HANDLE_W }]} />
        {/* Fora do corte: escurecido. */}
        <View style={[styles.trimOut, { left: HANDLE_W, width: Math.max(0, sx - HANDLE_W) }]} />
        <View style={[styles.trimOut, { left: ex, width: Math.max(0, width - HANDLE_W - ex) }]} />
        <View style={[styles.trimIn, { left: sx, width: Math.max(0, ex - sx) }]} />
        <View style={[styles.trimHandle, { left: sx - HANDLE_W }]}>
          <Text style={styles.trimGrip}>[</Text>
        </View>
        <View style={[styles.trimHandle, { left: ex }]}>
          <Text style={styles.trimGrip}>]</Text>
        </View>
        <View style={[styles.trimHead, { left: x(currentMs) - 1 }]} />
      </View>
    </View>
  );
}

const HANDLE_W = 22;

function Btn({
  label,
  onPress,
  on,
  primary,
  big,
}: {
  label: string;
  onPress: () => void;
  on?: boolean;
  primary?: boolean;
  big?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        big && styles.btnBig,
        (on || primary) && { backgroundColor: colors.accent },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.btnText, big && { fontSize: 22 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  videoArea: { flex: 1 },
  videoBox: { position: 'absolute', overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    top: space(1),
    left: space(1),
    right: space(1),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
  },
  title: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15, textShadowColor: '#000', textShadowRadius: 4 },
  motiveChip: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space(1.5),
    paddingVertical: 6,
  },
  motiveText: { color: colors.text, fontWeight: '700' },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  momentHint: {
    position: 'absolute',
    bottom: space(1),
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: space(1.5),
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontWeight: '700',
  },
  scrub: { height: 34, justifyContent: 'center', paddingHorizontal: 0, backgroundColor: colors.surface },
  scrubTrack: { height: 8, marginHorizontal: space(1), backgroundColor: colors.surfaceHigh, borderRadius: 4 },
  scrubTrim: { position: 'absolute', top: -4, bottom: -4, backgroundColor: 'rgba(255,122,26,0.25)', borderRadius: 4 },
  scrubFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 4 },
  scrubMoment: { position: 'absolute', top: -6, width: 4, height: 20, marginLeft: -2, backgroundColor: '#FFD60A', borderRadius: 2 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space(1),
    padding: space(1),
    backgroundColor: colors.surfaceHigh,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space(1),
    padding: space(1),
    backgroundColor: colors.surface,
  },
  sep: { width: space(1) },
  btn: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: space(1.5),
    borderRadius: radius.s,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBig: { minWidth: 72, minHeight: 52 },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.accent, transform: [{ scale: 1.15 }] },
  info: { color: colors.text, fontWeight: '700' },
  infoMuted: { color: colors.muted, fontWeight: '600' },
  pen: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  zoomChip: {
    position: 'absolute',
    bottom: space(1),
    left: space(1),
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.pill,
    paddingHorizontal: space(1.5),
    paddingVertical: 8,
  },
  zoomText: { color: '#fff', fontWeight: '700' },
  trimBar: { height: 56, backgroundColor: colors.surface },
  trimTrack: { position: 'absolute', top: 10, bottom: 10, backgroundColor: colors.surfaceHigh, borderRadius: 4 },
  trimOut: { position: 'absolute', top: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  trimIn: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,122,26,0.18)',
  },
  trimHandle: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: HANDLE_W,
    backgroundColor: colors.accent,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimGrip: { color: '#fff', fontWeight: '900', fontSize: 18 },
  trimHead: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' },
  time: { color: colors.muted, fontVariant: ['tabular-nums'], marginRight: space(1) },
});
