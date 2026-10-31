// src/modules/consulta/ConsultaPage.jsx
//
// Consulta (solo lectura, sin clave): el personal busca un producto por
// descripción, estilo o EAN (o lo escanea) y ve su descripción, cama,
// altura y total de cajas por pallet. No se puede cambiar nada aquí.
import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, PackageSearch, ScanBarcode, Search, X } from 'lucide-react'
import { Button, Card, EmptyState, ErrorBanner, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { friendlyError, isSupabaseConfigured } from '../../lib/supabase.js'
import { consultarPorEan, consultarProductos } from '../../lib/api/consulta.js'
import BarcodeScanner from '../rotulo/BarcodeScanner.jsx'

export default function ConsultaPage() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const inputRef = useRef(null)
  const debounced = useDebounce(q.trim(), 300)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (debounced.length < 2) {
      setRows([])
      setError('')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    consultarProductos(debounced)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(friendlyError(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [debounced])

  const onScanned = (p, ean) => {
    setScanOpen(false)
    setQ(ean)
    setRows([p])
    toast(`${p.estilo} · ${p.descripcion}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Buscador */}
      <Card className="p-3 sm:p-4">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Descripción, estilo o EAN"
              className="h-14 w-full rounded-xl border border-zinc-300 bg-white pl-11 pr-10 text-lg font-semibold text-zinc-900 outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-vega-red focus:ring-4 focus:ring-red-100"
              autoComplete="off"
              autoFocus
              enterKeyHint="search"
            />
            {q && (
              <button
                onClick={() => {
                  setQ('')
                  inputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Borrar búsqueda"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <Button
            variant="dark"
            icon={ScanBarcode}
            onClick={() => setScanOpen(true)}
            disabled={!isSupabaseConfigured}
            className="h-14 rounded-xl px-4"
            aria-label="Escanear código de barras"
          >
            <span className="hidden sm:inline">Escanear</span>
          </Button>
        </div>
      </Card>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading && rows.length === 0 && (
        <div className="flex justify-center py-10 text-zinc-400">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      )}

      {!loading && !error && debounced.length >= 2 && rows.length === 0 && (
        <Card>
          <EmptyState icon={PackageSearch} title="No se encontró el producto" text="Revisa lo que escribiste o prueba con otra palabra de la descripción." />
        </Card>
      )}

      {debounced.length < 2 && !rows.length && (
        <Card>
          <EmptyState
            icon={PackageSearch}
            title="Busca un producto"
            text="Escribe parte de la descripción (ej. angel zuck), el estilo o el código de barras. También puedes escanearlo."
          />
        </Card>
      )}

      {rows.length > 0 && (
        <ul className={cx('space-y-3 transition-opacity', loading && 'opacity-60')}>
          {rows.map((p) => (
            <li key={p.estilo}>
              <Card className="overflow-hidden">
                <div className="px-4 pb-3 pt-4 sm:px-5">
                  <p className="text-lg font-extrabold uppercase leading-snug text-zinc-900 sm:text-xl">{p.descripcion}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Estilo <b className="font-mono text-zinc-700">{p.estilo}</b>
                    {p.eans.length > 0 && (
                      <>
                        {' '}· EAN <span className="font-mono">{p.eans.join(' · ')}</span>
                      </>
                    )}
                  </p>
                </div>
                {p.cama != null || p.altura != null ? (
                  <div className="grid grid-cols-3 divide-x divide-zinc-200 border-t border-zinc-200 bg-zinc-50 text-center">
                    <Dato label="Cama" value={p.cama} />
                    <Dato label="Altura" value={p.altura} />
                    <Dato label="Total" value={p.total} strong />
                  </div>
                ) : (
                  <p className="border-t border-zinc-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 sm:px-5">
                    Sin datos de cama y altura para este producto.
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onLookup={consultarPorEan} onFound={onScanned} />
    </div>
  )
}

function Dato({ label, value, strong }) {
  return (
    <div className="px-2 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cx('text-3xl font-extrabold tabular-nums sm:text-4xl', strong ? 'text-vega-red' : 'text-zinc-900')}>
        {value == null ? <span className="text-zinc-300">—</span> : Number(value).toLocaleString('es-PE')}
      </p>
    </div>
  )
}
