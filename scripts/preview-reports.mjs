import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Disposable sample reports only; never reads or modifies real user records.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { demoData } = await server.ssrLoadModule('/src/lib/model.ts');
  const { createProgressPdf, reportRange } = await server.ssrLoadModule('/src/lib/report.ts');
  await mkdir('output/pdf', { recursive: true });
  for (const theme of ['dark', 'light']) {
    const data = demoData();
    data.settings.theme = theme;
    data.settings.accentColor = theme === 'light' ? '#EFC93E' : null;
    const pdf = await createProgressPdf(data, reportRange(data, 30));
    const path = `output/pdf/progress-sample-${theme}.pdf`;
    await writeFile(path, new Uint8Array(pdf.output('arraybuffer')));
    console.log(`${path}: ${pdf.getNumberOfPages()} pages`);
  }
} finally { await server.close(); }
