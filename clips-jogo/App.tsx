import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { parseRosterLink } from './src/lib/annotations';
import { setRoster } from './src/remote/notesStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExportOverlay } from './src/components/exportShare';
import { ClipsScreen } from './src/screens/ClipsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { RemoteScreen } from './src/screens/RemoteScreen';

type Screen = 'home' | 'record' | 'remote' | 'clips';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const home = () => setScreen('home');

  // Plantel enviado pela Agenda do Treinador (clipsjogo://plantel?d=…).
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const roster = parseRosterLink(url);
      if (!roster) return;
      setRoster(roster);
      Alert.alert('Plantel importado', `${roster.length} jogadora${roster.length === 1 ? '' : 's'} da Agenda do Treinador.`);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden={screen === 'record' || screen === 'remote'} />
      {screen === 'home' ? (
        <HomeScreen
          onRecord={() => setScreen('record')}
          onRemote={() => setScreen('remote')}
          onClips={() => setScreen('clips')}
        />
      ) : screen === 'record' ? (
        <RecordScreen onBack={home} onClips={() => setScreen('clips')} />
      ) : screen === 'remote' ? (
        <RemoteScreen onBack={home} />
      ) : (
        <ClipsScreen onBack={home} />
      )}
      <ExportOverlay />
    </SafeAreaProvider>
  );
}
