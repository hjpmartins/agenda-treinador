import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { Button } from './ui';

export async function saveToGallery(uri: string) {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert('Sem permissão', 'Autoriza o acesso à galeria nas definições para guardar vídeos.');
    return;
  }
  await Asset.create(uri);
  Alert.alert('Guardado', 'O vídeo foi guardado na galeria.');
}

export async function share(uri: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Partilha indisponível', 'Este dispositivo não permite partilhar ficheiros.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'video/mp4' });
}

/** Corre uma ação e mostra o erro, se houver. */
export function run(task: () => Promise<void>) {
  task().catch((e) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)));
}

export function PlayerModal({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.playerRoot}>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <View style={styles.playerBar}>
          <Text style={styles.title}>{title}</Text>
          <Button label="Fechar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  playerRoot: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  playerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space(2),
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
