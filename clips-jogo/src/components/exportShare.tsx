import { useState, useSyncExternalStore } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { addEngineListener, ClipEngine } from '../../modules/clip-engine';
import { clipTitle, getNotes } from '../remote/notesStore';
import { colors, radius, space } from '../theme';
import { Button, Card, ProgressBar } from './ui';

/** Tempo que a imagem fica parada em cada desenho, no vídeo enviado. */
export const FREEZE_MS = 4000;

// Progresso da criação do vídeo (um de cada vez), mostrado por <ExportOverlay/>.
let progress: number | null = null;
let label = 'A preparar o vídeo com os desenhos…';
const listeners = new Set<() => void>();
function setProgress(p: number | null, text?: string) {
  progress = p;
  if (text) label = text;
  listeners.forEach((l) => l());
}

export function hasEdits(id: string): boolean {
  const n = getNotes(id);
  return !!n.trim || !!n.crop || (n.moments?.length ?? 0) > 0;
}

/** 720 = leve (WhatsApp); 1080 = qualidade máxima (YouTube). */
export type ExportQuality = 720 | 1080;

/** Cria o vídeo com o corte e os desenhos. */
function exportOne(id: string, uri: string, quality: ExportQuality): Promise<string> {
  const n = getNotes(id);
  return ClipEngine!.exportAnnotated(
    uri,
    n.trim?.startMs ?? 0,
    n.trim?.endMs ?? 0,
    JSON.stringify(n.moments ?? []),
    FREEZE_MS,
    quality,
    n.crop ? JSON.stringify(n.crop) : ''
  );
}

/** Abre a partilha do Android (WhatsApp, YouTube, …) com os títulos como texto e nome dos ficheiros. */
async function sendFiles(files: { uri: string; title: string }[], chooserTitle: string, asFile = false) {
  if (!ClipEngine) throw new Error('Indisponível neste dispositivo.');
  const text = files.length === 1 ? files[0].title : files.map((f, i) => `${i + 1}. ${f.title}`).join('\n');
  await ClipEngine.shareFiles(
    files.map((f) => f.uri),
    files.map((f) => f.title),
    text,
    chooserTitle,
    // Como ficheiro, o WhatsApp manda-o como documento e não o comprime.
    asFile ? 'application/octet-stream' : 'video/mp4'
  );
}

/**
 * Vídeo editado (corte, desenhos, zoom) na qualidade máxima: o WhatsApp comprime à
 * parte, por isso convém partir do melhor original possível.
 */
export async function shareWithDrawings(id: string, uri: string, title: string, asFile = false) {
  const quality: ExportQuality = 1080;
  if (!ClipEngine) throw new Error('Indisponível neste dispositivo.');
  if (progress != null) return;
  setProgress(0, 'A preparar o vídeo editado…');
  const sub = addEngineListener('onExportProgress', ({ progress: p }) => setProgress(p));
  try {
    const out = await exportOne(id, uri, quality);
    setProgress(null);
    await sendFiles([{ uri: out, title }], title, asFile);
  } finally {
    sub?.remove();
    setProgress(null);
  }
}

/**
 * Envia vários clips de uma vez (ex.: todos os de uma jogadora): os que têm corte
 * ou desenhos vão na versão editada (qualidade máxima), os outros como estão.
 */
export async function shareMany(items: { id: string; uri: string; title: string }[], title: string) {
  if (!ClipEngine) throw new Error('Indisponível neste dispositivo.');
  if (progress != null || items.length === 0) return;
  const total = items.length;
  let index = 0;
  setProgress(0, `A preparar 1/${total}…`);
  const sub = addEngineListener('onExportProgress', ({ progress: p }) =>
    setProgress((index + p) / total, `A preparar ${index + 1}/${total}…`)
  );
  try {
    const out: { uri: string; title: string }[] = [];
    for (; index < total; index++) {
      const it = items[index];
      setProgress(index / total, `A preparar ${index + 1}/${total}…`);
      out.push({ uri: hasEdits(it.id) ? await exportOne(it.id, it.uri, 1080) : it.uri, title: clipTitle(it.id, it.title) });
    }
    setProgress(null);
    await sendFiles(out, title);
  } finally {
    sub?.remove();
    setProgress(null);
  }
}

// Janela "Partilhar" (o Alert do Android só tem 3 botões).
let asking: { id: string; uri: string; title: string; edited: boolean } | null = null;
function setAsking(a: typeof asking) {
  asking = a;
  listeners.forEach((l) => l());
}

/** Partilhar um clip: escolher como vídeo ou como ficheiro (e, se foi editado, qual versão). */
export function shareClip(id: string, uri: string, fallbackTitle: string) {
  setAsking({ id, uri, title: clipTitle(id, fallbackTitle), edited: hasEdits(id) });
}

/** "corte, desenhos e zoom" — o que o vídeo editado leva. */
function editsLabel(id: string): string {
  const n = getNotes(id);
  const parts = [n.trim ? 'corte' : null, (n.moments?.length ?? 0) > 0 ? 'desenhos' : null, n.crop ? 'zoom' : null].filter(
    (x): x is string => !!x
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0] ?? '—';
}

const fail = (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e));

function ShareChoice() {
  const a = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => asking
  );
  return a ? <ShareCard key={a.id} a={a} /> : null;
}

function ShareCard({ a }: { a: NonNullable<typeof asking> }) {
  const [version, setVersion] = useState<'edited' | 'original'>(a.edited ? 'edited' : 'original');
  const send = (asFile: boolean) => {
    setAsking(null);
    const task =
      version === 'edited' ? shareWithDrawings(a.id, a.uri, a.title, asFile) : sendFiles([{ uri: a.uri, title: a.title }], a.title, asFile);
    task.catch(fail);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setAsking(null)} supportedOrientations={['landscape', 'portrait']}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Text style={styles.title}>Partilhar</Text>
          <Text style={styles.muted} numberOfLines={2}>
            {a.title}
          </Text>
          {a.edited ? (
            <View style={styles.segmented}>
              {(['edited', 'original'] as const).map((v) => (
                <Pressable key={v} onPress={() => setVersion(v)} style={[styles.segment, version === v && styles.segmentOn]}>
                  <Text style={[styles.segmentText, version === v && { color: '#fff' }]}>
                    {v === 'edited' ? `Editado (${editsLabel(a.id)})` : 'Original'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button
            label="Enviar como vídeo"
            sublabel="WhatsApp, YouTube, Galeria… No WhatsApp, toca em HD antes de enviar."
            variant="primary"
            onPress={() => send(false)}
          />
          <Button
            label="Enviar como ficheiro · qualidade total"
            sublabel="No WhatsApp chega como documento e não perde qualidade (toca-se para ver)."
            onPress={() => send(true)}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setAsking(null)} />
        </Card>
      </View>
    </Modal>
  );
}

export function ExportOverlay() {
  const p = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => progress
  );
  if (p == null) return <ShareChoice />;
  const text = label;
  return (
    <Modal visible transparent animationType="fade" supportedOrientations={['landscape', 'portrait']}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Text style={styles.title}>{text}</Text>
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
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceHigh, borderRadius: radius.s, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.s - 2, paddingHorizontal: 6 },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 14, textAlign: 'center' },
});
