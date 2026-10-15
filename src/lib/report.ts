import type { AppData, DailyRecord } from './model';
import { dateKey, displayWeight, shiftDate } from './model';
import { accentStyle } from './accent';

export interface ReportRange { start: string; end: string }
export interface ProgressReport {
  range: ReportRange; records: DailyRecord[]; first: DailyRecord | null; last: DailyRecord | null;
  changeKg: number | null; averageKg: number | null; minKg: number | null; maxKg: number | null;
  exerciseDays: number; healthyDays: number; exercisePercent: number; healthyPercent: number;
}

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && dateKey(new Date(year, month - 1, day, 12)) === value;
}

export function reportRange(data: AppData, days: number, today = dateKey()): ReportRange {
  const first = data.records.map(record => record.date).sort()[0] || today;
  return { start: days > 0 ? shiftDate(today, -(days - 1)) : first, end: today };
}

/** Range metrics include all selected entries, irrespective of the weight-goal baseline. */
export function buildProgressReport(data: AppData, range: ReportRange, today = dateKey()): ProgressReport {
  if (!calendarDate(range.start) || !calendarDate(range.end) || range.start > range.end || range.end > today) throw new Error('Elige un rango de fechas válido hasta hoy.');
  const records = data.records.filter(record => record.date >= range.start && record.date <= range.end).sort((a, b) => a.date.localeCompare(b.date));
  const first = records[0] ?? null, last = records.at(-1) ?? null;
  const exerciseDays = records.filter(record => record.exercise).length;
  const healthyDays = records.filter(record => record.healthy).length;
  return {
    range, records, first, last, changeKg: records.length >= 2 ? last!.weightKg - first!.weightKg : null,
    averageKg: records.length ? records.reduce((sum, record) => sum + record.weightKg, 0) / records.length : null,
    minKg: records.length ? Math.min(...records.map(record => record.weightKg)) : null,
    maxKg: records.length ? Math.max(...records.map(record => record.weightKg)) : null,
    exerciseDays, healthyDays, exercisePercent: records.length ? exerciseDays / records.length * 100 : 0,
    healthyPercent: records.length ? healthyDays / records.length * 100 : 0,
  };
}

