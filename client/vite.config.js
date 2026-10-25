import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// One source of truth for the version: the root package.json. It is baked into
// the bundle so every build announces itself (title bar + home screen) and it
// is obvious at a glance whether the kids are running the newest one.
const APP_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

// VITE_SINGLEFILE=1 inlines all JS/CSS into a single index.html so the
// offline desktop build runs by double-clicking the file (works from file://).
const SINGLEFILE = process.env.VITE_SINGLEFILE === '1'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [react(), ...(SINGLEFILE ? [viteSingleFile()] : [])],
  server: {
    open: false,
    proxy: {
      '/api': 'http://localhost:3001',
      // Server-rendered surfaces that live only on the server: the Coli store
      // and the Cloud console. Without these, the buttons in the parents'
      // screen open a dead 404 while running the dev server.
      '/coli': 'http://localhost:3001',
      '/cloud': 'http://localhost:3001',
      '/oauth': 'http://localhost:3001',
    },
  },
})
