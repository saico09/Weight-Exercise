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
    data.records[0].steps = 0; delete data.records[1].steps; data.records[2].steps = 1200;
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
  it.each([[-2.4, 77.6], [3.2, 83.2], [0, 80]])('summarizes net change %s from first to last selected record, not the sum of rows', (delta, lastWeight) => {
    const data = demoData(new Date(2026, 9, 15));
    data.records[0].weightKg = 80; data.records[4].weightKg = 85; data.records[10].weightKg = lastWeight;
    const result = compareRecords(data, [data.records[10].id, data.records[4].id, data.records[0].id])!;
    expect(result.summary.from.id).toBe(data.records[0].id);
    expect(result.summary.to.id).toBe(data.records[10].id);
    expect(result.summary.weightChangeKg).toBeCloseTo(delta);
  });
  it('keeps a single selection relative to the user baseline even if the selection precedes it', () => {
    const data = demoData(new Date(2026, 9, 15));
    data.initialRecordId = data.records[10].id;
    const result = compareRecords(data, [data.records[2].id])!;
    expect(result.summary.from.id).toBe(data.records[10].id);
    expect(result.summary.to.id).toBe(data.records[2].id);
    expect(result.summary.weightChangeKg).toBeCloseTo(data.records[2].weightKg - data.records[10].weightKg);
  });
});
