import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/.tools/**', '**/android/**', '**/output/**'] } },
  build: { rollupOptions: { output: { manualChunks: { ionic: ['@ionic/react'], react: ['react', 'react-dom'] } } } },
});
