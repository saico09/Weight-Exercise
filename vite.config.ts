import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { productionSecurityPolicy } from './scripts/security-policy';
export default defineConfig({
  plugins: [react(), productionSecurityPolicy()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' }, watch: { ignored: ['**/.tools/**', '**/android/**', '**/output/**'] } },
  build: { rollupOptions: { output: { manualChunks: { ionic: ['@ionic/react'], react: ['react', 'react-dom'] } } } },
});
