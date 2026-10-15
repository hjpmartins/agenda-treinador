import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ClipEngine } from '../../modules/clip-engine';
import { PlayerModal, run, saveToGallery, share } from '../components/media';
import { Button, Card, Chip } from '../components/ui';
import { ADJUST_STEP_MS, fromMarks, lastSeconds, normalize, PRESET_SECONDS, type ClipRange } from '../lib/clipRange';
import { formatClock, formatDuration, formatHoursMinutes, recordingTimeLeftMs } from '../lib/format';
import { loadLastPairing } from '../remote/persist';
import { decodePairing, type Pairing } from '../remote/pairing';
import { RemoteClient, type RemoteClip, type RemoteSnapshot } from '../remote/RemoteClient';
import { colors, radius, space } from '../theme';

type Props = { onBack: () => void };

const AUTO_SEND_SECONDS = 5;

/** Ecrã dividido / janela baixa: botões numa linha, tudo mais pequeno. */
function useLayout() {
  const { width, height } = useWindowDimensions();
  const compact = height < 620;
  const stacked = width < 640;
  return { compact, stacked, sideWidth: compact ? Math.min(340, Math.max(260, width * 0.34)) : 340 };
}

export function RemoteScreen({ onBack }: Props) {
  useKeepAwake();
  const [client, setClient] = useState<RemoteClient | null>(null);

  // Sem rotação forçada: o tablet pode estar na vertical com o ecrã dividido
  // (ex.: estatísticas noutra app); o ecrã adapta-se ao espaço disponível.
  useEffect(() => () => client?.stop(), [client]);

  const disconnect = useCallback(() => {
    client?.stop();
    setClient(null);
  }, [client]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (client) {
        Alert.alert('Desligar do telemóvel?', 'Os clips continuam a ser gravados no telemóvel.', [
          { text: 'Ficar', style: 'cancel' },
          { text: 'Desligar', style: 'destructive', onPress: disconnect },
        ]);
      } else {
        onBack();
      }
      return true;
    });
    return () => sub.remove();
  }, [client, disconnect, onBack]);

  const onPaired = useCallback((pairing: Pairing) => {
    const c = new RemoteClient(pairing);
    setClient(c);
    c.start();
  }, []);

  return client ? (
    <CommandView client={client} onDisconnect={disconnect} />
  ) : (
    <ScanView onPaired={onPaired} onBack={onBack} />
  );
}

// ======================================================================== leitura do QR

function ScanView({ onPaired, onBack }: { onPaired: (p: Pairing) => void; onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const handled = useRef(false);
  const [last] = useState(() => loadLastPairing());

  if (!permission) return <View style={styles.root} />;

  return (
    <View style={[styles.root, styles.row]}>
      <View style={styles.scanCamera}>
        {permission.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              const pairing = decodePairing(data);
              if (!pairing) {
                setInvalid(true);
                return;
              }
              handled.current = true;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onPaired(pairing);
            }}
          />
        ) : (
          <View style={styles.center}>
            <Button label="Permitir câmara para ler o QR" variant="primary" size="l" onPress={requestPermission} />
          </View>
        )}
        <View style={styles.scanFrame} pointerEvents="none" />
      </View>
      <View style={styles.scanSide}>
        <Text style={styles.h1}>Ligar ao telemóvel</Text>
        <Text style={styles.body}>
          1. No telemóvel que grava: <Text style={styles.strong}>Gravar → Ligar tablet</Text>.{'\n'}
          2. Aponta este tablet para o QR que aparece no telemóvel.{'\n'}
          3. Se o Android perguntar, confirma a ligação à rede do telemóvel.
        </Text>
        {invalid ? <Text style={styles.warn}>Este QR não é da app Clips de Jogo.</Text> : null}
        {last ? (
          <Button
            label="Ligar ao último telemóvel"
            sublabel={last.ssid ? `Rede ${last.ssid}` : last.ips[0]}
            variant="primary"
            onPress={() => {
              handled.current = true;
              onPaired(last);
            }}
          />
        ) : null}
        <Button label="Voltar" variant="ghost" onPress={onBack} />
      </View>
    </View>
  );
}

// ======================================================================== comando

