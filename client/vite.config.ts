import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // în dev, /api merge prin proxy către Express — fără CORS și fără URL-uri hardcodate
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
