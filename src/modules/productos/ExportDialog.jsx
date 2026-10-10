// src/modules/productos/ExportDialog.jsx
//
// Exportar la base de productos a Excel. Pide la misma clave de
// administrador que la importación (se valida en Supabase).
import { useEffect, useState } from 'react'
import { Download, KeyRound } from 'lucide-react'
import { Button, Field, Modal, inputClass } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { exportarProductos } from '../../lib/api/productos.js'
import { exportProductosExcel } from '../../lib/excel.js'

export default function ExportDialog({ open, onClose }) {
  const toast = useToast()
  const [clave, setClave] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setClave('')
      setError('')
      setBusy(false)
    }
  }, [open])

  const run = async () => {
    if (!clave || busy) return
    setError('')
    setBusy(true)
    try {
      const all = await exportarProductos(clave)
      if (!all.length) {
        setError('La base está vacía, no hay nada que exportar.')
        return
      }
      await exportProductosExcel(all)
      toast(`Excel exportado con ${all.length.toLocaleString('es-PE')} productos.`)
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      icon={Download}
      title="Exportar productos a Excel"
      subtitle="Descarga toda la base de productos."
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="dark" icon={Download} onClick={run} disabled={!clave} loading={busy}>
            {busy ? 'Generando Excel…' : 'Exportar'}
          </Button>
        </>
      }
    >
      <Field label="Clave de administrador" icon={KeyRound}>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          className={inputClass()}
          placeholder="La misma clave de importar"
          autoComplete="current-password"
          autoFocus
        />
      </Field>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}
