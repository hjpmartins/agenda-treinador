import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addEngineListener, ClipEngine, type Clip, type Session } from '../../modules/clip-engine';
import { PlayerModal, run, saveToGallery, share } from '../components/media';
import { Button, Card } from '../components/ui';
import {
  deleteReceived,
  listReceived,
  subscribeReceived,
  type ReceivedClip,
} from '../remote/receivedLibrary';
import { formatBytes, formatClock, formatDateTime, formatDuration } from '../lib/format';
import { colors, radius, space } from '../theme';

type Props = { onBack: () => void };

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
  const [received, setReceived] = useState<ReceivedClip[]>(() => listReceived());
  useEffect(() => subscribeReceived(setReceived), []);

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
      ) : sessions.length === 0 && received.length === 0 ? (
        <Text style={styles.empty}>Ainda não há gravações.</Text>
      ) : (
        <FlatList
          data={sessions}
          ListHeaderComponent={
            received.length > 0 ? (
              <ReceivedSection
                clips={received}
                onPlay={(c) => setPlaying({ uri: c.uri, title: c.name })}
                onDelete={(c) =>
                  Alert.alert('Apagar do tablet?', c.name, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Apagar', style: 'destructive', onPress: () => deleteReceived(c.id) },
                  ])
                }
              />
            ) : null
          }
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
                  <View key={uri} style={styles.item}>
                    <Text style={styles.rowTitle}>{title}</Text>
                    <View style={styles.actions}>
                      <Button label="▶ Ver" onPress={() => setPlaying({ uri, title })} style={styles.action} />
                      <Button label="Galeria" onPress={() => run(() => saveToGallery(uri))} style={styles.action} />
                      <Button label="Partilhar" onPress={() => run(() => share(uri))} style={styles.action} />
                    </View>
                  </View>
                );
              })}

              {s.clips.length === 0 ? <Text style={styles.muted}>Sem clips.</Text> : null}
              {s.clips.map((c) => (
                <View key={c.id} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{c.name}</Text>
                    <Text style={styles.muted}>
                      {formatClock(c.startMs)} – {formatClock(c.endMs)} ({formatDuration(c.endMs - c.startMs)})
                      {c.status === 'ready' ? ` · ${formatBytes(c.sizeBytes)}` : ''}
                    </Text>
                      {c.error ? <Text style={styles.errorText}>{c.error}</Text> : null}
                    </View>
                    {c.status !== 'ready' ? (
                      <View style={[styles.badge, c.status === 'failed' && { borderColor: colors.danger }]}>
                        {c.status !== 'failed' ? <ActivityIndicator size="small" color={colors.accent} /> : null}
                        <Text style={[styles.badgeText, c.status === 'failed' && { color: colors.danger }]}>
                          {STATUS_LABEL[c.status]}
                        </Text>
                      </View>
                    ) : null}
                    {c.status === 'ready' || c.status === 'failed' ? (
                      <Pressable onPress={() => deleteClip(c)} hitSlop={12} style={styles.trash}>
                        <Text style={styles.trashText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {c.status === 'ready' && c.uri ? (
                    <View style={styles.actions}>
                      <Button label="▶ Ver" onPress={() => setPlaying({ uri: c.uri!, title: c.name })} style={styles.action} />
                      <Button label="Galeria" onPress={() => run(() => saveToGallery(c.uri!))} style={styles.action} />
                      <Button label="Partilhar" onPress={() => run(() => share(c.uri!))} style={styles.action} />
                    </View>
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

/** Clips copiados do telemóvel para este dispositivo (modo Comando), agrupados por jogo. */
function ReceivedSection({
  clips,
  onPlay,
  onDelete,
}: {
  clips: ReceivedClip[];
  onPlay: (c: ReceivedClip) => void;
  onDelete: (c: ReceivedClip) => void;
}) {
  const bySession = new Map<string, ReceivedClip[]>();
  for (const c of [...clips].sort((a, b) => b.createdAtMs - a.createdAtMs)) {
    bySession.set(c.sessionId, [...(bySession.get(c.sessionId) ?? []), c]);
  }
  return (
    <View style={{ gap: space(2), marginBottom: space(2) }}>
      {[...bySession.entries()].map(([sessionId, list]) => (
        <Card key={sessionId}>
          <Text style={styles.sessionTitle}>Recebidos · jogo de {sessionLabel(sessionId)}</Text>
          <Text style={[styles.muted, { marginBottom: space(1) }]}>
            Do {list[0].phone} · {list.length} clip{list.length === 1 ? '' : 's'}
          </Text>
          {list
            .slice()
            .sort((a, b) => a.startMs - b.startMs)
            .map((c) => (
              <View key={c.id} style={styles.item}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.name}</Text>
                    <Text style={styles.muted}>
                      {formatClock(c.startMs)} – {formatClock(c.endMs)} ({formatDuration(c.endMs - c.startMs)}) ·{' '}
                      {formatBytes(c.sizeBytes)}
                    </Text>
                  </View>
                  <Pressable onPress={() => onDelete(c)} hitSlop={12} style={styles.trash}>
                    <Text style={styles.trashText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.actions}>
                  <Button label="▶ Ver" onPress={() => onPlay(c)} style={styles.action} />
                  <Button label="Galeria" onPress={() => run(() => saveToGallery(c.uri))} style={styles.action} />
                  <Button label="Partilhar" onPress={() => run(() => share(c.uri))} style={styles.action} />
                </View>
              </View>
            ))}
        </Card>
      ))}
    </View>
  );
}

/** "20261014-213005" → "14/10 21:30" */
function sessionLabel(id: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(id);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : id;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2) },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space(6), fontSize: 16 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1) },
  sessionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  item: {
    gap: space(1),
    paddingVertical: space(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  actions: { flexDirection: 'row', gap: space(1) },
  action: { flex: 1, paddingHorizontal: space(1) },
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
});
