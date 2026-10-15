import { describe, expect, it } from 'vitest';
import { demoData } from './model';
import { compareRecords } from './comparison';

describe('selected record comparison', () => {
  it('compares one selected record with the chosen initial record, not the immediately previous day', () => {
    const data = demoData(new Date(2026, 9, 15));
    data.initialRecordId = data.records[5].id;
    const result = compareRecords(data, [data.records[20].id])!;
    expect(result.usesInitial).toBe(true);
    expect(result.reference.id).toBe(data.records[5].id);
    expect(result.rows[0].days).toBe(15);
    expect(result.rows[0].weightChangeKg).toBeCloseTo(data.records[20].weightKg - data.records[5].weightKg);
  });
  it('orders multiple choices chronologically and uses the first selection as the reference', () => {
    const data = demoData(new Date(2026, 9, 15));
    const result = compareRecords(data, [data.records[20].id, data.records[2].id, data.records[8].id])!;
    expect(result.reference.id).toBe(data.records[2].id);
    expect(result.rows.map(row => row.days)).toEqual([0, 6, 18]);
    expect(result.rows).toHaveLength(3);
  });
  it('keeps absent step data distinct from a measured zero', () => {
    const data = demoData(new Date(2026, 9, 15));
    data.records[0].steps = 0; data.records[2].steps = 1200;
    const result = compareRecords(data, data.records.slice(0, 3).map(record => record.id))!;
    expect(result.rows.map(row => row.stepsChange)).toEqual([0, null, 1200]);
  });
  it('does not invent baseline habits when only an onboarding profile is available', () => {
    const data = demoData(new Date(2026, 9, 15)); data.initialRecordId = null;
    data.records = data.records.slice(5);
    const result = compareRecords(data, [data.records.at(-1)!.id])!;
    expect(result.reference.id).toBeNull();
    expect(result.rows[0].exerciseChange).toBeNull();
    expect(result.rows[0].healthyChange).toBeNull();
  });
});
