import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: './',
  plugins: [
    legacy({
      targets: ['Chrome >= 37'],
      modernPolyfills: false,
      renderLegacyChunks: true,
    }),
  ],
  build: {
    target: 'es2017',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
