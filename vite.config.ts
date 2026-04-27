import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/axiom-trading-platform/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/axiom-trading.html'),
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    open: '/src/dashboard/axiom-trading.html',
    hmr: true,
  },
});
