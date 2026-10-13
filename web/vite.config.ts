import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Deployed to GitHub Pages under /AI-Hedge-Fund-Research-Team/.
// Override with VITE_BASE=/ for other hosts (Vercel, Netlify, Docker...).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/AI-Hedge-Fund-Research-Team/',
  plugins: [react()],
  resolve: {
    alias: {
      '@services': fileURLToPath(new URL('../services', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
})
