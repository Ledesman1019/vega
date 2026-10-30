// src/modules/productos/DeleteBaseDialog.jsx
//
// Eliminar TODA la base de productos (y sus EAN) para subir una nueva y
// limpia. Pide la clave de administrador y escribir ELIMINAR (se valida
// en Supabase, ver supabase/11_eliminar_base_productos.sql). Permite
// descargar un respaldo en Excel antes de borrar.
import { useEffect, useState } from 'react'
import { CircleCheck, Download, KeyRound, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { Button, Field, Modal, inputClass } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { eliminarBaseProductos, exportarProductos } from '../../lib/api/productos.js'
import { exportProductosExcel } from '../../lib/excel.js'

const fmt = (n) => Number(n || 0).toLocaleString('es-PE')
const PALABRA = 'ELIMINAR'

export default function DeleteBaseDialog({ open, onClose, onDone, onImport, total }) {
  const toast = useToast()
  const [clave, setClave] = useState('')
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState('') // 'respaldo' | 'eliminando'
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { productos, eans }

  useEffect(() => {
    if (open) {
      setClave('')
      setTexto('')
      setBusy('')
      setError('')
      setResult(null)
    }
  }, [open])

  const respaldo = async () => {
    if (!clave || busy) return
    setError('')
    setBusy('respaldo')
    try {
      const all = await exportarProductos(clave)
      if (!all.length) {
        setError('La base ya está vacía, no hay nada que respaldar.')
        return
      }
      await exportProductosExcel(all)
      toast(`Respaldo descargado con ${fmt(all.length)} productos.`)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  const eliminar = async () => {
    if (!clave || texto !== PALABRA || busy) return
    setError('')
    setBusy('eliminando')
    try {
      const r = await eliminarBaseProductos({ clave, confirmacion: texto })
      setResult(r)
      onDone?.()
      toast(`Base eliminada: ${fmt(r.productos)} productos.`)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  if (result) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        icon={CircleCheck}
        title="Base de productos eliminada"
        subtitle="Ya puedes subir la base nueva."
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cerrar</Button>
            <Button variant="success" icon={Upload} onClick={onImport}>
              Importar base nueva
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Se eliminaron <b>{fmt(result.productos)}</b> productos y <b>{fmt(result.eans)}</b> códigos EAN.
        </div>
        <p className="mt-3 text-xs text-zinc-500">El historial de rótulos, el paletizado y los rótulos automáticos no se tocaron.</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      icon={Trash2}
      title="Eliminar base de productos"
      subtitle="Para subir una base nueva y limpia."
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={!!busy}>Cancelar</Button>
          <Button variant="primary" icon={Trash2} onClick={eliminar} disabled={!clave || texto !== PALABRA || !!busy} loading={busy === 'eliminando'}>
            {busy === 'eliminando' ? 'Eliminando…' : 'Eliminar todo'}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          Se borrarán <b>{total == null ? 'todos los' : fmt(total)} productos</b> y sus códigos EAN. <b>No se puede deshacer.</b>
          <p className="mt-1 text-xs text-red-800/80">No se tocan: historial de rótulos, paletizado, ingresos ni rótulos automáticos.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Clave de administrador" icon={KeyRound}>
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className={inputClass()}
            placeholder="La misma clave de importar"
            autoComplete="current-password"
            autoFocus
          />
        </Field>

        <Button icon={Download} onClick={respaldo} disabled={!clave || !!busy} loading={busy === 'respaldo'} className="w-full">
          {busy === 'respaldo' ? 'Generando respaldo…' : 'Descargar respaldo en Excel (recomendado)'}
        </Button>

        <Field label={`Escribe ${PALABRA} para confirmar`}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && eliminar()}
            className={inputClass()}
            placeholder={PALABRA}
            autoComplete="off"
          />
        </Field>
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}
