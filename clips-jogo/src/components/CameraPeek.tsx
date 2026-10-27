import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Button } from './ui';

/** De quanto em quanto tempo se pede uma imagem nova (só enquanto esta janela está aberta). */
const EVERY_MS = 1500;

/**
 * "Ver câmara": imagem do que o telemóvel está a filmar, atualizada de 1,5 em 1,5 s,
 * para confirmar o enquadramento (ninguém à frente, ângulo certo) sem ir à bancada.
 * Não é vídeo: assim não aquece mais o telemóvel.
 */
export function CameraPeek({ baseUrl, token, onClose }: { baseUrl: string; token: string; onClose: () => void }) {
  // Hora do pedido no endereço: nunca se repete (com um contador que recomeçava em 0,
  // o tablet voltava a mostrar imagens antigas que tinha guardado).
  const [stamp, setStamp] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState<number | null>(null);
  /** Última imagem que carregou (fica à vista enquanto a seguinte carrega). */
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (!loading.current) setStamp(Date.now());
    }, EVERY_MS);
    return () => clearInterval(t);
  }, []);

  const next = `${baseUrl}/api/preview.jpg?token=${encodeURIComponent(token)}&t=${stamp}`;
  useEffect(() => {
    loading.current = true;
  }, [next]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Câmara do telemóvel</Text>
            <Button label="Fechar" variant="ghost" onPress={onClose} />
          </View>
          <View style={styles.frame}>
            {shown ? <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="contain" fadeDuration={0} /> : null}
            {/* A imagem nova carrega por cima, invisível; quando chega passa a ser a mostrada. */}
            <Image
              key={next}
              source={{ uri: next }}
              style={[StyleSheet.absoluteFill, { opacity: 0 }]}
              fadeDuration={0}
              onLoad={() => {
                loading.current = false;
                setShown(next);
                setShownAt(Date.now());
                setError(null);
              }}
              onError={() => {
                loading.current = false;
                setError('Sem imagem. No telemóvel, o ecrã Gravar tem de estar aberto e a câmara ligada (fora do modo espera e da pausa).');
              }}
            />
            {!shown && !error ? <Text style={styles.muted}>A pedir imagem…</Text> : null}
          </View>
          {error ? (
            <Text style={styles.warn}>{error}</Text>
          ) : (
            <Text style={styles.muted}>
              {shownAt ? `Imagem das ${new Date(shownAt).toLocaleTimeString('pt-PT')} · ` : ''}Atualiza sozinha. Não é vídeo: não aquece o
              telemóvel.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  card: { width: '100%', maxWidth: 820, gap: space(1.5), backgroundColor: colors.surface, borderRadius: radius.l, padding: space(2) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.m, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted, fontSize: 14 },
  warn: { color: colors.warn, fontSize: 14 },
});
