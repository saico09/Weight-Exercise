import { Capacitor } from '@capacitor/core';
import { dateKey, type AppData, type DailyRecord } from './model';
import { buildProgressWorkbook } from '../../shared/progress-workbook.mjs';

export async function saveProgressWorkbook(data: AppData, records: DailyRecord[], scopeLabel: string): Promise<void> {
  const bytes = buildProgressWorkbook(data, { records, scopeLabel });
  const fileName = `WeightExercise-${dateKey()}-${Date.now()}.xlsx`;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    let raw = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) raw += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const result = await Filesystem.writeFile({ path: `reports/${fileName}`, data: btoa(raw), directory: Directory.Cache, recursive: true });
    await Share.share({ title: 'Weight&Exercise', files: [result.uri], dialogTitle: data.settings.language === 'en' ? 'Save or share your workbook' : 'Guardar o compartir Excel' });
  } else {
    const buffer = new Uint8Array(bytes).buffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
