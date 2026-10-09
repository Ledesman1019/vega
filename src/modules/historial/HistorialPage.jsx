// src/modules/historial/HistorialPage.jsx
//
// Historial de rótulos: cada impresión o descarga con su fecha y hora.
// Solo lectura (no se edita ni se borra). Se puede reimprimir y exportar.
import { useCallback, useEffect, useState } from 'react'
import { History, Printer, FileDown, CalendarCheck, Search, Download, RotateCcw, X, Layers } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Pagination, Spinner, StatCard, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { navigate } from '../../lib/router.js'
import { friendlyError, isSupabaseConfigured } from '../../lib/supabase.js'
import { fetchAllHistorial, listHistorial, resumenHistorial } from '../../lib/api/historial.js'
import { exportHistorialExcel } from '../../lib/excel.js'
import { formatFecha, formatFechaHora, todayLocalISO } from '../../utils/dateUtils.js'

const PAGE_SIZE = 50

const ACCIONES = {
  impreso: { label: 'Impreso', tone: 'blue', icon: Printer },
  descargado: { label: 'Descargado', tone: 'green', icon: FileDown },
}

export default function HistorialPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [accion, setAccion] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebounce(search.trim(), 300)

  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [exporting, setExporting] = useState(false)

  const filters = { search: debounced, accion, desde, hasta }
  const filtered = Boolean(debounced || accion || desde || hasta)
  const refresh = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => setPage(0), [debounced, accion, desde, hasta])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    Promise.all([listHistorial({ ...filters, page, pageSize: PAGE_SIZE }), resumenHistorial(filters, todayLocalISO())])
      .then(([{ rows, count }, res]) => {
        if (!alive) return
        setRows(rows)
        setCount(count)
        setResumen(res)
        setError('')
      })
      .catch((e) => alive && setError(friendlyError(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, accion, desde, hasta, page, reload])

  const clearFilters = () => {
    setSearch('')
    setAccion('')
    setDesde('')
    setHasta('')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const all = await fetchAllHistorial(filters)
      if (!all.length) {
        toast('No hay registros para exportar.', 'info')
        return
      }
      await exportHistorialExcel(all)
      toast(`Historial exportado (${all.length.toLocaleString('es-PE')} registros).`)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  const reimprimir = (r) => navigate('rotulo', { estilo: r.estilo, fv: r.fecha_vencimiento, cant: r.cantidad })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Rótulos hoy" value={resumen?.hoy ?? 0} tone="red" loading={!resumen && isSupabaseConfigured} />
        <StatCard icon={Layers} label={filtered ? 'Total filtrado' : 'Total'} value={(resumen?.total ?? 0).toLocaleString('es-PE')} loading={!resumen && isSupabaseConfigured} />
        <StatCard icon={Printer} label="Impresos" value={(resumen?.impresos ?? 0).toLocaleString('es-PE')} tone="blue" loading={!resumen && isSupabaseConfigured} />
        <StatCard icon={FileDown} label="Descargados" value={(resumen?.descargados ?? 0).toLocaleString('es-PE')} tone="green" loading={!resumen && isSupabaseConfigured} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          icon={History}
          title="Historial de rótulos"
          subtitle="Registro automático de cada impresión y descarga"
          actions={
            <>
              <Button icon={RotateCcw} onClick={refresh} className="flex-1 sm:flex-none">Actualizar</Button>
              <Button icon={Download} onClick={handleExport} loading={exporting} className="flex-1 sm:flex-none">Exportar Excel</Button>
            </>
          }
        />

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:px-5 lg:grid-cols-[1fr_170px_160px_160px_auto]">
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por estilo o descripción…" className={cx(inputClass(), 'h-10 pl-9 text-sm')} inputMode="search" />
          </div>
          <select value={accion} onChange={(e) => setAccion(e.target.value)} className={cx(inputClass(), 'col-span-2 h-10 text-sm sm:col-span-1 lg:col-span-1')}>
            <option value="">Todas las acciones</option>
            <option value="impreso">Impresos</option>
            <option value="descargado">Descargados</option>
          </select>
          <label className="relative block sm:col-span-1">
            <span className="pointer-events-none absolute -top-1.5 left-2 bg-zinc-50 px-1 text-[10px] font-bold uppercase text-zinc-400">Desde</span>
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={cx(inputClass(), 'h-10 px-2 text-sm')} />
          </label>
          <label className="relative block">
            <span className="pointer-events-none absolute -top-1.5 left-2 bg-zinc-50 px-1 text-[10px] font-bold uppercase text-zinc-400">Hasta</span>
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={cx(inputClass(), 'h-10 px-2 text-sm')} />
          </label>
          {filtered && (
            <Button variant="ghost" icon={X} onClick={clearFilters} className="col-span-2 h-10 lg:col-span-1">
              Limpiar
            </Button>
          )}
        </div>

        {error && (
          <div className="p-4">
            <ErrorBanner onRetry={refresh}>{error}</ErrorBanner>
          </div>
        )}

        {!error && !loading && rows.length === 0 ? (
          <EmptyState
            icon={History}
            title={filtered ? 'Sin resultados' : 'Aún no hay rótulos registrados'}
            text={filtered ? 'Prueba con otros filtros.' : 'Cuando imprimas o descargues un rótulo aparecerá aquí con su fecha y hora.'}
            action={filtered ? <Button onClick={clearFilters}>Quitar filtros</Button> : <Button variant="primary" icon={Printer} onClick={() => navigate('rotulo')}>Crear rótulo</Button>}
          />
        ) : (
          <div className={cx(loading && rows.length > 0 && 'opacity-60')}>
            {loading && rows.length === 0 && (
              <div className="flex justify-center py-16 text-zinc-400">
                <Spinner className="h-7 w-7" />
              </div>
            )}

            {rows.length > 0 && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      <th className="px-5 py-2.5">Fecha y hora</th>
                      <th className="px-3 py-2.5">Estilo</th>
                      <th className="px-3 py-2.5">Descripción</th>
                      <th className="px-3 py-2.5 text-center">Venc.</th>
                      <th className="px-3 py-2.5 text-right">Cant.</th>
                      <th className="px-3 py-2.5 text-center">Acción</th>
                      <th className="px-5 py-2.5 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((r) => {
                      const { fecha, hora } = formatFechaHora(r.created_at)
                      const a = ACCIONES[r.accion]
                      return (
                        <tr key={r.id} className="hover:bg-red-50/40">
                          <td className="whitespace-nowrap px-5 py-2.5">
                            <span className="font-semibold text-zinc-900">{fecha}</span>
                            <span className="ml-2 text-zinc-500 tabular-nums">{hora}</span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[13px] font-bold">{r.estilo}</td>
                          <td className="max-w-[360px] truncate px-3 py-2.5 text-zinc-700" title={r.descripcion}>{r.descripcion}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums">{formatFecha(r.fecha_vencimiento)}</td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums">{r.cantidad}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge tone={a.tone}>
                              <a.icon className="h-3 w-3" /> {a.label}
                            </Badge>
                            <span className="ml-1.5 text-[11px] font-semibold text-zinc-400">{r.papel}</span>
                          </td>
                          <td className="px-5 py-2 text-right">
                            <Button size="sm" icon={Printer} onClick={() => reimprimir(r)}>Reimprimir</Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Teléfono */}
            <ul className="divide-y divide-zinc-100 md:hidden">
              {rows.map((r) => {
                const { fecha, hora } = formatFechaHora(r.created_at)
                const a = ACCIONES[r.accion]
                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-500 tabular-nums">{fecha} · {hora}</span>
                      <Badge tone={a.tone}>
                        <a.icon className="h-3 w-3" /> {a.label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-extrabold">{r.estilo}</p>
                        <p className="text-[13px] leading-snug text-zinc-600">{r.descripcion}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          FV <b className="text-zinc-800">{formatFecha(r.fecha_vencimiento)}</b> · Cant. <b className="text-zinc-800">{r.cantidad}</b> · {r.papel}
                        </p>
                      </div>
                      <Button size="sm" icon={Printer} onClick={() => reimprimir(r)} aria-label="Reimprimir" />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {count > 0 && <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPage={setPage} />}
      </Card>
    </div>
  )
}
