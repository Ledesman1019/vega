// src/modules/automatico/IngresosTab.jsx
//
// Tabla 2: ingreso de mercadería (cantidad recibida en UNIDADES).
// "Insertar ingreso" (Excel o manual) → Supabase calcula por producto
//   pallets completos = recibido ÷ (factor × cama × altura)   (entero)
//   saldo             = lo que sobra (sin rótulo)
// → vista previa → confirmar: se genera un rótulo por pallet completo y
// se avisa en la campana de notificaciones.
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, Calculator, FileSpreadsheet, Keyboard, PackagePlus, Plus, Trash2, Undo2 } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Field, Modal, Pagination, Spinner, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useNotify } from '../../components/Notifications.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { isValidEstilo, normalizeEstilo } from '../../lib/api/productos.js'
import { eliminarIngreso, listIngresoDetalle, listIngresos, registrarIngreso } from '../../lib/api/automatico.js'
import { parseEntero, parseIngresoFile } from '../../lib/excel.js'
import { formatFecha, formatFechaHora } from '../../utils/dateUtils.js'
import { ErroresList, FileDrop, Mini, fmt } from './PaletizadoTab.jsx'

const PAGE_SIZE = 20

export default function IngresosTab({ onGenerated }) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ rows: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listIngresos({ page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [page])
  useEffect(load, [load])

  const eliminar = async (ing) => {
    const msg =
      `¿Eliminar el ingreso #${ing.id} con sus ${fmt(ing.productos)} productos?\n\n` +
      'Los rótulos que ya generó NO se borran: siguen en Pendientes / Impresos.'
    if (!window.confirm(msg)) return
    setDeleting(ing.id)
    try {
      await eliminarIngreso(ing.id)
      toast(`Ingreso #${ing.id} eliminado.`)
      if (expanded === ing.id) setExpanded(null)
      if (data.rows.length === 1 && page > 0) setPage(page - 1)
      else load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader
        icon={PackagePlus}
        title="Ingresos"
        subtitle="Por cada pallet completo recibido se genera un rótulo automático"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            Insertar ingreso
          </Button>
        }
      />

      {error && (
        <div className="p-4">
          <ErrorBanner onRetry={load}>{error}</ErrorBanner>
        </div>
      )}

      {!error && !loading && data.rows.length === 0 && (
        <EmptyState icon={PackagePlus} title="Aún no hay ingresos" text="Pulsa “Insertar ingreso” para cargar un Excel o escribir las cantidades recibidas." />
      )}
      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!loading && data.rows.length > 0 && (
        <ul className="divide-y divide-zinc-100">
          {data.rows.map((ing) => {
            const { fecha, hora } = formatFechaHora(ing.created_at)
            const isOpen = expanded === ing.id
            return (
              <li key={ing.id}>
                <div className="flex items-center gap-2 pr-3 hover:bg-zinc-50 sm:pr-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : ing.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left sm:pl-5"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900">
                        Ingreso #{ing.id} <span className="font-medium text-zinc-500">· {fecha} {hora}</span>
                      </p>
                      {ing.nota && <p className="truncate text-xs text-zinc-500">{ing.nota}</p>}
                    </div>
                    <span className="hidden text-xs text-zinc-500 sm:block">{fmt(ing.productos)} productos</span>
                    <Badge tone={ing.rotulos ? 'green' : 'zinc'}>{fmt(ing.rotulos)} rótulos</Badge>
                  </button>
                  <button
                    onClick={() => eliminar(ing)}
                    disabled={deleting === ing.id}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Eliminar ingreso"
                  >
                    {deleting === ing.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-2 py-3 sm:px-4">
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Cálculo por producto</p>
                    <ResultadoTable detalle={ing.detalle} />
                    <IngresoFilas ingresoId={ing.id} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {data.count > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />}

      <IngresoDialog
        open={open}
        onClose={() => setOpen(false)}
        onDone={(res) => {
          setPage(0)
          load()
          onGenerated(res.rotulos)
        }}
      />
    </Card>
  )
}

/* ---------- Insertar ingreso ---------- */
const emptyRow = () => ({ id: Math.random().toString(36).slice(2), estilo: '', cantidad: '', fecha: '' })

function IngresoDialog({ open, onClose, onDone }) {
  const toast = useToast()
  const notify = useNotify()
  const inputRef = useRef(null)
  const [mode, setMode] = useState('excel') // excel | manual
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [rows, setRows] = useState([emptyRow()])
  const [nota, setNota] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (open) {
      setFile(null)
      setParsed(null)
      setRows([emptyRow()])
      setNota('')
      setPreview(null)
      setError('')
      setBusy('')
    }
  }, [open])

  // Filas manuales → items (con sus errores, igual que el Excel)
  const manual = (() => {
    const items = []
    const errores = []
    rows.forEach((r, i) => {
      if (!r.estilo.trim() && !r.cantidad.trim()) return
      const estilo = normalizeEstilo(r.estilo)
      const cantidad = parseEntero(r.cantidad)
      if (!isValidEstilo(estilo)) errores.push({ fila: i + 1, estilo: r.estilo, motivo: 'Estilo vacío o no válido' })
      else if (!(cantidad >= 1)) errores.push({ fila: i + 1, estilo, motivo: 'Cantidad vacía o no es un entero positivo' })
      else items.push({ fila: i + 1, estilo, descripcion: '', cantidad, fecha: r.fecha || null })
    })
    return { items, errores }
  })()

  const source = mode === 'excel' ? parsed : manual
  const items = source?.items || []
  const errores = source?.errores || []

  const pick = async (f) => {
    if (!f) return
    setFile(f)
    setParsed(null)
    setPreview(null)
    setError('')
    setBusy('leyendo')
    try {
      const result = await parseIngresoFile(f)
      if (!result.items.length && !result.errores.length) throw new Error('El archivo no tiene filas con cantidad recibida.')
      setParsed(result)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  const calcular = async () => {
    setError('')
    setBusy('calculando')
    try {
      setPreview(await registrarIngreso({ items, nota, aplicar: false }))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  const confirmar = async () => {
    setError('')
    setBusy('guardando')
    try {
      const res = await registrarIngreso({ items, nota, aplicar: true })
      const generan = (res.detalle || []).filter((d) => d.estado === 'genera')
      for (const d of generan) {
        notify({
          type: 'success',
          title: `Se ${d.pallets === 1 ? 'generó 1 rótulo automático' : `generaron ${d.pallets} rótulos automáticos`}`,
          body: `${d.estilo} · ${d.descripcion} — ${fmt(d.total)} cajas por pallet${d.saldo ? ` · saldo ${fmt(d.saldo)} und. sin rótulo` : ''}. Falta la fecha de vencimiento.`,
        })
      }
      if (!generan.length) {
        notify({ type: 'info', title: `Ingreso #${res.ingreso_id} registrado`, body: 'Ningún producto completó un pallet: no se generaron rótulos.' })
      }
      toast(
        res.rotulos
          ? `Ingreso #${res.ingreso_id} registrado: ${fmt(res.rotulos)} rótulo(s) automático(s) generado(s).`
          : `Ingreso #${res.ingreso_id} registrado sin rótulos.`,
      )
      onDone(res)
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  const working = busy === 'calculando' || busy === 'guardando'
  const resetPreview = () => setPreview(null)
  const resumen = preview && {
    genera: preview.detalle.filter((d) => d.estado === 'genera').length,
    incompleto: preview.detalle.filter((d) => d.estado === 'incompleto').length,
    sinConfig: preview.detalle.filter((d) => d.estado === 'sin_config').length,
  }

  return (
    <Modal
      open={open}
      onClose={working ? undefined : onClose}
      icon={PackagePlus}
      size="lg"
      title="Insertar ingreso"
      subtitle="Cantidad recibida en UNIDADES · el mismo estilo repetido se suma"
      footer={
        <>
          <Button onClick={onClose} disabled={working}>Cancelar</Button>
          {preview ? (
            <>
              <Button icon={Undo2} onClick={resetPreview} disabled={working}>Corregir</Button>
              <Button variant="success" icon={CircleCheck} onClick={confirmar} loading={busy === 'guardando'}>
                {preview.rotulos ? `Confirmar y generar ${fmt(preview.rotulos)} rótulo(s)` : 'Registrar ingreso'}
              </Button>
            </>
          ) : (
            <Button variant="dark" icon={Calculator} onClick={calcular} disabled={!items.length || busy === 'leyendo'} loading={busy === 'calculando'}>
              Calcular
            </Button>
          )}
        </>
      }
    >
      {!preview && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
            {[
              ['excel', 'Desde Excel', FileSpreadsheet],
              ['manual', 'Manual', Keyboard],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cx(
                  'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition-colors',
                  mode === id ? 'bg-white text-vega-red shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {mode === 'excel' ? (
            <>
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
              <FileDrop
                file={file}
                busy={busy === 'leyendo'}
                disabled={working}
                onClick={() => inputRef.current?.click()}
                onFile={pick}
                label="Elige o arrastra el Excel del ingreso"
              />
              <p className="mt-2 text-center text-xs text-zinc-500">Columnas: Estilo, Descripción, Cantidad (unidades) y Fecha de vencimiento. Descripción y fecha son opcionales.</p>
              {parsed && (
                <p className="mt-3 text-center text-xs text-zinc-500">
                  <b className="text-zinc-800">{fmt(parsed.items.length)}</b> filas con cantidad
                  {parsed.vacias > 0 && <> · {fmt(parsed.vacias)} sin cantidad (se ignoran)</>}
                  {parsed.errores.length > 0 && <> · <span className="font-semibold text-red-600">{fmt(parsed.errores.length)} con error (no se cargan)</span></>}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_36px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                <span>Estilo</span>
                <span>Cantidad (und.)</span>
                <span>Vencimiento</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_36px] gap-2">
                  <input
                    value={r.estilo}
                    onChange={(e) => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, estilo: e.target.value } : x)))}
                    className={cx(inputClass(), 'font-mono font-bold')}
                    placeholder="134214"
                    autoFocus={i === rows.length - 1 && i > 0}
                  />
                  <input
                    value={r.cantidad}
                    onChange={(e) => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, cantidad: e.target.value.replace(/[^\d]/g, '').slice(0, 9) } : x)))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (i === rows.length - 1) setRows((list) => [...list, emptyRow()])
                      }
                    }}
                    inputMode="numeric"
                    className={cx(inputClass(), 'font-bold tabular-nums')}
                    placeholder="1920"
                  />
                  <input
                    type="date"
                    value={r.fecha}
                    onChange={(e) => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, fecha: e.target.value } : x)))}
                    className={cx(inputClass(), 'px-2 text-sm')}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((list) => (list.length > 1 ? list.filter((x) => x.id !== r.id) : [emptyRow()]))}
                    className="flex items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Quitar fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button size="sm" icon={Plus} onClick={() => setRows((list) => [...list, emptyRow()])}>
                Agregar fila
              </Button>
            </div>
          )}

          {errores.length > 0 && (
            <div className="mt-4">
              <ErroresList errores={errores} />
            </div>
          )}

          <Field label="Nota (opcional)" className="mt-4">
            <input value={nota} onChange={(e) => setNota(e.target.value.slice(0, 200))} className={inputClass()} placeholder="Ej. Guía 001-2345 · proveedor" />
          </Field>
        </>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Generan rótulo" value={resumen.genera} tone="text-emerald-600" />
            <Mini label="No completan" value={resumen.incompleto} tone="text-amber-600" />
            <Mini label="Sin paletizado" value={resumen.sinConfig} tone="text-red-600" />
          </div>
          <ResultadoTable detalle={preview.detalle} />
          {resumen.sinConfig > 0 && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
              Los productos <b>sin paletizado</b> no pueden generar rótulos. Agrégalos en la pestaña Paletizado y vuelve a calcular.
            </p>
          )}
          {(preview.invalidos > 0 || errores.length > 0) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {fmt(errores.length + (preview.invalidos || 0))} fila(s) con error no se tomaron en cuenta.
            </p>
          )}
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
            Revisa el cálculo. Al confirmar se guarda el ingreso y se crea <b>un rótulo por cada pallet completo</b>, con CANT. = cajas del pallet y la fecha de vencimiento por completar.
          </p>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

