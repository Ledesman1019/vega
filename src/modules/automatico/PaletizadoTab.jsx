// src/modules/automatico/PaletizadoTab.jsx
//
// Tabla 1: por producto, factor (unidades por caja), cama (cajas por
// nivel) y altura (niveles). Total = cama × altura (cajas por pallet) y
// unidades por pallet = factor × total. Se carga por Excel o a mano.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Calculator, FileSpreadsheet, Layers, Pencil, Plus, ScanSearch, Search, Trash2, Upload, CircleCheck, KeyRound } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, ErrorBanner, Field, Modal, Pagination, Spinner, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { friendlyError } from '../../lib/supabase.js'
import { getProducto, isValidEstilo, normalizeEstilo } from '../../lib/api/productos.js'
import { borrarPaletizado, getPaletizado, guardarPaletizado, listPaletizado } from '../../lib/api/automatico.js'
import { parseEntero, parsePaletizadoFile } from '../../lib/excel.js'

export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-PE'))
const PAGE_SIZE = 50

export default function PaletizadoTab() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ rows: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (nuevo) | fila
  const [importOpen, setImportOpen] = useState(false)
  const debounced = useDebounce(search.trim(), 250)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listPaletizado({ search: debounced, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [debounced, page])
  useEffect(load, [load])
  useEffect(() => setPage(0), [debounced])

  const remove = async (row) => {
    if (!window.confirm(`¿Quitar el paletizado de ${row.estilo} · ${row.descripcion}?`)) return
    try {
      await borrarPaletizado(row.estilo)
      toast(`Paletizado de ${row.estilo} eliminado.`)
      load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Layers}
        title="Paletizado por producto"
        subtitle="Unidades por pallet = factor × cama × altura"
        actions={
          <>
            <Button size="sm" icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>
              Importar Excel
            </Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({})}>
              Agregar
            </Button>
          </>
        }
      />
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o descripción"
            className={cx(inputClass(), 'h-10 pl-9 text-sm')}
          />
        </div>
      </div>

      {error && (
        <div className="p-4">
          <ErrorBanner onRetry={load}>{error}</ErrorBanner>
        </div>
      )}

      {!error && !loading && data.rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={debounced ? 'Sin resultados' : 'Aún no hay paletizado'}
          text={debounced ? 'Prueba con otro código o descripción.' : 'Importa tu Excel (Código, Descripción, Factor, Cama, Altura) o agrega los productos uno por uno.'}
        />
      ) : (
        <div className="relative overflow-x-auto">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Spinner />
            </div>
          )}
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2.5 sm:px-5">Código</th>
                <th className="px-3 py-2.5">Descripción</th>
                <th className="px-3 py-2.5 text-right">Factor</th>
                <th className="px-3 py-2.5 text-right">Cama</th>
                <th className="px-3 py-2.5 text-right">Altura</th>
                <th className="px-3 py-2.5 text-right">Total cajas</th>
                <th className="px-3 py-2.5 text-right">Und. por pallet</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.rows.map((r) => (
                <tr key={r.estilo} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-mono font-bold sm:px-5">{r.estilo}</td>
                  <td className="px-3 py-2.5 text-zinc-700">{r.descripcion}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.factor)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.cama)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.altura)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(r.total)}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-vega-red">{fmt(r.unidades_pallet)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800" aria-label="Editar" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(r)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar" title="Quitar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.count > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />}

      <PaletizadoDialog row={editing} onClose={() => setEditing(null)} onSaved={load} />
      <PaletizadoImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </Card>
  )
}

