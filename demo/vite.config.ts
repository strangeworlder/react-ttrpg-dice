import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      // Import lib directly from source, no build step required in dev
      'react-ttrpg-dice': path.resolve(__dirname, '../src/index.ts'),
    },
  },
});
