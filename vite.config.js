import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  // Garante que o process.env.API_KEY funcione no ambiente cliente
  define: {
    'process.env': process.env
  }
});