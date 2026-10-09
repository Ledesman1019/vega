// src/modules/productos/ProductosDialogs.jsx
import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, Plus, TriangleAlert, Trash2, Barcode, FileText, Download } from 'lucide-react'
import { Button, Field, Modal, inputClass } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { addProducto, isValidEstilo, normalizeEstilo, upsertProductos, vaciarProductos } from '../../lib/api/productos.js'
import { downloadPlantilla, parseProductosFile } from '../../lib/excel.js'

/* =========================================================
   IMPORTAR EXCEL
   ========================================================= */
export function ImportDialog({ open, onClose, onDone }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (open) {
      setFile(null)
      setParsed(null)
      setError('')
      setProgress(null)
    }
  }, [open])

  const pick = async (f) => {
    if (!f) return
    setFile(f)
    setParsed(null)
    setError('')
    setReading(true)
    try {
      const result = await parseProductosFile(f)
      if (!result.rows.length) throw new Error('No se encontraron productos válidos. Revisa que tenga las columnas N° y Descripcion.')
      setParsed(result)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setReading(false)
    }
  }

  const run = async () => {
    if (!parsed) return
    setProgress({ done: 0, total: parsed.rows.length })
    try {
      await upsertProductos(parsed.rows, (done, total) => setProgress({ done, total }))
      toast(`Importación completa: ${parsed.rows.length.toLocaleString('es-PE')} productos cargados.`)
      onDone()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
      setProgress(null)
    }
  }

  const busy = !!progress
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      icon={Upload}
      title="Importar productos desde Excel"
      subtitle="Los estilos que ya existen se actualizan; los nuevos se agregan."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="success" icon={Upload} onClick={run} disabled={!parsed} loading={busy}>
            {busy ? `Importando ${pct}%` : parsed ? `Importar ${parsed.rows.length.toLocaleString('es-PE')} productos` : 'Importar'}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]) }}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400'}`}
      >
        <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
        {file ? (
          <>
            <span className="max-w-full truncate font-bold text-zinc-800">{file.name}</span>
            <span className="text-xs text-zinc-500">{reading ? 'Leyendo archivo…' : 'Toca para elegir otro archivo'}</span>
          </>
        ) : (
          <>
            <span className="font-bold text-zinc-800">Elige o arrastra tu archivo Excel</span>
            <span className="text-xs text-zinc-500">Formatos .xlsx o .csv · columnas <b>N°</b> y <b>Descripcion</b></span>
          </>
        )}
      </button>

      {parsed && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Válidos" value={parsed.rows.length} tone="text-emerald-600" />
          <Mini label="Repetidos" value={parsed.duplicated} tone="text-zinc-700" />
          <Mini label="Omitidos" value={parsed.skipped} tone={parsed.skipped ? 'text-amber-600' : 'text-zinc-700'} />
        </div>
      )}

      {parsed && (
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200">
          <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Vista previa</p>
          <ul className="divide-y divide-zinc-100 text-sm">
            {parsed.rows.slice(0, 5).map((r) => (
              <li key={r.estilo} className="flex gap-3 px-3 py-1.5">
                <span className="w-16 shrink-0 font-mono font-bold">{r.estilo}</span>
                <span className="truncate text-zinc-600">{r.descripcion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {busy && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-center text-xs text-zinc-500 tabular-nums">
            {progress.done.toLocaleString('es-PE')} de {progress.total.toLocaleString('es-PE')}
          </p>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={() => downloadPlantilla()} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
        <Download className="h-3.5 w-3.5" /> Descargar plantilla de ejemplo
      </button>
    </Modal>
  )
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-2 py-2">
      <p className={`text-lg font-extrabold tabular-nums ${tone}`}>{value.toLocaleString('es-PE')}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  )
}

/* =========================================================
   AGREGAR PRODUCTO
   ========================================================= */
export function AddProductDialog({ open, onClose, onDone }) {
  const toast = useToast()
  const [estilo, setEstilo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEstilo('')
      setDescripcion('')
      setErrors({})
    }
  }, [open])

  const save = async (e) => {
    e?.preventDefault()
    const next = {}
    const est = normalizeEstilo(estilo)
    if (!est) next.estilo = 'Ingresa el estilo.'
    else if (!isValidEstilo(est)) next.estilo = 'Solo números, letras o guion.'
    if (!descripcion.trim()) next.descripcion = 'Ingresa la descripción.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await addProducto({ estilo: est, descripcion: descripcion.toUpperCase() })
      toast(`Producto ${est} agregado.`)
      onDone()
      onClose()
    } catch (err) {
      setErrors({ estilo: friendlyError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Plus}
      title="Agregar producto"
      subtitle="Una vez guardado no se puede editar ni eliminar desde la app."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Plus} onClick={save} loading={saving}>Guardar producto</Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="N° / Estilo" icon={Barcode} error={errors.estilo}>
          <input value={estilo} onChange={(e) => setEstilo(e.target.value)} className={inputClass(errors.estilo)} placeholder="Ej. 010247" inputMode="numeric" autoFocus />
        </Field>
        <Field label="Descripción" icon={FileText} error={errors.descripcion}>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${inputClass(errors.descripcion)} uppercase`} placeholder="Ej. SAPOLIO BALDE *15LT+1DET.*6KG" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* =========================================================
   VACIAR BASE
   ========================================================= */
const CONFIRM_WORD = 'VACIAR'

export function ClearBaseDialog({ open, total, onClose, onDone }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setText('')
      setError('')
    }
  }, [open])

  const run = async () => {
    setBusy(true)
    try {
      await vaciarProductos()
      toast('La base de productos quedó vacía.', 'info')
      onDone()
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
      icon={TriangleAlert}
      title="Vaciar base de productos"
      subtitle="Esta acción no se puede deshacer."
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" icon={Trash2} onClick={run} loading={busy} disabled={text.trim().toUpperCase() !== CONFIRM_WORD}>
            Vaciar base
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">
        Se eliminarán los <b className="text-zinc-900">{total.toLocaleString('es-PE')}</b> productos. Te recomendamos <b>exportar el Excel</b> antes como respaldo. El historial de rótulos no se borra.
      </p>
      <Field label={`Escribe ${CONFIRM_WORD} para confirmar`} className="mt-4" error={error}>
        <input value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass()} uppercase`} placeholder={CONFIRM_WORD} autoFocus />
      </Field>
    </Modal>
  )
}
