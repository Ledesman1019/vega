// src/layout/AppShell.jsx
//
// Estructura tipo ERP:
//  - PC/laptop: barra lateral oscura fija + barra superior con el título.
//  - Teléfono: barra superior compacta + navegación inferior (3 módulos).
import { useEffect, useState } from 'react'
import { Package, Tag, History, Download, Wifi, WifiOff, Database } from 'lucide-react'
import { navigate } from '../lib/router.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { APP_VERSION } from '../version.js'
import { cx } from '../components/ui.jsx'

export const MODULES = [
  { id: 'productos', label: 'Productos', short: 'Productos', icon: Package, desc: 'Base de productos · importar y exportar' },
  { id: 'rotulo', label: 'Crear rótulo', short: 'Rótulo', icon: Tag, desc: 'Genera, imprime o descarga el rótulo del pallet' },
  { id: 'historial', label: 'Historial de rótulos', short: 'Historial', icon: History, desc: 'Rótulos impresos y descargados' },
]

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }
  return { canInstall: !!prompt, install }
}

export default function AppShell({ route, children }) {
  const online = useOnline()
  const { canInstall, install } = useInstallPrompt()
  const current = MODULES.find((m) => m.id === route) || MODULES[0]

  return (
    <div className="min-h-screen bg-zinc-100 font-sans text-zinc-900">
      {/* ============ SIDEBAR (PC) ============ */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-vega-ink text-white lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <img src="/logo-vega.png" alt="VEGA" className="h-10 w-10 rounded-xl shadow-lg shadow-black/30" />
          <div className="min-w-0 leading-tight">
            <p className="text-[17px] font-extrabold tracking-tight">
              VEGA <span className="text-vega-red">Rótulos</span>
            </p>
            <p className="text-[11px] text-zinc-400">Gestión de almacén</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Módulos</p>
          <ul className="space-y-1">
            {MODULES.map((m) => {
              const active = m.id === current.id
              return (
                <li key={m.id}>
                  <a
                    href={`#/${m.id}`}
                    className={cx(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                      active ? 'bg-vega-red text-white shadow-lg shadow-red-950/40' : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <m.icon className={cx('h-[18px] w-[18px]', active ? 'text-white' : 'text-zinc-400 group-hover:text-white')} />
                    {m.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="space-y-2 border-t border-white/10 px-5 py-4 text-xs">
          <StatusLine online={online} dark />
          <p className="text-zinc-500">Versión {APP_VERSION}</p>
        </div>
      </aside>

      {/* ============ CONTENIDO ============ */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Barra superior */}
        <header className="no-print sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
          {/* Franja de marca solo en teléfono */}
          <div className="flex items-center justify-between gap-3 bg-vega-ink px-4 py-2.5 text-white lg:hidden">
            <div className="flex items-center gap-2.5">
              <img src="/logo-vega.png" alt="VEGA" className="h-8 w-8 rounded-lg" />
              <p className="text-[15px] font-extrabold tracking-tight">
                VEGA <span className="text-vega-red">Rótulos</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canInstall && (
                <button onClick={install} className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold">
                  <Download className="h-3.5 w-3.5" /> Instalar
                </button>
              )}
              <span className={cx('h-2.5 w-2.5 rounded-full', online && isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400')} title={online ? 'En línea' : 'Sin conexión'} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:py-4">
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-zinc-400 sm:block">
                Almacén VEGA <span className="mx-1 text-zinc-300">/</span> {current.label}
              </p>
              <h1 className="flex items-center gap-2 truncate text-lg font-extrabold tracking-tight text-zinc-900 sm:text-xl">
                <current.icon className="h-5 w-5 text-vega-red lg:hidden" />
                {current.label}
              </h1>
              <p className="hidden truncate text-xs text-zinc-500 sm:block">{current.desc}</p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              {canInstall && (
                <button
                  onClick={install}
                  className="flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <Download className="h-4 w-4" /> Instalar app
                </button>
              )}
              <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm">
                <StatusLine online={online} />
              </div>
            </div>
          </div>
        </header>

        {!isSupabaseConfigured && (
          <div className="no-print mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6">
            <b>Supabase no está configurado.</b> Completa <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> en el
            archivo <code>.env</code> y reinicia <code>npm run dev</code>.
          </div>
        )}

        <main className="flex-1 px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-10">{children}</main>
      </div>

      {/* ============ NAVEGACIÓN INFERIOR (teléfono) ============ */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-3">
          {MODULES.map((m) => {
            const active = m.id === current.id
            return (
              <li key={m.id}>
                <button
                  onClick={() => navigate(m.id)}
                  className={cx('relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-bold', active ? 'text-vega-red' : 'text-zinc-500')}
                >
                  {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-vega-red" />}
                  <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-red-50')}>
                    <m.icon className="h-5 w-5" />
                  </span>
                  {m.short}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function StatusLine({ online, dark }) {
  const ok = online && isSupabaseConfigured
  return (
    <span className={cx('flex items-center gap-2 font-medium', dark ? 'text-zinc-300' : 'text-zinc-600')}>
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className={cx('h-2 w-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')} />
      {!online ? 'Sin conexión' : isSupabaseConfigured ? (
        <span className="flex items-center gap-1">
          <Database className="h-3.5 w-3.5" /> Conectado
        </span>
      ) : 'Sin base de datos'}
    </span>
  )
}
