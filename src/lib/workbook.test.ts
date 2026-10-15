import { describe, expect, it } from 'vitest';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { buildProgressWorkbook } from '../../shared/progress-workbook.mjs';
import { demoData } from './model';

function entries(bytes: Uint8Array, method = 0) {
  const result = new Map<string, string>(), decoder = new TextDecoder(); let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(method);
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength)), start = offset + 30 + nameLength + extra;
    const payload = bytes.subarray(start, start + size), raw = method === 8 ? inflateRawSync(payload) : payload;
    expect(raw.length).toBe(view.getUint32(offset + 22, true));
    result.set(name, decoder.decode(raw)); offset = start + size;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
  return result;
}

describe('real XLSX export', () => {
  it('supports server-side raw DEFLATE with identical workbook contents and ZIP directory metadata', () => {
    const data = demoData(new Date(2026, 9, 15)), options = { generatedAt: '2026-10-15T12:00:00Z' };
    const stored = buildProgressWorkbook(data, options), compressed = buildProgressWorkbook(data, options, bytes => deflateRawSync(bytes));
    expect(compressed.length).toBeLessThan(stored.length / 2);
    expect(entries(compressed, 8)).toEqual(entries(stored));
    const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    let directory = view.getUint32(compressed.length - 6, true);
    for (let index = 0; index < 7; index++) {
      expect(view.getUint32(directory, true)).toBe(0x02014b50);
      expect(view.getUint16(directory + 10, true)).toBe(8);
      const local = view.getUint32(directory + 42, true);
      expect(view.getUint32(directory + 16, true)).toBe(view.getUint32(local + 14, true));
      expect(view.getUint32(directory + 20, true)).toBe(view.getUint32(local + 18, true));
      expect(view.getUint32(directory + 24, true)).toBe(view.getUint32(local + 22, true));
      directory += 46 + view.getUint16(directory + 28, true) + view.getUint16(directory + 30, true) + view.getUint16(directory + 32, true);
    }
  });
  it('produces a ZIP workbook with two sheets, correct references and numeric weight cells', () => {
    const data = demoData(new Date(2026, 9, 15));
    const files = entries(buildProgressWorkbook(data, { generatedAt: '2026-10-15T12:00:00Z' }));
    expect(files.size).toBe(7);
    expect(files.get('xl/workbook.xml')).toContain('name="Registros"');
    expect(files.get('xl/_rels/workbook.xml.rels')).toContain('Target="worksheets/sheet2.xml"');
    expect(files.get('xl/worksheets/sheet2.xml')).toContain(`<c r="B2" s="2" t="n"><v>${data.records[0].weightKg}</v></c>`);
    expect(files.get('xl/worksheets/sheet2.xml')).toContain('autoFilter ref="A1:I31"');
  });
  it('exports only the explicitly selected scope and encodes notes as text, never formulas', () => {
    const data = demoData(new Date(2026, 9, 15));
    data.records[0].note = '=HYPERLINK("https://example.test","<script>&")';
    const files = entries(buildProgressWorkbook(data, { records: [data.records[0]], scopeLabel: 'Solo este día' }));
    const sheet = files.get('xl/worksheets/sheet2.xml')!;
    expect(sheet).toContain('autoFilter ref="A1:I2"');
    expect(sheet).toContain('&lt;script&gt;&amp;');
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).not.toContain('<f>');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('Solo este día');
  });
  it('uses blanks for missing steps and numeric zero for a measured zero', () => {
    const data = demoData(new Date(2026, 9, 15)); delete data.records[0].steps; data.records[1].steps = 0;
    const files = entries(buildProgressWorkbook(data, { records: data.records.slice(0, 2) }));
    expect(files.get('xl/worksheets/sheet2.xml')).toContain('<c r="G2" s="5"/>');
    expect(files.get('xl/worksheets/sheet2.xml')).toContain('<c r="G3" s="5" t="n"><v>0</v></c>');
  });
});
