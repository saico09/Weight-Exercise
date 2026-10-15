/** Small dependency-free XLSX writer shared by the app and the local email service.
 * SpreadsheetML: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document
 * Values are snapshots, not executable formulas. User notes always use inline strings.
 */
const encoder = new TextEncoder();
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => { for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function merge(parts) { const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result; }
function header(length) { const bytes = new Uint8Array(length); return { bytes, view: new DataView(bytes.buffer) }; }

/** Browsers use ZIP method 0. Servers may inject raw DEFLATE without a browser dependency. */
function zip(files, compress) {
  const parts = [], central = []; let offset = 0;
  for (const [name, contents] of files) {
    const fileName = encoder.encode(name), raw = encoder.encode(contents), crc = crc32(raw);
    const bytes = compress ? compress(raw) : raw, method = compress ? 8 : 0;
    const local = header(30); local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true); local.view.setUint16(6, 0x800, true); local.view.setUint16(8, method, true); local.view.setUint16(12, 33, true); local.view.setUint32(14, crc, true); local.view.setUint32(18, bytes.length, true); local.view.setUint32(22, raw.length, true); local.view.setUint16(26, fileName.length, true);
    const directory = header(46); directory.view.setUint32(0, 0x02014b50, true); directory.view.setUint16(4, 20, true); directory.view.setUint16(6, 20, true); directory.view.setUint16(8, 0x800, true); directory.view.setUint16(10, method, true); directory.view.setUint16(14, 33, true); directory.view.setUint32(16, crc, true); directory.view.setUint32(20, bytes.length, true); directory.view.setUint32(24, raw.length, true); directory.view.setUint16(28, fileName.length, true); directory.view.setUint32(42, offset, true);
    parts.push(local.bytes, fileName, bytes); central.push(directory.bytes, fileName); offset += local.bytes.length + fileName.length + bytes.length;
  }
  const directory = merge(central), end = header(22); end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true); end.view.setUint32(12, directory.length, true); end.view.setUint32(16, offset, true);
  return merge([...parts, directory, end.bytes]);
}

function column(index) { let label = ''; for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) label = String.fromCharCode(65 + (value - 1) % 26) + label; return label; }
function cell(value, row, col, style = 0) {
  const address = `${column(col)}${row}`;
  if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return `<c r="${address}" s="${style}"/>`;
  if (typeof value === 'number') return `<c r="${address}" s="${style}" t="n"><v>${value}</v></c>`;
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value).slice(0, 32767))}</t></is></c>`;
}
function worksheet(rows, { widths, table = false, merges = [] } = {}) {
  const last = Math.max(1, rows.length), lastColumn = column(Math.max(0, ...rows.map(row => row.values.length - 1)));
  return declaration + `<worksheet xmlns="${ns}"><dimension ref="A1:${lastColumn}${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${table ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row, index) => `<row r="${index + 1}"${row.height ? ` ht="${row.height}" customHeight="1"` : ''}>${row.values.map((value, col) => cell(value, index + 1, col, row.styles?.[col] ?? row.style ?? (typeof value === 'number' ? 2 : 0))).join('')}</row>`).join('')}</sheetData>${table ? `<autoFilter ref="A1:${lastColumn}${last}"/>` : ''}${merges.length ? `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

