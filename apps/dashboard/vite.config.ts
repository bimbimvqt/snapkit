import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const version = JSON.parse(readFileSync(root + 'package.json', 'utf8')).version;
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), base: './',
  publicDir: fileURLToPath(new URL('../../packages/ui', import.meta.url)),
  plugins: [react()], define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: 'build', emptyOutDir: true, target: 'es2022', sourcemap: false,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-dom/client'] } } } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4310', '/downloads': 'http://127.0.0.1:4310' } }
});
