// src/modules/automatico/AutomaticoPage.jsx
//
// Rótulo automático: módulo SOLO para el administrador. Se entra con la
// misma clave de la importación (validada en Supabase, sin login). El
// resto de módulos sigue libre para el personal de almacén.
//
//  - Paletizado: factor × cama × altura por producto (Excel o manual).
//  - Ingresos: cantidad recibida; por cada pallet completo se genera un
//    rótulo automático (y se avisa en la campana).
//  - Rótulos pendientes: se les pone la fecha de vencimiento y se imprimen.
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Layers, Lock, LockKeyhole, LogIn, PackagePlus, ShieldCheck, Tags } from 'lucide-react'
import { Button, Card, Field, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { expireIfIdle, lockAdmin, touchAdmin, unlockAdmin, useAdminUnlocked } from '../../lib/api/admin.js'
import { countPendientes } from '../../lib/api/automatico.js'
import PendientesTab from './PendientesTab.jsx'
import IngresosTab from './IngresosTab.jsx'
import PaletizadoTab from './PaletizadoTab.jsx'

const TAB_KEY = 'vega-rotulos:automatico-tab'
const TABS = [
  { id: 'pendientes', label: 'Rótulos pendientes', short: 'Pendientes', icon: Tags },
  { id: 'ingresos', label: 'Ingresos', short: 'Ingresos', icon: PackagePlus },
  { id: 'paletizado', label: 'Paletizado', short: 'Paletizado', icon: Layers },
]

export default function AutomaticoPage() {
  const unlocked = useAdminUnlocked()

  // Se bloquea solo tras un rato sin actividad
  useEffect(() => {
    if (!unlocked) return
    const onActivity = () => touchAdmin()
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    const timer = setInterval(expireIfIdle, 30 * 1000)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      clearInterval(timer)
    }
  }, [unlocked])

  if (!unlocked) return <AdminGate />
  return <AdminModule />
}

function AdminModule() {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || 'pendientes'
    } catch {
      return 'pendientes'
    }
  })
  const [pendientes, setPendientes] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch { /* sin almacenamiento */ }
  }, [tab])

  const refreshCount = useCallback(() => {
    countPendientes().then(setPendientes).catch(() => setPendientes(null))
  }, [])
  useEffect(refreshCount, [refreshCount])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm sm:flex-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                tab === t.id ? 'bg-vega-ink text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
              )}
            >
              <t.icon className="hidden h-4 w-4 sm:block" />
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.id === 'pendientes' && pendientes > 0 && (
                <span className="rounded-full bg-vega-red px-1.5 text-[11px] font-extrabold leading-5 text-white">{pendientes}</span>
              )}
            </button>
          ))}
        </div>
        <Button size="sm" icon={Lock} onClick={lockAdmin}>
          Bloquear
        </Button>
      </div>

      {tab === 'pendientes' && <PendientesTab onChange={refreshCount} />}
      {tab === 'ingresos' && (
        <IngresosTab
          onGenerated={(rotulos) => {
            refreshCount()
            if (rotulos > 0) setTab('pendientes')
          }}
        />
      )}
      {tab === 'paletizado' && <PaletizadoTab />}
    </div>
  )
}

function AdminGate() {
  const toast = useToast()
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!clave || busy) return
    setBusy(true)
    setError('')
    try {
      await unlockAdmin(clave)
      toast('Acceso de administrador concedido.')
    } catch (err) {
      setError(friendlyError(err))
      setClave('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col pt-4 sm:pt-10">
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 bg-vega-ink px-6 py-8 text-center text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vega-red shadow-lg shadow-red-950/40">
            <LockKeyhole className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">Acceso restringido</h2>
            <p className="mt-1 text-sm text-zinc-400">Solo el administrador puede usar el rótulo automático.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="Clave de administrador" icon={KeyRound} error={error}>
            <input
              type="password"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value)
                setError('')
              }}
              className={inputClass(error)}
              placeholder="La misma clave de Importar Excel"
              autoComplete="current-password"
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={busy} disabled={!clave} className="w-full">
            Entrar
          </Button>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            La clave se comprueba en el servidor. Se vuelve a pedir al recargar la app o tras 30 minutos sin uso.
          </p>
        </form>
      </Card>
    </div>
  )
}
