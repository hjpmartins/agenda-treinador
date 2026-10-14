import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addEngineListener, ClipEngine, type Clip, type Session } from '../../modules/clip-engine';
import { Button, Card } from '../components/ui';
import { formatBytes, formatClock, formatDateTime, formatDuration } from '../lib/format';
import { colors, radius, space } from '../theme';

type Props = { onBack: () => void };

async function saveToGallery(uri: string) {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert('Sem permissão', 'Autoriza o acesso à galeria nas definições para guardar vídeos.');
    return;
  }
  await Asset.create(uri);
  Alert.alert('Guardado', 'O vídeo foi guardado na galeria.');
}

async function share(uri: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Partilha indisponível', 'Este dispositivo não permite partilhar ficheiros.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'video/mp4' });
}

function run(task: () => Promise<void>) {
  task().catch((e) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)));
}

const STATUS_LABEL: Record<Clip['status'], string> = {
  pending: 'À espera',
  cutting: 'A processar',
  ready: 'Pronto',
  failed: 'Falhou',
};

const SESSION_STATUS: Record<Session['status'], string> = {
  recording: 'A gravar',
  finalizing: 'A finalizar',
  done: 'Concluída',
  interrupted: 'Interrompida',
};

export function ClipsScreen({ onBack }: Props) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [playing, setPlaying] = useState<{ uri: string; title: string } | null>(null);

  const reload = useCallback(async () => {
    if (!ClipEngine) return setSessions([]);
    setSessions(await ClipEngine.listSessions());
  }, []);

  useEffect(() => {
    reload();
    const subs = [
      addEngineListener('onClipUpdate', (clip) =>
        setSessions((list) =>
          list?.map((s) =>
            s.id !== clip.sessionId
              ? s
              : {
                  ...s,
                  clips: s.clips.some((c) => c.id === clip.id)
                    ? s.clips.map((c) => (c.id === clip.id ? clip : c))
                    : [...s.clips, clip],
                }
          ) ?? null
        )
      ),
      addEngineListener('onStateChange', () => reload()),
    ];
    return () => subs.forEach((s) => s?.remove());
  }, [reload]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const deleteClip = (clip: Clip) =>
    Alert.alert('Apagar clip?', clip.name, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => run(async () => {
          await ClipEngine?.deleteClip(clip.sessionId, clip.id);
          await reload();
        }),
      },
    ]);

  const deleteSession = (s: Session) =>
    Alert.alert('Apagar gravação?', 'Apaga o vídeo completo e todos os clips deste jogo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar tudo',
        style: 'destructive',
        onPress: () => run(async () => {
          await ClipEngine?.deleteSession(s.id);
          await reload();
        }),
      },
    ]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Button label="‹ Voltar" variant="ghost" onPress={onBack} />
        <Text style={styles.title}>Gravações e clips</Text>
      </View>

      {sessions === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space(4) }} />
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>Ainda não há gravações.</Text>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ gap: space(2), paddingBottom: space(4) }}
          renderItem={({ item: s }) => (
            <Card>
              <View style={styles.sessionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>Jogo de {formatDateTime(s.startedAtMs)}</Text>
                  <Text style={styles.muted}>
                    {formatClock(s.durationMs)} · {s.quality} · {SESSION_STATUS[s.status]}
                  </Text>
                </View>
                {s.status !== 'recording' && s.status !== 'finalizing' ? (
                  <Button label="Apagar" variant="ghost" onPress={() => deleteSession(s)} />
                ) : null}
              </View>

              {s.status === 'interrupted' ? (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>
                    Esta gravação foi interrompida (app fechada ou sem bateria). Os segmentos gravados podem ser recuperados.
                  </Text>
                  <Button
                    label="Recuperar vídeo"
                    variant="primary"
                    onPress={() => run(async () => {
                      await ClipEngine?.recoverSession(s.id);
                      Alert.alert('A recuperar', 'O vídeo está a ser criado. Volta a abrir esta lista daqui a pouco.');
                    })}
                  />
                </View>
              ) : null}

              {s.fullVideoUris.map((uri, i) => {
                const title = s.fullVideoUris.length > 1 ? `Jogo completo — parte ${i + 1}` : 'Jogo completo';
                return (
                  <View key={uri} style={styles.row}>
                    <Text style={[styles.rowTitle, { flex: 1 }]}>{title}</Text>
                    <Button label="▶ Ver" onPress={() => setPlaying({ uri, title })} />
                    <Button label="Galeria" onPress={() => run(() => saveToGallery(uri))} />
                    <Button label="Partilhar" onPress={() => run(() => share(uri))} />
                  </View>
                );
              })}

              {s.clips.length === 0 ? <Text style={styles.muted}>Sem clips.</Text> : null}
              {s.clips.map((c) => (
                <View key={c.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.name}</Text>
                    <Text style={styles.muted}>
                      {formatClock(c.startMs)} – {formatClock(c.endMs)} ({formatDuration(c.endMs - c.startMs)})
                      {c.status === 'ready' ? ` · ${formatBytes(c.sizeBytes)}` : ''}
                    </Text>
                    {c.error ? <Text style={styles.errorText}>{c.error}</Text> : null}
                  </View>
                  {c.status === 'ready' && c.uri ? (
                    <>
                      <Button label="▶" onPress={() => setPlaying({ uri: c.uri!, title: c.name })} />
                      <Button label="Galeria" onPress={() => run(() => saveToGallery(c.uri!))} />
                      <Button label="Partilhar" onPress={() => run(() => share(c.uri!))} />
                    </>
                  ) : (
                    <View style={[styles.badge, c.status === 'failed' && { borderColor: colors.danger }]}>
                      {c.status !== 'failed' ? <ActivityIndicator size="small" color={colors.accent} /> : null}
                      <Text style={[styles.badgeText, c.status === 'failed' && { color: colors.danger }]}>
                        {STATUS_LABEL[c.status]}
                      </Text>
                    </View>
                  )}
                  {c.status === 'ready' || c.status === 'failed' ? (
                    <Pressable onPress={() => deleteClip(c)} hitSlop={12} style={styles.trash}>
                      <Text style={styles.trashText}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        />
      )}

      {playing ? <PlayerModal uri={playing.uri} title={playing.title} onClose={() => setPlaying(null)} /> : null}
    </SafeAreaView>
  );
}

function PlayerModal({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.playerRoot}>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <View style={styles.playerBar}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Button label="Fechar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2) },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space(6), fontSize: 16 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1) },
  sessionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 13 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: colors.accent, fontWeight: '700' },
  trash: { padding: space(1) },
  trashText: { color: colors.muted, fontSize: 18 },
  warnBox: { backgroundColor: colors.accentDim, borderRadius: radius.m, padding: space(1.5), gap: space(1), marginBottom: space(1) },
  warnText: { color: colors.warn },
  playerRoot: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  playerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space(2),
    backgroundColor: colors.surface,
  },
});
