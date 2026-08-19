import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative assets make the same build work on both <user>.github.io and
  // <user>.github.io/<repository>/ without hard-coding the repository name.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
