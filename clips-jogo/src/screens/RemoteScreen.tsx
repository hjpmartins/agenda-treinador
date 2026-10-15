import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
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
  View,
} from 'react-native';
import { Button, Card, Chip } from '../components/ui';
import { ADJUST_STEP_MS, fromMarks, lastSeconds, normalize, PRESET_SECONDS, type ClipRange } from '../lib/clipRange';
import { formatClock, formatDuration } from '../lib/format';
import { decodePairing, type Pairing } from '../remote/pairing';
import { RemoteClient, type RemoteClip, type RemoteSnapshot } from '../remote/RemoteClient';
import { colors, radius, space } from '../theme';

type Props = { onBack: () => void };

const AUTO_SEND_SECONDS = 5;

export function RemoteScreen({ onBack }: Props) {
  useKeepAwake();
  const [client, setClient] = useState<RemoteClient | null>(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

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
        <Button label="Voltar" variant="ghost" onPress={onBack} />
      </View>
    </View>
  );
}

// ======================================================================== comando

type Draft = ClipRange & { name: string; createdAt: number };

function CommandView({ client, onDisconnect }: { client: RemoteClient; onDisconnect: () => void }) {
  const [snap, setSnap] = useState<RemoteSnapshot>({ connection: 'joining', error: null, phone: null, clips: [] });
  const [recMs, setRecMs] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => client.subscribe(setSnap), [client]);
  useEffect(() => {
    const t = setInterval(() => setRecMs(client.recordingTimeNow()), 200);
    return () => clearInterval(t);
  }, [client]);

  const recording = snap.phone?.state === 'recording' && recMs != null;
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

  const canClip = recording;
  const queued = snap.clips.filter((c) => c.status === 'queued').length;

  return (
    <View style={[styles.root, styles.row]}>
      {/* ---------------------------------------------------- comandos */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          <View style={styles.timerBox}>
            {recording ? <View style={styles.recDot} /> : null}
            <Text style={styles.timer}>{recording ? formatClock(recMs!) : '--:--'}</Text>
          </View>
          <View style={styles.chips}>
            <Chip label={connectionChip.label} tone={connectionChip.tone} />
            {connected && !recording ? <Chip label="O telemóvel não está a gravar" tone="warn" /> : null}
            {snap.phone?.batteryPercent != null ? (
              <Chip
                label={`Telemóvel ${snap.phone.batteryPercent}%${snap.phone.charging ? ' ⚡' : ''}`}
                tone={snap.phone.charging || snap.phone.batteryPercent >= 30 ? 'neutral' : 'warn'}
              />
            ) : null}
            {queued > 0 ? <Chip label={`${queued} na fila`} tone="warn" /> : null}
          </View>
        </View>

        {draft ? (
          <DraftPanel
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

        <View style={styles.presets}>
          {PRESET_SECONDS.map((s) => (
            <Pressable
              key={s}
              disabled={!canClip}
              onPress={() => preset(s)}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              style={({ pressed }) => [styles.preset, { opacity: !canClip ? 0.35 : pressed ? 0.75 : 1 }]}
            >
              <Text style={styles.presetSmall}>Clip dos últimos</Text>
              <Text style={styles.presetBig}>{s}s</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <Button
            label={markStart == null ? 'Marcar início' : `Marcar fim (início ${formatClock(markStart)})`}
            variant={markStart == null ? 'secondary' : 'primary'}
            size="l"
            disabled={!canClip}
            onPress={mark}
            style={styles.flex}
          />
          {markStart != null ? (
            <Button label="Cancelar marca" variant="ghost" size="l" onPress={() => setMarkStart(null)} />
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
      <View style={styles.side}>
        <View style={styles.sideHeader}>
          <Text style={styles.h2}>Clips</Text>
          <Button label="Desligar" variant="ghost" onPress={onDisconnect} />
        </View>
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
          renderItem={({ item }) => <ClipRow clip={item} />}
        />
      </View>
    </View>
  );
}

function DraftPanel({
  draft,
  countdown,
  onAdjust,
  onName,
  onCancel,
  onSend,
}: {
  draft: Draft;
  countdown: number | null;
  onAdjust: (which: 'start' | 'end', delta: number) => void;
  onName: (name: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <Card style={styles.draft}>
      <View style={styles.draftRow}>
        <Text style={styles.draftTitle}>
          {formatClock(draft.startMs)} → {formatClock(draft.endMs)}{' '}
          <Text style={styles.muted}>({formatDuration(draft.endMs - draft.startMs)})</Text>
        </Text>
        <TextInput
          value={draft.name}
          onChangeText={onName}
          placeholder="Nome (opcional) ex.: Triplo #7"
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
      </View>
      <View style={styles.draftRow}>
        <Text style={styles.label}>Início</Text>
        <Button label="−5s" onPress={() => onAdjust('start', -ADJUST_STEP_MS)} />
        <Button label="+5s" onPress={() => onAdjust('start', ADJUST_STEP_MS)} />
        <View style={{ width: space(2) }} />
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

function ClipRow({ clip }: { clip: RemoteClip }) {
  const st = CLIP_STATUS[clip.status];
  const busy = clip.status === 'queued' || clip.status === 'pending' || clip.status === 'cutting';
  return (
    <View style={styles.clipRow}>
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  recDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.rec, marginRight: space(1.5) },
  timer: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },

  presets: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
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
  presetSmall: { color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 },
  presetBig: { color: '#fff', fontSize: 52, fontWeight: '900' },
  bottomRow: { flexDirection: 'row', gap: space(2) },

  draft: { gap: space(1.5), borderWidth: 1, borderColor: colors.accent },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  draftTitle: { color: colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  sideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
