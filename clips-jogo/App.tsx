import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClipsScreen } from './src/screens/ClipsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RecordScreen } from './src/screens/RecordScreen';

type Screen = 'home' | 'record' | 'clips';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const home = () => setScreen('home');

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden={screen === 'record'} />
      {screen === 'home' ? (
        <HomeScreen
          onRecord={() => setScreen('record')}
          onRemote={() => Alert.alert('Em breve', 'O modo Comando chega na próxima fase (emparelhamento por QR).')}
          onClips={() => setScreen('clips')}
        />
      ) : screen === 'record' ? (
        <RecordScreen onBack={home} onClips={() => setScreen('clips')} />
      ) : (
        <ClipsScreen onBack={home} />
      )}
    </SafeAreaProvider>
  );
}
