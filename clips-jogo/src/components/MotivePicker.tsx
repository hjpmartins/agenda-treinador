import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getMotives, setMotives, useNotesVersion } from '../remote/notesStore';
import { colors, radius, space } from '../theme';
import { Button, Card } from './ui';

/** Escolher o motivo de um clip (um só), com a lista de motivos editável. */
export function MotivePicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: string | null;
  onPick: (motive: string | null) => void;
  onClose: () => void;
}) {
  useNotesVersion();
  const motives = getMotives();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const add = () => {
    const m = text.trim();
    if (m && !motives.includes(m)) setMotives([...motives, m]);
    setText('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{editing ? 'Editar motivos' : 'Motivo do clip'}</Text>
              <Button label={editing ? 'Concluído' : 'Editar lista'} variant="ghost" onPress={() => setEditing(!editing)} />
            </View>
            <ScrollView contentContainerStyle={styles.chips}>
              {motives.map((m) =>
                editing ? (
                  <View key={m} style={[styles.chip, styles.chipEdit]}>
                    <Text style={styles.chipText}>{m}</Text>
                    <Pressable hitSlop={10} onPress={() => setMotives(motives.filter((x) => x !== m))}>
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable key={m} onPress={() => onPick(m)} style={[styles.chip, current === m && styles.chipOn]}>
                    <Text style={[styles.chipText, current === m && { color: '#fff' }]}>{m}</Text>
                  </Pressable>
                )
              )}
            </ScrollView>
            {editing ? (
              <View style={styles.addRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Novo motivo"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  onSubmitEditing={add}
                  returnKeyType="done"
                />
                <Button label="Adicionar" variant="primary" onPress={add} />
              </View>
            ) : current ? (
              <Button label="Sem motivo" variant="ghost" onPress={() => onPick(null)} />
            ) : null}
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Fila de motivos para tocar rapidamente (ex.: no painel do clip acabado de pedir). */
export function MotiveChips({ value, onChange }: { value: string | null; onChange: (m: string | null) => void }) {
  useNotesVersion();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {getMotives().map((m) => (
        <Pressable key={m} onPress={() => onChange(value === m ? null : m)} style={[styles.chip, value === m && styles.chipOn]}>
          <Text style={[styles.chipText, value === m && { color: '#fff' }]}>{m}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  cardWrap: { width: '100%', maxWidth: 560 },
  card: { gap: space(1.5), maxHeight: 520 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
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
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
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
