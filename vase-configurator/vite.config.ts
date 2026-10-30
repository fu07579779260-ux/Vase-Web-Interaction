import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site under /<repo-name>/; the Pages workflow sets BASE_PATH.
  // Vercel and local development use the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // The export worker lazy-loads rhino3dm, which needs an ES-module worker bundle
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
