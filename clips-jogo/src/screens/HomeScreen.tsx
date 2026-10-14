import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isEngineAvailable } from '../../modules/clip-engine';
import { Button } from '../components/ui';
import { colors, space } from '../theme';

type Props = {
  onRecord: () => void;
  onRemote: () => void;
  onClips: () => void;
};

export function HomeScreen({ onRecord, onRemote, onClips }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Clips de Jogo</Text>
        <Text style={styles.subtitle}>Grava o jogo inteiro e tira clips sem parar a gravação. Funciona sem internet.</Text>
      </View>

      <View style={styles.choices}>
        <Button
          label="Gravar"
          sublabel="Este dispositivo filma o jogo (no tripé)"
          variant="primary"
          size="xl"
          onPress={onRecord}
          disabled={!isEngineAvailable}
          style={styles.choice}
        />
        <Button
          label="Comando"
          sublabel="Este dispositivo pede os clips (em breve)"
          size="xl"
          onPress={onRemote}
          style={styles.choice}
        />
      </View>

      {!isEngineAvailable ? (
        <Text style={styles.notice}>
          O modo Gravar ainda não está disponível neste dispositivo (nesta versão só funciona em Android).
        </Text>
      ) : null}

      <Button label="Ver gravações e clips" variant="ghost" onPress={onClips} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: space(3), justifyContent: 'space-between' },
  header: { marginTop: space(4) },
  title: { color: colors.text, fontSize: 34, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: space(1), lineHeight: 22 },
  choices: { gap: space(2) },
  choice: { minHeight: 140 },
  notice: { color: colors.warn, textAlign: 'center', marginBottom: space(1) },
});
