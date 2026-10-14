import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
  getPlatform: vi.fn<() => string>(),
}));
const local = vi.hoisted(() => ({
  checkPermissions: vi.fn<() => Promise<{ display: string }>>(),
  requestPermissions: vi.fn<() => Promise<{ display: string }>>(),
  createChannel: vi.fn<(options: unknown) => Promise<void>>(),
  cancel: vi.fn<(options: { notifications: { id: number }[] }) => Promise<void>>(),
  schedule: vi.fn<(options: { notifications: Record<string, unknown>[] }) => Promise<void>>(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: native }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: local }));

let reminders: typeof import('./notifications');
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  native.isNativePlatform.mockReset().mockReturnValue(true);
  native.getPlatform.mockReset().mockReturnValue('android');
  local.checkPermissions.mockReset().mockResolvedValue({ display: 'prompt' });
  local.requestPermissions.mockReset().mockResolvedValue({ display: 'granted' });
  local.createChannel.mockReset().mockResolvedValue(undefined);
  local.cancel.mockReset().mockResolvedValue(undefined);
  local.schedule.mockReset().mockResolvedValue(undefined);
  reminders = await import('./notifications');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('native reminders', () => {
  it('checks permission without opening a permission prompt', async () => {
    expect(await reminders.getNotificationPermission()).toBe('prompt');
    expect(local.checkPermissions).toHaveBeenCalledOnce();
    expect(local.requestPermissions).not.toHaveBeenCalled();
    expect(local.schedule).not.toHaveBeenCalled();
  });

  it('requests permission only on enable and maps local weekdays to native calendar days', async () => {
    const result = await reminders.configureNotifications({ enabled: true, time: '08:35', days: [6, 1, 0, 1] });
    expect(result.enabled).toBe(true);
    expect(local.requestPermissions).toHaveBeenCalledOnce();
    expect(local.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'weight-exercise-daily' }));
    expect(local.schedule).toHaveBeenCalledExactlyOnceWith({ notifications: [
      expect.objectContaining({ id: 810100, isExactNotification: false, schedule: { on: { weekday: 1, hour: 8, minute: 35, second: 0 }, repeats: true } }),
      expect.objectContaining({ id: 810101, isExactNotification: false, schedule: { on: { weekday: 2, hour: 8, minute: 35, second: 0 }, repeats: true } }),
      expect.objectContaining({ id: 810106, isExactNotification: false, schedule: { on: { weekday: 7, hour: 8, minute: 35, second: 0 }, repeats: true } }),
    ] });
    expect(local.cancel.mock.invocationCallOrder[0]).toBeLessThan(local.schedule.mock.invocationCallOrder[0]);
  });

  it('does not reprompt a denied permission and removes obsolete reminders', async () => {
    local.checkPermissions.mockResolvedValue({ display: 'denied' });
    const result = await reminders.configureNotifications({ enabled: true, time: '20:00', days: [1] });
    expect(result.enabled).toBe(false);
    expect(result.message).toMatch(/ajustes/);
    expect(local.requestPermissions).not.toHaveBeenCalled();
    expect(local.schedule).not.toHaveBeenCalled();
    expect(local.cancel).toHaveBeenCalledOnce();
  });

  it('schedules English content and returns an interpolated confirmation in the chosen language', async () => {
    const result = await reminders.configureNotifications({ enabled: true, time: '08:35', days: [1] }, 'en');
    expect(result.message).toBe('Done. We will remind you to check in around 08:35 on your chosen days.');
    expect(local.createChannel).toHaveBeenCalledWith(expect.objectContaining({ name: 'Your daily check-in' }));
    expect(local.schedule.mock.calls[0][0].notifications[0]).toMatchObject({
      title: 'A moment for you', body: 'Log your weight and habits today. Every day counts.',
    });
    await reminders.testNotification('en');
    expect(local.schedule.mock.calls[1][0].notifications[0]).toMatchObject({
      title: 'A moment for you', body: 'This is what your Weight&Exercise reminder will look like.',
    });
  });

  it('uses granted permission directly and skips Android channel creation on iOS', async () => {
    native.getPlatform.mockReturnValue('ios');
    local.checkPermissions.mockResolvedValue({ display: 'granted' });
    await reminders.configureNotifications({ enabled: true, time: '20:00', days: [2] });
    expect(local.requestPermissions).not.toHaveBeenCalled();
    expect(local.createChannel).not.toHaveBeenCalled();
    expect(local.schedule).toHaveBeenCalledOnce();
  });

  it('rejects invalid schedules before requesting permissions or changing existing notifications', async () => {
    for (const input of [
      { time: '24:00', days: [1] }, { time: '8:30', days: [1] },
      { time: '08:30', days: [] }, { time: '08:30', days: [7] }, { time: '08:30', days: [1.5] },
    ]) {
      await expect(reminders.configureNotifications({ ...input, enabled: true })).rejects.toThrow(/hora válida/);
    }
    expect(local.checkPermissions).not.toHaveBeenCalled();
    expect(local.cancel).not.toHaveBeenCalled();
    expect(local.schedule).not.toHaveBeenCalled();
  });

  it('disables only the app-owned reminder and test IDs without asking permission', async () => {
    expect((await reminders.configureNotifications({ enabled: false, time: '', days: [] })).enabled).toBe(false);
    expect(local.cancel).toHaveBeenCalledExactlyOnceWith({ notifications: Array.from({ length: 8 }, (_, index) => ({ id: 810100 + index })) });
    expect(local.checkPermissions).not.toHaveBeenCalled();
    expect(local.requestPermissions).not.toHaveBeenCalled();
  });

  it('cleans up partial scheduling failures and reports reminders as disabled', async () => {
    local.schedule.mockRejectedValueOnce(new Error('native failure'));
    const result = await reminders.configureNotifications({ enabled: true, time: '20:00', days: [1, 3] });
    expect(result.enabled).toBe(false);
    expect(local.cancel).toHaveBeenCalledTimes(2);
    expect(local.cancel.mock.invocationCallOrder[1]).toBeGreaterThan(local.schedule.mock.invocationCallOrder[0]);
  });

  it('serializes enable then reset so no queued schedule survives cancellation', async () => {
    let finishPermission!: (result: { display: string }) => void;
    let signalPermission!: () => void;
    const asking = new Promise<void>(resolve => { signalPermission = resolve; });
    local.requestPermissions.mockImplementationOnce(() => { signalPermission(); return new Promise(resolve => { finishPermission = resolve; }); });
    const enabling = reminders.configureNotifications({ enabled: true, time: '20:00', days: [1] });
    const cancelling = reminders.cancelNotifications();
    await asking;
    expect(local.cancel).not.toHaveBeenCalled();
    finishPermission({ display: 'granted' });
    await Promise.all([enabling, cancelling]);
    expect(local.cancel).toHaveBeenCalledTimes(2);
    expect(local.cancel.mock.invocationCallOrder.at(-1)).toBeGreaterThan(local.schedule.mock.invocationCallOrder[0]);
  });

  it('captures schedule inputs before awaiting permission', async () => {
    const settings = { enabled: true, time: '20:00', days: [1] };
    const configuring = reminders.configureNotifications(settings);
    settings.time = '09:00';
    settings.days.push(5);
    await configuring;
    expect(local.schedule.mock.calls[0][0].notifications).toHaveLength(1);
    expect(local.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ schedule: { on: { hour: 20, weekday: 2 } } });
  });

  it('sends a one-shot native test without enabling or replacing the saved reminders', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const result = await reminders.testNotification();
    expect(result.enabled).toBe(false);
    expect(local.schedule).toHaveBeenCalledExactlyOnceWith({ notifications: [expect.objectContaining({
      id: 810107, schedule: { at: new Date(1_800_000_003_000) }, extra: { owner: 'weight-exercise', test: true },
    })] });
    expect(local.cancel).not.toHaveBeenCalled();
  });
});