/** @param {object} snapshot AppData snapshot. No account identifiers or photos are exported. */
export function buildProgressWorkbook(snapshot, options = {}, compress) {
  if (!snapshot || !Array.isArray(snapshot.records)) throw new Error('Invalid workbook data');
  const records = [...(options.records ?? snapshot.records)].sort((a, b) => a.date.localeCompare(b.date));
  if (records.length > 36600) throw new Error('Too many daily records');
  const english = (options.locale ?? snapshot.settings?.language ?? 'es').startsWith('en');
  const t = (es, en) => english ? en : es;
  const yes = t('Sí', 'Yes'), no = t('No', 'No');
  const first = records[0], last = records.at(-1), height = snapshot.profile?.heightCm;
  const withSteps = records.filter(record => Number.isInteger(record.steps) && record.steps >= 0);
  const generated = options.generatedAt ? new Date(options.generatedAt) : new Date();
  if (!Number.isFinite(generated.getTime())) throw new Error('Invalid generation date');
  const summaryName = t('Resumen', 'Summary'), recordsName = t('Registros', 'Records');
  const summary = [
    { values: ['Weight&Exercise · Pro', '', '', ''], style: 3, height: 32 },
    { values: [options.title || t('Tu historial de progreso', 'Your progress history'), '', '', ''], style: 4, height: 26 },
    { values: [t('Generado (UTC)', 'Generated (UTC)'), generated.toISOString()] },
    { values: [options.scopeLabel || t('Todos los registros guardados', 'All saved records'), '', '', ''], style: 4 },
    { values: [t('Tu evolución', 'Your progress'), t('Valor', 'Value')], style: 1, height: 26 },
    { values: [t('Registros incluidos', 'Included records'), records.length], styles: [0, 5] },
    { values: [t('Primera fecha del informe', 'First date in report'), first?.date ?? '—'] },
    { values: [t('Última fecha del informe', 'Last date in report'), last?.date ?? '—'] },
    { values: [t('Primer peso del informe (kg)', 'First weight in report (kg)'), first?.weightKg] },
    { values: [t('Último peso del informe (kg)', 'Last weight in report (kg)'), last?.weightKg] },
    { values: [t('Cambio en el informe (kg)', 'Change in report (kg)'), records.length > 1 ? last.weightKg - first.weightKg : null] },
    { values: [t('Altura actual (cm)', 'Current height (cm)'), height] },
    { values: [t('Peso objetivo (kg)', 'Goal weight (kg)'), snapshot.profile?.goalWeightKg] },
    { values: [t('Días de ejercicio registrados', 'Recorded exercise days'), records.filter(record => record.exercise).length], styles: [0, 5] },
    { values: [t('Días de comer sano registrados', 'Recorded healthy eating days'), records.filter(record => record.healthy).length], styles: [0, 5] },
    { values: [t('Días con pasos registrados', 'Days with recorded steps'), withSteps.length], styles: [0, 5] },
    { values: [t('Total de pasos registrados', 'Total recorded steps'), withSteps.reduce((sum, record) => sum + record.steps, 0)], styles: [0, 5] },
    { values: [] },
    { values: [t('Una celda de pasos vacía significa sin dato; cero significa 0 pasos registrados.', 'An empty steps cell means missing data; zero means 0 recorded steps.'), '', '', ''], style: 4, height: 30 },
    { values: [t('El IMC usa la altura actual para todas las fechas. Es una referencia, no un diagnóstico.', 'BMI uses current height for every date. It is a reference, not a diagnosis.'), '', '', ''], style: 4, height: 30 },
  ];
  const details = [{ values: [t('Fecha', 'Date'), 'kg', 'lb', t('IMC', 'BMI'), t('Ejercicio', 'Exercise'), t('Comer sano', 'Healthy eating'), t('Pasos', 'Steps'), t('Fuente de pasos', 'Steps source'), t('Nota', 'Note')], style: 1, height: 27 }, ...records.map(record => ({
    values: [record.date, record.weightKg, record.weightKg / 0.45359237, Number.isFinite(height) && height > 0 ? record.weightKg / (height / 100) ** 2 : null, record.exercise ? yes : no, record.healthy ? yes : no, Number.isInteger(record.steps) && record.steps >= 0 ? record.steps : null, record.stepsSource === 'health-connect' ? 'Health Connect' : '', record.note || ''],
    styles: [0, 2, 2, 2, 0, 0, 5, 0, 4], height: 24,
  }))];
  const theme = snapshot.settings?.theme || 'dark';
  const light = theme === 'light' || theme === 'sand';
  const accent = /^#[0-9a-f]{6}$/i.test(snapshot.settings?.accentColor || '') ? snapshot.settings.accentColor.slice(1) : ({ dark: '42FF85', light: '91F8FF', aurora: 'B7A0FF', sand: 'C38264' }[theme] || '42FF85');
  const ink = light ? '203B40' : 'F5F8F3', background = light ? 'F4F8F8' : '18201C';
  const rgb = [0, 2, 4].map(offset => parseInt(accent.slice(offset, offset + 2), 16));
  const accentInk = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 145 ? '14271E' : 'FFFFFF';
  const styles = declaration + `<styleSheet xmlns="${ns}"><fonts count="4"><font><sz val="11"/><color rgb="FF${ink}"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF${accentInk}"/><name val="Calibri"/></font><font><b/><sz val="20"/><color rgb="FF${accent}"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF${light ? '596E70' : 'B3C1B8'}"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${background}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${accent}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="2" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="1" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    ['[Content_Types].xml', declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', declaration + `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${summaryName}" sheetId="1" r:id="rId1"/><sheet name="${recordsName}" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', worksheet(summary, { widths: [38, 27, 15, 15], merges: ['A1:D1', 'A2:D2', 'A4:D4', 'A19:D19', 'A20:D20'] })],
    ['xl/worksheets/sheet2.xml', worksheet(details, { widths: [15, 12, 12, 12, 14, 17, 14, 20, 55], table: true })],
  ], compress);
}
