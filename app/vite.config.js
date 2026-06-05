import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const WEBSITE_DIR = path.resolve(__dirname, '..', 'mybuddymaid')
const APP_PUBLIC = path.resolve(__dirname, 'public')

/**
 * Vite plugin: serves the static marketing website at "/" during dev,
 * so the local dev experience matches production (Vercel).
 * React app routes (/auth, /home, /services, etc.) go through Vite's SPA.
 * Assets in app/public/ take priority over website files.
 */
function serveLandingPage() {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain',
    '.ico': 'image/x-icon', '.webp': 'image/webp',
  }

  // These paths belong to the React SPA — always let Vite handle them
  const SPA_ROUTES = ['/auth', '/splash', '/home', '/services', '/bookings', '/profile',
                      '/@', '/src', '/node_modules', '/__vite']

  return {
    name: 'serve-landing-page',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0]

        // Let React SPA routes pass through to Vite
        if (SPA_ROUTES.some(r => url.startsWith(r))) return next()

        // If the file exists in app/public/, let Vite handle it (priority)
        const appPublicFile = path.join(APP_PUBLIC, url)
        if (url !== '/' && fs.existsSync(appPublicFile) && fs.statSync(appPublicFile).isFile()) {
          return next() // Vite serves it from public/
        }

        // Serve landing page for exact root "/"
        if (url === '/' || url === '/index.html') {
          const file = path.join(WEBSITE_DIR, 'index.html')
          if (fs.existsSync(file)) {
            res.setHeader('Content-Type', 'text/html')
            res.end(fs.readFileSync(file, 'utf-8'))
            return
          }
        }

        // Serve static website files (styles.css, script.js, images, blogs)
        const filePath = path.join(WEBSITE_DIR, url)
        const resolved = path.resolve(filePath)
        // Security: prevent path traversal (H5 fix)
        if (!resolved.startsWith(WEBSITE_DIR)) return next()
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = path.extname(url).toLowerCase()
          if (MIME[ext]) res.setHeader('Content-Type', MIME[ext])
          res.end(fs.readFileSync(resolved))
          return
        }

        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [serveLandingPage(), react()],
})