/* ---------- Agregar / editar uno ---------- */
function PaletizadoDialog({ row, onClose, onSaved }) {
  const toast = useToast()
  const open = row !== null
  const isEdit = !!row?.estilo
  const [form, setForm] = useState({ estilo: '', descripcion: '', factor: '', cama: '', altura: '' })
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lookupRef = useRef(0)

  useEffect(() => {
    if (!open) return
    setForm({
      estilo: row.estilo || '',
      descripcion: row.descripcion || '',
      factor: row.factor ? String(row.factor) : '',
      cama: row.cama ? String(row.cama) : '',
      altura: row.altura ? String(row.altura) : '',
    })
    setHint('')
    setError('')
  }, [open, row])

  // Al escribir un código nuevo: trae su paletizado (si ya existe) o la descripción
  const debouncedEstilo = useDebounce(form.estilo, 300)
  useEffect(() => {
    if (!open || isEdit) return
    const est = normalizeEstilo(debouncedEstilo)
    if (!isValidEstilo(est)) return setHint('')
    const id = ++lookupRef.current
    Promise.all([getPaletizado(est), getProducto(est)])
      .then(([pal, prod]) => {
        if (id !== lookupRef.current) return
        if (pal) {
          setForm({ estilo: est, descripcion: pal.descripcion, factor: String(pal.factor), cama: String(pal.cama), altura: String(pal.altura) })
          setHint('Este código ya tiene paletizado: al guardar se actualiza.')
        } else {
          if (prod) setForm((f) => ({ ...f, descripcion: f.descripcion || prod.descripcion }))
          setHint(prod ? 'Producto encontrado en la base.' : 'No está en la base de productos: escribe la descripción.')
        }
      })
      .catch(() => {})
  }, [debouncedEstilo, open, isEdit])

  const set = (k) => (e) => {
    const v = k === 'estilo' || k === 'descripcion' ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, k === 'factor' ? 6 : 4)
    setForm((f) => ({ ...f, [k]: v }))
    setError('')
  }

  const factor = parseEntero(form.factor)
  const cama = parseEntero(form.cama)
  const altura = parseEntero(form.altura)
  const total = cama > 0 && altura > 0 ? cama * altura : null
  const unidades = total && factor > 0 ? factor * total : null

  const save = async (e) => {
    e.preventDefault()
    const estilo = normalizeEstilo(form.estilo)
    const descripcion = form.descripcion.replace(/\s+/g, ' ').trim()
    if (!isValidEstilo(estilo)) return setError('Ingresa un código válido.')
    if (!descripcion) return setError('Ingresa la descripción.')
    if (!(factor >= 1 && factor <= 100000)) return setError('El factor debe ser un entero entre 1 y 100 000.')
    if (!(cama >= 1 && cama <= 1000)) return setError('La cama debe ser un entero entre 1 y 1 000.')
    if (!(altura >= 1 && altura <= 1000)) return setError('La altura debe ser un entero entre 1 y 1 000.')
    setBusy(true)
    try {
      const res = await guardarPaletizado({ items: [{ estilo, descripcion, factor, cama, altura }], aplicar: true })
      if (res.invalidos) throw new Error('Supabase rechazó los datos. Revisa los valores.')
      toast(`Paletizado de ${estilo} guardado: ${fmt(unidades)} unidades por pallet.`)
      onSaved()
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      icon={Layers}
      title={isEdit ? `Editar paletizado · ${row.estilo}` : 'Agregar paletizado'}
      subtitle="Factor, cama y altura del producto en almacén"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" form="paletizado-form" variant="primary" icon={CircleCheck} loading={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="paletizado-form" onSubmit={save} className="space-y-4">
        <Field label="Código (estilo)" hint={hint}>
          <input
            value={form.estilo}
            onChange={set('estilo')}
            disabled={isEdit}
            className={cx(inputClass(), 'font-mono font-bold disabled:bg-zinc-100')}
            placeholder="Ej. 134214"
            autoFocus={!isEdit}
          />
        </Field>
        <Field label="Descripción">
          <input value={form.descripcion} onChange={set('descripcion')} className={inputClass()} placeholder="Ej. BONLE PROTECCIÓN 390G" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Factor">
            <input value={form.factor} onChange={set('factor')} inputMode="numeric" className={cx(inputClass(), 'font-bold tabular-nums')} placeholder="24" autoFocus={isEdit} />
          </Field>
          <Field label="Cama">
            <input value={form.cama} onChange={set('cama')} inputMode="numeric" className={cx(inputClass(), 'font-bold tabular-nums')} placeholder="8" />
          </Field>
          <Field label="Altura">
            <input value={form.altura} onChange={set('altura')} inputMode="numeric" className={cx(inputClass(), 'font-bold tabular-nums')} placeholder="10" />
          </Field>
        </div>

        <div className="rounded-xl bg-zinc-900 p-4 text-white">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Calculator className="h-3.5 w-3.5" /> Cálculo
          </p>
          <p className="flex justify-between gap-3 text-sm">
            <span className="text-zinc-400">Total = cama × altura</span>
            <span className="font-mono tabular-nums">
              {total ? `${fmt(cama)} × ${fmt(altura)} = ` : ''}
              <b className="text-white">{total ? `${fmt(total)} cajas` : '—'}</b>
            </span>
          </p>
          <p className="mt-1 flex justify-between gap-3 text-sm">
            <span className="text-zinc-400">Por pallet = factor × total</span>
            <span className="font-mono tabular-nums">
              {unidades ? `${fmt(factor)} × ${fmt(total)} = ` : ''}
              <b className="text-lg text-red-400">{unidades ? `${fmt(unidades)} und.` : '—'}</b>
            </span>
          </p>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  )
}

