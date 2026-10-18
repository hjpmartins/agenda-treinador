import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRESET_SECONDS } from '../lib/clipRange';
import { formatClock, formatDateTime, formatDuration } from '../lib/format';
import { getNotes, setNotes, useNotesVersion } from '../remote/notesStore';
import { ReviewClient, type PhoneGame, type ReviewClip } from '../remote/ReviewClient';
import { colors, radius, space } from '../theme';
import { MotiveChips } from './MotivePicker';
import { PlayerChips, playersShort } from './PlayerPicker';
import { toneBackground, ToneChips } from './Tone';
import { Button } from './ui';

/**
 * Rever um jogo já gravado: o vídeo completo passa a partir do telemóvel (sem o
 * copiar para o tablet) e os botões 15/25/45/60 pedem o clip dos últimos
 * segundos a partir do ponto onde se está a ver.
 */
export function ReviewGame({
  baseUrl,
  token,
  phoneName,
  onClose,
}: {
  baseUrl: string;
  token: string;
  phoneName: string;
  onClose: () => void;
}) {
  const [games, setGames] = useState<PhoneGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<PhoneGame | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    ReviewClient.listGames(baseUrl, token)
      .then(setGames)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [baseUrl, token]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        {game ? (
          <GameView key={game.id} baseUrl={baseUrl} token={token} phoneName={phoneName} game={game} onBack={() => setGame(null)} />
        ) : (
          <View style={styles.pick}>
            <View style={styles.pickHeader}>
              <Text style={styles.h1}>Rever jogo</Text>
              <Button label="Fechar" variant="ghost" onPress={onClose} />
            </View>
            <Text style={styles.muted}>
              O vídeo passa a partir do telemóvel (não ocupa espaço no tablet). Os clips que pedires ficam na lista de clips
              desse jogo, como os outros.
            </Text>
            {error ? <Text style={styles.warn}>{error}</Text> : null}
            {games == null && !error ? <ActivityIndicator color={colors.accent} /> : null}
            {games?.length === 0 ? <Text style={styles.muted}>Não há jogos terminados neste telemóvel.</Text> : null}
            <ScrollView contentContainerStyle={{ gap: space(1) }}>
              {games?.map((g) => (
                <Button
                  key={g.id}
                  label={`Jogo de ${formatDateTime(g.startedAtMs)}`}
                  sublabel={`${formatClock(g.durationMs)} · ${g.quality} · ${g.clips} clip${g.clips === 1 ? '' : 's'}`}
                  variant="primary"
                  size="l"
                  onPress={() => setGame(g)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const RATES = [0.5, 1, 2];

function GameView({
  baseUrl,
  token,
  phoneName,
  game,
  onBack,
}: {
  baseUrl: string;
  token: string;
  phoneName: string;
  game: PhoneGame;
  onBack: () => void;
}) {
  const client = useMemo(() => new ReviewClient(baseUrl, token, game, phoneName), [baseUrl, token, game, phoneName]);
  const [clips, setClips] = useState<ReviewClip[]>([]);
  const [part, setPart] = useState(0);
  const [tagging, setTagging] = useState<string | null>(null);
  useEffect(() => {
    client.start();
    const unsub = client.subscribe(setClips);
    return () => {
      unsub();
      client.stop();
    };
  }, [client]);
  const p = game.parts[part] ?? game.parts[0];

  return (
    <View style={styles.gameRoot}>
      <View style={styles.flex}>
        <PartPlayer
          key={part}
          url={client.videoUrl(p.index)}
          partStartMs={p.startMs}
          totalMs={game.durationMs}
          onClip={(startMs, endMs) => setTagging(client.requestClip(startMs, endMs))}
          header={
            <View style={styles.topBar}>
              <Button label="‹ Jogos" variant="ghost" onPress={onBack} />
              <Text style={styles.title} numberOfLines={1}>
                Jogo de {formatDateTime(game.startedAtMs)}
              </Text>
              {game.parts.length > 1
                ? game.parts.map((x, i) => (
                    <Button key={x.index} label={`Parte ${i + 1}`} variant={i === part ? 'primary' : 'secondary'} onPress={() => setPart(i)} />
                  ))
                : null}
            </View>
          }
        />
      </View>
      <View style={styles.side}>
        {tagging ? (
          <TagPanel id={tagging} onDone={() => setTagging(null)} />
        ) : (
          <>
            <Text style={styles.h2}>Clips pedidos</Text>
            <ScrollView contentContainerStyle={{ gap: space(1) }}>
              {clips.length === 0 ? (
                <Text style={styles.muted}>Carrega em 15s/25s/45s/60s para fazer um clip dos últimos segundos do que estás a ver.</Text>
              ) : null}
              {[...clips].reverse().map((c) => (
                <ClipLine key={c.id} clip={c} onTag={() => setTagging(c.id)} />
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

/** Leitor de uma parte do vídeo completo (a partir do telemóvel). */
function PartPlayer({
  url,
  partStartMs,
  totalMs,
  onClip,
  header,
}: {
  url: string;
  partStartMs: number;
  totalMs: number;
  onClip: (startMs: number, endMs: number) => void;
  header: ReactNode;
}) {
  const player = useVideoPlayer(url, (pl) => {
    pl.timeUpdateEventInterval = 0.25;
    pl.preservesPitch = false;
    pl.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [curMs, setCurMs] = useState(0);
  const [durMs, setDurMs] = useState(0);
  const [rate, setRate] = useState(1);
  const [mark, setMark] = useState<number | null>(null);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => setCurMs(Math.round(currentTime * 1000)));
  useEventListener(player, 'statusChange', ({ status: st }) => {
    if (st === 'readyToPlay' && player.duration > 0) setDurMs(Math.round(player.duration * 1000));
  });
  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);

  const seek = (ms: number) => {
    const t = Math.max(0, Math.min(ms, durMs || ms));
    player.currentTime = t / 1000;
    setCurMs(t);
  };
  /** Tempo de jogo onde se está a ver. */
  const gameMs = partStartMs + (player.currentTime > 0 ? player.currentTime * 1000 : curMs);
  const last = (seconds: number) => {
    const end = Math.min(gameMs, totalMs);
    onClip(Math.max(partStartMs, end - seconds * 1000), end);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.video}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        {status === 'loading' || (status === 'idle' && durMs === 0) ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.muted}>A abrir o vídeo do telemóvel…</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <View style={styles.loading} pointerEvents="none">
            <Text style={styles.warn}>Não foi possível ver o vídeo. Confirma a ligação ao telemóvel.</Text>
          </View>
        ) : null}
        {header}
      </View>
      <Scrub currentMs={curMs} durationMs={durMs} onSeek={seek} />
      <View style={styles.controls}>
        <Btn label="−10s" onPress={() => seek(curMs - 10_000)} />
        <Btn label="−3s" onPress={() => seek(curMs - 3_000)} />
        <Btn label={isPlaying ? '❚❚' : '▶'} primary onPress={() => (isPlaying ? player.pause() : player.play())} />
        <Btn label="+3s" onPress={() => seek(curMs + 3_000)} />
        <Btn label="+10s" onPress={() => seek(curMs + 10_000)} />
        {RATES.map((r) => (
          <Btn key={r} label={`${String(r).replace('.', ',')}x`} on={rate === r} onPress={() => setRate(r)} />
        ))}
        <View style={styles.flex} />
        <Text style={styles.time}>
          {formatClock(gameMs)} / {formatClock(totalMs)}
        </Text>
      </View>
      <View style={styles.clipRow}>
        {PRESET_SECONDS.map((s) => (
          <Pressable key={s} onPress={() => last(s)} style={({ pressed }) => [styles.preset, pressed && { opacity: 0.75 }]}>
            <Text style={styles.presetSmall}>últimos</Text>
            <Text style={styles.presetBig}>{s}s</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            if (mark == null) setMark(gameMs);
            else {
              onClip(Math.min(mark, gameMs), Math.max(mark, gameMs));
              setMark(null);
            }
          }}
          onLongPress={() => setMark(null)}
          style={({ pressed }) => [styles.preset, styles.markBtn, mark != null && styles.markOn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.presetSmall}>{mark == null ? 'marcar' : `início ${formatClock(mark)}`}</Text>
          <Text style={styles.presetMark}>{mark == null ? 'Início' : 'Fim'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Tipo, motivo, jogadoras e título do clip acabado de pedir. */
function TagPanel({ id, onDone }: { id: string; onDone: () => void }) {
  useNotesVersion();
  const n = getNotes(id);
  const [title, setTitle] = useState(n.title ?? '');
  return (
    <ScrollView contentContainerStyle={{ gap: space(1.5) }}>
      <View style={styles.tagHeader}>
        <Text style={[styles.h2, styles.flex]}>Clip pedido ✓</Text>
        <Button
          label="✓ Feito"
          variant="primary"
          onPress={() => {
            setNotes(id, { title: title.trim() || null });
            onDone();
          }}
        />
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onEndEditing={() => setNotes(id, { title: title.trim() || null })}
        placeholder="Título (opcional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <ToneChips value={n.tone ?? null} onChange={(tone) => setNotes(id, { tone })} />
      <MotiveChips value={n.motive ?? null} onChange={(motive) => setNotes(id, { motive })} />
      <PlayerChips value={n.players ?? []} onChange={(players) => setNotes(id, { players })} />
    </ScrollView>
  );
}

const STATUS: Record<ReviewClip['status'], string> = {
  queued: 'A pedir…',
  pending: 'À espera',
  cutting: 'A cortar',
  ready: 'A copiar…',
  failed: 'Falhou',
};

function ClipLine({ clip, onTag }: { clip: ReviewClip; onTag: () => void }) {
  useNotesVersion();
  const n = getNotes(clip.id);
  const st = clip.localUri ? 'No tablet ✓' : STATUS[clip.status];
  return (
    <Pressable onPress={onTag} style={[styles.clipLine, toneBackground(n.tone)]}>
      <Text style={styles.clipName} numberOfLines={1}>
        {n.title?.trim() || clip.name} · {formatClock(clip.startMs)} ({formatDuration(clip.endMs - clip.startMs)})
      </Text>
      <Text style={styles.muted} numberOfLines={1}>
        {[n.motive, playersShort(n.players)].filter(Boolean).join(' · ') || 'toca para marcar'} · {st}
      </Text>
      {clip.error ? <Text style={styles.warn}>{clip.error}</Text> : null}
    </Pressable>
  );
}

function Scrub({ currentMs, durationMs, onSeek }: { currentMs: number; durationMs: number; onSeek: (ms: number) => void }) {
  const [width, setWidth] = useState(1);
  const ref = useRef({ width, durationMs, onSeek });
  ref.current = { width, durationMs, onSeek };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
        onPanResponderMove: (e) => at(e.nativeEvent.locationX),
      }),
    []
  );
  function at(x: number) {
    const r = ref.current;
    if (r.durationMs > 0) r.onSeek((Math.max(0, Math.min(x, r.width)) / r.width) * r.durationMs);
  }
  const pct = `${durationMs > 0 ? (currentMs / durationMs) * 100 : 0}%` as const;
  return (
    <View style={styles.scrub} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View style={styles.scrubTrack} pointerEvents="none">
        <View style={[styles.scrubFill, { width: pct }]} />
      </View>
    </View>
  );
}

function Btn({ label, onPress, on, primary }: { label: string; onPress: () => void; on?: boolean; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, (on || primary) && { backgroundColor: colors.accent }, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  pick: { flex: 1, padding: space(3), gap: space(2), backgroundColor: colors.bg },
  pickHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  warn: { color: colors.warn, fontSize: 14, textAlign: 'center' },
  gameRoot: { flex: 1, flexDirection: 'row' },
  side: { width: 320, backgroundColor: colors.surface, padding: space(1.5), gap: space(1) },
  video: { flex: 1, backgroundColor: '#000' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space(1), padding: space(2) },
  topBar: { position: 'absolute', top: space(1), left: space(1), right: space(1), flexDirection: 'row', alignItems: 'center', gap: space(1) },
  title: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15, textShadowColor: '#000', textShadowRadius: 4 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space(1),
    paddingHorizontal: space(1),
    paddingBottom: space(1),
    backgroundColor: colors.surface,
  },
  time: { color: colors.muted, fontVariant: ['tabular-nums'] },
  clipRow: { flexDirection: 'row', gap: space(1), padding: space(1), backgroundColor: colors.surface },
  preset: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.m,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetSmall: { color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.9 },
  presetBig: { color: '#fff', fontSize: 28, fontWeight: '900' },
  presetMark: { color: '#fff', fontSize: 20, fontWeight: '900' },
  markBtn: { backgroundColor: colors.surfaceHigh },
  markOn: { backgroundColor: '#1E6FE0' },
  scrub: { height: 34, justifyContent: 'center', backgroundColor: colors.surface },
  scrubTrack: { height: 8, marginHorizontal: space(1), backgroundColor: colors.surfaceHigh, borderRadius: 4 },
  scrubFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 4 },
  btn: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: space(1.5),
    borderRadius: radius.s,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  tagHeader: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  input: {
    height: 46,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.s,
    paddingHorizontal: space(1.5),
    fontSize: 16,
  },
  clipLine: {
    gap: 2,
    padding: space(1),
    borderRadius: radius.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  clipName: { color: colors.text, fontWeight: '700' },
});
