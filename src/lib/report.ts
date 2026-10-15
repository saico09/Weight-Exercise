import type { AppData, DailyRecord, Theme } from './model';
import { dateKey, displayWeight, shiftDate } from './model';
import { accentStyle } from './accent';
import { themeInfo } from './themes';

export interface ReportRange { start: string; end: string }
export interface ProgressReport {
  range: ReportRange; records: DailyRecord[]; first: DailyRecord | null; last: DailyRecord | null;
  changeKg: number | null; averageKg: number | null; minKg: number | null; maxKg: number | null;
  exerciseDays: number; healthyDays: number; exercisePercent: number; healthyPercent: number;
  calendarDays: number; coveragePercent: number;
  stepsDays: number; totalSteps: number | null; averageSteps: number | null;
}
export interface ReportOverview {
  global: ProgressReport; selected: ProgressReport; previous: ProgressReport;
  averageChangeKg: number | null; exerciseChangePoints: number | null; healthyChangePoints: number | null;
  averageStepsChange: number | null;
}
export interface ReportFonts { body: string; bold: string; heading: string }
export function reportFontFiles(theme: Theme): ReportFonts {
  const family = (theme === 'light' || theme === 'platinum') ? 'manrope' : theme === 'aurora' ? 'space-grotesk' : 'dm-sans';
  return {
    body: `/fonts/report/${family}-400.ttf`,
    bold: `/fonts/report/${family}-${family === 'manrope' ? 700 : 600}.ttf`,
    heading: `/fonts/report/${(theme === 'dark' || theme === 'gold') ? 'barlow-condensed-600' : (theme === 'light' || theme === 'platinum') ? 'manrope-700' : theme === 'aurora' ? 'space-grotesk-600' : 'fraunces-600'}.ttf`,
  };
}
const fontCache = new Map<string, Promise<string>>();
async function localReportFonts(theme: Theme): Promise<ReportFonts | undefined> {
  if (typeof window === 'undefined') return undefined;
  const paths = reportFontFiles(theme);
  const load = (path: string) => {
    if (!fontCache.has(path)) fontCache.set(path, fetch(path).then(async response => {
      if (!response.ok) throw new Error('Font unavailable');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) throw new Error('Invalid font');
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }).catch(error => { fontCache.delete(path); throw error; }));
    return fontCache.get(path)!;
  };
  try { const [body, bold, heading] = await Promise.all([load(paths.body), load(paths.bold), load(paths.heading)]); return { body, bold, heading }; }
  catch { return undefined; } // Standard PDF fonts remain a usable offline fallback.
}

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && dateKey(new Date(year, month - 1, day, 12)) === value;
}
/** UTC date keys are used only to count calendar days, independently of DST. */
export function reportDayCount(range: ReportRange): number {
  return Math.round((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86_400_000) + 1;
}
export function previousReportRange(range: ReportRange): ReportRange {
  return { start: shiftDate(range.start, -reportDayCount(range)), end: shiftDate(range.start, -1) };
}
export function reportRange(data: AppData, days: number, today = dateKey()): ReportRange {
  const first = data.records.filter(record => record.date <= today).map(record => record.date).sort()[0] || today;
  return { start: days > 0 ? shiftDate(today, -(days - 1)) : first, end: today };
}
function summarize(data: AppData, range: ReportRange): ProgressReport {
  const records = data.records.filter(record => record.date >= range.start && record.date <= range.end).sort((a, b) => a.date.localeCompare(b.date));
  const first = records[0] ?? null, last = records.at(-1) ?? null;
  const exerciseDays = records.filter(record => record.exercise).length;
  const healthyDays = records.filter(record => record.healthy).length;
  const steps = records.flatMap(record => typeof record.steps === 'number' && Number.isInteger(record.steps) && record.steps >= 0 && record.steps <= 200_000 ? [record.steps] : []);
  const totalSteps = steps.length ? steps.reduce((sum, value) => sum + value, 0) : null;
  const calendarDays = reportDayCount(range);
  return {
    range, records, first, last, changeKg: records.length >= 2 ? last!.weightKg - first!.weightKg : null,
    averageKg: records.length ? records.reduce((sum, record) => sum + record.weightKg, 0) / records.length : null,
    minKg: records.length ? records.reduce((min, record) => Math.min(min, record.weightKg), Infinity) : null,
    maxKg: records.length ? records.reduce((max, record) => Math.max(max, record.weightKg), -Infinity) : null,
    exerciseDays, healthyDays, exercisePercent: records.length ? exerciseDays / records.length * 100 : 0,
    healthyPercent: records.length ? healthyDays / records.length * 100 : 0,
    calendarDays, coveragePercent: records.length / calendarDays * 100,
    stepsDays: steps.length, totalSteps, averageSteps: totalSteps === null ? null : totalSteps / steps.length,
  };
}
/** Includes all entries in the chosen dates, even before the goal's selected baseline. */
export function buildProgressReport(data: AppData, range: ReportRange, today = dateKey()): ProgressReport {
  if (!calendarDate(range.start) || !calendarDate(range.end) || range.start > range.end || range.end > today) throw new Error('Elige un rango de fechas válido hasta hoy.');
  return summarize(data, range);
}
export function buildReportOverview(data: AppData, range: ReportRange, today = dateKey()): ReportOverview {
  const selected = buildProgressReport(data, range, today);
  const previous = summarize(data, previousReportRange(range));
  const global = summarize(data, reportRange(data, 0, today));
  const comparable = selected.records.length > 0 && previous.records.length > 0;
  return {
    global, selected, previous,
    averageChangeKg: selected.averageKg !== null && previous.averageKg !== null ? selected.averageKg - previous.averageKg : null,
    exerciseChangePoints: comparable ? selected.exercisePercent - previous.exercisePercent : null,
    healthyChangePoints: comparable ? selected.healthyPercent - previous.healthyPercent : null,
    averageStepsChange: selected.averageSteps !== null && previous.averageSteps !== null ? selected.averageSteps - previous.averageSteps : null,
  };
}

/** Build entirely on the device; PDF and native plugins remain lazy imports. */
export async function createProgressPdf(data: AppData, range: ReportRange, options: { fonts?: ReportFonts } = {}) {
  const { jsPDF } = await import('jspdf');
  const overview = buildReportOverview(data, range);
  const { global, selected, previous } = overview;
  if (!global.records.length) throw new Error('No hay registros para crear un informe.');
  const en = data.settings.language === 'en';
  const l = (es: string, english: string) => en ? english : es;
  const locale = en ? 'en-US' : 'es-CL', unit = data.settings.weightUnit;
  const number = (value: number) => Math.round(value).toLocaleString(locale);
  const weight = (kg: number | null, signed = false) => kg === null ? '--' : `${signed && kg > 0 ? '+' : ''}${displayWeight(Math.abs(kg) < .00001 ? 0 : kg, unit, 1, locale)} ${unit}`;
  const percent = (value: number) => `${Math.round(value)}%`;
  const palette = themeInfo[data.settings.theme];
  const colors = { bg: palette.background, card: palette.surface, ink: palette.text, muted: palette.light ? data.settings.theme === 'sand' ? '#695A4B' : '#526D73' : palette.muted, accent: String(accentStyle(data.settings.theme, data.settings.accentColor)['--accent-ink']), line: palette.light ? '#D6DBD8' : '#343C46' };
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fonts = options.fonts ?? await localReportFonts(data.settings.theme);
  if (fonts) {
    doc.addFileToVFS('report-body.ttf', fonts.body); doc.addFont('report-body.ttf', 'ReportBody', 'normal');
    doc.addFileToVFS('report-bold.ttf', fonts.bold); doc.addFont('report-bold.ttf', 'ReportBody', 'bold');
    doc.addFileToVFS('report-heading.ttf', fonts.heading); doc.addFont('report-heading.ttf', 'ReportHeading', 'normal');
  }
  doc.setProperties({ title: `Weight&Exercise - ${l('Informe de progreso', 'Progress report')}`, creator: 'Weight&Exercise', subject: `${range.start} - ${range.end}` });
  const text = (value: string, x: number, y: number, size = 10, color = colors.ink, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
    const heading = !!fonts && bold && size >= 14;
    doc.setTextColor(color); doc.setFont(heading ? 'ReportHeading' : fonts ? 'ReportBody' : 'helvetica', heading ? 'normal' : bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.text(value, x, y, { align });
  };
  const paragraph = (value: string, x: number, y: number, width: number, size = 8.5, color = colors.muted) => {
    doc.setFont(fonts ? 'ReportBody' : 'helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(value, width); doc.text(lines, x, y, { lineHeightFactor: 1.4 });
    return y + lines.length * size * .3528 * 1.4;
  };
  const card = (x: number, y: number, width: number, height: number) => { doc.setFillColor(colors.card); doc.roundedRect(x, y, width, height, Math.min(3, height / 2), Math.min(3, height / 2), 'F'); };
  const rule = (y: number, x = 18, width = 174) => { doc.setDrawColor(colors.line); doc.setLineWidth(.25); doc.line(x, y, x + width, y); };
  const page = (section: string, subtitle: string, add = false) => {
    if (add) doc.addPage();
    doc.setFillColor(colors.bg); doc.rect(0, 0, 210, 297, 'F');
    text('Weight&', 18, 19, 13, colors.ink, true); text('Exercise', 18, 24.5, 13, colors.ink, true);
    text(l('INFORME PERSONAL', 'PERSONAL REPORT'), 192, 18, 7.3, colors.muted, false, 'right');
    text('PRO  /  ' + palette.name.toUpperCase(), 192, 24.5, 8, colors.accent, true, 'right');
    rule(32); text(section, 18, 43, 8, colors.accent, true); text(subtitle, 192, 43, 7.6, colors.muted, false, 'right');
  };
  const bar = (x: number, y: number, width: number, fraction: number, color = colors.accent) => {
    doc.setFillColor(colors.line); doc.roundedRect(x, y, width, 2, 1, 1, 'F');
    if (fraction > 0) { doc.setFillColor(color); doc.roundedRect(x, y, Math.max(.5, width * Math.min(1, fraction)), 2, .5, .5, 'F'); }
  };

  // 01. All-history summary is deliberately independent of the detail date filter.
  page(l('01 / TU HISTORIA COMPLETA', '01 / YOUR COMPLETE HISTORY'), `${global.first!.date} - ${global.last!.date}`);
  text(l('Tu constancia,', 'Your consistency,'), 18, 59, 23, colors.ink, true);
  text(l('en perspectiva.', 'in perspective.'), 18, 69, 23, colors.ink, true);
  text(l('PESO MÁS RECIENTE', 'LATEST RECORDED WEIGHT'), 192, 57, 7.3, colors.muted, false, 'right');
  text(weight(global.last!.weightKg), 192, 71, 25, colors.accent, true, 'right');
  text(global.last!.date, 192, 79, 8, colors.muted, false, 'right');
  const metrics = [
    { label: l('Peso de tu primer registro', 'First recorded weight'), value: weight(global.first!.weightKg), note: global.first!.date },
    { label: l('Cambio total registrado', 'Total recorded change'), value: weight(global.changeKg, true), note: l('Primero frente a más reciente', 'First versus most recent') },
    { label: l('Días registrados', 'Recorded days'), value: number(global.records.length), note: l('Todo tu historial', 'Your entire history') },
  ];
  metrics.forEach((metric, index) => {
    const x = 18 + index * 60; card(x, 91, 54, 32);
    text(metric.label, x + 5, 100, 7.1, colors.muted);
    text(metric.value, x + 5, 111, 17, colors.ink, true);
    text(metric.note, x + 5, 118, 6.6, colors.muted);
  });
  card(18, 131, 174, 75);
  text(l('La trayectoria completa', 'Your complete trajectory'), 24, 142, 11, colors.ink, true);
  text(`${l('Mín.', 'Min.')} ${weight(global.minKg)}  /  ${l('Máx.', 'Max.')} ${weight(global.maxKg)}`, 186, 142, 7.6, colors.muted, false, 'right');
  const bounds = { x: 38, y: 151, width: 147, height: 39 };
  const lowest = global.minKg! - .5, highest = global.maxKg! + .5;
  const startTime = Date.parse(global.first!.date), endTime = Date.parse(global.last!.date);
  const point = (record: DailyRecord) => ({ x: bounds.x + (endTime === startTime ? .5 : (Date.parse(record.date) - startTime) / (endTime - startTime)) * bounds.width, y: bounds.y + bounds.height * (1 - (record.weightKg - lowest) / (highest - lowest)) });
  for (let index = 0; index < 3; index++) {
    const y = bounds.y + index * bounds.height / 2; rule(y, bounds.x, bounds.width);
    text(displayWeight(highest - index * (highest - lowest) / 2, unit, 1, locale), 25, y + 1, 6.7, colors.muted);
  }
  doc.setDrawColor(colors.accent); doc.setFillColor(colors.accent); doc.setLineWidth(.7);
  global.records.forEach((record, index) => {
    const current = point(record);
    if (index) { const before = point(global.records[index - 1]); doc.line(before.x, before.y, current.x, current.y); }
    if (index === 0 || index === global.records.length - 1) doc.circle(current.x, current.y, 1.2, 'F');
  });
  text(global.first!.date, bounds.x, 199, 7, colors.muted);
  if (global.records.length > 1) text(global.last!.date, 185, 199, 7, colors.muted, false, 'right');
  const habit = (title: string, count: number, fraction: number, x: number) => {
    card(x, 214, 84, 39); text(title, x + 6, 224, 8, colors.muted);
    text(number(count), x + 6, 236, 22, colors.ink, true);
    text(`${percent(fraction * 100)} ${l('de días registrados', 'of recorded days')}`, x + 78, 236, 7, colors.muted, false, 'right');
    bar(x + 6, 244, 72, fraction);
  };
  habit(l('DÍAS CON EJERCICIO', 'DAYS WITH EXERCISE'), global.exerciseDays, global.exercisePercent / 100, 18);
  habit(l('DÍAS DE COMER SANO', 'DAYS OF HEALTHY EATING'), global.healthyDays, global.healthyPercent / 100, 108);
  const stepText = global.stepsDays ? `${l('PASOS', 'STEPS')}  ${number(global.totalSteps!)} ${l('en total', 'total')}  /  ${number(global.averageSteps!)} ${l('por día con dato', 'per day with data')}  /  ${global.stepsDays} ${l('días con pasos', 'days with steps')}` : l('PASOS  Aún no hay datos de pasos en tu historial.', 'STEPS  No step data in your history yet.');
  paragraph(stepText, 18, 263, 174, 8, colors.accent);
  paragraph(l('Los días sin registro no se cuentan como descanso ni como cero pasos.', 'Missing days are not counted as rest or zero steps.'), 18, 273, 174, 7.5);

  // 02. Equal calendar windows with explicit coverage and unavailable comparisons.
  page(l('02 / COMPARACIÓN DE PERÍODOS', '02 / PERIOD COMPARISON'), `${selected.calendarDays} ${l('días por período', 'days per period')}`, true);
  text(l('El cambio, con contexto.', 'Change, with context.'), 18, 59, 23, colors.ink, true);
  paragraph(l('El período que elegiste frente a los días inmediatamente anteriores. Cada promedio usa únicamente los registros disponibles.', 'Your chosen period versus the immediately preceding days. Each average uses only the available entries.'), 18, 68, 173, 8.5);
  card(18, 84, 84, 27); card(108, 84, 84, 27);
  text(l('ANTERIOR', 'PREVIOUS'), 24, 93, 7.5, colors.muted, true);
  text(`${previous.range.start} - ${previous.range.end}`, 24, 101, 9, colors.ink, true);
  text(l('ELEGIDO', 'SELECTED'), 114, 93, 7.5, colors.accent, true);
  text(`${selected.range.start} - ${selected.range.end}`, 114, 101, 9, colors.ink, true);
  const pp = (value: number | null) => value === null ? '--' : `${value > 0 ? '+' : ''}${Math.round(value)} pp`;
  const habitValue = (count: number, summary: ProgressReport) => summary.records.length ? `${count}/${summary.records.length} (${percent(count / summary.records.length * 100)})` : '--';
  const rows = [
    [l('Días registrados', 'Recorded days'), `${previous.records.length}/${previous.calendarDays}`, `${selected.records.length}/${selected.calendarDays}`, `${selected.records.length - previous.records.length > 0 ? '+' : ''}${selected.records.length - previous.records.length}`],
    [l('Cobertura del período', 'Period coverage'), percent(previous.coveragePercent), percent(selected.coveragePercent), pp(selected.coveragePercent - previous.coveragePercent)],
    [l('Peso promedio', 'Average weight'), weight(previous.averageKg), weight(selected.averageKg), weight(overview.averageChangeKg, true)],
    [l('Cambio dentro del período', 'Change within period'), weight(previous.changeKg, true), weight(selected.changeKg, true), '--'],
    [l('Días con ejercicio', 'Days with exercise'), habitValue(previous.exerciseDays, previous), habitValue(selected.exerciseDays, selected), pp(overview.exerciseChangePoints)],
    [l('Días de comer sano', 'Healthy eating days'), habitValue(previous.healthyDays, previous), habitValue(selected.healthyDays, selected), pp(overview.healthyChangePoints)],
    [l('Pasos por día con dato', 'Steps per day with data'), previous.averageSteps === null ? '--' : number(previous.averageSteps), selected.averageSteps === null ? '--' : number(selected.averageSteps), overview.averageStepsChange === null ? '--' : `${overview.averageStepsChange > 0 ? '+' : ''}${number(overview.averageStepsChange)}`],
  ];
  text(l('INDICADOR', 'METRIC'), 22, 123, 7.2, colors.muted, true);
  text(l('ANTERIOR', 'PREVIOUS'), 104, 123, 7.2, colors.muted, true, 'right');
  text(l('ELEGIDO', 'SELECTED'), 147, 123, 7.2, colors.accent, true, 'right');
  text(l('DIFERENCIA', 'DIFFERENCE'), 188, 123, 7.2, colors.muted, true, 'right');
  rows.forEach((row, index) => {
    const y = 137 + index * 14; if (index % 2 === 0) card(18, y - 8, 174, 14);
    text(row[0], 22, y, 8); text(row[1], 104, y, 8.5, colors.muted, false, 'right');
    text(row[2], 147, y, 8.5, colors.ink, true, 'right'); text(row[3], 188, y, 8.5, colors.accent, false, 'right');
  });
  rule(232);
  text(l('CÓMO LEER ESTA COMPARACIÓN', 'HOW TO READ THIS COMPARISON'), 18, 243, 7.7, colors.accent, true);
  const interpretation = !previous.records.length || !selected.records.length
    ? l('Faltan registros en uno de los períodos. Los guiones indican comparaciones no disponibles; no equivalen a un cambio de cero.', 'One period has no entries. Dashes mark unavailable comparisons; they do not mean zero change.')
    : selected.coveragePercent < 50 || previous.coveragePercent < 50
      ? l('La cobertura es menor al 50% en uno de los períodos. Los promedios describen los días registrados, no todos los días del calendario.', 'One period has less than 50% coverage. Averages describe recorded days, not every calendar day.')
      : l('Una diferencia de peso puede ser positiva o negativa. Aquí se describe el cambio, sin calificarlo como bueno o malo.', 'A weight difference can be positive or negative. This report describes the change without judging it as good or bad.');
  const bottom = paragraph(interpretation, 18, 251, 174, 8.2);
  paragraph(l(`pp = puntos porcentuales. Pasos disponibles: ${previous.stepsDays} días anteriores y ${selected.stepsDays} días elegidos. El cambio dentro de un período necesita dos registros. Valores redondeados; las diferencias usan los valores sin redondear.`, `pp = percentage points. Step data: ${previous.stepsDays} previous days and ${selected.stepsDays} selected days. Change within a period needs two entries. Values are rounded; differences use unrounded values.`), 18, bottom + 3, 174, 7.5);

  // 03. Details include every selected weight/habit/step entry, in chronological order.
  const rowsPerPage = 31;
  for (let start = 0; start < Math.max(1, selected.records.length); start += rowsPerPage) {
    page(l('03 / REGISTROS DEL PERÍODO', '03 / PERIOD ENTRIES'), `${range.start} - ${range.end}`, true);
    text(l('El detalle de tu camino.', 'The details of your journey.'), 18, 59, 22, colors.ink, true);
    text(`${selected.records.length} ${l('registros', 'entries')}  /  ${l('Pesos en', 'Weights in')} ${unit}`, 18, 68, 8.5, colors.muted);
    const columns = [22, 70, 111, 151, 188];
    const labels = [l('FECHA', 'DATE'), l('PESO', 'WEIGHT'), l('EJERCICIO', 'EXERCISE'), l('COMER SANO', 'HEALTHY EATING'), l('PASOS', 'STEPS')];
    labels.forEach((label, index) => text(label, columns[index], 82, 7, colors.accent, true, index === 0 ? 'left' : 'right'));
    selected.records.slice(start, start + rowsPerPage).forEach((record, index) => {
      const y = 94 + index * 5.6;
      if (index % 2 === 0) card(18, y - 4.2, 174, 5.6);
      const values = [record.date, displayWeight(record.weightKg, unit, 1, locale), record.exercise ? l('Sí', 'Yes') : 'No', record.healthy ? l('Sí', 'Yes') : 'No', typeof record.steps === 'number' ? number(record.steps) : '--'];
      values.forEach((value, col) => text(value, columns[col], y, 8.5, col === 0 ? colors.muted : colors.ink, false, col === 0 ? 'left' : 'right'));
    });
    if (!selected.records.length) paragraph(l('No hay registros en las fechas elegidas. El resumen general conserva el historial completo disponible.', 'There are no entries in the selected dates. The overview still includes your complete available history.'), 22, 103, 165, 10);
    text(l('Pasos: -- significa sin dato; 0 significa cero pasos registrados.', 'Steps: -- means no data; 0 means zero recorded steps.'), 18, 273, 7.4, colors.muted);
  }
  const pageCount = doc.getNumberOfPages();
  for (let index = 1; index <= pageCount; index++) {
    doc.setPage(index); rule(281);
    text(`Weight&Exercise  /  ${l('Creado el', 'Created on')} ${dateKey()}`, 18, 288, 7, colors.muted);
    text(l('Resumen personal. No es una evaluación médica.', 'Personal summary. Not a medical assessment.'), 105, 288, 6.5, colors.muted, false, 'center');
    text(`${String(index).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, 192, 288, 7, colors.muted, false, 'right');
  }
  return doc;
}

export async function saveProgressPdf(data: AppData, range: ReportRange): Promise<void> {
  const doc = await createProgressPdf(data, range);
  const fileName = `WeightExercise-${range.start}-${range.end}.pdf`;
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const base64 = doc.output('datauristring').split(',')[1];
    const file = await Filesystem.writeFile({ path: `reports/${fileName}`, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title: 'Weight&Exercise', files: [file.uri], dialogTitle: data.settings.language === 'en' ? 'Save or share your report' : 'Guardar o compartir tu informe' });
  } else { doc.save(fileName); }
}
