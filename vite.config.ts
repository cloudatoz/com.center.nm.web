import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3300,
    strictPort: true,
    allowedHosts: ['839f-52-76-45-224.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:11001',
        changeOrigin: true,
      },
    },
  },
})
