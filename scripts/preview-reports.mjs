import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Disposable sample reports only; never reads or modifies real user records.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { demoData, dateKey, shiftDate } = await server.ssrLoadModule('/src/lib/model.ts');
  const { createProgressPdf, reportRange, reportFontFiles } = await server.ssrLoadModule('/src/lib/report.ts');
  await mkdir('output/pdf', { recursive: true });
  for (const theme of ['dark', 'light', 'aurora', 'sand']) {
    const data = demoData();
    data.settings.theme = theme;
    data.settings.accentColor = theme === 'light' ? '#EFC93E' : null;
    data.settings.language = theme === 'aurora' ? 'en' : 'es';
    data.settings.weightUnit = theme === 'aurora' ? 'lb' : 'kg';
    const today = dateKey();
    data.records = Array.from({ length: 90 }, (_, index) => ({
      id: `sample-${index}`, date: shiftDate(today, index - 89), weightKg: Math.round((88 - index * .065 + Math.sin(index * .7) * .4) * 10) / 10,
      exercise: index % 5 !== 0, healthy: index % 7 !== 2, note: '',
      ...(index % 11 !== 0 ? { steps: index === 44 ? 0 : 4000 + index % 7 * 650 } : {}),
    }));
    const paths = reportFontFiles(theme);
    const fonts = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, (await readFile(`public${path}`)).toString('base64')])));
    const pdf = await createProgressPdf(data, reportRange(data, 30), { fonts });
    const path = `output/pdf/progress-sample-${theme}.pdf`;
    await writeFile(path, new Uint8Array(pdf.output('arraybuffer')));
    console.log(`${path}: ${pdf.getNumberOfPages()} pages`);
  }
} finally { await server.close(); }
