// src/modules/rotulo/RotuloPage.jsx
//
// Crear rótulo: se ingresa el estilo (la descripción llega sola desde
// la base de productos), la fecha de vencimiento y la cantidad. Se
// imprime o descarga en UNA hoja horizontal, con todo lo más grande
// posible. Cada impresión/descarga queda en el historial.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, CalendarDays, Boxes, FileText, Printer, FileDown, Search, Eraser, Tag, CircleCheck, CircleX, LoaderCircle, Info } from 'lucide-react'
import { Button, Card, CardHeader, Field, inputClass, cx } from '../../components/ui.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { friendlyError, isSupabaseConfigured } from '../../lib/supabase.js'
import { getProducto, isValidEstilo, normalizeEstilo, suggestProductos } from '../../lib/api/productos.js'
import { registrarRotulo } from '../../lib/api/historial.js'
import { PAPERS, computeLabelLayout, loadLabelFont } from '../../lib/label/layout.js'
import { buildLabelPdf } from '../../lib/label/pdf.js'
import { todayLocalISO } from '../../utils/dateUtils.js'
import { LabelSvg, PrintableLabel } from './LabelSheet.jsx'

const PAPER_KEY = 'vega-rotulos:papel'

export default function RotuloPage({ params }) {
  const toast = useToast()

  const [estiloInput, setEstiloInput] = useState(params.estilo || '')
  const [fecha, setFecha] = useState(params.fv || '')
  const [cantidad, setCantidad] = useState(params.cant || '')
  const [papel, setPapel] = useState(() => {
    try {
      return localStorage.getItem(PAPER_KEY) || 'A4'
    } catch {
      return 'A4'
    }
  })
  const [errors, setErrors] = useState({})

  const [producto, setProducto] = useState(null)
  const [lookup, setLookup] = useState('idle') // idle | loading | found | notfound | error
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug] = useState(false)
  const [fontReady, setFontReady] = useState(false)
  const [busy, setBusy] = useState('') // 'pdf' | 'print'

  const fechaRef = useRef(null)

  // Si llega desde Productos / Historial con otros datos
  useEffect(() => {
    if (params.estilo) setEstiloInput(params.estilo)
    if (params.fv) setFecha(params.fv)
    if (params.cant) setCantidad(params.cant)
  }, [params.estilo, params.fv, params.cant])

  useEffect(() => {
    try {
      localStorage.setItem(PAPER_KEY, papel)
    } catch { /* sin almacenamiento */ }
  }, [papel])

  useEffect(() => {
    loadLabelFont().then(() => setFontReady(true))
  }, [])

  // Buscar el producto por estilo (y sugerencias por estilo/descripción)
  const debounced = useDebounce(estiloInput.trim(), 250)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    const est = normalizeEstilo(debounced)
    if (!debounced) {
      setProducto(null)
      setLookup('idle')
      setSuggestions([])
      return
    }
    setLookup('loading')
    const exact = isValidEstilo(est) ? getProducto(est) : Promise.resolve(null)
    Promise.all([exact, debounced.length >= 2 ? suggestProductos(debounced) : []])
      .then(([p, sug]) => {
        if (!alive) return
        setProducto(p)
        setLookup(p ? 'found' : 'notfound')
        setSuggestions(p ? [] : sug)
      })
      .catch((e) => {
        if (!alive) return
        setProducto(null)
        setLookup('error')
        setErrors((x) => ({ ...x, estilo: friendlyError(e) }))
      })
    return () => {
      alive = false
    }
  }, [debounced])

  const pick = (p) => {
    setEstiloInput(p.estilo)
    setProducto(p)
    setLookup('found')
    setSuggestions([])
    setShowSug(false)
    setErrors((x) => ({ ...x, estilo: undefined }))
    setTimeout(() => fechaRef.current?.focus(), 0)
  }

  const data = {
    estilo: producto?.estilo || '',
    descripcion: producto?.descripcion || '',
    fecha,
    cantidad: cantidad ? String(Number(cantidad)) : '',
  }

  const layout = useMemo(
    () => computeLabelLayout(data, papel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.estilo, data.descripcion, data.fecha, data.cantidad, papel, fontReady],
  )

  const validate = () => {
    const next = {}
    if (!estiloInput.trim()) next.estilo = 'Ingresa el estilo.'
    else if (lookup === 'loading' || (producto && producto.estilo !== normalizeEstilo(estiloInput)))
      next.estilo = 'Buscando el producto, espera un momento.'
    else if (!producto) next.estilo = 'Ese estilo no existe en la base de productos.'
    if (!fecha) next.fecha = 'Selecciona la fecha de vencimiento.'
    else if (fecha < todayLocalISO()) next.fecha = 'La fecha no puede ser anterior a hoy.'
    const n = Number(cantidad)
    if (!cantidad || !Number.isInteger(n) || n <= 0) next.cantidad = 'Ingresa una cantidad válida.'
    else if (n > 999999) next.cantidad = 'Cantidad demasiado grande.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const log = (accion) =>
    registrarRotulo({ ...data, accion, papel }).catch((e) =>
      toast(`No se pudo registrar en el historial: ${friendlyError(e)}`, 'error', 6000),
    )

  const handlePdf = async () => {
    if (!validate()) return
    setBusy('pdf')
    try {
      await loadLabelFont()
      const doc = await buildLabelPdf(computeLabelLayout(data, papel))
      doc.save(`Rotulo_${data.estilo}_FV-${fecha}.pdf`)
      await log('descargado')
      toast('PDF descargado y registrado en el historial.')
    } catch (e) {
      toast(`No se pudo generar el PDF: ${e.message || e}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const handlePrint = async () => {
    if (!validate()) return
    setBusy('print')
    log('impreso').then(() => toast('Rótulo enviado a imprimir y registrado en el historial.'))
    await loadLabelFont()
    // Un cuadro para que el navegador pinte la copia de impresión
    requestAnimationFrame(() => {
      window.print()
      setBusy('')
    })
  }

  const clear = () => {
    setEstiloInput('')
    setFecha('')
    setCantidad('')
    setProducto(null)
    setLookup('idle')
    setErrors({})
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* ============ FORMULARIO ============ */}
      <Card className="self-start">
        <CardHeader icon={Tag} title="Datos del rótulo" subtitle="La descripción se completa sola desde la base de productos." />
        <form
          className="space-y-4 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault()
            handlePrint()
          }}
        >
          {/* Estilo + sugerencias */}
          <Field label="Estilo (N°)" icon={Barcode} error={errors.estilo} hint={<LookupHint state={lookup} />}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={estiloInput}
                onChange={(e) => {
                  setEstiloInput(e.target.value)
                  setShowSug(true)
                  setErrors((x) => ({ ...x, estilo: undefined }))
                }}
                onFocus={() => setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                placeholder="Ej. 010247 o parte de la descripción"
                className={cx(inputClass(errors.estilo), 'pl-9 font-mono text-base font-bold placeholder:font-sans placeholder:font-normal')}
                autoComplete="off"
                autoFocus={!params.estilo}
              />
              {showSug && suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl">
                  {suggestions.map((s) => (
                    <li key={s.estilo}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(s)}
                        className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-red-50"
                      >
                        <span className="w-16 shrink-0 font-mono font-bold text-zinc-900">{s.estilo}</span>
                        <span className="text-zinc-600">{s.descripcion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>

          {/* Descripción (solo lectura) */}
          <Field label="Descripción" icon={FileText}>
            <div
              className={cx(
                'flex min-h-[52px] items-center rounded-lg border px-3 py-2 text-sm font-bold uppercase leading-snug',
                producto ? 'border-emerald-200 bg-emerald-50 text-zinc-900' : 'border-dashed border-zinc-300 bg-zinc-50 font-medium normal-case text-zinc-400',
              )}
            >
              {producto ? producto.descripcion : 'Escribe el estilo para traer la descripción.'}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimiento (FV)" icon={CalendarDays} error={errors.fecha}>
              <input
                ref={fechaRef}
                type="date"
                value={fecha}
                min={todayLocalISO()}
                onChange={(e) => {
                  setFecha(e.target.value)
                  setErrors((x) => ({ ...x, fecha: undefined }))
                }}
                className={cx(inputClass(errors.fecha), 'px-2.5')}
              />
            </Field>
            <Field label="Cantidad" icon={Boxes} error={errors.cantidad}>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                  setErrors((x) => ({ ...x, cantidad: undefined }))
                }}
                placeholder="Ej. 48"
                className={cx(inputClass(errors.cantidad), 'font-bold tabular-nums')}
              />
            </Field>
          </div>

          {/* Papel */}
          <Field label="Papel (horizontal)">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
              {Object.values(PAPERS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPapel(p.id)}
                  className={cx(
                    'rounded-md py-2 text-sm font-bold transition-colors',
                    papel === p.id ? 'bg-white text-vega-red shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <p className="flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Al imprimir, elige la impresora y deja la escala en <b>100%</b> (o “Tamaño real”) y orientación <b>horizontal</b>.
            </span>
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="submit" variant="primary" size="lg" icon={Printer} loading={busy === 'print'} disabled={!!busy}>
              Imprimir
            </Button>
            <Button variant="dark" size="lg" icon={FileDown} onClick={handlePdf} loading={busy === 'pdf'} disabled={!!busy}>
              PDF
            </Button>
          </div>
          <Button variant="ghost" icon={Eraser} onClick={clear} className="w-full">
            Nuevo rótulo
          </Button>
        </form>
      </Card>

      {/* ============ VISTA PREVIA ============ */}
      <Card className="self-start overflow-hidden lg:sticky lg:top-28">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Vista previa · hoja completa horizontal
          </p>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
            {layout.paper.label} · {layout.width}×{layout.height} mm
          </span>
        </div>
        <div className="bg-zinc-200/70 p-3 sm:p-6">
          <LabelSvg layout={layout} className="block h-auto w-full rounded-sm shadow-xl shadow-zinc-900/20" />
        </div>
      </Card>

      <PrintableLabel layout={layout} />
    </div>
  )
}

function LookupHint({ state }) {
  if (state === 'loading')
    return (
      <span className="flex items-center gap-1 text-zinc-400">
        <LoaderCircle className="h-3 w-3 animate-spin" /> Buscando…
      </span>
    )
  if (state === 'found')
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <CircleCheck className="h-3.5 w-3.5" /> Encontrado
      </span>
    )
  if (state === 'notfound')
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <CircleX className="h-3.5 w-3.5" /> No existe
      </span>
    )
  return null
}
