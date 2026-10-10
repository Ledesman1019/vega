// src/modules/productos/ImportDialog.jsx
//
// Importar Excel protegido con clave de administrador.
// Paso 1: elegir archivo · Paso 2: clave + revisar cambios · Paso 3: importar.
// Nunca duplica: los estilos nuevos se agregan, los que cambiaron de
// descripción se actualizan y los iguales no se tocan.
import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, KeyRound, ScanSearch, CircleCheck } from 'lucide-react'
import { Button, Field, Modal, inputClass } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { importarProductos } from '../../lib/api/productos.js'
import { parseProductosFile } from '../../lib/excel.js'

const fmt = (n) => n.toLocaleString('es-PE')

export default function ImportDialog({ open, onClose, onDone }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [clave, setClave] = useState('')
  const [preview, setPreview] = useState(null) // { nuevos, actualizados, sin_cambios }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('') // 'leyendo' | 'revisando' | 'importando'
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (open) {
      setFile(null)
      setParsed(null)
      setClave('')
      setPreview(null)
      setError('')
      setBusy('')
      setProgress(0)
    }
  }, [open])

  const pick = async (f) => {
    if (!f) return
    setFile(f)
    setParsed(null)
    setPreview(null)
    setError('')
    setBusy('leyendo')
    try {
      const result = await parseProductosFile(f)
      if (!result.rows.length) throw new Error('No se encontraron productos válidos. El Excel debe tener una columna de código o estilo (ej. N°, ProductoCodigo) y otra de descripción.')
      setParsed(result)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  const run = async (aplicar) => {
    if (!parsed || !clave) return
    setError('')
    setBusy(aplicar ? 'importando' : 'revisando')
    setProgress(0)
    try {
      const res = await importarProductos({
        clave,
        rows: parsed.rows,
        aplicar,
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      })
      if (aplicar) {
        toast(`Importación lista: ${fmt(res.nuevos)} nuevos y ${fmt(res.actualizados)} actualizados.`)
        onDone()
        onClose()
      } else {
        setPreview(res)
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  const cambios = preview ? preview.nuevos + preview.actualizados : 0
  const working = busy === 'revisando' || busy === 'importando'

  let action
  if (!preview) {
    action = (
      <Button variant="dark" icon={ScanSearch} onClick={() => run(false)} disabled={!parsed || !clave} loading={busy === 'revisando'}>
        {busy === 'revisando' ? `Revisando ${progress}%` : 'Revisar cambios'}
      </Button>
    )
  } else if (cambios === 0) {
    action = <Button variant="dark" icon={CircleCheck} onClick={onClose}>Listo</Button>
  } else {
    action = (
      <Button variant="success" icon={Upload} onClick={() => run(true)} loading={busy === 'importando'}>
        {busy === 'importando' ? `Importando ${progress}%` : `Importar ${fmt(cambios)} cambios`}
      </Button>
    )
  }

  return (
    <Modal
      open={open}
      onClose={working ? undefined : onClose}
      icon={Upload}
      title="Importar productos desde Excel"
      subtitle="Sin duplicados: agrega lo nuevo y actualiza solo lo que cambió."
      footer={
        <>
          <Button onClick={onClose} disabled={working}>Cancelar</Button>
          {action}
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

      {/* 1. Archivo */}
      <button
        type="button"
        disabled={working}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]) }}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400'}`}
      >
        <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
        {file ? (
          <>
            <span className="max-w-full truncate font-bold text-zinc-800">{file.name}</span>
            <span className="text-xs text-zinc-500">{busy === 'leyendo' ? 'Leyendo archivo…' : 'Toca para elegir otro archivo'}</span>
          </>
        ) : (
          <>
            <span className="font-bold text-zinc-800">Elige o arrastra tu archivo Excel</span>
            <span className="text-xs text-zinc-500">Formatos .xlsx o .csv · columna de <b>código</b> y de <b>descripción</b></span>
          </>
        )}
      </button>

      {parsed && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          <b className="text-zinc-800">{fmt(parsed.rows.length)}</b> productos válidos en el archivo
          {parsed.duplicated > 0 && <> · {fmt(parsed.duplicated)} repetidos dentro del Excel (se toma el último)</>}
          {parsed.skipped > 0 && <> · <span className="text-amber-600">{fmt(parsed.skipped)} filas omitidas (sin estilo o descripción)</span></>}
        </p>
      )}

      {/* 2. Clave */}
      {parsed && (
        <Field label="Clave de administrador" icon={KeyRound} className="mt-4">
          <input
            type="password"
            value={clave}
            onChange={(e) => {
              setClave(e.target.value)
              setPreview(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && clave && !working && run(!!preview && cambios > 0)}
            className={inputClass()}
            placeholder="Solo el administrador puede importar"
            autoComplete="current-password"
            autoFocus
          />
        </Field>
      )}

      {/* 3. Resumen de cambios */}
      {preview && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Comparado con la base actual</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Nuevos" value={preview.nuevos} tone="text-emerald-600" />
            <Mini label="Se actualizan" value={preview.actualizados} tone="text-sky-600" />
            <Mini label="Sin cambios" value={preview.sin_cambios} tone="text-zinc-500" />
          </div>
          <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
            {cambios === 0
              ? 'La base ya está al día con este archivo: no hay nada que importar.'
              : 'No se crea ningún duplicado. Los productos que ya están en la base y no vienen en el Excel se conservan.'}
          </p>
        </div>
      )}

      {working && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-2 py-2">
      <p className={`text-lg font-extrabold tabular-nums ${tone}`}>{fmt(value)}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  )
}
