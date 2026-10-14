import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultData, demoData } from './model';

const preferences = vi.hoisted(() => ({
  values: new Map<string, string>(),
  get: vi.fn<(options: { key: string }) => Promise<{ value: string | null }>>(),
  set: vi.fn<(options: { key: string; value: string }) => Promise<void>>(),
  remove: vi.fn<(options: { key: string }) => Promise<void>>(),
  clear: vi.fn<() => Promise<void>>(),
}));

vi.mock('@capacitor/preferences', () => ({ Preferences: preferences }));

let storage: typeof import('./storage');
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  preferences.values.clear();
  preferences.get.mockReset().mockImplementation(async ({ key }) => ({ value: preferences.values.get(key) ?? null }));
  preferences.set.mockReset().mockImplementation(async ({ key, value }) => { preferences.values.set(key, value); });
  preferences.remove.mockReset().mockImplementation(async ({ key }) => { preferences.values.delete(key); });
  storage = await import('./storage');
});

describe('device persistence', () => {
  it('starts without invented records and reads only the app-owned key', async () => {
    expect(await storage.loadData()).toEqual(defaultData());
    expect(preferences.get).toHaveBeenCalledExactlyOnceWith({ key: storage.STORAGE_KEY });
    expect(preferences.set).not.toHaveBeenCalled();
  });

  it('round-trips profile, history and preferences through the native Preferences contract', async () => {
    const data = demoData(new Date(2026, 9, 14, 12));
    data.settings.theme = 'light';
    data.settings.weightUnit = 'lb';
    await storage.saveData(data);
    expect(await storage.loadData()).toEqual(data);
    expect(preferences.get.mock.invocationCallOrder[0]).toBeLessThan(preferences.set.mock.invocationCallOrder[0]);
  });

  it('preserves corrupt existing data and refuses to overwrite it until explicit reset', async () => {
    const original = '{ malformed profile';
    preferences.values.set(storage.STORAGE_KEY, original);
    await expect(storage.loadData()).rejects.toMatchObject({ code: 'invalid' });
    await expect(storage.saveData(defaultData())).rejects.toMatchObject({ code: 'invalid' });
    expect(preferences.values.get(storage.STORAGE_KEY)).toBe(original);
    expect(preferences.set).not.toHaveBeenCalled();
    await storage.clearData();
    await storage.saveData(defaultData());
    expect(await storage.loadData()).toEqual(defaultData());
  });

  it('does not overwrite a newer schema on a first save before a read', async () => {
    const futureSchema = JSON.stringify({ ...defaultData(), version: 2 });
    preferences.values.set(storage.STORAGE_KEY, futureSchema);
    await expect(storage.saveData(defaultData())).rejects.toMatchObject({ code: 'invalid' });
    expect(preferences.values.get(storage.STORAGE_KEY)).toBe(futureSchema);
    expect(preferences.set).not.toHaveBeenCalled();
  });

  it('snapshots data at invocation so later mutations cannot change a queued save', async () => {
    const data = demoData(new Date(2026, 9, 14, 12));
    const saving = storage.saveData(data);
    data.records[0].weightKg = 300;
    data.settings.notifications.days.length = 0;
    await saving;
    const persisted = await storage.loadData();
    expect(persisted.records[0].weightKg).toBe(86.4);
    expect(persisted.settings.notifications.days).toHaveLength(7);
  });

  it('waits for a pending save before reset so it cannot resurrect cleared history', async () => {
    await storage.loadData();
    let releaseWrite!: () => void;
    let signalWrite!: () => void;
    const enteredWrite = new Promise<void>(resolve => { signalWrite = resolve; });
    const writeGate = new Promise<void>(resolve => { releaseWrite = resolve; });
    preferences.set.mockImplementationOnce(async ({ key, value }) => {
      signalWrite();
      await writeGate;
      preferences.values.set(key, value);
    });
    const saving = storage.saveData(demoData());
    const resetting = storage.clearData();
    await enteredWrite;
    expect(preferences.remove).not.toHaveBeenCalled();
    releaseWrite();
    await Promise.all([saving, resetting]);
    expect(preferences.values.has(storage.STORAGE_KEY)).toBe(false);
    expect(await storage.loadData()).toEqual(defaultData());
  });

  it('reset only removes this app key and keeps other plugin preferences', async () => {
    preferences.values.set('another-plugin-key', 'keep me');
    await storage.saveData(demoData());
    await storage.clearData();
    expect(preferences.remove).toHaveBeenCalledExactlyOnceWith({ key: storage.STORAGE_KEY });
    expect(preferences.clear).not.toHaveBeenCalled();
    expect(preferences.values.get('another-plugin-key')).toBe('keep me');
  });

  it('reports native I/O failures while leaving the queue usable for retries', async () => {
    preferences.get.mockRejectedValueOnce(new Error('permission'));
    await expect(storage.loadData()).rejects.toMatchObject({ code: 'read' });
    expect(await storage.loadData()).toEqual(defaultData());
    preferences.set.mockRejectedValueOnce(new Error('disk full'));
    await expect(storage.saveData(defaultData())).rejects.toMatchObject({ code: 'write' });
    await storage.saveData(defaultData());
    preferences.remove.mockRejectedValueOnce(new Error('locked'));
    await expect(storage.clearData()).rejects.toMatchObject({ code: 'clear' });
    expect(preferences.values.has(storage.STORAGE_KEY)).toBe(true);
    await storage.clearData();
    expect(preferences.values.has(storage.STORAGE_KEY)).toBe(false);
  });

  it('rejects invalid outgoing profiles before touching existing storage', async () => {
    const data = demoData();
    data.profile!.heightCm = 0;
    await expect(storage.saveData(data)).rejects.toMatchObject({ code: 'write' });
    expect(preferences.get).not.toHaveBeenCalled();
    expect(preferences.set).not.toHaveBeenCalled();
  });
});
