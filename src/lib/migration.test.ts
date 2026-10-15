import { describe, expect, it } from 'vitest';
import { defaultData, dateKey, shiftDate, type AppData } from './model';
import { getAchievements } from './achievements';
import { BASIC_TRANSFER_FORMAT, buildBasicTransfer } from './migration';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNc8AAAAASUVORK5CYII=';
function sample(): AppData {
  const data = defaultData();
  data.profile = { heightCm: 175, initialWeightKg: 80, goalWeightKg: 75, age: 35, initialDate: '2024-01-01', birthDate: '1990-01-01', photo: png };
  data.records = [{ id: 'first', date: '2024-01-01', weightKg: 80, exercise: true, healthy: false, note: 'Un día más.' }];
  data.initialRecordId = 'first';
  data.settings.notifications = { enabled: true, time: '19:30', days: [1, 3, 5] };
  data.settings.motivation = { message: 'Hazlo por ella', image: png };
  return data;
}

describe('Basic transfer export', () => {
  it('exports a versioned snapshot of profile, photos, records, habits and shared preferences without mutating Basic', () => {
    const data = sample(); const before = JSON.stringify(data);
    const transfer = JSON.parse(buildBasicTransfer(data));
    expect(transfer.format).toBe(BASIC_TRANSFER_FORMAT); expect(transfer.version).toBe(1);
    expect(Number.isFinite(Date.parse(transfer.createdAt))).toBe(true);
    expect(transfer.snapshot.profile).toEqual(data.profile); expect(transfer.snapshot.records).toEqual(data.records);
    expect(transfer.snapshot.settings.notifications).toEqual({ enabled: false, time: '19:30', days: [1, 3, 5] });
    expect(transfer.snapshot.settings.motivation).toEqual(data.settings.motivation);
    expect(transfer.snapshot.initialRecordId).toBe('first'); expect(JSON.stringify(data)).toBe(before);
  });
  it('allows only shared payload fields, never account secrets, native permissions or Pro features', () => {
    const data = sample();
    Object.assign(data, { account: { email: 'private@example.test' }, token: 'secret-token' });
    Object.assign(data.profile!, { privateToken: 'secret-token' });
    Object.assign(data.records[0], { steps: 10000, stepsSource: 'health-connect' });
    Object.assign(data.settings, { accentColor: '#123456', recap: { enabled: true }, steps: { enabled: true } });
    const text = buildBasicTransfer(data);
    expect(text).not.toMatch(/secret-token|private@example|steps|recap|accentColor|account/);
    expect(JSON.parse(text).snapshot.settings.notifications.enabled).toBe(false);
  });
  it('rejects missing profiles and records that validation would discard or truncate', () => {
    expect(() => buildBasicTransfer(defaultData())).toThrow('perfil');
    for (const patch of [{ weightKg: NaN }, { note: 'x'.repeat(2001) }, { date: '2024-02-30' }, { date: shiftDate(dateKey(), 1) }]) {
      const data = sample(); Object.assign(data.records[0], patch);
      expect(() => buildBasicTransfer(data)).toThrow('registros');
    }
    const duplicate = sample(); duplicate.records.push({ ...duplicate.records[0], id: 'duplicate' });
    expect(() => buildBasicTransfer(duplicate)).toThrow('registros');
    const orphan = sample(); orphan.initialRecordId = 'missing';
    expect(() => buildBasicTransfer(orphan)).toThrow('registros');
  });
  it('rejects oversized transfers before handing data to Android', () => {
    const data = sample();
    data.records = Array.from({ length: 2200 }, (_, index) => ({ ...data.records[0], id: String(index), date: shiftDate('2000-01-01', index), note: 'é'.repeat(2000) }));
    data.initialRecordId = data.records[0].id;
    expect(() => buildBasicTransfer(data)).toThrow('4 MB');
  });
  it('preserves earned metallic themes and known achievements, gates unearned themes', () => {
    const data = sample(); data.settings.theme = 'platinum'; data.celebratedAchievementIds = ['unknown'];
    expect(JSON.parse(buildBasicTransfer(data)).snapshot.settings.theme).toBe('dark');
    data.celebratedAchievementIds = [...getAchievements(data).map(achievement => achievement.id), 'unknown'];
    const transfer = JSON.parse(buildBasicTransfer(data));
    expect(transfer.snapshot.settings.theme).toBe('platinum'); expect(transfer.snapshot.celebratedAchievementIds).toHaveLength(30);
    expect(transfer.snapshot.celebratedAchievementIds).not.toContain('unknown');
  });
});
