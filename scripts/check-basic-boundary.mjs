import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const forbiddenDependencies = ['jspdf', 'xlsx', 'exceljs', '@capacitor/filesystem', '@capacitor/share', '@capacitor-community/health'];
const forbiddenFiles = [
  'src/components/CloudAccount.tsx', 'src/components/ReportExport.tsx', 'src/components/RecordComparison.tsx',
  'src/components/Steps.tsx', 'src/components/AccentPicker.tsx', 'src/components/ThemeShowcase.tsx',
  'src/lib/cloud.ts', 'src/lib/report.ts', 'src/lib/recap.ts', 'src/lib/steps.ts', 'src/lib/workbook.ts',
  'server/src/index.mjs', 'compose.yaml',
];
const forbiddenRuntime = /configureRecap|createProgressPdf|saveProgressPdf|saveHistoryWorkbook|HealthConnectPlugin|requestHealthConnect|\/api\/(?:auth|backup|account|session)|\/health-connect/;
const failures = [];
for (const name of forbiddenDependencies) if (packageJson.dependencies?.[name] || packageJson.devDependencies?.[name]) failures.push(`Pro dependency: ${name}`);
for (const path of forbiddenFiles) if (existsSync(join(root, path))) failures.push(`Pro implementation: ${path}`);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
for (const path of files(join(root, 'src')).filter(path => /\.[jt]sx?$/.test(path) && !/\.test\./.test(path))) {
  if (forbiddenRuntime.test(readFileSync(path, 'utf8'))) failures.push(`Pro runtime in source: ${relative(root, path)}`);
}
const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
if (/android\.permission\.health\.|android\.permission\.ACTIVITY_RECOGNITION/.test(manifest)) failures.push('Pro health permissions in Basic Android manifest');

if (process.argv.includes('--bundle')) {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) failures.push('Missing dist: build the app before checking the bundle');
  else for (const path of files(dist).filter(path => /\.js$/.test(path))) {
    if (forbiddenRuntime.test(readFileSync(path, 'utf8')) || /jspdf|workbook|health-connect/i.test(relative(dist, path))) failures.push(`Pro runtime in bundle: ${relative(root, path)}`);
  }
}
if (failures.length) {
  console.error(`Basic must contain previews only, never Pro implementations:\n${failures.map(failure => `- ${failure}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Basic boundary verified: no Pro implementations or dependencies${process.argv.includes('--bundle') ? ' in source and bundle' : ''}.`);
