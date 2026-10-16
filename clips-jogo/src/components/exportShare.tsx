import { useSyncExternalStore } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { addEngineListener, ClipEngine } from '../../modules/clip-engine';
import { getNotes } from '../remote/notesStore';
import { colors, space } from '../theme';
import { share } from './media';
import { Card, ProgressBar } from './ui';

/** Tempo que a imagem fica parada em cada desenho, no vídeo enviado. */
export const FREEZE_MS = 4000;

// Progresso da criação do vídeo (um de cada vez), mostrado por <ExportOverlay/>.
let progress: number | null = null;
const listeners = new Set<() => void>();
function setProgress(p: number | null) {
  progress = p;
  listeners.forEach((l) => l());
}

export function hasEdits(id: string): boolean {
  const n = getNotes(id);
  return !!n.trim || (n.moments?.length ?? 0) > 0;
}

/** Cria o vídeo com o corte e os desenhos e abre a partilha (WhatsApp, YouTube, …). */
export async function shareWithDrawings(id: string, uri: string) {
  if (!ClipEngine) throw new Error('Indisponível neste dispositivo.');
  if (progress != null) return;
  const n = getNotes(id);
  setProgress(0);
  const sub = addEngineListener('onExportProgress', ({ progress: p }) => setProgress(p));
  try {
    const out = await ClipEngine.exportAnnotated(
      uri,
      n.trim?.startMs ?? 0,
      n.trim?.endMs ?? 0,
      JSON.stringify(n.moments ?? []),
      FREEZE_MS
    );
    setProgress(null);
    await share(out);
  } finally {
    sub?.remove();
    setProgress(null);
  }
}

/** Partilhar um clip: se tiver corte ou desenhos, pergunta qual versão enviar. */
export function shareClip(id: string, uri: string, title: string) {
  const fail = (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e));
  if (!hasEdits(id)) {
    share(uri).catch(fail);
    return;
  }
  Alert.alert('Partilhar', title, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Original', onPress: () => share(uri).catch(fail) },
    { text: 'Com desenhos', onPress: () => shareWithDrawings(id, uri).catch(fail) },
  ]);
}

export function ExportOverlay() {
  const p = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => progress
  );
  if (p == null) return null;
  return (
    <Modal visible transparent animationType="fade" supportedOrientations={['landscape', 'portrait']}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Text style={styles.title}>A preparar o vídeo com os desenhos…</Text>
          <ProgressBar value={p} />
          <Text style={styles.muted}>{Math.round(p * 100)}%</Text>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  card: { width: '100%', maxWidth: 420, gap: space(1.5) },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted },
});
