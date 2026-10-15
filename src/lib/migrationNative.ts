import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type PendingTransfer = { id: string; payload: string };

const BasicMigration = registerPlugin<{
  getPending(): Promise<{ transfer: PendingTransfer | null }>;
  clearPending(options: { id: string }): Promise<void>;
  openBasic(): Promise<void>;
  addListener(event: 'transferReady', callback: (transfer: PendingTransfer) => void): Promise<PluginListenerHandle>;
}>('BasicMigration');

export function nativeMigration(): boolean { return Capacitor.getPlatform() === 'android'; }

export async function getPendingTransfer(): Promise<PendingTransfer | null> {
  return nativeMigration() ? (await BasicMigration.getPending()).transfer : null;
}

export async function listenForTransfer(callback: (transfer: PendingTransfer) => void): Promise<PluginListenerHandle> {
  if (!nativeMigration()) return { remove: async () => {} };
  return BasicMigration.addListener('transferReady', callback);
}

export async function clearPendingTransfer(id: string): Promise<void> {
  if (!nativeMigration()) throw new Error('MIGRATION_ANDROID_ONLY');
  await BasicMigration.clearPending({ id });
}

export async function openBasicForTransfer(): Promise<void> {
  if (!nativeMigration()) throw new Error('MIGRATION_ANDROID_ONLY');
  await BasicMigration.openBasic();
}
