// src/App.jsx
import { useEffect, useState } from 'react'
import PalletForm from './components/PalletForm.jsx'
import ExportView from './components/ExportView.jsx'
import PrintCounter from './components/PrintCounter.jsx'
import BottomNav from './components/BottomNav.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import { useDailyPrintCounter } from './hooks/useDailyPrintCounter.js'
import { IconChevronDown, IconZap, IconShield, IconGauge } from './components/Icons.jsx'

const STORAGE_KEY = 'rotulo-pallet-vega:last'

const FEATURES = [
  { icon: IconZap, title: 'Rápido', text: 'Genera tus etiquetas en segundos.' },
  { icon: IconShield, title: 'Seguro', text: 'Información confiable y precisa.' },
  { icon: IconGauge, title: 'Eficiente', text: 'Optimiza la gestión de tu almacén.' },
]

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) { /* almacenamiento no disponible */ }
    return { codigo: '', fecha: '', cantidad: '' }
  })
  const [orientation, setOrientation] = useState('portrait')
  const [errors, setErrors] = useState({})
  const [view, setView] = useState('form') // 'form' | 'export'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)

  const { count, increment, reset } = useDailyPrintCounter()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) { /* almacenamiento no disponible */ }
  }, [data])

  useEffect(() => {
    let styleTag = document.getElementById('print-orientation-style')
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = 'print-orientation-style'
      document.head.appendChild(styleTag)
    }
    styleTag.textContent = `@page { size: A4 ${orientation}; margin: 0; }`
  }, [orientation])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const validate = () => {
    const next = {}

    // Código: exactamente 6 dígitos
    const codigoLimpio = data.codigo.trim()
    if (!codigoLimpio) {
      next.codigo = 'Ingresa el código del producto.'
    } else if (!/^\d{6}$/.test(codigoLimpio)) {
      next.codigo = 'El código debe tener exactamente 6 dígitos.'
    }

    // Fecha: hoy o futuro
    if (!data.fecha) {
      next.fecha = 'Selecciona la fecha de vencimiento.'
    } else {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const seleccionada = new Date(`${data.fecha}T00:00:00`)
      if (seleccionada < hoy) {
        next.fecha = 'La fecha no puede ser anterior a hoy.'
      }
    }

    // Cantidad: número > 0
    if (!data.cantidad || Number(data.cantidad) <= 0) {
      next.cantidad = 'Ingresa una cantidad válida.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleGenerate = () => {
    if (!validate()) return
    setView('export')
  }

  const handleNavChange = (target) => {
    if (target === view) return
    if (target === 'export') {
      handleGenerate() // valida antes de mostrar vista previa
      return
    }
    setView(target)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowInstall(false)
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-neutral-50 font-sans pb-24 lg:pb-0">
      {/* Encabezado */}
      <header className="no-print flex items-center justify-between gap-3 border-b-4 border-vega-red bg-vega-ink px-4 py-3.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-vega.png" alt="VEGA" className="h-10 w-10 shrink-0 rounded-xl shadow-sm" />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
              Rótulo de Pallet
            </h1>
            <p className="truncate text-xs text-neutral-400 sm:text-sm">
              Generador de etiquetas de almacén
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white sm:flex">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
            </svg>
          </span>
          Sistema VEGA
          <IconChevronDown className="h-4 w-4 text-neutral-400" />
        </div>
      </header>

      {view === 'export' ? (
        <ExportView
          data={data}
          orientation={orientation}
          onOrientation={setOrientation}
          onBack={() => setView('form')}
          onPrinted={increment}
        />
      ) : (
        <>
          {showInstall && (
            <div className="no-print mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:mx-8">
              <span className="min-w-0">
                Puedes instalar esta app en tu teléfono, laptop o PC para usarla sin conexión.
              </span>
              <button
                onClick={handleInstall}
                className="shrink-0 rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
              >
                Instalar
              </button>
            </div>
          )}

          <main className="relative flex w-full flex-1 flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden lg:block">
              <div className="absolute inset-0 bg-neutral-900" />
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 34px)',
                }}
              />
              <div className="absolute -right-24 bottom-[-35%] h-[80%] w-[135%] -rotate-6 bg-vega-red" />
            </div>

            <div className="relative z-10 flex w-full flex-1 flex-col lg:grid lg:grid-cols-2">
              <div className="hidden flex-col items-center justify-center px-10 py-16 text-center lg:flex lg:px-16">
                <img
                  src="/logo-vega.png"
                  alt="VEGA"
                  className="mb-8 h-24 w-24 rounded-3xl shadow-xl shadow-red-600/20"
                />
                <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 xl:text-6xl">
                  Rótulo de
                  <br />
                  <span className="text-vega-red">Pallet</span>
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-500">
                  Genera etiquetas de almacén de forma rápida y segura.
                </p>
                <div className="mt-12 flex w-full max-w-sm flex-col gap-6">
                  {FEATURES.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="flex items-start gap-4 text-left">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-vega-red ring-1 ring-red-100">
                        <Icon className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-neutral-900">{title}</p>
                        <p className="text-sm text-neutral-500">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-14 flex items-center gap-3 text-sm font-medium text-neutral-400">
                  <span className="h-px w-8 bg-neutral-300" />
                  VEGA&nbsp;|&nbsp;Soluciones que impulsan tu operación
                </div>
              </div>

              <div className="flex w-full items-start justify-center px-4 py-6 sm:px-6 sm:py-8 lg:items-center lg:px-12">
                <div className="flex w-full max-w-xl flex-col gap-4">
                  <PrintCounter count={count} onReset={reset} />
                  <PalletForm
                    data={data}
                    onChange={setData}
                    onGenerate={handleGenerate}
                    errors={errors}
                  />
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      <BottomNav
        view={view}
        onChangeView={handleNavChange}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        orientation={orientation}
        onOrientation={setOrientation}
        count={count}
        onReset={reset}
      />
    </div>
  )
}