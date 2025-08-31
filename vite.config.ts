import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'public/manifest.json',
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Le plugin détecte les entrées depuis le manifest
  },
});
