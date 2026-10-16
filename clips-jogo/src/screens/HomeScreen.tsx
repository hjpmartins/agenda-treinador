import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipEngine, isEngineAvailable } from '../../modules/clip-engine';
import { Button, Card } from '../components/ui';
import { UpdatePanel } from '../components/UpdatePanel';
import { RosterEditor } from '../components/PlayerPicker';
import { getRoster, useNotesVersion } from '../remote/notesStore';
import { colors, space } from '../theme';
import appConfig from '../../app.json';

type Props = {
  onRecord: () => void;
  onRemote: () => void;
  onClips: () => void;
};

export function HomeScreen({ onRecord, onRemote, onClips }: Props) {
  useNotesVersion();
  const [showRoster, setShowRoster] = useState(false);
  const [crash, setCrash] = useState<string | null>(() => {
    try {
      return ClipEngine?.getLastCrash() ?? null;
    } catch {
      return null;
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.root}>
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
            sublabel="Este dispositivo pede os clips (tablet)"
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

        {crash ? (
          <Card style={styles.crash}>
            <Text style={styles.crashTitle}>A app fechou inesperadamente da última vez</Text>
            <Text style={styles.crashHint}>
              Tira uma captura de ecrã a esta mensagem e envia-a a quem está a desenvolver a app.
            </Text>
            <ScrollView style={styles.crashBox}>
              <Text style={styles.crashText} selectable>
                {crash}
              </Text>
            </ScrollView>
            <Button
              label="OK"
              onPress={() => {
                ClipEngine?.clearLastCrash();
                setCrash(null);
              }}
            />
          </Card>
        ) : null}

        <View style={styles.bottom}>
          <Button label="Ver gravações e clips" variant="ghost" onPress={onClips} />
        <Button label={`Plantel (${getRoster().length})`} variant="ghost" onPress={() => setShowRoster(true)} />
          {isEngineAvailable ? (
            <UpdatePanel currentVersion={appConfig.expo.version} />
          ) : (
            <Text style={styles.version}>Versão {appConfig.expo.version}</Text>
          )}
        </View>
      </ScrollView>
      <Modal visible={showRoster} transparent animationType="fade" onRequestClose={() => setShowRoster(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Plantel</Text>
            <RosterEditor />
            <Button label="Fechar" variant="primary" onPress={() => setShowRoster(false)} />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space(2) },
  modalCard: { width: '100%', maxWidth: 600, gap: space(1.5) },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  safe: { flex: 1, backgroundColor: colors.bg },
  root: {
    flexGrow: 1,
    padding: space(3),
    justifyContent: 'space-between',
    gap: space(2),
  },
  header: { marginTop: space(4) },
  title: { color: colors.text, fontSize: 34, fontWeight: '800' },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginTop: space(1),
    lineHeight: 22,
  },
  choices: { gap: space(2) },
  choice: { minHeight: 140 },
  bottom: { gap: space(1) },
  version: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: space(1),
  },
  crash: { gap: 8, borderWidth: 1, borderColor: colors.danger },
  crashTitle: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  crashHint: { color: colors.muted, fontSize: 13 },
  crashBox: {
    maxHeight: 180,
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 8,
  },
  crashText: { color: colors.text, fontSize: 11, fontFamily: 'monospace' },
  notice: { color: colors.warn, textAlign: 'center', marginBottom: space(1) },
});
