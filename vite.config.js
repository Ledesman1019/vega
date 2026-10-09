import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Lee el .env (SUPABASE_URL / SUPABASE_ANON_KEY). Solo estas dos
  // variables llegan al navegador: NUNCA se expone otra (por ejemplo
  // una service_role key que se agregue después).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''

  return {
    define: {
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'logo-vega.png'],
        manifest: {
          name: 'VEGA · Rótulos de almacén',
          short_name: 'VEGA Rótulos',
          description: 'Productos, rótulos e historial de almacén VEGA',
          theme_color: '#16171a',
          background_color: '#f4f5f7',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
        }
      })
    ]
  }
})
