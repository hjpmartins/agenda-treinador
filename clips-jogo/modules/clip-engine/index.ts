import { requireNativeView, requireOptionalNativeModule, type NativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export type EngineState = 'idle' | 'preview' | 'recording' | 'finalizing';
export type ClipStatus = 'pending' | 'cutting' | 'ready' | 'failed';
export type Quality = '1080p' | '720p';

export type Clip = {
  id: string;
  sessionId: string;
  name: string;
  status: ClipStatus;
  requestedStartMs: number;
  requestedEndMs: number;
  /** Início real (keyframe), pode ser até ~1 s antes do pedido. */
  startMs: number;
  endMs: number;
  createdAtMs: number;
  uri: string | null;
  sizeBytes: number;
  error: string | null;
};

export type Session = {
  id: string;
  startedAtMs: number;
  status: 'recording' | 'finalizing' | 'done' | 'interrupted';
  quality: Quality;
  durationMs: number;
  fullVideoUris: string[];
  clips: Clip[];
};

export type EngineStatus = {
  state: EngineState;
  sessionId: string | null;
  recordingMs: number;
  segments: number;
  quality: Quality | null;
  width: number | null;
  height: number | null;
  batteryPercent: number | null;
  charging: boolean;
  thermal: 'normal' | 'quente' | 'critico';
  freeBytes: number;
  bytesPerSecond: number;
  hasMicrophone: boolean;
  linkActive: boolean;
  /** Modo espera: câmara desligada até começar a gravar. */
  standby: boolean;
  tabletConnected: boolean;
};

export type LinkInfo = {
  ssid: string | null;
  passphrase: string | null;
  security: string;
  ips: string[];
  port: number;
  token: string;
  /** Preenchido se a rede própria falhou (a ligação pode ainda funcionar por outro Wi-Fi). */
  hotspotError: string | null;
};

export type PermissionResult = { granted: boolean; canAskAgain: boolean; status: string };

type Events = {
  onStateChange(e: { state: EngineState }): void;
  onClipUpdate(clip: Clip): void;
  onFinalizeProgress(e: { sessionId: string; progress: number }): void;
  onError(e: { message: string }): void;
  onUpdateProgress(e: { bytes: number; total: number }): void;
  onExportProgress(e: { progress: number }): void;
};

declare class ClipEngineNative extends NativeModule<Events> {
  requestPermissionsAsync(): Promise<PermissionResult>;
  getPermissionsAsync(): Promise<PermissionResult>;
  getStatus(): EngineStatus;
  getRecordingTimeMs(): number;
  /** Modo espera: desliga câmara/encoder até gravar (o tablet pode iniciar a gravação). */
  setStandby(on: boolean): Promise<void>;
  /** Brilho do ecrã no mínimo (ecrã de repouso). */
  setScreenDim(on: boolean): void;
  /** Erro que fez a app fechar da última vez (null se não houve). */
  getLastCrash(): string | null;
  clearLastCrash(): void;
  /** Prepara a câmara/encoder nesta qualidade (só antes de gravar). */
  setQuality(quality: Quality): Promise<void>;
  startRecording(quality: Quality): Promise<string>;
  stopRecording(): Promise<void>;
  requestClip(id: string | null, startMs: number, endMs: number, name: string | null): Promise<Clip>;
  renameClip(sessionId: string, clipId: string, name: string): Promise<void>;
  deleteClip(sessionId: string, clipId: string): Promise<void>;
  listSessions(): Promise<Session[]>;
  deleteSession(sessionId: string): Promise<void>;
  recoverSession(sessionId: string): Promise<void>;

  // Ligação ao tablet (telemóvel)
  requestLinkPermissionsAsync(): Promise<PermissionResult>;
  startLink(): Promise<LinkInfo>;
  stopLink(): Promise<void>;
  // Ligação ao telemóvel (tablet)
  joinNetwork(ssid: string, passphrase: string, security: string): Promise<void>;
  leaveNetwork(): Promise<void>;
  /** Mantém o Wi-Fi fora do modo de poupança (tablet ligado à mão à rede do telemóvel). */
  keepWifiAwake(): Promise<void>;
  /** Sinal Wi-Fi deste aparelho: rssi em dBm (≥ -60 bom, < -75 fraco). */
  getWifiSignal(): { rssi: number | null; frequencyMHz: number | null; linkSpeedMbps: number | null };

  // Barra flutuante (tablet): pede clips por cima de outras apps
  canDrawOverlays(): boolean;
  openOverlayPermissionSettings(): void;
  /** A barra aparece sempre que a app sair do ecrã, até disarmFloatingBar(). */
  /** skipIds: clips que o tablet já tem ou apagou (a barra não os volta a copiar). */
  armFloatingBar(
    urls: string[],
    token: string,
    skipIds: string[],
    autoDownload: boolean,
    light: boolean,
    motives: string[]
  ): void;
  /** Motivos escolhidos na barra flutuante desde a última chamada (id do clip → motivo). */
  takeBarMotives(): Record<string, string>;
  disarmFloatingBar(): void;
  moveToBackground(): boolean;

  /**
   * Vídeo para enviar: só a parte cortada (endMs 0 = até ao fim), em 720p, com a imagem
   * parada freezeMs em cada desenho. momentsJson = JSON de [{ atMs, strokes }]. Devolve o uri.
   */
  exportAnnotated(srcUri: string, startMs: number, endMs: number, momentsJson: string, freezeMs: number): Promise<string>;

  // Atualizações da app
  /** Caminho do APK desta versão se já foi descarregado, senão null. */
  getDownloadedUpdate(version: string): string | null;
  downloadUpdate(url: string, version: string): Promise<string>;
  /** Android 8+: a app tem autorização para instalar apps? */
  canInstallUpdates(): boolean;
  openInstallPermissionSettings(): void;
  installUpdate(path: string): Promise<void>;
  clearUpdates(): void;
}

/** null em plataformas onde o motor ainda não existe (iOS nesta fase). */
export const ClipEngine = requireOptionalNativeModule<ClipEngineNative>('ClipEngine');

export const isEngineAvailable = ClipEngine != null;

export const CameraPreview: ComponentType<ViewProps> | null = isEngineAvailable
  ? requireNativeView<ViewProps>('ClipEngine')
  : null;

export function addEngineListener<K extends keyof Events>(event: K, listener: Events[K]): EventSubscription | null {
  return ClipEngine ? ClipEngine.addListener(event, listener) : null;
}
