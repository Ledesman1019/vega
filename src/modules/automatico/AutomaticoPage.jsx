// src/modules/automatico/AutomaticoPage.jsx
//
// Rótulo automático: módulo SOLO para el administrador. Se entra con la
// misma clave de la importación (validada en Supabase, sin login). El
// resto de módulos sigue libre para el personal de almacén.
import { useEffect, useState } from 'react'
import { KeyRound, Lock, LockKeyhole, LogIn, ShieldCheck, WandSparkles } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Field, inputClass } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { expireIfIdle, lockAdmin, touchAdmin, unlockAdmin, useAdminUnlocked } from '../../lib/api/admin.js'

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

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Card>
        <CardHeader
          icon={WandSparkles}
          title="Rótulo automático"
          subtitle="Modo administrador"
          actions={
            <Button size="sm" icon={Lock} onClick={lockAdmin}>
              Bloquear
            </Button>
          }
        />
        <EmptyState
          icon={WandSparkles}
          title="Módulo listo para configurar"
          text="Aquí irá la operación del rótulo automático."
        />
      </Card>
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