/** Kept lazy: neither jsPDF nor native file plugins load during ordinary app usage. */
export async function createProgressPdf(data: AppData, range: ReportRange) {
  const { jsPDF } = await import('jspdf');
  const report = buildProgressReport(data, range);
  if (!report.records.length) throw new Error('No hay registros en este período.');
  const en = data.settings.language === 'en';
  const label = (es: string, english: string) => en ? english : es;
  const locale = en ? 'en-US' : 'es-CL', unit = data.settings.weightUnit;
  const weight = (kg: number) => `${displayWeight(kg, unit, 1, locale)} ${unit}`;
  const dark = data.settings.theme === 'dark';
  const colors = { bg: dark ? '#101411' : '#F0F7F7', card: dark ? '#1C251F' : '#FFFFFF', ink: dark ? '#F4F8F4' : '#203B40', muted: dark ? '#A5B3A8' : '#526D73', accent: String(accentStyle(data.settings.theme, data.settings.accentColor)['--accent-ink']) };
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Weight&Exercise - ' + label('Informe de progreso', 'Progress report'), creator: 'Weight&Exercise', subject: range.start + ' - ' + range.end });
  const text = (value: string, x: number, y: number, size = 10, color = colors.ink, bold = false) => {
    doc.setTextColor(color); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.text(value, x, y);
  };
  const page = (title: string) => {
    doc.setFillColor(colors.bg); doc.rect(0, 0, 210, 297, 'F');
    text('Weight&', 18, 20, 15, colors.ink, true); text('Exercise', 18, 26, 15, colors.ink, true);
    text('PRO', 181, 21, 10, colors.accent, true);
    doc.setDrawColor(colors.accent); doc.setLineWidth(.7); doc.line(18, 33, 192, 33);
    text(title, 18, 46, 19, colors.ink, true);
    text(`${range.start}  -  ${range.end}`, 18, 54, 9, colors.muted);
  };
  page(label('Tu progreso, en perspectiva.', 'Your progress, in perspective.'));
  const metric = (title: string, value: string, x: number, y: number) => {
    doc.setFillColor(colors.card); doc.roundedRect(x, y, 84, 28, 3, 3, 'F');
    text(title, x + 6, y + 9, 9, colors.muted); text(value, x + 6, y + 21, 18, colors.ink, true);
  };
  metric(label('Primer registro del período', 'First entry in range'), weight(report.first!.weightKg), 18, 64);
  metric(label('Último registro del período', 'Latest entry in range'), weight(report.last!.weightKg), 108, 64);
  metric(label('Cambio entre ambos registros', 'Change between these entries'), report.changeKg === null ? '--' : `${report.changeKg > 0 ? '+' : ''}${weight(report.changeKg)}`, 18, 98);
  metric(label('Peso promedio', 'Average weight'), weight(report.averageKg!), 108, 98);
  text(label('TU EVOLUCIÓN', 'YOUR PROGRESS'), 18, 139, 10, colors.accent, true);
  const bounds = { x: 30, y: 150, width: 156, height: 48 };
  const lowest = report.minKg! - .7, highest = report.maxKg! + .7;
  const startTime = Date.parse(report.first!.date), endTime = Date.parse(report.last!.date);
  const point = (record: DailyRecord) => ({
    x: bounds.x + (endTime === startTime ? .5 : (Date.parse(record.date) - startTime) / (endTime - startTime)) * bounds.width,
    y: bounds.y + bounds.height * (1 - (record.weightKg - lowest) / (highest - lowest)),
  });
  for (let index = 0; index < 3; index++) {
    const y = bounds.y + index * bounds.height / 2;
    doc.setDrawColor(colors.card); doc.setLineWidth(.4); doc.line(bounds.x, y, bounds.x + bounds.width, y);
    text(displayWeight(highest - index * (highest - lowest) / 2, unit, 1, locale), 18, y + 1, 7, colors.muted);
  }
  doc.setDrawColor(colors.accent); doc.setFillColor(colors.accent); doc.setLineWidth(.8);
  report.records.forEach((record, index) => {
    const current = point(record);
    if (index) { const previous = point(report.records[index - 1]); doc.line(previous.x, previous.y, current.x, current.y); }
    if (index % Math.max(1, Math.ceil(report.records.length / 45)) === 0 || index === report.records.length - 1) doc.circle(current.x, current.y, .8, 'F');
  });
  text(report.first!.date, bounds.x, 207, 8, colors.muted);
  if (report.records.length > 1) text(report.last!.date, 168, 207, 8, colors.muted);
  const habit = (title: string, count: number, percentage: number, y: number) => {
    text(title, 18, y, 10, colors.ink, true); text(`${count}/${report.records.length} ${label('días', 'days')}  -  ${Math.round(percentage)}%`, 143, y, 9, colors.muted);
    doc.setFillColor(colors.card); doc.roundedRect(18, y + 4, 174, 4, 2, 2, 'F');
    if (percentage) { doc.setFillColor(colors.accent); doc.roundedRect(18, y + 4, Math.max(1, 174 * percentage / 100), 4, 1, 1, 'F'); }
  };
  habit(label('Días con ejercicio', 'Days with exercise'), report.exerciseDays, report.exercisePercent, 224);
  habit(label('Días de comer sano', 'Days of healthy eating'), report.healthyDays, report.healthyPercent, 244);
  text(label('Los días sin registro no se cuentan como descanso.', 'Missing entries are not counted as rest days.'), 18, 269, 8, colors.muted);
  text(label('Resumen personal de tus registros. No es una evaluación médica.', 'A personal summary of your entries. Not a medical assessment.'), 18, 275, 8, colors.muted);
  const rowsPerPage = 27;
  for (let start = 0; start < report.records.length; start += rowsPerPage) {
    doc.addPage(); page(label('Tu historial del período.', 'Your entries in this range.'));
    text(label('Fecha', 'Date'), 21, 68, 10, colors.accent, true);
    text(label('Peso', 'Weight'), 72, 68, 10, colors.accent, true);
    text(label('Ejercicio', 'Exercise'), 117, 68, 10, colors.accent, true);
    text(label('Comer sano', 'Healthy eating'), 159, 68, 10, colors.accent, true);
    report.records.slice(start, start + rowsPerPage).forEach((record, index) => {
      const y = 78 + index * 7;
      if (index % 2 === 0) { doc.setFillColor(colors.card); doc.roundedRect(18, y - 4.5, 174, 7, 1, 1, 'F'); }
      text(record.date, 21, y, 9); text(weight(record.weightKg), 72, y, 9);
      text(record.exercise ? label('Sí', 'Yes') : 'No', 117, y, 9); text(record.healthy ? label('Sí', 'Yes') : 'No', 159, y, 9);
    });
  }
  const pageCount = doc.getNumberOfPages();
  for (let index = 1; index <= pageCount; index++) {
    doc.setPage(index); text(`Weight&Exercise  |  ${label('Creado el', 'Created on')} ${dateKey()}`, 18, 287, 8, colors.muted); text(`${index} / ${pageCount}`, 181, 287, 8, colors.muted);
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
