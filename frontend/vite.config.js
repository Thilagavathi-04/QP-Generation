import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('react-router')) return 'router-vendor'
          if (id.includes('@tanstack/react-query')) return 'query-vendor'
          if (id.includes('firebase')) return 'firebase-vendor'
          if (id.includes('jspdf')) return 'jspdf-vendor'
          if (id.includes('html2canvas')) return 'html2canvas-vendor'
          return 'vendor'
        },
      },
    },
  },
})