/* ---------- Resultado del cálculo por producto ---------- */
export function ResultadoTable({ detalle }) {
  if (!detalle?.length) return <p className="py-4 text-center text-sm text-zinc-500">Sin productos.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[720px] text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2">Estilo</th>
            <th className="px-3 py-2">Descripción</th>
            <th className="px-3 py-2">Vencimiento</th>
            <th className="px-3 py-2 text-right">Recibido</th>
            <th className="px-3 py-2 text-right">Por pallet</th>
            <th className="px-3 py-2 text-right">Pallets</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {detalle.map((d) => (
            <Fragment key={d.estilo}>
              <tr className={cx(d.estado === 'genera' && 'bg-emerald-50/50')}>
                <td className="px-3 py-2 font-mono font-bold">{d.estilo}</td>
                <td className="px-3 py-2 text-zinc-700">{d.descripcion || <span className="text-zinc-400">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {d.fechas?.length ? d.fechas.map((f) => <span key={f} className="block">{formatFecha(f)}</span>) : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(d.recibido)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {d.por_pallet ? (
                    <>
                      <b>{fmt(d.por_pallet)}</b>
                      <span className="block text-[10px] text-zinc-400">
                        {d.factor} × ({d.cama} × {d.altura})
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right font-extrabold tabular-nums">{fmt(d.pallets)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(d.saldo)}</td>
                <td className="px-3 py-2">
                  {d.estado === 'genera' && <Badge tone="green">{d.pallets === 1 ? '1 rótulo' : `${d.pallets} rótulos`} · {d.total} cajas</Badge>}
                  {d.estado === 'incompleto' && <Badge tone="amber">Faltan {fmt(d.faltan)} und.</Badge>}
                  {d.estado === 'sin_config' && <Badge tone="red">Sin paletizado</Badge>}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Filas tal como vinieron en el Excel del ingreso ---------- */
function IngresoFilas({ ingresoId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listIngresoDetalle(ingresoId)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(friendlyError(e)))
    return () => {
      alive = false
    }
  }, [ingresoId])

  if (error) return <p className="px-1 text-xs text-red-600">{error}</p>
  if (!rows) return <Spinner className="mx-auto h-4 w-4 text-zinc-400" />
  if (!rows.length) return null
  return (
    <>
      <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Filas del ingreso ({fmt(rows.length)})</p>
      <div className="max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[560px] text-xs sm:text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Fila</th>
              <th className="px-3 py-2">Estilo</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2">Vencimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 tabular-nums text-zinc-400">{r.fila ?? '—'}</td>
                <td className="px-3 py-1.5 font-mono font-bold">{r.estilo}</td>
                <td className="px-3 py-1.5 text-zinc-700">{r.descripcion || '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.cantidad)}</td>
                <td className="px-3 py-1.5 tabular-nums">{formatFecha(r.fecha_vencimiento) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
