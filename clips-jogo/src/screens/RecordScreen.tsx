import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  addEngineListener,
  CameraPreview,
  ClipEngine,
  type Clip,
  type EngineStatus,
  type LinkInfo,
  type Quality,
} from '../../modules/clip-engine';
import { Button, Card, Chip, ProgressBar } from '../components/ui';
import { lastSeconds, PRESET_SECONDS } from '../lib/clipRange';
import { encodePairing } from '../remote/pairing';
import { formatClock, formatHoursMinutes, recordingTimeLeftMs } from '../lib/format';
import { colors, radius, space } from '../theme';

type Props = { onBack: () => void; onClips: () => void };

type PermissionState = 'checking' | 'granted' | 'ask' | 'blocked';

export function RecordScreen({ onBack, onClips }: Props) {
  useKeepAwake();
  const engine = ClipEngine!;

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [status, setStatus] = useState<EngineStatus>(() => engine.getStatus());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [quality, setQuality] = useState<Quality>('1080p');
  const [clips, setClips] = useState<Record<string, Clip>>({});
  const [finalizeProgress, setFinalizeProgress] = useState<number | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const wasFinalizing = useRef(false);

  const recording = status.state === 'recording';
  const finalizing = status.state === 'finalizing';

  // Ecrã sempre na horizontal enquanto se grava.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    engine.getPermissionsAsync().then((p) => setPermission(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked'));
  }, [engine]);

  // Estado do motor (bateria, espaço, …) e cronómetro.
  useEffect(() => {
    const tick = setInterval(() => setElapsedMs(engine.getRecordingTimeMs()), 250);
    const slow = setInterval(() => setStatus(engine.getStatus()), 1000);
    return () => {
      clearInterval(tick);
      clearInterval(slow);
    };
  }, [engine]);

  useEffect(() => {
    const subs = [
      addEngineListener('onStateChange', ({ state }) => {
        setStatus(engine.getStatus());
        if (state === 'finalizing') {
          wasFinalizing.current = true;
          setFinalizeProgress(0);
        } else if (wasFinalizing.current) {
          wasFinalizing.current = false;
          setFinalizeProgress(null);
          setJustFinished(true);
        }
      }),
      addEngineListener('onClipUpdate', (clip) => setClips((c) => ({ ...c, [clip.id]: clip }))),
      addEngineListener('onFinalizeProgress', ({ progress }) => setFinalizeProgress(progress)),
      addEngineListener('onError', ({ message }) => setError(message)),
    ];
    return () => subs.forEach((s) => s?.remove());
  }, [engine]);

  // O botão "voltar" do Android não pode parar a gravação sem querer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (recording || finalizing) {
        Alert.alert('A gravar', 'Para a gravação antes de sair deste ecrã.');
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [recording, finalizing, onBack]);

  // A câmara e o encoder ficam preparados na qualidade escolhida, para o arranque ser imediato.
  useEffect(() => {
    if (permission === 'granted' && !recording && !finalizing) engine.setQuality(quality).catch(() => {});
  }, [engine, permission, quality, recording, finalizing]);

  // Ao sair do ecrã (sem gravar), desliga a rede local.
  const recordingRef = useRef(false);
  recordingRef.current = recording || finalizing;
  useEffect(() => {
    return () => {
      if (!recordingRef.current) engine.stopLink().catch(() => {});
    };
  }, [engine]);

  const connectTablet = useCallback(async () => {
    setLinkBusy(true);
    try {
      const perm = await engine.requestLinkPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permissão necessária',
          'Para criar a rede Wi-Fi que liga ao tablet, autoriza "Dispositivos próximos" (ou Localização) para esta app.',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir definições', onPress: () => Linking.openSettings() }]
        );
        return;
      }
      setLink(await engine.startLink());
      setShowQr(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinkBusy(false);
    }
  }, [engine]);

  const askPermission = useCallback(async () => {
    const p = await engine.requestPermissionsAsync();
    setPermission(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked');
  }, [engine]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setJustFinished(false);
    setClips({});
    try {
      await engine.startRecording(quality);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setStatus(engine.getStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [engine, quality]);

  const stop = useCallback(() => {
    Alert.alert('Parar a gravação?', 'O vídeo completo vai ser criado a seguir. Os clips já pedidos são terminados.', [
      { text: 'Continuar a gravar', style: 'cancel' },
      {
        text: 'Parar',
        style: 'destructive',
        onPress: async () => {
          setSleeping(false);
          await engine.stopRecording();
          setStatus(engine.getStatus());
        },
      },
    ]);
  }, [engine]);

  const testClip = useCallback(
    async (seconds: number) => {
      const now = engine.getRecordingTimeMs();
      const range = lastSeconds(now, seconds);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (flashRef.current) clearTimeout(flashRef.current);
      setFlash(`Clip de ${seconds}s pedido`);
      flashRef.current = setTimeout(() => setFlash(null), 1500);
      try {
        const clip = await engine.requestClip(null, range.startMs, range.endMs, null);
        setClips((c) => ({ ...c, [clip.id]: clip }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine]
  );

  // ------------------------------------------------------------------ sem permissões
  if (permission !== 'granted') {
    return (
      <View style={[styles.root, styles.center]}>
        <Card style={styles.permissionCard}>
          <Text style={styles.h1}>Câmara e microfone</Text>
          <Text style={styles.body}>
            Para gravar o jogo, a app precisa de acesso à câmara e ao microfone. Os vídeos ficam só neste
            dispositivo — nada é enviado para a internet.
          </Text>
          {permission === 'blocked' ? (
            <Button label="Abrir definições" variant="primary" size="l" onPress={() => Linking.openSettings()} />
          ) : (
            <Button label="Permitir" variant="primary" size="l" onPress={askPermission} loading={permission === 'checking'} />
          )}
          <Button label="Voltar" variant="ghost" onPress={onBack} style={{ marginTop: space(1) }} />
        </Card>
      </View>
    );
  }

  // ------------------------------------------------------------------ avisos
  const clipList = Object.values(clips).sort((a, b) => a.createdAtMs - b.createdAtMs);
  const processing = clipList.filter((c) => c.status === 'pending' || c.status === 'cutting').length;
  const ready = clipList.filter((c) => c.status === 'ready').length;

  const battery = status.batteryPercent;
  const batteryTone = status.charging ? 'ok' : battery == null ? 'neutral' : battery < 15 ? 'danger' : battery < 35 ? 'warn' : 'ok';
  const timeLeft = recordingTimeLeftMs(status.freeBytes, status.bytesPerSecond);
  const spaceTone = timeLeft < 20 * 60_000 ? 'danger' : timeLeft < 60 * 60_000 ? 'warn' : 'ok';

  return (
    <View style={styles.root}>
      {/* ---------------------------------------------------- câmara */}
      <View style={styles.previewArea}>
        {CameraPreview ? <CameraPreview style={StyleSheet.absoluteFill} /> : null}

        <View style={styles.topBar} pointerEvents="none">
          <View style={styles.timerBox}>
            {recording ? <View style={styles.recDot} /> : null}
            <Text style={styles.timer}>{formatClock(recording ? elapsedMs : 0)}</Text>
          </View>
          <View style={styles.chips}>
            <Chip label={`${battery ?? '—'}%${status.charging ? ' ⚡' : ''}`} tone={batteryTone} />
            <Chip label={`Espaço: ${formatHoursMinutes(timeLeft)}`} tone={spaceTone} />
            {status.thermal !== 'normal' ? (
              <Chip label={status.thermal === 'critico' ? 'Muito quente!' : 'Quente'} tone={status.thermal === 'critico' ? 'danger' : 'warn'} />
            ) : null}
            {!status.hasMicrophone ? <Chip label="Sem som" tone="warn" /> : null}
            <Chip
              label={status.tabletConnected ? 'Tablet ligado' : status.linkActive ? 'À espera do tablet' : 'Tablet: não ligado'}
              tone={status.tabletConnected ? 'ok' : status.linkActive ? 'warn' : 'neutral'}
            />
          </View>
        </View>

        {flash ? (
          <View style={styles.flash} pointerEvents="none">
            <Text style={styles.flashText}>{flash}</Text>
          </View>
        ) : null}

        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => setError(null)}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Toca para fechar</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---------------------------------------------------- painel lateral */}
      <View style={styles.panel}>
        {finalizing ? (
          <View style={styles.panelSection}>
            <Text style={styles.h2}>A criar o vídeo completo…</Text>
            <ProgressBar value={finalizeProgress ?? 0} />
            <Text style={styles.muted}>{Math.round((finalizeProgress ?? 0) * 100)}% — não feches a app.</Text>
          </View>
        ) : recording ? (
          <>
            <View style={styles.panelSection}>
              <Text style={styles.label}>Clip de teste (últimos…)</Text>
              <View style={styles.grid}>
                {PRESET_SECONDS.map((s) => (
                  <Button key={s} label={`${s}s`} size="l" onPress={() => testClip(s)} style={styles.gridButton} />
                ))}
              </View>
              <Text style={styles.muted}>
                {clipList.length === 0
                  ? 'Ainda sem clips.'
                  : `${ready} pronto${ready === 1 ? '' : 's'}${processing ? ` · ${processing} a processar` : ''}`}
              </Text>
            </View>
            <View style={styles.panelSection}>
              <Button
                label={status.tabletConnected ? 'Tablet ligado ✓' : 'Ligar tablet'}
                variant="ghost"
                onPress={connectTablet}
                loading={linkBusy}
              />
              <Button label="Ecrã de repouso" variant="ghost" onPress={() => setSleeping(true)} />
              <Button label="Parar gravação" variant="danger" size="l" onPress={stop} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.panelSection}>
              <Text style={styles.label}>Qualidade</Text>
              <View style={styles.row}>
                {(['1080p', '720p'] as const).map((q) => (
                  <Button
                    key={q}
                    label={q}
                    sublabel={q === '1080p' ? '~4,5 GB/h' : '~2,3 GB/h'}
                    variant={quality === q ? 'primary' : 'secondary'}
                    onPress={() => setQuality(q)}
                    style={styles.flex}
                  />
                ))}
              </View>
              {justFinished ? (
                <Card style={styles.doneCard}>
                  <Text style={styles.okText}>Gravação guardada.</Text>
                  <Button label="Ver clips" variant="ghost" onPress={onClips} />
                </Card>
              ) : null}
            </View>
            <View style={styles.panelSection}>
              <Pressable
                onPress={start}
                disabled={busy}
                style={({ pressed }) => [styles.recordButton, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
              >
                <View style={styles.recordInner} />
              </Pressable>
              <Text style={styles.recordLabel}>{busy ? 'A iniciar…' : 'Iniciar gravação'}</Text>
              <Button
                label={status.tabletConnected ? 'Tablet ligado ✓' : 'Ligar tablet'}
                variant="ghost"
                onPress={connectTablet}
                loading={linkBusy}
              />
              <Button label="Voltar" variant="ghost" onPress={onBack} />
            </View>
          </>
        )}
      </View>

      {/* ---------------------------------------------------- ecrã de repouso */}
      {/* ---------------------------------------------------- QR para o tablet */}
      <Modal visible={showQr && link != null} transparent animationType="fade" onRequestClose={() => setShowQr(false)} supportedOrientations={['landscape', 'portrait']}>
        <View style={styles.qrBackdrop}>
          <Card style={styles.qrCard}>
            <View style={styles.qrBox}>
              {link ? <QRCode value={encodePairing(link)} size={240} backgroundColor="#fff" color="#000" /> : null}
            </View>
            <View style={styles.qrText}>
              <Text style={styles.h1}>Ligar o tablet</Text>
              <Text style={styles.body}>
                No tablet, abre a app → <Text style={{ fontWeight: '700', color: colors.text }}>Comando</Text> → Ler QR.
                O tablet liga-se sozinho à rede deste telemóvel (sem internet).
              </Text>
              {status.tabletConnected ? <Text style={styles.okText}>Tablet ligado ✓</Text> : null}
              {link?.ssid ? (
                <>
                  <Text style={styles.muted}>
                    Rede: <Text style={styles.strong}>{link.ssid}</Text>
                    {'\n'}Palavra-passe: <Text style={styles.strong}>{link.passphrase}</Text>
                  </Text>
                  <Text style={[styles.muted, { marginTop: space(1) }]}>
                    O tablet não encontra a rede? Liga a Localização no tablet. Se continuar, liga o Ponto de acesso do
                    telemóvel (banda 2,4 GHz), liga o tablet a essa rede nas definições e toca outra vez em "Ligar tablet".
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>
                  {link?.hotspotError ? `${link.hotspotError} ` : ''}O tablet tem de estar ligado à mesma rede Wi-Fi que
                  este telemóvel (por exemplo, o Ponto de acesso dele) antes de ler o QR.
                </Text>
              )}
              <Button label={status.tabletConnected ? 'Feito' : 'Fechar'} variant="primary" onPress={() => setShowQr(false)} style={{ marginTop: space(2) }} />
            </View>
          </Card>
        </View>
      </Modal>

      {sleeping ? (
        <Pressable style={styles.sleep} onPress={() => setSleeping(false)}>
          <View style={styles.timerBox}>
            <View style={styles.recDot} />
            <Text style={[styles.timer, { opacity: 0.5 }]}>{formatClock(elapsedMs)}</Text>
          </View>
          <Text style={styles.sleepHint}>A gravar. Toca para acordar o ecrã.</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  previewArea: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: space(2),
    left: space(2),
    right: space(2),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space(2),
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderRadius: radius.m,
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  recDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.rec, marginRight: space(1.5) },
  timer: { color: colors.text, fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  flash: {
    position: 'absolute',
    bottom: space(3),
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  flashText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  errorBanner: {
    position: 'absolute',
    bottom: space(2),
    left: space(2),
    right: space(2),
    backgroundColor: colors.danger,
    borderRadius: radius.m,
    padding: space(2),
  },
  errorText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorHint: { color: '#fff', opacity: 0.8, marginTop: 4, fontSize: 12 },
  panel: {
    width: 280,
    backgroundColor: colors.surface,
    padding: space(2),
    justifyContent: 'space-between',
  },
  panelSection: { gap: space(1.5) },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  gridButton: { width: 118 },
  row: { flexDirection: 'row', gap: space(1) },
  muted: { color: colors.muted, fontSize: 14 },
  h1: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: space(1) },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 22, marginBottom: space(2) },
  permissionCard: { width: 460, maxWidth: '90%' },
  doneCard: { backgroundColor: colors.surfaceHigh, gap: space(1) },
  okText: { color: colors.ok, fontWeight: '700', fontSize: 16 },
  recordButton: {
    alignSelf: 'center',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 6,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.rec },
  recordLabel: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  sleep: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  sleepHint: { color: colors.muted, opacity: 0.6 },
  qrBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  qrCard: { flexDirection: 'row', gap: space(3), alignItems: 'center', maxWidth: '92%' },
  qrBox: { backgroundColor: '#fff', padding: space(2), borderRadius: radius.m },
  qrText: { width: 320 },
  strong: { color: colors.text, fontWeight: '700' },
});
