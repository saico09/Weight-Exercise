import { describe, expect, it } from 'vitest';
import { defaultData, dateKey, shiftDate, type AppData, type DailyRecord } from './model';
import { getAchievements } from './achievements';
import { BASIC_TRANSFER_FORMAT, MAX_BASIC_TRANSFER_BYTES, BasicTransferError, mergeBasicTransfer, parseBasicTransfer, summarizeBasicTransfer } from './migration';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNc8AAAAASUVORK5CYII=';
const firstDate = '2024-01-01';
const record = (id = 'first', date = firstDate, weightKg = 80): DailyRecord => ({ id, date, weightKg, exercise: true, healthy: false, note: 'Un día más.' });
function sample(): AppData {
  const data = defaultData();
  data.profile = { heightCm: 175, initialWeightKg: 80, goalWeightKg: 75, age: 35, initialDate: firstDate, photo: png };
  data.records = [record()];
  data.initialRecordId = 'first';
  data.settings.motivation = { message: 'Hazlo por ella', image: png };
  data.settings.weightUnit = 'lb'; data.settings.heightUnit = 'ft';
  data.celebratedAchievementIds = ['records-iron'];
  return data;
}
function envelope(data = sample()) {
  return {
    format: BASIC_TRANSFER_FORMAT, version: 1, createdAt: new Date().toISOString(),
    snapshot: {
      profile: data.profile, records: data.records,
      settings: {
        theme: data.settings.theme, language: data.settings.language,
        weightUnit: data.settings.weightUnit, heightUnit: data.settings.heightUnit,
        notifications: { ...data.settings.notifications, enabled: false }, motivation: data.settings.motivation,
      },
      initialRecordId: data.initialRecordId, celebratedAchievementIds: data.celebratedAchievementIds,
    },
  };
}
const parse = (value: unknown) => parseBasicTransfer(JSON.stringify(value));

