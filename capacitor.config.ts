import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'cl.forma.weightexercise',
  appName: 'Weight&Exercise',
  webDir: 'dist',
  android: { backgroundColor: '#101311' },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
  },
};
export default config;
