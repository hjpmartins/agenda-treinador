import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addEngineListener, ClipEngine, type Clip, type Session } from '../../modules/clip-engine';
import { AnalysisPlayer, type AnalysisItem } from '../components/AnalysisPlayer';
import { shareClip, shareMany } from '../components/exportShare';
import { PlayerPicker, playersShort } from '../components/PlayerPicker';
import { PlayerModal, run, saveToGallery, share } from '../components/media';
import { MotivePicker } from '../components/MotivePicker';
import { toneBackground, ToneToggle } from '../components/Tone';
import { ClipTitle, TitleEditor } from '../components/TitleEditor';
import { groupByMotive, groupByPlayer, playerLabel, type Player } from '../lib/annotations';
import { KEEP_GAMES, nextToPrune } from '../lib/retention';
import { absorbBarTags, allNotes, getMotives, getNotes, getRoster, setNotes, useNotesVersion } from '../remote/notesStore';
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
  const [analysis, setAnalysis] = useState<{ items: AnalysisItem[]; index: number } | null>(null);
  const [motiveFor, setMotiveFor] = useState<string | null>(null);
  const [playersFor, setPlayersFor] = useState<string | null>(null);
  const [titleFor, setTitleFor] = useState<{ id: string; name: string } | null>(null);
  // A janela das jogadoras mostra o que está gravado: tem de se atualizar a cada toque.
  useNotesVersion();
  /** Modo "Selecionar": clips marcados para enviar todos de uma vez (null = fora do modo). */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const toggleSelected = (ids: string[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur ?? []);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const sendSelected = () => {
    if (!selected?.size) return;
    const items = received
      .filter((c) => selected.has(c.id))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((c) => ({ id: c.id, uri: c.uri, title: c.name }));
    setSelected(null);
    shareMany(items, `Clips (${items.length})`).catch((e) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)));
  };
  const phoneNextToPrune = nextToPrune(
    (sessions ?? [])
      .filter((x) => x.status !== 'recording' && x.status !== 'finalizing')
      .map((x) => ({ sessionId: x.id, createdAtMs: x.startedAtMs }))
  );
  useEffect(() => subscribeReceived(setReceived), []);
  // Motivos escolhidos na barra flutuante que ainda não foram registados.
  useEffect(() => absorbBarTags(), []);

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
      if (selected) setSelected(null);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, selected]);

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
                selected={selected}
                onSelecting={() => setSelected(new Set())}
                onToggle={toggleSelected}
                onPlay={(items, index) => setAnalysis({ items, index })}
                onMotive={(c) => setMotiveFor(c.id)}
                onPlayers={(c) => setPlayersFor(c.id)}
                onTitle={(c) => setTitleFor({ id: c.id, name: c.name })}
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
          ListFooterComponent={
            <Text style={[styles.muted, { textAlign: 'center' }]}>
              Ficam guardados os últimos {KEEP_GAMES} jogos. Para guardar um vídeo, usa Galeria ou Partilhar.
            </Text>
          }
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

              {phoneNextToPrune === s.id ? <PruneWarning /> : null}

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

      {selected ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectText}>
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </Text>
          <Button
            label={selected.size === received.length ? 'Nenhum' : 'Todos'}
            variant="ghost"
            onPress={() =>
              selected.size === received.length ? setSelected(new Set()) : setSelected(new Set(received.map((c) => c.id)))
            }
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setSelected(null)} />
          <Button label={`Enviar (${selected.size})`} variant="primary" disabled={selected.size === 0} onPress={sendSelected} />
        </View>
      ) : null}

      {playing ? <PlayerModal uri={playing.uri} title={playing.title} onClose={() => setPlaying(null)} /> : null}
      {analysis ? <AnalysisPlayer items={analysis.items} startIndex={analysis.index} onClose={() => setAnalysis(null)} /> : null}
      <TitleEditor clip={titleFor} onClose={() => setTitleFor(null)} />
      <PlayerPicker
        visible={playersFor != null}
        selected={playersFor ? getNotes(playersFor).players ?? [] : []}
        onChange={(players) => playersFor && setNotes(playersFor, { players })}
        onClose={() => setPlayersFor(null)}
      />
      <MotivePicker
        visible={motiveFor != null}
        current={motiveFor ? getNotes(motiveFor).motive ?? null : null}
        onPick={(m) => {
          if (motiveFor) setNotes(motiveFor, { motive: m });
          setMotiveFor(null);
        }}
        onClose={() => setMotiveFor(null)}
      />
    </SafeAreaView>
  );
}

