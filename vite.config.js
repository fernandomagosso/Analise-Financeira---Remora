import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Corrige problemas de carregamento de assets em caminhos relativos
  server: {
    host: true,
    hmr: {
        overlay: false
    }
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  },
  define: {
    'process.env': process.env
  }
});