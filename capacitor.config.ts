import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'cl.forma.weightexercise.basic',
  appName: 'Weight&Exercise Basic',
  webDir: 'dist',
  loggingBehavior: 'none',
  android: { backgroundColor: '#101311', allowMixedContent: false },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
  },
};
export default config;
