import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The booking app is served by the Next.js site under /app/* (BrowserRouter
// basename="/app") from a build embedded at next-app/public/_spa. Production builds
// therefore use base=/_spa/ (set by scripts/build-spa.mjs via SPA_BASE); local dev
// keeps base=/ so `npm run dev` serves the app at http://localhost:5173/app/.
export default defineConfig({
  base: process.env.SPA_BASE || '/',
  plugins: [react()],
})
