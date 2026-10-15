import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { addEngineListener, ClipEngine } from '../../modules/clip-engine';
import { fetchUpdate, type ReleaseInfo } from '../lib/update';
import { formatBytes } from '../lib/format';
import { colors, space } from '../theme';
import { Button, Card, ProgressBar } from './ui';

type State =
  | { kind: 'idle' }
  | { kind: 'checking'; manual: boolean }
  | { kind: 'upToDate' }
  | { kind: 'offline' }
  | { kind: 'available'; release: ReleaseInfo }
  | { kind: 'downloading'; release: ReleaseInfo; progress: number }
  | { kind: 'needsPermission'; release: ReleaseInfo; path: string }
  | { kind: 'installing'; release: ReleaseInfo; path: string }
  | { kind: 'error'; release: ReleaseInfo; message: string };

/** Procura uma versão nova ao abrir a app e instala-a sem passar pelo GitHub. */
export function UpdatePanel({ currentVersion }: { currentVersion: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const stateRef = useRef(state);
  stateRef.current = state;

  const check = useCallback(
    async (manual: boolean) => {
      setState({ kind: 'checking', manual });
      try {
        const release = await fetchUpdate(currentVersion);
        if (release) {
          setState({ kind: 'available', release });
        } else {
          ClipEngine?.clearUpdates();
          setState(manual ? { kind: 'upToDate' } : { kind: 'idle' });
        }
      } catch {
        setState(manual ? { kind: 'offline' } : { kind: 'idle' });
      }
    },
    [currentVersion],
  );

  useEffect(() => {
    check(false);
  }, [check]);

  const install = useCallback(async (release: ReleaseInfo, path: string) => {
    if (!ClipEngine) return;
    if (!ClipEngine.canInstallUpdates()) {
      setState({ kind: 'needsPermission', release, path });
      return;
    }
    setState({ kind: 'installing', release, path });
    try {
      await ClipEngine.installUpdate(path);
    } catch (e) {
      setState({
        kind: 'error',
        release,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const start = useCallback(
    async (release: ReleaseInfo) => {
      if (!ClipEngine) return;
      let path = ClipEngine.getDownloadedUpdate(release.version);
      if (!path) {
        setState({ kind: 'downloading', release, progress: 0 });
        const sub = addEngineListener('onUpdateProgress', ({ bytes, total }) => {
          const t = total > 0 ? total : release.sizeBytes;
          setState({
            kind: 'downloading',
            release,
            progress: t > 0 ? bytes / t : 0,
          });
        });
        try {
          path = await ClipEngine.downloadUpdate(release.apkUrl, release.version);
        } catch (e) {
          setState({
            kind: 'error',
            release,
            message: e instanceof Error ? e.message : String(e),
          });
          return;
        } finally {
          sub?.remove();
        }
      }
      await install(release, path);
    },
    [install],
  );

  // Ao voltar das definições (autorização dada) ou do instalador (cancelado), segue em frente.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const cur = stateRef.current;
      if (cur.kind === 'needsPermission' && ClipEngine?.canInstallUpdates()) install(cur.release, cur.path);
      else if (cur.kind === 'installing') setState({ kind: 'available', release: cur.release });
    });
    return () => sub.remove();
  }, [install]);

  if (state.kind === 'idle' || state.kind === 'upToDate' || state.kind === 'offline' || state.kind === 'checking') {
    const msg =
      state.kind === 'upToDate'
        ? 'Tens a versão mais recente.'
        : state.kind === 'offline'
          ? 'Sem internet: não foi possível procurar atualizações.'
          : null;
    return (
      <View style={styles.footer}>
        <Text style={styles.version}>Versão {currentVersion}</Text>
        <Button
          label={state.kind === 'checking' && state.manual ? 'A procurar…' : 'Procurar atualizações'}
          variant="ghost"
          onPress={() => check(true)}
          disabled={state.kind === 'checking'}
          style={styles.checkButton}
        />
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </View>
    );
  }

  const { release } = state;
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Nova versão {release.version} disponível</Text>
      <Text style={styles.sub}>
        Tens a {currentVersion}.{release.sizeBytes > 0 ? ` Download de ${formatBytes(release.sizeBytes)}.` : ''} As gravações e
        clips mantêm-se.
      </Text>
      {release.notes ? (
        <Text style={styles.notes} numberOfLines={6}>
          {release.notes}
        </Text>
      ) : null}

      {state.kind === 'available' ? (
        <Button label="Atualizar agora" variant="primary" size="l" onPress={() => start(release)} />
      ) : null}

      {state.kind === 'downloading' ? (
        <View style={styles.progress}>
          <Text style={styles.sub}>A descarregar… {Math.round(state.progress * 100)}%</Text>
          <ProgressBar value={state.progress} />
        </View>
      ) : null}

      {state.kind === 'needsPermission' ? (
        <View style={styles.progress}>
          <Text style={styles.warn}>
            Falta um passo (só da primeira vez): autorizar esta app a instalar atualizações. Carrega no botão, ativa "Permitir
            desta fonte" e volta atrás.
          </Text>
          <Button
            label="Abrir definições"
            variant="primary"
            size="l"
            onPress={() => ClipEngine?.openInstallPermissionSettings()}
          />
          <Button label="Já autorizei — instalar" onPress={() => install(release, state.path)} />
        </View>
      ) : null}

      {state.kind === 'installing' ? (
        <Text style={styles.sub}>No ecrã do Android, carrega em "Atualizar" (ou "Instalar").</Text>
      ) : null}

      {state.kind === 'error' ? (
        <View style={styles.progress}>
          <Text style={styles.warn}>{state.message}</Text>
          <Button label="Tentar outra vez" variant="primary" onPress={() => start(release)} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: 4 },
  version: { color: colors.muted, fontSize: 12 },
  checkButton: { minHeight: 40, paddingHorizontal: space(2) },
  msg: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  card: { gap: space(1), borderWidth: 1, borderColor: colors.accent },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14 },
  notes: { color: colors.text, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.warn, fontSize: 14 },
  progress: { gap: space(1) },
});
