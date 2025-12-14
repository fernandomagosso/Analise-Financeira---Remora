import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', 
  server: {
    host: true,
    hmr: {
        overlay: false
    }
  },
  resolve: {
    // Prioriza arquivos TypeScript para evitar carregar duplicatas JS
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  },
  define: {
    'process.env': process.env
  }
});