/* ---------- Importar Excel ---------- */
function PaletizadoImportDialog({ open, onClose, onDone }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (open) {
      setFile(null)
      setParsed(null)
      setPreview(null)
      setError('')
      setBusy('')
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
      const result = await parsePaletizadoFile(f)
      if (!result.items.length && !result.errores.length) throw new Error('No se encontraron productos en el archivo.')
      setParsed(result)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  const run = async (aplicar) => {
    setError('')
    setBusy(aplicar ? 'importando' : 'revisando')
    try {
      const res = await guardarPaletizado({ items: parsed.items, aplicar })
      if (aplicar) {
        toast(`Paletizado importado: ${fmt(res.nuevos)} nuevos y ${fmt(res.actualizados)} actualizados.`)
        onDone()
        onClose()
      } else setPreview(res)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  const cambios = preview ? preview.nuevos + preview.actualizados : 0
  const working = busy === 'revisando' || busy === 'importando'

  let action = null
  if (parsed?.items.length && !preview)
    action = (
      <Button variant="dark" icon={ScanSearch} onClick={() => run(false)} loading={busy === 'revisando'}>
        Revisar cambios
      </Button>
    )
  else if (preview && cambios === 0) action = <Button variant="dark" icon={CircleCheck} onClick={onClose}>Listo</Button>
  else if (preview)
    action = (
      <Button variant="success" icon={Upload} onClick={() => run(true)} loading={busy === 'importando'}>
        Importar {fmt(cambios)} cambios
      </Button>
    )

  return (
    <Modal
      open={open}
      onClose={working ? undefined : onClose}
      icon={Upload}
      size="lg"
      title="Importar paletizado desde Excel"
      subtitle="Columnas: Código, Descripción, Factor, Cama, Altura (Total opcional)"
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
      <FileDrop file={file} busy={busy === 'leyendo'} disabled={working} onClick={() => inputRef.current?.click()} onFile={pick} />

      {parsed && (
        <div className="mt-4 space-y-3">
          <p className="text-center text-xs text-zinc-500">
            <b className="text-zinc-800">{fmt(parsed.items.length)}</b> productos correctos
            {parsed.repetidos > 0 && <> · {fmt(parsed.repetidos)} repetidos (se toma el último)</>}
            {parsed.errores.length > 0 && <> · <span className="font-semibold text-red-600">{fmt(parsed.errores.length)} filas con error (no se importan)</span></>}
          </p>
          <ErroresList errores={parsed.errores} />
          <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            El total se recalcula siempre como cama × altura. Si el Excel trae una columna Total que no coincide, esa fila se marca como error.
          </p>
        </div>
      )}

      {preview && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Nuevos" value={preview.nuevos} tone="text-emerald-600" />
          <Mini label="Se actualizan" value={preview.actualizados} tone="text-sky-600" />
          <Mini label="Sin cambios" value={preview.sin_cambios} tone="text-zinc-500" />
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

/* ---------- Piezas compartidas con Ingresos ---------- */
export function FileDrop({ file, busy, disabled, onClick, onFile, label = 'Elige o arrastra tu archivo Excel' }) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFile(e.dataTransfer.files?.[0])
      }}
      className={cx(
        'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
        over ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400',
      )}
    >
      <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
      {file ? (
        <>
          <span className="max-w-full truncate font-bold text-zinc-800">{file.name}</span>
          <span className="text-xs text-zinc-500">{busy ? 'Leyendo archivo…' : 'Toca para elegir otro archivo'}</span>
        </>
      ) : (
        <>
          <span className="font-bold text-zinc-800">{label}</span>
          <span className="text-xs text-zinc-500">Formatos .xlsx o .csv</span>
        </>
      )}
    </button>
  )
}

export function ErroresList({ errores }) {
  if (!errores?.length) return null
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-red-50 text-left font-bold text-red-800">
          <tr>
            <th className="px-3 py-1.5">Fila</th>
            <th className="px-3 py-1.5">Código</th>
            <th className="px-3 py-1.5">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-100">
          {errores.map((e, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 tabular-nums">{e.fila}</td>
              <td className="px-3 py-1.5 font-mono font-bold">{e.estilo || '—'}</td>
              <td className="px-3 py-1.5 text-red-700">{e.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Mini({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-2 py-2">
      <p className={`text-lg font-extrabold tabular-nums ${tone}`}>{fmt(value)}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  )
}
