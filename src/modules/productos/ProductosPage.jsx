// src/modules/productos/ProductosPage.jsx
//
// Módulo Productos: consulta de la base (solo lectura por fila: no se
// edita ni se elimina un producto suelto), importación/exportación en
// Excel, alta manual y vaciado completo de la base.
import { useCallback, useEffect, useState } from 'react'
import { Package, Tags, ListFilter, Search, Upload, Download, Plus, Trash2, Printer, Database, X } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Pagination, StatCard, Spinner, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { navigate } from '../../lib/router.js'
import { friendlyError, isSupabaseConfigured } from '../../lib/supabase.js'
import { SORTS, countProductos, fetchAllProductos, listMarcas, listProductos } from '../../lib/api/productos.js'
import { exportProductosExcel } from '../../lib/excel.js'
import { AddProductDialog, ClearBaseDialog, ImportDialog } from './ProductosDialogs.jsx'

const PAGE_SIZE = 50

export default function ProductosPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [marca, setMarca] = useState('')
  const [sort, setSort] = useState('estilo')
  const [page, setPage] = useState(0)
  const debounced = useDebounce(search.trim(), 300)

  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [total, setTotal] = useState(null)
  const [marcas, setMarcas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  const [dialog, setDialog] = useState(null) // 'import' | 'add' | 'clear'
  const [exporting, setExporting] = useState('')

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  // Totales y marcas
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    Promise.all([countProductos(), listMarcas()])
      .then(([t, m]) => {
        if (!alive) return
        setTotal(t)
        setMarcas(m)
      })
      .catch(() => alive && setTotal(0))
    return () => {
      alive = false
    }
  }, [reload])

  useEffect(() => setPage(0), [debounced, marca, sort])

  // Página actual
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    listProductos({ search: debounced, marca, sort, page, pageSize: PAGE_SIZE })
      .then(({ rows, count }) => {
        if (!alive) return
        setRows(rows)
        setCount(count)
        setError('')
      })
      .catch((e) => alive && setError(friendlyError(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [debounced, marca, sort, page, reload])

  const filtered = Boolean(debounced || marca)

  const handleExport = async () => {
    setExporting('Preparando…')
    try {
      const all = await fetchAllProductos((n) => setExporting(`Descargando ${n.toLocaleString('es-PE')}…`))
      if (!all.length) {
        toast('La base está vacía, no hay nada que exportar.', 'info')
        return
      }
      setExporting('Generando Excel…')
      await exportProductosExcel(all)
      toast(`Excel exportado con ${all.length.toLocaleString('es-PE')} productos.`)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setExporting('')
    }
  }

  const goRotulo = (p) => navigate('rotulo', { estilo: p.estilo })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Database} label="Productos" value={(total ?? 0).toLocaleString('es-PE')} hint="Guardados en Supabase" loading={total === null && isSupabaseConfigured} />
        <StatCard icon={Tags} label="Marcas" value={marcas.length.toLocaleString('es-PE')} hint="Primera palabra de la descripción" loading={total === null && isSupabaseConfigured} />
        <StatCard
          icon={ListFilter}
          label="Resultado"
          value={count.toLocaleString('es-PE')}
          hint={filtered ? 'Con filtros aplicados' : 'Sin filtros aplicados'}
          tone={filtered ? 'red' : 'green'}
          loading={loading && !rows.length}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          icon={Package}
          title="Base de productos"
          subtitle="Consulta de productos · solo lectura"
          actions={
            <>
              <Button variant="success" icon={Upload} onClick={() => setDialog('import')} className="flex-1 sm:flex-none">
                Importar Excel
              </Button>
              <Button icon={Download} onClick={handleExport} loading={!!exporting} className="flex-1 sm:flex-none">
                {exporting || 'Exportar Excel'}
              </Button>
              <Button icon={Plus} onClick={() => setDialog('add')} className="flex-1 sm:flex-none">
                Agregar
              </Button>
              <Button variant="danger" icon={Trash2} onClick={() => setDialog('clear')} disabled={!total} className="flex-1 sm:flex-none">
                Vaciar base
              </Button>
            </>
          }
        />

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:grid-cols-[1fr_220px_220px] sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por estilo o descripción…"
              className={cx(inputClass(), 'h-10 pl-9 pr-9 text-sm')}
              inputMode="search"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700" aria-label="Limpiar búsqueda">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select value={marca} onChange={(e) => setMarca(e.target.value)} className={cx(inputClass(), 'h-10 text-sm')}>
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m.marca} value={m.marca}>
                {m.marca} ({m.total})
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={cx(inputClass(), 'h-10 text-sm')}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4">
            <ErrorBanner onRetry={refresh}>{error}</ErrorBanner>
          </div>
        )}

        {!error && !loading && rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={Search} title="Sin resultados" text="No hay productos que coincidan con la búsqueda o la marca seleccionada." action={<Button onClick={() => { setSearch(''); setMarca('') }}>Quitar filtros</Button>} />
          ) : (
            <EmptyState
              icon={Database}
              title="La base de productos está vacía"
              text="Importa tu Excel con las columnas N° y Descripcion para empezar."
              action={<Button variant="success" icon={Upload} onClick={() => setDialog('import')}>Importar Excel</Button>}
            />
          )
        ) : (
          <div className={cx('relative', loading && rows.length > 0 && 'opacity-60')}>
            {loading && rows.length === 0 && (
              <div className="flex justify-center py-16 text-zinc-400">
                <Spinner className="h-7 w-7" />
              </div>
            )}

            {/* Tabla (tablet / PC) */}
            {rows.length > 0 && (
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="w-36 px-5 py-2.5">N° / Estilo</th>
                    <th className="px-3 py-2.5">Descripción</th>
                    <th className="w-44 px-3 py-2.5">Marca</th>
                    <th className="w-32 px-5 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((p) => (
                    <tr key={p.estilo} className="transition-colors hover:bg-red-50/40">
                      <td className="px-5 py-2.5 font-mono text-[13px] font-bold text-zinc-900">{p.estilo}</td>
                      <td className="px-3 py-2.5 font-medium text-zinc-700">{p.descripcion}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setMarca(p.marca)} title="Filtrar por esta marca">
                          <Badge>{p.marca}</Badge>
                        </button>
                      </td>
                      <td className="px-5 py-2 text-right">
                        <Button size="sm" variant="dark" icon={Printer} onClick={() => goRotulo(p)}>
                          Rótulo
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Lista (teléfono) */}
            <ul className="divide-y divide-zinc-100 md:hidden">
              {rows.map((p) => (
                <li key={p.estilo} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-zinc-900">{p.estilo}</span>
                      <Badge className="max-w-[45%] truncate">{p.marca}</Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-600">{p.descripcion}</p>
                  </div>
                  <Button size="sm" variant="dark" icon={Printer} onClick={() => goRotulo(p)} aria-label={`Crear rótulo de ${p.estilo}`}>
                    Rótulo
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {count > 0 && <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
      </Card>

      <ImportDialog open={dialog === 'import'} onClose={() => setDialog(null)} onDone={refresh} />
      <AddProductDialog open={dialog === 'add'} onClose={() => setDialog(null)} onDone={refresh} />
      <ClearBaseDialog open={dialog === 'clear'} total={total ?? 0} onClose={() => setDialog(null)} onDone={refresh} />
    </div>
  )
}
