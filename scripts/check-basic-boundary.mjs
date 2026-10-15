import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const forbiddenDependencies = ['jspdf', 'xlsx', 'exceljs', '@capacitor/filesystem', '@capacitor/share', '@capacitor-community/health', '@revenuecat/purchases-capacitor'];
const forbiddenFiles = [
  'src/components/CloudAccount.tsx', 'src/components/ReportExport.tsx', 'src/components/RecordComparison.tsx',
  'src/components/Steps.tsx', 'src/components/AccentPicker.tsx', 'src/components/ThemeShowcase.tsx',
  'src/components/ProAccessGate.tsx', 'src/components/EmailSummary.tsx',
  'src/lib/cloud.ts', 'src/lib/report.ts', 'src/lib/recap.ts', 'src/lib/steps.ts', 'src/lib/workbook.ts',
  'src/lib/proLicense.ts', 'src/lib/localDataExport.ts',
  'server/src/index.mjs', 'server/src/pro-license.mjs', 'compose.yaml',
];
// Explicit capability identifiers permit SVG/CSS previews and descriptive copy,
// but catch implementations even after their source files have been renamed.
const forbiddenRuntime = /configureRecap|createProgressPdf|saveProgressPdf|saveHistoryWorkbook|HealthConnectPlugin|HealthStepsPlugin|requestHealthConnect|activateProLicense|canAccessPro|ProAccessGate|['"]ProLicense['"]|\/api\/(?:auth|backup|account|session|license|email-summary)|\/health-connect/;
const forbiddenNative = /HealthStepsPlugin|HealthConnectClient|HealthPrivacyActivity|androidx\.health\.connect|android\.permission\.(?:health\.|ACTIVITY_RECOGNITION)|ProLicensePlugin|LicenseVerifier|WE_LICENSE_PUBLIC_KEY|com\.google\.android\.play\.core\.integrity/;
const forbiddenGradle = /androidx\.health\.connect|com\.google\.android\.play:integrity|com\.android\.billingclient|purchases-capacitor|WE_LICENSE_PUBLIC_KEY/;
const failures = [];
for (const name of forbiddenDependencies) if (packageJson.dependencies?.[name] || packageJson.devDependencies?.[name]) failures.push(`Pro dependency: ${name}`);
const lockPath = join(root, 'package-lock.json');
if (existsSync(lockPath)) {
  const locked = Object.keys(JSON.parse(readFileSync(lockPath, 'utf8')).packages || {});
  for (const name of forbiddenDependencies) if (locked.some(path => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))) failures.push(`Pro dependency in lockfile: ${name}`);
}
for (const path of forbiddenFiles) if (existsSync(join(root, path))) failures.push(`Pro implementation: ${path}`);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? ['.git', '.gradle', 'build', 'node_modules'].includes(entry.name) ? [] : files(path) : [path];
  });
}
for (const path of files(join(root, 'src')).filter(path => /\.[jt]sx?$/.test(path) && !/\.test\./.test(path))) {
  if (forbiddenRuntime.test(readFileSync(path, 'utf8'))) failures.push(`Pro runtime in source: ${relative(root, path)}`);
}
const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
if (/android\.permission\.health\.|android\.permission\.ACTIVITY_RECOGNITION/.test(manifest)) failures.push('Pro health permissions in Basic Android manifest');
// Scan every Android source set, not only JS: a hidden native plugin/library
// would still be shipped even when the visible Basic button is a teaser.
for (const path of files(join(root, 'android/app/src')).filter(path => /\.(?:java|kt|xml|json)$/.test(path))) {
  if (forbiddenNative.test(readFileSync(path, 'utf8'))) failures.push(`Pro native implementation: ${relative(root, path)}`);
}
for (const path of files(join(root, 'android')).filter(path => /(?:\.gradle(?:\.kts)?|\.toml)$/.test(path))) {
  if (forbiddenGradle.test(readFileSync(path, 'utf8'))) failures.push(`Pro Android dependency/configuration: ${relative(root, path)}`);
}
const nativeLibs = join(root, 'android/app/libs');
if (existsSync(nativeLibs)) for (const path of files(nativeLibs)) {
  if (/\.(?:aar|jar)$/.test(path) && /health.?connect|play.?integrity|billing|pro.?license/i.test(relative(nativeLibs, path))) failures.push(`Pro native library: ${relative(root, path)}`);
}

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
