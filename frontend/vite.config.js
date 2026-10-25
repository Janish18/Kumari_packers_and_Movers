import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: the browser talks to Vite (5173); /api and /media are proxied to Django so cookies stay same-origin.
// Production: serve the built files from a web server that reverse-proxies /api and /media to Django,
// or set VITE_API_BASE_URL to the API host at build time. `vite preview` does NOT proxy unless configured here.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'
  const proxy = { '/api': { target, changeOrigin: true }, '/media': { target, changeOrigin: true } }
  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts'
            return undefined
          },
        },
      },
    },
    test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js', css: false },
  }
})