type Draft = ClipRange & { name: string; createdAt: number };

function CommandView({ client, onDisconnect }: { client: RemoteClient; onDisconnect: () => void }) {
  const [snap, setSnap] = useState<RemoteSnapshot>({
    connection: 'joining',
    error: null,
    phone: null,
    clips: [],
    recording: false,
    notRecordingReason: null,
  });
  const [recMs, setRecMs] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ uri: string; title: string } | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => client.subscribe(setSnap), [client]);
  useEffect(() => {
    const t = setInterval(() => setRecMs(client.recordingTimeNow()), 200);
    return () => clearInterval(t);
  }, [client]);

  const recording = snap.recording && recMs != null;
  const connected = snap.connection === 'connected';

  const feedback = useCallback(
    (text: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setFlash(text);
      pulse.setValue(1);
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }).start();
      setTimeout(() => setFlash((f) => (f === text ? null : f)), 1500);
    },
    [pulse]
  );

  const send = useCallback(
    (d: Draft) => {
      client.requestClip(d.startMs, d.endMs, d.name);
      setDraft(null);
      setCountdown(null);
      feedback(`Clip pedido · ${formatDuration(d.endMs - d.startMs)}`);
    },
    [client, feedback]
  );

  // Envio automático do rascunho (qualquer ajuste pausa a contagem).
  useEffect(() => {
    if (!draft || countdown == null) return;
    if (countdown <= 0) {
      send(draft);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [draft, countdown, send]);

  const newDraft = useCallback(
    (range: ClipRange) => {
      // Se já havia um rascunho por enviar, envia-o antes de criar o novo.
      if (draft) client.requestClip(draft.startMs, draft.endMs, draft.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setDraft({ ...range, name: '', createdAt: Date.now() });
      setCountdown(AUTO_SEND_SECONDS);
    },
    [client, draft]
  );

  const preset = (seconds: number) => {
    const now = client.recordingTimeNow();
    if (now == null) return;
    newDraft(lastSeconds(now, seconds));
  };

  const mark = () => {
    const now = client.recordingTimeNow();
    if (now == null) return;
    if (markStart == null) {
      setMarkStart(now);
      feedback(`Início marcado · ${formatClock(now)}`);
    } else {
      newDraft(fromMarks(markStart, now));
      setMarkStart(null);
    }
  };

  const adjust = (which: 'start' | 'end', delta: number) => {
    setCountdown(null);
    setDraft((d) => {
      if (!d) return d;
      const next = which === 'start' ? { ...d, startMs: d.startMs + delta } : { ...d, endMs: d.endMs + delta };
      return { ...next, ...normalize(next) };
    });
  };

  const connectionChip =
    snap.connection === 'connected'
      ? { label: `Ligado · ${snap.phone?.device ?? 'telemóvel'}`, tone: 'ok' as const }
      : snap.connection === 'joining'
        ? { label: 'A ligar à rede do telemóvel…', tone: 'warn' as const }
        : snap.connection === 'connecting'
          ? { label: 'À procura do telemóvel…', tone: 'warn' as const }
          : { label: 'Sem ligação — a tentar de novo', tone: 'danger' as const };

  // Barra flutuante: fica por cima de outras apps (ex.: estatísticas) quando esta sai do ecrã.
  const [floatingOn, setFloatingOn] = useState(false);
  useEffect(() => () => ClipEngine?.disarmFloatingBar(), []);
  const openFloating = () => {
    if (!ClipEngine) return;
    if (floatingOn) {
      ClipEngine.disarmFloatingBar();
      setFloatingOn(false);
      return;
    }
    if (!ClipEngine.canDrawOverlays()) {
      Alert.alert(
        'Falta uma autorização',
        'Para a barra aparecer por cima da app das estatísticas, ativa "Mostrar sobre outras apps" para o Clips de Jogo. Depois volta aqui e carrega outra vez em "Barra flutuante".',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir definições', onPress: () => ClipEngine?.openOverlayPermissionSettings() },
        ]
      );
      return;
    }
    ClipEngine.armFloatingBar(client.phoneUrls, client.pairing.token);
    setFloatingOn(true);
    ClipEngine.moveToBackground();
  };

  const canClip = recording;
  const queued = snap.clips.filter((c) => c.status === 'queued').length;
  const { compact, stacked, sideWidth } = useLayout();

  return (
    <View style={[styles.root, !stacked && styles.row]}>
      {/* ---------------------------------------------------- comandos */}
      <View style={[styles.main, compact && styles.mainCompact, stacked && styles.mainStacked]}>
        <View style={[styles.topBar, compact && styles.topBarCompact]}>
          <View style={[styles.timerBox, compact && styles.timerBoxCompact]}>
            {recording ? <View style={[styles.recDot, compact && styles.recDotCompact]} /> : null}
            <Text style={[styles.timer, compact && styles.timerCompact]}>{recording ? formatClock(recMs!) : '--:--'}</Text>
          </View>
          <View style={styles.chips}>
            <Chip label={connectionChip.label} tone={connectionChip.tone} />
            {connected && !recording ? (
              <Chip label={snap.notRecordingReason ?? 'A sincronizar com o telemóvel…'} tone="warn" />
            ) : null}
            {snap.phone?.batteryPercent != null ? (
              <Chip
                label={`Telemóvel ${snap.phone.batteryPercent}%${snap.phone.charging ? ' ⚡' : ''}`}
                tone={snap.phone.charging || snap.phone.batteryPercent >= 30 ? 'neutral' : 'warn'}
              />
            ) : null}
            {snap.phone?.freeBytes != null && snap.phone.bytesPerSecond ? (
              (() => {
                const left = recordingTimeLeftMs(snap.phone.freeBytes, snap.phone.bytesPerSecond);
                return left < 60 * 60_000 ? (
                  <Chip label={`Espaço no telemóvel: ${formatHoursMinutes(left)}`} tone={left < 20 * 60_000 ? 'danger' : 'warn'} />
                ) : null;
              })()
            ) : null}
            {snap.phone?.thermal && snap.phone.thermal !== 'normal' ? (
              <Chip label={snap.phone.thermal === 'critico' ? 'Telemóvel muito quente!' : 'Telemóvel quente'} tone={snap.phone.thermal === 'critico' ? 'danger' : 'warn'} />
            ) : null}
            {queued > 0 ? <Chip label={`${queued} na fila`} tone="warn" /> : null}
          </View>
        </View>

        {draft ? (
          <DraftPanel
            compact={compact}
            draft={draft}
            countdown={countdown}
            onAdjust={adjust}
            onName={(name) => {
              setCountdown(null);
              setDraft((d) => (d ? { ...d, name } : d));
            }}
            onCancel={() => {
              setDraft(null);
              setCountdown(null);
            }}
            onSend={() => send(draft)}
          />
        ) : null}

        <View style={[styles.presets, !compact && !stacked && styles.flex, compact && styles.presetsCompact]}>
          {PRESET_SECONDS.map((s) => (
            <Pressable
              key={s}
              disabled={!canClip}
              onPress={() => preset(s)}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              style={({ pressed }) => [
                styles.preset,
                compact && styles.presetCompact,
                { opacity: !canClip ? 0.35 : pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.presetSmall, compact && styles.presetSmallCompact]}>
                {compact ? 'últimos' : 'Clip dos últimos'}
              </Text>
              <Text style={[styles.presetBig, compact && styles.presetBigCompact]}>{s}s</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <Button
            label={markStart == null ? 'Marcar início' : `Marcar fim (início ${formatClock(markStart)})`}
            variant={markStart == null ? 'secondary' : 'primary'}
            size={compact ? 'm' : 'l'}
            disabled={!canClip}
            onPress={mark}
            style={styles.flex}
          />
          {markStart != null ? (
            <Button label="Cancelar marca" variant="ghost" size={compact ? 'm' : 'l'} onPress={() => setMarkStart(null)} />
          ) : null}
        </View>

        {flash ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flash,
              { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
            ]}
          >
            <Text style={styles.flashText}>{flash}</Text>
          </Animated.View>
        ) : null}
      </View>

      {/* ---------------------------------------------------- lista de clips */}
      <View style={[styles.side, compact && styles.sideCompact, stacked ? styles.sideStacked : { width: sideWidth }]}>
        <View style={styles.sideHeader}>
          <Text style={styles.h2}>Clips</Text>
          <Button label="Desligar" variant="ghost" onPress={onDisconnect} style={compact && styles.smallButton} />
        </View>
        <Button
          label={floatingOn ? 'Barra flutuante: ligada' : 'Barra flutuante'}
          sublabel={floatingOn ? 'Aparece quando sais desta app · toca para desligar' : 'Pede clips por cima de outra app'}
          variant={floatingOn ? 'primary' : 'secondary'}
          onPress={openFloating}
        />
        {snap.error && !connected ? (
          <Card style={styles.helpCard}>
            <Text style={styles.warn}>{snap.error}</Text>
            {client.pairing.ssid ? (
              <Text style={styles.muted}>
                Liga a Localização deste tablet e volta a ler o QR. Ou liga-te à mão em Definições → Wi-Fi:{'\n'}
                Rede <Text style={styles.strong}>{client.pairing.ssid}</Text>
                {'\n'}Palavra-passe <Text style={styles.strong}>{client.pairing.passphrase}</Text>
                {'\n'}A app continua a procurar o telemóvel e liga-se sozinha.
              </Text>
            ) : null}
          </Card>
        ) : null}
        <FlatList
          data={[...snap.clips].reverse()}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Text style={styles.muted}>Os clips pedidos aparecem aqui.</Text>}
          contentContainerStyle={{ gap: space(1) }}
          renderItem={({ item }) => (
            <ClipRow clip={item} compact={compact} onPlay={(uri) => setPlaying({ uri, title: item.name })} />
          )}
        />
      </View>

      {playing ? <PlayerModal uri={playing.uri} title={playing.title} onClose={() => setPlaying(null)} /> : null}
    </View>
  );
}

function DraftPanel({
  compact,
  draft,
  countdown,
  onAdjust,
  onName,
  onCancel,
  onSend,
}: {
  compact: boolean;
  draft: Draft;
  countdown: number | null;
  onAdjust: (which: 'start' | 'end', delta: number) => void;
  onName: (name: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <Card style={[styles.draft, compact && styles.draftCompact]}>
      <View style={styles.draftRow}>
        <Text style={[styles.draftTitle, compact && styles.draftTitleCompact]}>
          {formatClock(draft.startMs)} → {formatClock(draft.endMs)}{' '}
          <Text style={styles.muted}>({formatDuration(draft.endMs - draft.startMs)})</Text>
        </Text>
        <TextInput
          value={draft.name}
          onChangeText={onName}
          placeholder="Nome (opcional) ex.: Triplo #7"
          placeholderTextColor={colors.muted}
          style={[styles.nameInput, compact && styles.nameInputCompact]}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
      </View>
      <View style={[styles.draftRow, styles.wrap]}>
        <Text style={styles.label}>Início</Text>
        <Button label="−5s" onPress={() => onAdjust('start', -ADJUST_STEP_MS)} />
        <Button label="+5s" onPress={() => onAdjust('start', ADJUST_STEP_MS)} />
        <View style={{ width: compact ? space(1) : space(2) }} />
        <Text style={styles.label}>Fim</Text>
        <Button label="−5s" onPress={() => onAdjust('end', -ADJUST_STEP_MS)} />
        <Button label="+5s" onPress={() => onAdjust('end', ADJUST_STEP_MS)} />
        <View style={styles.flex} />
        <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        <Button label={countdown != null ? `Enviar (${countdown})` : 'Enviar'} variant="primary" onPress={onSend} />
      </View>
    </Card>
  );
}

const CLIP_STATUS: Record<RemoteClip['status'], { label: string; color: string }> = {
  queued: { label: 'Na fila', color: colors.warn },
  pending: { label: 'À espera', color: colors.accent },
  cutting: { label: 'A processar', color: colors.accent },
  ready: { label: 'Pronto', color: colors.ok },
  failed: { label: 'Falhou', color: colors.danger },
};

function ClipRow({ clip, compact, onPlay }: { clip: RemoteClip; compact: boolean; onPlay: (uri: string) => void }) {
  const local = clip.localUri;
  const transferring = clip.transfer != null;
  const st = local
    ? { label: 'No tablet ✓', color: colors.ok }
    : transferring
      ? { label: `A transferir ${Math.round((clip.transfer ?? 0) * 100)}%`, color: colors.accent }
      : clip.status === 'ready'
        ? { label: 'Pronto', color: colors.accent }
        : CLIP_STATUS[clip.status];
  const busy = !local && clip.status !== 'failed';
  return (
    <View style={styles.clipRow}>
      <View style={styles.clipHeader}>
        <View style={styles.flex}>
          <Text style={styles.clipName} numberOfLines={1}>
            {clip.name}
          </Text>
          <Text style={styles.muted}>
            {formatClock(clip.startMs)} – {formatClock(clip.endMs)}
          </Text>
          {clip.error ? <Text style={styles.warn}>{clip.error}</Text> : null}
        </View>
        <View style={[styles.badge, { borderColor: st.color }]}>
          {busy ? <ActivityIndicator size="small" color={st.color} /> : null}
          <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      {local ? (
        <View style={styles.clipActions}>
          <Button label="▶ Ver" onPress={() => onPlay(local)} style={[styles.flex, compact && styles.smallButton]} />
          <Button label="Galeria" onPress={() => run(() => saveToGallery(local))} style={[styles.flex, compact && styles.smallButton]} />
          <Button label="Partilhar" onPress={() => run(() => share(local))} style={[styles.flex, compact && styles.smallButton]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  smallButton: { minHeight: 38, paddingHorizontal: space(1) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 26 },
  strong: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  warn: { color: colors.warn, fontSize: 14 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '700' },

  scanCamera: { flex: 1, backgroundColor: '#000' },
  scanFrame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '20%',
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: radius.l,
  },
  scanSide: { width: 380, padding: space(3), gap: space(2), justifyContent: 'center', backgroundColor: colors.surface },

  main: { flex: 1, padding: space(2), gap: space(2) },
  mainCompact: { padding: space(1), gap: space(1) },
  mainStacked: { flex: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  topBarCompact: { gap: space(1) },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  timerBoxCompact: { paddingHorizontal: space(1.5), paddingVertical: 4, borderRadius: radius.s },
  recDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.rec, marginRight: space(1.5) },
  recDotCompact: { width: 10, height: 10, borderRadius: 5, marginRight: space(1) },
  timer: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerCompact: { fontSize: 24 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  // Uma linha de 4, ocupa a altura que sobrar (mín. 64, máx. 140).
  presetsCompact: { flex: 1, flexWrap: 'nowrap', gap: space(1), minHeight: 64, maxHeight: 140 },
  preset: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 110,
    backgroundColor: colors.accent,
    borderRadius: radius.l,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  presetCompact: { flexBasis: 0, minHeight: 64, borderRadius: radius.m },
  presetSmall: { color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 },
  presetSmallCompact: { fontSize: 12 },
  presetBig: { color: '#fff', fontSize: 52, fontWeight: '900' },
  presetBigCompact: { fontSize: 30, lineHeight: 34 },
  bottomRow: { flexDirection: 'row', gap: space(2) },

  draft: { gap: space(1.5), borderWidth: 1, borderColor: colors.accent },
  draftCompact: { gap: space(1), padding: space(1) },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  draftTitle: { color: colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  draftTitleCompact: { fontSize: 17 },
  nameInput: {
    flex: 1,
    marginLeft: space(2),
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.s,
    paddingHorizontal: space(1.5),
    height: 44,
    fontSize: 16,
  },
  nameInputCompact: { height: 38, marginLeft: space(1) },

  flash: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    backgroundColor: colors.ok,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  flashText: { color: '#fff', fontWeight: '800', fontSize: 20 },

  helpCard: { backgroundColor: colors.surfaceHigh, gap: space(1) },
  side: { width: 340, backgroundColor: colors.surface, padding: space(2), gap: space(1) },
  sideCompact: { padding: space(1) },
  sideStacked: { flex: 1 },
  sideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clipHeader: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  clipActions: { flexDirection: 'row', gap: space(1) },
  clipRow: {
    gap: space(1),
    paddingVertical: space(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  clipName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontWeight: '700', fontSize: 13 },
});