describe('Basic transfer validation', () => {
  it('round-trips shared data, local photos and selected baseline into safe Pro defaults', () => {
    const original = sample();
    const parsed = parse(envelope(original));
    expect(parsed.profile).toEqual(original.profile);
    expect(parsed.records).toEqual(original.records);
    expect(parsed.initialRecordId).toBe('first');
    expect(parsed.settings.motivation).toEqual(original.settings.motivation);
    expect(parsed.settings.weightUnit).toBe('lb'); expect(parsed.settings.heightUnit).toBe('ft');
    expect(parsed.settings.notifications.enabled).toBe(false);
    expect(parsed.settings.recap.enabled).toBe(false); expect(parsed.settings.steps.enabled).toBe(false);
    expect(parsed.settings.accentColor).toBeNull();
  });
  it('rejects wrong formats, unknown versions and invalid JSON', () => {
    expect(() => parseBasicTransfer('{')).toThrow(BasicTransferError);
    expect(() => parse({ ...envelope(), format: 'another-app' })).toThrow(BasicTransferError);
    try { parse({ ...envelope(), version: 2 }); } catch (error) { expect((error as BasicTransferError).code).toBe('unsupported-version'); }
  });
  it('checks UTF-8 byte size, including multibyte text', () => {
    expect(() => parseBasicTransfer(' '.repeat(MAX_BASIC_TRANSFER_BYTES + 1))).toThrow('4 MB');
    expect(() => parseBasicTransfer('é'.repeat(MAX_BASIC_TRANSFER_BYTES / 2 + 1))).toThrow('4 MB');
  });
  it('rejects an invalid record instead of silently omitting it', () => {
    for (const patch of [
      { weightKg: 0 }, { weightKg: null }, { exercise: 'yes' }, { healthy: 1 },
      { date: '2024-02-30' }, { date: shiftDate(dateKey(), 1) }, { id: '' }, { note: 'x'.repeat(2001) },
    ]) {
      const transfer = envelope(); transfer.snapshot.records.push({ ...record('bad', '2024-01-02'), ...patch } as DailyRecord);
      expect(() => parse(transfer)).toThrow(BasicTransferError);
    }
    expect(() => parseBasicTransfer(JSON.stringify(envelope()).replace('"weightKg":80', '"weightKg":1e400'))).toThrow(BasicTransferError);
  });
  it('rejects duplicate dates, duplicate IDs and orphan baseline IDs', () => {
    const duplicateDate = envelope(); duplicateDate.snapshot.records.push(record('another'));
    const duplicateId = envelope(); duplicateId.snapshot.records.push(record('first', '2024-01-02'));
    const orphan = envelope(); orphan.snapshot.initialRecordId = 'missing';
    for (const transfer of [duplicateDate, duplicateId, orphan]) expect(() => parse(transfer)).toThrow(BasicTransferError);
  });
  it('rejects malformed profiles, invalid photos, birthdays and inappropriate Pro themes', () => {
    for (const patch of [{ heightCm: -1 }, { age: 9.5 }, { photo: 'https://example.test/me.jpg' }, { birthDate: '2024-02-30' }]) {
      const transfer = envelope(); Object.assign(transfer.snapshot.profile!, patch);
      expect(() => parse(transfer)).toThrow(BasicTransferError);
    }
    const noProfile = envelope(); noProfile.snapshot.profile = null;
    expect(() => parse(noProfile)).toThrow('perfil');
    for (const theme of ['aurora', 'sand', 'purple']) {
      const transfer = envelope(); transfer.snapshot.settings.theme = theme as AppData['settings']['theme'];
      expect(() => parse(transfer)).toThrow(BasicTransferError);
    }
  });
  it('rejects malformed shared preferences rather than silently replacing them', () => {
    const invalidTime = envelope(); invalidTime.snapshot.settings.notifications.time = '25:61';
    const invalidDays = envelope(); invalidDays.snapshot.settings.notifications.days = [0, 7];
    const invalidPermission = envelope(); invalidPermission.snapshot.settings.notifications.enabled = true;
    const invalidImage = envelope(); invalidImage.snapshot.settings.motivation.image = 'data:image/svg+xml;base64,PHN2Zz4=';
    for (const transfer of [invalidTime, invalidDays, invalidPermission, invalidImage]) expect(() => parse(transfer)).toThrow(BasicTransferError);
  });
  it('whitelists payload fields: no accounts, passwords, steps or Pro preferences enter the result', () => {
    const transfer = envelope();
    Object.assign(transfer.snapshot, { accessToken: 'secret', account: { email: 'test@example.test' } });
    Object.assign(transfer.snapshot.settings, { accentColor: '#123456', recap: { enabled: true }, steps: { enabled: true }, chartStyle: 'bars' });
    Object.assign(transfer.snapshot.records[0], { steps: 9000, stepsSource: 'health-connect', accessToken: 'secret' });
    const result = parse(transfer);
    expect(JSON.stringify(result)).not.toContain('secret'); expect(JSON.stringify(result)).not.toContain('test@example');
    expect(result.records[0].steps).toBeUndefined(); expect(result.settings.steps.enabled).toBe(false);
    expect(result.settings.recap.enabled).toBe(false); expect(result.settings.chartStyle).toBe('area');
    expect(result.settings.accentColor).toBeNull();
  });
  it('keeps reward unlocks from known lifetime IDs and gates unearned themes', () => {
    const locked = envelope(); locked.snapshot.settings.theme = 'gold'; locked.snapshot.celebratedAchievementIds = ['invented'];
    expect(parse(locked).settings.theme).toBe('dark'); expect(parse(locked).celebratedAchievementIds).toEqual([]);
    const earned = envelope(); earned.snapshot.settings.theme = 'platinum';
    earned.snapshot.celebratedAchievementIds = getAchievements(defaultData()).map(achievement => achievement.id);
    expect(parse(earned).settings.theme).toBe('platinum');
  });
});

