import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('pdfmake')) return 'vendor-pdf';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('sonner')) return 'vendor-ui';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('socket.io-client')) return 'vendor-socket';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
