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
};

declare class ClipEngineNative extends NativeModule<Events> {
  requestPermissionsAsync(): Promise<PermissionResult>;
  getPermissionsAsync(): Promise<PermissionResult>;
  getStatus(): EngineStatus;
  getRecordingTimeMs(): number;
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
