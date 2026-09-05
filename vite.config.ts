import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'oxc',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Pisahkan vendor agar dapat di-cache permanen oleh browser
        // (chunk tidak berubah selama versi dependency sama).
        // (Rolldown/Vite 8 hanya menerima bentuk fungsi untuk manualChunks)
        manualChunks(id) {
          // Pakai trailing slash supaya TIDAK ikut menangkap react-quill-new
          // (editor Quill di panel admin, ~200+ kB, harus tetap lazy).
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@supabase/supabase-js/')) {
            return 'supabase-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
    open: true,
  },
})