import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const isAnalyze = process.env.ANALYZE === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Bundle analyzer: run `ANALYZE=true npm run build` to generate stats.html
      isAnalyze && visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        title: 'Aswaq Bundle Analysis',
      }),
    ].filter(Boolean),

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
      // Target modern browsers for smaller output
      target: ['es2020', 'chrome80', 'firefox80', 'safari14'],
      // Reduce warning threshold to 600 KB (down from 1500)
      chunkSizeWarningLimit: 600,
      // Skip compressed size reporting during build for faster output
      reportCompressedSize: false,
      // Split CSS per chunk
      cssCodeSplit: true,
      // Minify with esbuild (faster than terser, good output)
      minify: 'esbuild',

      rollupOptions: {
        output: {
          // Optimal manual chunk splitting for Aswaq
          manualChunks(id) {
            // React core
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            // Firebase (large — only loaded on auth)
            if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
              return 'vendor-firebase';
            }
            // Google Maps
            if (id.includes('node_modules/@vis.gl/')) {
              return 'vendor-maps-google';
            }
            // Leaflet (only loaded when map opens)
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'vendor-maps-leaflet';
            }
            // Animation library
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            // Charts (only in admin/dashboard)
            if (id.includes('node_modules/recharts/') || id.includes('node_modules/@reduxjs/')) {
              return 'vendor-charts';
            }
            // Icons
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            // i18n
            if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
              return 'vendor-i18n';
            }
            // Socket.io (only loaded when user is logged in)
            if (id.includes('node_modules/socket.io-client/') || id.includes('node_modules/engine.io-client/')) {
              return 'vendor-socket';
            }
            // Capacitor (mobile-only)
            if (id.includes('node_modules/@capacitor/')) {
              return 'vendor-capacitor';
            }
          },
        },
      },
    },
  };
});
