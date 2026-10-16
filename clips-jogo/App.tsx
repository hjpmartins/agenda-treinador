import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
