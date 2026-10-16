import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { playerLabel, togglePlayer } from '../lib/annotations';
import { getRoster, setRoster, useNotesVersion } from '../remote/notesStore';
import { colors, radius, space } from '../theme';
import { Button, Card } from './ui';

/** Marcar as jogadoras de um clip (várias), com o plantel editável. */
export function PlayerPicker({
  visible,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  selected: string[];
  onChange: (players: string[]) => void;
  onClose: () => void;
}) {
  useNotesVersion();
  const roster = getRoster();
  const [editing, setEditing] = useState(roster.length === 0);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{editing ? 'Plantel' : 'Jogadoras no clip'}</Text>
              <Button label={editing ? 'Concluído' : 'Editar plantel'} variant="ghost" onPress={() => setEditing(!editing)} />
            </View>
            {editing ? (
              <RosterEditor />
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.chips}>
                  {roster.map((p) => {
                    const on = selected.includes(p.n);
                    return (
                      <Pressable key={p.n + p.nome} onPress={() => onChange(togglePlayer(selected, p.n))} style={[styles.chip, on && styles.chipOn]}>
                        <Text style={[styles.chipText, on && { color: '#fff' }]}>{playerLabel(p)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Button label="Concluído" variant="primary" onPress={onClose} />
              </>
            )}
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Lista do plantel: importada da Agenda do Treinador ou escrita à mão. */
export function RosterEditor() {
  useNotesVersion();
  const roster = getRoster();
  const [n, setN] = useState('');
  const [nome, setNome] = useState('');
  const add = () => {
    const num = n.trim();
    if (!num && !nome.trim()) return;
    setRoster([...roster.filter((p) => !(num && p.n === num)), { n: num, nome: nome.trim() }]);
    setN('');
    setNome('');
  };
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={styles.muted}>
        Na Agenda do Treinador (neste tablet): Plantel → "Enviar para Clips de Jogo". Ou escreve aqui.
      </Text>
      <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={styles.chips}>
        {roster.length === 0 ? <Text style={styles.muted}>Ainda sem jogadoras.</Text> : null}
        {roster.map((p) => (
          <View key={p.n + p.nome} style={[styles.chip, styles.chipEdit]}>
            <Text style={styles.chipText}>{playerLabel(p)}</Text>
            <Pressable hitSlop={10} onPress={() => setRoster(roster.filter((x) => x !== p))}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={styles.addRow}>
        <TextInput
          value={n}
          onChangeText={setN}
          placeholder="Nº"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          style={[styles.input, { flex: 0, width: 64 }]}
        />
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Button label="Adicionar" variant="primary" onPress={add} />
      </View>
    </View>
  );
}

/** Fila de jogadoras para tocar rapidamente (várias). */
export function PlayerChips({ value, onChange }: { value: string[]; onChange: (players: string[]) => void }) {
  useNotesVersion();
  const roster = getRoster();
  if (roster.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {roster.map((p) => {
        const on = value.includes(p.n);
        return (
          <Pressable key={p.n + p.nome} onPress={() => onChange(togglePlayer(value, p.n))} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && { color: '#fff' }]}>{playerLabel(p)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** "#8, #11" para mostrar num clip. */
export function playersShort(players: string[] | undefined): string | null {
  if (!players?.length) return null;
  return players.map((n) => (n ? `#${n}` : '?')).join(', ');
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  cardWrap: { width: '100%', maxWidth: 600 },
  card: { gap: space(1.5), maxHeight: 560 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  row: { flexDirection: 'row', gap: space(1), paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    minHeight: 40,
    paddingHorizontal: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  chipOn: { backgroundColor: '#2D7FF9', borderColor: '#2D7FF9' },
  chipEdit: { borderColor: colors.muted },
  chipText: { color: colors.text, fontWeight: '700' },
  remove: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  addRow: { flexDirection: 'row', gap: space(1), alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.s,
    paddingHorizontal: space(1.5),
    fontSize: 16,
  },
});
