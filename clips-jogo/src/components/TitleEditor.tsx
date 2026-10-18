import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { clipTitle, getNotes, setNotes } from '../remote/notesStore';
import { colors, radius, space } from '../theme';
import { Button, Card } from './ui';

/** Escrever ou mudar o título de um clip (fica no tablet; vai como texto ao enviar). */
export function TitleEditor({
  clip,
  onClose,
}: {
  /** Clip a editar (id + nome que veio do telemóvel), ou null para fechado. */
  clip: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (clip) setText(getNotes(clip.id).title ?? '');
  }, [clip]);
  if (!clip) return null;
  const save = () => {
    setNotes(clip.id, { title: text.trim() || null });
    onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <Card style={styles.card}>
            <Text style={styles.title}>Título do clip</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={clip.name}
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <View style={styles.row}>
              {getNotes(clip.id).title ? (
                <Button
                  label="Tirar título"
                  variant="ghost"
                  onPress={() => {
                    setNotes(clip.id, { title: null });
                    onClose();
                  }}
                />
              ) : null}
              <View style={{ flex: 1 }} />
              <Button label="Cancelar" variant="ghost" onPress={onClose} />
              <Button label="Guardar" variant="primary" onPress={save} />
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Título do clip para tocar e editar ("✎" quando ainda não tem título). */
export function ClipTitle({
  id,
  name,
  onEdit,
  style,
}: {
  id: string;
  name: string;
  onEdit: () => void;
  style?: object;
}) {
  const own = !!getNotes(id).title?.trim();
  return (
    <Pressable onPress={onEdit} hitSlop={6}>
      <Text style={style} numberOfLines={2}>
        {clipTitle(id, name)}
        <Text style={styles.pen}>{own ? '  ✎' : '  ✎ título'}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'flex-start', padding: space(2), paddingTop: '12%' },
  cardWrap: { width: '100%', maxWidth: 560 },
  card: { gap: space(1.5) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  input: {
    height: 52,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    borderRadius: radius.s,
    paddingHorizontal: space(1.5),
    fontSize: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  pen: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
