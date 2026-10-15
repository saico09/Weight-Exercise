import { Capacitor, registerPlugin } from '@capacitor/core';

export type MigrationStatus = { available: boolean; reason?: 'missing' | 'outdated' | 'signature' };

const BasicMigration = registerPlugin<{
  getStatus(): Promise<MigrationStatus>;
  send(options: { payload: string }): Promise<void>;
}>('BasicMigration');

export function nativeMigration(): boolean { return Capacitor.getPlatform() === 'android'; }

export async function getMigrationStatus(): Promise<MigrationStatus> {
  if (!nativeMigration()) return { available: false };
  return BasicMigration.getStatus();
}

export async function sendBasicTransfer(payload: string): Promise<void> {
  if (!nativeMigration()) throw new Error('MIGRATION_ANDROID_ONLY');
  await BasicMigration.send({ payload });
}