describe('Basic transfer merge', () => {
  it('summarizes new, identical and conflicting dates, including note changes but excluding steps', () => {
    const current = sample(); current.records[0].steps = 1234;
    current.records.push(record('second', '2024-01-02', 79));
    const incoming = parse(envelope()); incoming.records.push(record('different-id', '2024-01-02', 78), record('third', '2024-01-03', 77));
    expect(summarizeBasicTransfer(current, incoming)).toEqual({ incomingRecords: 3, newRecords: 1, conflicts: 1, identicalRecords: 1 });
    incoming.records[0].note = 'Another note';
    expect(summarizeBasicTransfer(current, incoming).conflicts).toBe(2);
  });
  it('preserves the existing Pro profile, configuration, permissions and default conflicting values', () => {
    const current = sample(); current.profile!.heightCm = 185; current.profile!.goalWeightKg = 70;
    current.settings.theme = 'sand'; current.settings.accentColor = '#FEABCD'; current.settings.notifications.enabled = true;
    current.settings.recap.enabled = true; current.settings.steps.enabled = true; current.settings.stepGoal = 8000;
    const incoming = parse(envelope()); incoming.records[0].weightKg = 77;
    const merged = mergeBasicTransfer(current, incoming);
    expect(merged.profile).toEqual(current.profile); expect(merged.settings).toEqual(current.settings);
    expect(merged.records).toEqual(current.records); expect(merged.initialRecordId).toBe(current.initialRecordId);
  });
  it('uses Basic values only on explicit choice while retaining Pro step readings, IDs and baseline consistency', () => {
    const current = sample(); Object.assign(current.records[0], { steps: 9001, stepsSource: 'health-connect', stepsSyncedAt: '2024-01-01T21:00:00Z' });
    const incoming = parse(envelope()); incoming.records[0].id = 'basic-id'; incoming.initialRecordId = 'basic-id';
    Object.assign(incoming.records[0], { weightKg: 79, exercise: false, healthy: true, note: 'Basic note' });
    const merged = mergeBasicTransfer(current, incoming, 'use-basic');
    expect(merged.records[0]).toEqual({ ...current.records[0], weightKg: 79, exercise: false, healthy: true, note: 'Basic note' });
    expect(merged.initialRecordId).toBe('first'); expect(merged.profile!.initialWeightKg).toBe(79);
  });
  it('adopts shared profile/preferences in empty Pro, disables native permissions and keeps reward themes', () => {
    const incoming = parse(envelope()); incoming.settings.theme = 'gold';
    incoming.celebratedAchievementIds = getAchievements(defaultData()).map(achievement => achievement.id);
    incoming.settings.notifications.enabled = true; incoming.settings.steps.enabled = true; incoming.settings.recap.enabled = true;
    const merged = mergeBasicTransfer(defaultData(), incoming);
    expect(merged.profile).toEqual(incoming.profile); expect(merged.initialRecordId).toBe('first');
    expect(merged.settings.theme).toBe('gold'); expect(merged.settings.weightUnit).toBe('lb');
    expect(merged.settings.notifications.enabled).toBe(false); expect(merged.settings.recap.enabled).toBe(false); expect(merged.settings.steps.enabled).toBe(false);
  });
  it('handles ID collisions across different dates and repeated import without losing or duplicating days', () => {
    const current = sample(); current.records.push(record('basic-2024-01-02-1', '2024-01-03', 78));
    const incoming = parse(envelope()); incoming.records = [record('first', '2024-01-02', 79)]; incoming.initialRecordId = 'first';
    const merged = mergeBasicTransfer(current, incoming);
    expect(merged.records).toHaveLength(3); expect(new Set(merged.records.map(item => item.id)).size).toBe(3);
    expect(merged.records.find(item => item.date === '2024-01-02')!.id).toBe('basic-2024-01-02-2');
    expect(mergeBasicTransfer(merged, incoming)).toEqual(merged);
    expect(summarizeBasicTransfer(merged, incoming)).toEqual({ incomingRecords: 1, newRecords: 0, conflicts: 0, identicalRecords: 1 });
  });
  it('maps the incoming baseline by date when empty-profile Pro already contains a colliding ID', () => {
    const current = defaultData(); current.records = [record('first', '2023-12-31')];
    const incoming = parse(envelope());
    const merged = mergeBasicTransfer(current, incoming);
    const baseline = merged.records.find(item => item.date === firstDate)!;
    expect(merged.initialRecordId).toBe(baseline.id); expect(baseline.id).not.toBe('first');
    expect(merged.profile!.initialDate).toBe(firstDate);
  });
  it('preserves a deleted baseline fallback, unions only known IDs and does not mutate inputs', () => {
    const current = sample(); current.initialRecordId = null; current.profile!.initialWeightKg = 85;
    current.celebratedAchievementIds = ['records-iron', 'unknown'];
    const incoming = parse(envelope()); incoming.celebratedAchievementIds = ['exercise-iron', 'records-iron'];
    const before = JSON.stringify({ current, incoming });
    const merged = mergeBasicTransfer(current, incoming);
    expect(merged.initialRecordId).toBeNull(); expect(merged.profile!.initialWeightKg).toBe(85);
    expect(merged.celebratedAchievementIds).toEqual(['records-iron', 'exercise-iron']);
    expect(JSON.stringify({ current, incoming })).toBe(before);
    merged.settings.notifications.days.push(99); merged.profile!.heightCm = 200; merged.records[0].weightKg = 100;
    expect(JSON.stringify({ current, incoming })).toBe(before);
  });
});
