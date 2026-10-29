// src/modules/automatico/PendientesTab.jsx
//
// Rótulos generados por los ingresos. Se agrupan por ingreso + producto
// (un rótulo por pallet completo): se pone la fecha de vencimiento y se
// imprimen todas las hojas del grupo de una vez (o se descarga el PDF).
// Cada hoja queda registrada en el Historial de rótulos.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CalendarDays, FileDown, Printer, RotateCcw, Tags } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, ErrorBanner, Spinner, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { friendlyError } from '../../lib/supabase.js'
import { actualizarRotulosAuto, listRotulosAuto } from '../../lib/api/automatico.js'
import { registrarRotulo } from '../../lib/api/historial.js'
import { PAPERS, computeLabelLayout, loadLabelFont } from '../../lib/label/layout.js'
import { buildLabelPdf } from '../../lib/label/pdf.js'
import { formatFecha, formatFechaHora, todayLocalISO } from '../../utils/dateUtils.js'
import { LabelSvg, PrintableLabel } from '../rotulo/LabelSheet.jsx'
import { fmt } from './PaletizadoTab.jsx'

const PAPER_KEY = 'vega-rotulos:papel' // el mismo papel que Crear rótulo

export default function PendientesTab({ onChange }) {
  const toast = useToast()
  const [estado, setEstado] = useState('pendiente') // pendiente | impreso
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fechas, setFechas] = useState({}) // por grupo
  const [busy, setBusy] = useState('') // `${key}:print` | `${key}:pdf` | `${key}:anular`
  const [printPages, setPrintPages] = useState(null)
  const [fontReady, setFontReady] = useState(false)
  const [papel, setPapel] = useState(() => {
    try {
      return localStorage.getItem(PAPER_KEY) || 'A4'
    } catch {
      return 'A4'
    }
  })

  useEffect(() => {
    loadLabelFont().then(() => setFontReady(true))
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(PAPER_KEY, papel)
    } catch { /* sin almacenamiento */ }
  }, [papel])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listRotulosAuto({ estado })
      .then(setRows)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [estado])
  useEffect(load, [load])

  // Un grupo = mismo ingreso y mismo producto (sus pallets 1..N). Se usa
  // created_at (igual para todo el ingreso) porque el ingreso puede haberse
  // eliminado (ingreso_id vacío) y los rótulos siguen aquí.
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const key = `${r.created_at}-${r.estilo}`
      if (!map.has(key)) map.set(key, { key, ...r, items: [] })
      map.get(key).items.push(r)
    }
    return [...map.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => a.pallet_num - b.pallet_num) }))
  }, [rows])

  const fechaDe = (g) => fechas[g.key] ?? g.items[0].fecha_vencimiento ?? ''

  const layoutDe = (g, fecha) =>
    computeLabelLayout({ estilo: g.estilo, descripcion: g.descripcion, fecha, cantidad: String(g.cajas) }, papel)

  // Imprime cuando la copia de impresión ya está en pantalla
  useEffect(() => {
    if (!printPages) return
    const id = requestAnimationFrame(() => {
      window.print()
      setPrintPages(null)
    })
    return () => cancelAnimationFrame(id)
  }, [printPages])

  const validar = (g) => {
    const fecha = fechaDe(g)
    let msg = ''
    if (!fecha) msg = 'Pon la fecha de vencimiento antes de imprimir.'
    else if (estado === 'pendiente' && fecha < todayLocalISO()) msg = 'La fecha de vencimiento no puede ser anterior a hoy.'
    if (msg) {
      toast(msg, 'error')
      return null
    }
    return fecha
  }

  // Registra cada hoja en el historial (no bloquea si falla)
  const logHistorial = (g, fecha, accion) =>
    Promise.all(
      g.items.map(() => registrarRotulo({ estilo: g.estilo, descripcion: g.descripcion, fecha, cantidad: g.cajas, accion, papel })),
    ).catch((e) => toast(`No se pudo registrar en el historial: ${friendlyError(e)}`, 'error', 6000))

  const imprimir = async (g) => {
    const fecha = validar(g)
    if (!fecha) return
    setBusy(`${g.key}:print`)
    try {
      await loadLabelFont()
      const ids = g.items.map((r) => r.id)
      if (estado === 'pendiente') await actualizarRotulosAuto({ ids, fecha })
      const layout = layoutDe(g, fecha)
      setPrintPages(g.items.map(() => layout))
      if (estado === 'pendiente') await actualizarRotulosAuto({ ids, estado: 'impreso' })
      await logHistorial(g, fecha, 'impreso')
      toast(`${g.items.length} rótulo(s) de ${g.estilo} enviado(s) a imprimir.`)
      if (estado === 'pendiente') {
        load()
        onChange()
      }
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const pdf = async (g) => {
    const fecha = validar(g)
    if (!fecha) return
    setBusy(`${g.key}:pdf`)
    try {
      await loadLabelFont()
      const ids = g.items.map((r) => r.id)
      if (estado === 'pendiente') await actualizarRotulosAuto({ ids, fecha })
      const layout = layoutDe(g, fecha)
      const doc = await buildLabelPdf(g.items.map(() => layout))
      doc.save(`Rotulo_${g.estilo}_FV-${fecha}_${g.items.length}pallets.pdf`)
      if (estado === 'pendiente') await actualizarRotulosAuto({ ids, estado: 'impreso' })
      await logHistorial(g, fecha, 'descargado')
      toast(`PDF de ${g.estilo} descargado (${g.items.length} hoja(s)).`)
      if (estado === 'pendiente') {
        load()
        onChange()
      }
    } catch (e) {
      toast(`No se pudo generar el PDF: ${friendlyError(e)}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const cambiarEstado = async (g, nuevo) => {
    const msg = nuevo === 'anulado' ? `¿Anular ${g.items.length} rótulo(s) de ${g.estilo}? Ya no aparecerán como pendientes.` : null
    if (msg && !window.confirm(msg)) return
    setBusy(`${g.key}:estado`)
    try {
      await actualizarRotulosAuto({ ids: g.items.map((r) => r.id), estado: nuevo })
      toast(nuevo === 'anulado' ? 'Rótulos anulados.' : 'Rótulos devueltos a pendientes.')
      load()
      onChange()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Tags}
        title={estado === 'pendiente' ? 'Rótulos pendientes' : 'Rótulos impresos'}
        subtitle={estado === 'pendiente' ? 'Pon la fecha de vencimiento e imprime' : 'Últimos rótulos automáticos impresos o descargados'}
        actions={
          <>
            <Segment
              value={estado}
              onChange={setEstado}
              options={[
                ['pendiente', 'Pendientes'],
                ['impreso', 'Impresos'],
              ]}
            />
            <Segment value={papel} onChange={setPapel} options={Object.values(PAPERS).map((p) => [p.id, p.label])} />
          </>
        }
      />

      {error && (
        <div className="p-4">
          <ErrorBanner onRetry={load}>{error}</ErrorBanner>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!loading && !error && groups.length === 0 && (
        <EmptyState
          icon={Tags}
          title={estado === 'pendiente' ? 'No hay rótulos pendientes' : 'Aún no hay rótulos impresos'}
          text={estado === 'pendiente' ? 'Cuando un ingreso complete un pallet, el rótulo aparecerá aquí.' : null}
        />
      )}

      {!loading && groups.length > 0 && (
        <ul className="divide-y divide-zinc-100">
          {groups.map((g) => {
            const fecha = fechaDe(g)
            const n = g.items.length
            const { fecha: creado, hora } = formatFechaHora(g.created_at)
            return (
              <li key={g.key} className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-md bg-zinc-200/70 p-2">
                  <LabelSvg
                    layout={fontReady ? layoutDe(g, fecha) : layoutDe(g, '')}
                    className="block h-auto w-full rounded-sm shadow-md shadow-zinc-900/10"
                  />
                </div>
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold">{g.estilo}</span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        {n === 1 ? '1 rótulo' : `${n} rótulos`} · {fmt(g.cajas)} cajas c/u
                      </span>
                    </p>
                    <p className="text-sm font-semibold uppercase text-zinc-800">{g.descripcion}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {fmt(g.unidades)} und. por pallet · {g.ingreso_id ? `Ingreso #${g.ingreso_id}` : 'Ingreso eliminado'} · {creado} {hora}
                      {estado === 'impreso' && g.impreso_at && <> · Impreso {formatFechaHora(g.impreso_at).fecha}</>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-600">
                        <CalendarDays className="h-3.5 w-3.5" /> Vencimiento (FV)
                      </span>
                      {estado === 'pendiente' ? (
                        <input
                          type="date"
                          value={fecha}
                          min={todayLocalISO()}
                          onChange={(e) => setFechas((f) => ({ ...f, [g.key]: e.target.value }))}
                          className={cx(inputClass(), 'w-44 px-2.5')}
                        />
                      ) : (
                        <span className="flex h-11 items-center font-bold tabular-nums">{formatFecha(fecha) || '—'}</span>
                      )}
                    </label>
                    <Button variant="primary" icon={Printer} onClick={() => imprimir(g)} loading={busy === `${g.key}:print`} disabled={!!busy} className="h-11">
                      {estado === 'pendiente' ? 'Imprimir' : 'Reimprimir'} {n > 1 ? `(${n})` : ''}
                    </Button>
                    <Button variant="dark" icon={FileDown} onClick={() => pdf(g)} loading={busy === `${g.key}:pdf`} disabled={!!busy} className="h-11">
                      PDF
                    </Button>
                    {estado === 'pendiente' ? (
                      <Button variant="ghost" icon={Ban} onClick={() => cambiarEstado(g, 'anulado')} disabled={!!busy} className="h-11">
                        Anular
                      </Button>
                    ) : (
                      <Button variant="ghost" icon={RotateCcw} onClick={() => cambiarEstado(g, 'pendiente')} disabled={!!busy} className="h-11">
                        Volver a pendientes
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {printPages && <PrintableLabel layouts={printPages} />}
    </Card>
  )
}

function Segment({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cx(
            'rounded-md px-3 py-1.5 text-xs font-bold transition-colors',
            value === id ? 'bg-white text-vega-red shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
