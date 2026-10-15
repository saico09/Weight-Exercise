import { Capacitor } from '@capacitor/core';
import { loadData } from './storage';

/** Ownership of personal records is independent of the Pro license. */
export async function exportLocalData(): Promise<void> {
  const data = await loadData();
  await exportPersonalData(data, data.settings.language);
}

export async function exportPersonalData(data: unknown, language: string, source = 'local'): Promise<void> {
  const contents = JSON.stringify({ format: 'weight-exercise-personal-data', version: 1, source, exportedAt: new Date().toISOString(), data }, null, 2);
  const fileName = `WeightExercise-datos-${source}-${new Date().toISOString().slice(0, 10)}.json`;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const result = await Filesystem.writeFile({ path: `exports/${fileName}`, data: contents, encoding: Encoding.UTF8, directory: Directory.Cache, recursive: true });
    await Share.share({ title: 'Weight&Exercise', files: [result.uri], dialogTitle: language === 'en' ? 'Save your personal data' : 'Guardar mis datos' });
  } else {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
