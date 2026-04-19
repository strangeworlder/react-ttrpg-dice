import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve react-ttrpg-dice imports directly to the source
      // so the demo picks up live changes without rebuilding
      'react-ttrpg-dice': path.resolve(__dirname, '..', 'src', 'index.ts'),
    },
  },
});