/** Clips copiados do telemóvel para este dispositivo (modo Comando), agrupados por jogo. */
function ReceivedSection({
  clips,
  selected,
  onSelecting,
  onToggle,
  onPlay,
  onMotive,
  onPlayers,
  onTitle,
  onDelete,
}: {
  clips: ReceivedClip[];
  /** Clips marcados para enviar (null = fora do modo Selecionar). */
  selected: Set<string> | null;
  onSelecting: () => void;
  onToggle: (ids: string[], on: boolean) => void;
  onPlay: (items: AnalysisItem[], index: number) => void;
  onMotive: (c: ReceivedClip) => void;
  onPlayers: (c: ReceivedClip) => void;
  onTitle: (c: ReceivedClip) => void;
  onDelete: (c: ReceivedClip) => void;
}) {
  useNotesVersion();
  const notes = allNotes();
  const toItem = (c: ReceivedClip): AnalysisItem => ({ id: c.id, uri: c.uri, title: c.name });
  const willPrune = nextToPrune(clips);
  /** Clips de uma jogadora: de um jogo (scope = "jogo de 14/10 21:30") ou de todos os jogos guardados. */
  const [forPlayer, setForPlayer] = useState<{ player: Player; clips: ReceivedClip[]; scope: string } | null>(null);
  const byPlayer = groupByPlayer(
    [...clips].sort((a, b) => a.createdAtMs - b.createdAtMs),
    notes,
    getRoster()
  );
  const bySession = new Map<string, ReceivedClip[]>();
  for (const c of [...clips].sort((a, b) => b.createdAtMs - a.createdAtMs)) {
    bySession.set(c.sessionId, [...(bySession.get(c.sessionId) ?? []), c]);
  }
  return (
    <View style={{ gap: space(2), marginBottom: space(2) }}>
      {!selected ? (
        <Button
          label="Selecionar clips para enviar"
          sublabel="Escolhe vários (ou todos) e envia de uma vez"
          onPress={onSelecting}
        />
      ) : null}
      {byPlayer.length > 0 ? (
        <Card style={{ gap: space(1) }}>
          <Text style={styles.sessionTitle}>Por jogadora · todos os jogos</Text>
          <View style={styles.motiveRow}>
            {byPlayer.map((g) => (
              <Pressable
                key={g.player.n + g.player.nome}
                onPress={() => setForPlayer({ player: g.player, clips: g.clips, scope: 'todos os jogos' })}
                style={styles.playerChip}
              >
                <Text style={styles.motiveChipText}>
                  {playerLabel(g.player)} ({g.clips.length})
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
      {forPlayer ? (
        <PlayerClipsModal
          player={forPlayer.player}
          clips={forPlayer.clips}
          scope={forPlayer.scope}
          onPlay={(items) => {
            setForPlayer(null);
            onPlay(items, 0);
          }}
          onClose={() => setForPlayer(null)}
        />
      ) : null}
      {[...bySession.entries()].map(([sessionId, list]) => (
        <Card key={sessionId}>
          <View style={styles.sessionHeader}>
            <Text style={[styles.sessionTitle, { flex: 1 }]}>Recebidos · jogo de {sessionLabel(sessionId)}</Text>
            {selected ? (
              (() => {
                const all = list.every((c) => selected.has(c.id));
                return (
                  <Button
                    label={all ? 'Tirar este jogo' : 'Todos deste jogo'}
                    variant="ghost"
                    onPress={() => onToggle(list.map((c) => c.id), !all)}
                  />
                );
              })()
            ) : null}
          </View>
          <Text style={[styles.muted, { marginBottom: space(1) }]}>
            Do {list[0].phone} · {list.length} clip{list.length === 1 ? '' : 's'}
          </Text>
          {willPrune === sessionId ? <PruneWarning /> : null}
          {groupByMotive(list, notes, getMotives()).length > 0 ? (
            <View style={styles.motiveRow}>
              <Text style={styles.muted}>Ver seguidos:</Text>
              {groupByMotive(
                list.slice().sort((a, b) => a.startMs - b.startMs),
                notes,
                getMotives()
              ).map((g) => (
                <Pressable key={g.motive} onPress={() => onPlay(g.clips.map(toItem), 0)} style={styles.motiveChip}>
                  <Text style={styles.motiveChipText}>
                    {g.motive} ({g.clips.length})
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {(() => {
            // Jogadoras só deste jogo.
            const groups = groupByPlayer(list.slice().sort((a, b) => a.startMs - b.startMs), notes, getRoster());
            return groups.length > 0 ? (
              <View style={styles.motiveRow}>
                <Text style={styles.muted}>Por jogadora:</Text>
                {groups.map((g) => (
                  <Pressable
                    key={g.player.n + g.player.nome}
                    onPress={() => setForPlayer({ player: g.player, clips: g.clips, scope: `jogo de ${sessionLabel(sessionId)}` })}
                    style={styles.playerChip}
                  >
                    <Text style={styles.motiveChipText}>
                      {playerLabel(g.player)} ({g.clips.length})
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null;
          })()}
          {list
            .slice()
            .sort((a, b) => a.startMs - b.startMs)
            .map((c) => {
              const isOn = selected?.has(c.id) ?? false;
              return (
                <Pressable
                  key={c.id}
                  disabled={!selected}
                  onPress={() => onToggle([c.id], !isOn)}
                  style={[styles.item, styles.itemTone, toneBackground(notes[c.id]?.tone)]}
                >
                  <View style={styles.itemHeader}>
                    {selected ? <Text style={[styles.check, isOn && styles.checkOn]}>{isOn ? '☑' : '☐'}</Text> : null}
                    <View style={{ flex: 1 }}>
                      <ClipTitle id={c.id} name={c.name} onEdit={() => onTitle(c)} style={styles.rowTitle} />
                      <Text style={styles.muted}>
                        {formatClock(c.startMs)} – {formatClock(c.endMs)} ({formatDuration(c.endMs - c.startMs)}) ·{' '}
                        {formatBytes(c.sizeBytes)}
                        {c.leve ? ' · cópia leve' : ''}
                      </Text>
                      <View style={styles.tagRow}>
                        <ToneToggle value={notes[c.id]?.tone} onChange={(t) => setNotes(c.id, { tone: t })} />
                        <Pressable onPress={() => onMotive(c)} hitSlop={6}>
                          <Text style={notes[c.id]?.motive ? styles.motiveText : styles.muted}>
                            {notes[c.id]?.motive ?? '+ motivo'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => onPlayers(c)} hitSlop={6}>
                          <Text style={notes[c.id]?.players?.length ? styles.playersText : styles.muted}>
                            {playersShort(notes[c.id]?.players) ?? '+ jogadora'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    {!selected ? (
                      <Pressable onPress={() => onDelete(c)} hitSlop={12} style={styles.trash}>
                        <Text style={styles.trashText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!selected ? (
                    <View style={styles.actions}>
                      <Button label="▶ Ver" onPress={() => onPlay([toItem(c)], 0)} style={styles.action} />
                      <Button label="Galeria" onPress={() => run(() => saveToGallery(c.uri))} style={styles.action} />
                      <Button label="Partilhar" onPress={() => shareClip(c.id, c.uri, c.name)} style={styles.action} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
        </Card>
      ))}
    </View>
  );
}

/** Clips de uma jogadora (todos os jogos guardados): ver seguidos ou enviar todos. */
function PlayerClipsModal({
  player,
  clips,
  scope,
  onPlay,
  onClose,
}: {
  player: Player;
  clips: ReceivedClip[];
  scope: string;
  onPlay: (items: AnalysisItem[]) => void;
  onClose: () => void;
}) {
  const items = clips.map((c) => ({ id: c.id, uri: c.uri, title: c.name }));
  const notes = allNotes();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.modalCard}>
          <Text style={styles.sessionTitle}>
            {playerLabel(player)} · {clips.length} clip{clips.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.muted}>{scope}</Text>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 6 }}>
            {clips.map((c) => (
              <Text key={c.id} style={styles.muted}>
                • {sessionLabel(c.sessionId)} · {formatClock(c.startMs)} · {notes[c.id]?.title || (notes[c.id]?.motive ?? 'sem motivo')}
                {(notes[c.id]?.moments?.length ?? 0) > 0 ? ' · com desenhos' : ''}
              </Text>
            ))}
          </ScrollView>
          <Button label="▶ Ver seguidos" variant="primary" size="l" onPress={() => onPlay(items)} />
          <Button
            label="Enviar todos (WhatsApp…)"
            sublabel="Os que têm corte ou desenhos vão com os desenhos"
            onPress={() => {
              onClose();
              shareMany(items, `Clips · ${playerLabel(player)}`).catch((e) =>
                Alert.alert('Erro', e instanceof Error ? e.message : String(e))
              );
            }}
          />
          <Button label="Fechar" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PruneWarning() {
  return (
    <View style={styles.warnBox}>
      <Text style={styles.warnText}>
        Será apagado no próximo jogo (ficam só os últimos {KEEP_GAMES}). Guarda na Galeria ou partilha o que quiseres manter.
      </Text>
    </View>
  );
}

/** "20261014-213005" → "14/10 21:30" */
function sessionLabel(id: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(id);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : id;
}

const styles = StyleSheet.create({
  motiveRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(1), marginBottom: space(1) },
  motiveChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: space(1.5),
    paddingVertical: 6,
  },
  motiveChipText: { color: '#fff', fontWeight: '700' },
  motiveText: { color: colors.accent, fontWeight: '700', marginTop: 2 },
  playersText: { color: '#5AA2FF', fontWeight: '700', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space(1.5), rowGap: 4, marginTop: 4 },
  itemTone: { paddingHorizontal: space(1), borderRadius: radius.s },
  check: { color: colors.muted, fontSize: 26, marginRight: space(0.5) },
  checkOn: { color: colors.accent },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space(1),
    paddingVertical: space(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  selectText: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  playerChip: { borderRadius: radius.pill, backgroundColor: '#2D7FF9', paddingHorizontal: space(1.5), paddingVertical: 6 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    gap: space(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    padding: space(2),
  },
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