describe('PC preview reminders', () => {
  it('does not pretend background scheduling works on the web or request browser permission', async () => {
    native.isNativePlatform.mockReturnValue(false);
    const result = await reminders.configureNotifications({ enabled: true, time: '20:00', days: [1] });
    expect(result.enabled).toBe(false);
    expect(result.message).toMatch(/PC/);
    expect(local.checkPermissions).not.toHaveBeenCalled();
    expect(local.requestPermissions).not.toHaveBeenCalled();
    expect(local.schedule).not.toHaveBeenCalled();
    await reminders.cancelNotifications();
    expect(local.cancel).not.toHaveBeenCalled();
  });

  it('requests browser permission only for an explicit test and leaves recurring reminders disabled', async () => {
    native.isNativePlatform.mockReturnValue(false);
    const shown = vi.fn();
    class BrowserNotification {
      static permission = 'default';
      static requestPermission = vi.fn(async () => 'granted');
      onclick: (() => void) | null = null;
      close = vi.fn();
      constructor(title: string, options: unknown) { shown(title, options); }
    }
    vi.stubGlobal('Notification', BrowserNotification);
    vi.stubGlobal('window', { isSecureContext: true, Notification: BrowserNotification, focus: vi.fn() });
    expect(await reminders.getNotificationPermission()).toBe('prompt');
    expect(BrowserNotification.requestPermission).not.toHaveBeenCalled();
    const result = await reminders.testNotification();
    expect(BrowserNotification.requestPermission).toHaveBeenCalledOnce();
    expect(shown).toHaveBeenCalledExactlyOnceWith('Un momento para ti', expect.objectContaining({ tag: 'weight-exercise-test' }));
    expect(result.enabled).toBe(false);
    expect(local.schedule).not.toHaveBeenCalled();
  });

  it('returns unsupported on an insecure browser context without any permission call', async () => {
    native.isNativePlatform.mockReturnValue(false);
    vi.stubGlobal('window', { isSecureContext: false, Notification: {} });
    expect(await reminders.getNotificationPermission()).toBe('unsupported');
    expect((await reminders.testNotification()).enabled).toBe(false);
    expect(local.requestPermissions).not.toHaveBeenCalled();
  });
});
