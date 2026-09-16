// src/components/SettingsSheet.jsx
import { useEffect } from 'react'
import { IconPortrait, IconLandscape } from './Icons.jsx'

export default function SettingsSheet({
  open,
  onClose,
  orientation,
  onOrientation,
  count,
  onReset,
}) {
  // Bloquea el scroll del body cuando el sheet está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div className="no-print fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar ajustes"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 animate-[slideUp_240ms_ease-out] rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-neutral-300" />

        <div
          className="px-5 pb-6 pt-5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
        >
          <h3 className="mb-1 text-lg font-bold text-neutral-900">Ajustes</h3>
          <p className="mb-5 text-sm text-neutral-500">
            Personaliza la generación de etiquetas.
          </p>

          {/* Orientación */}
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Orientación
            </p>
            <div className="flex gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
              <button
                type="button"
                onClick={() => onOrientation('portrait')}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all',
                  orientation === 'portrait'
                    ? 'bg-white text-vega-red shadow-sm'
                    : 'text-neutral-500',
                ].join(' ')}
              >
                <IconPortrait className="h-4 w-4" /> Vertical
              </button>
              <button
                type="button"
                onClick={() => onOrientation('landscape')}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all',
                  orientation === 'landscape'
                    ? 'bg-white text-vega-red shadow-sm'
                    : 'text-neutral-500',
                ].join(' ')}
              >
                <IconLandscape className="h-4 w-4" /> Horizontal
              </button>
            </div>
          </div>

          {/* Contador */}
          <div className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Impresas hoy
                </p>
                <p className="text-2xl font-black tabular-nums text-vega-red">{count}</p>
              </div>
              <button
                type="button"
                onClick={onReset}
                disabled={count === 0}
                className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 disabled:opacity-40"
              >
                Reiniciar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-vega-red py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-vega-red-dark"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}