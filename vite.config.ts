import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Raise warning limit
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            // React core
            'vendor-react': ['react', 'react-dom'],
            // Firebase
            'vendor-firebase': ['firebase/app', 'firebase/auth'],
            // Maps
            'vendor-maps': ['@vis.gl/react-google-maps'],
            // Icons
            'vendor-icons': ['lucide-react'],
            // i18n
            'vendor-i18n': ['i18next', 'react-i18next'],
            // Leaflet Maps
            'vendor-leaflet': ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
  };
});
