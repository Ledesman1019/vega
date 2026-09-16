// src/components/PrintCounter.jsx
import { IconPrinter } from './Icons.jsx'

export default function PrintCounter({ count, onReset }) {
  const hasCount = count > 0

  return (
    <div className="w-full rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 shadow-sm shadow-neutral-900/5 sm:px-5 sm:py-3.5">
      <div className="flex items-center gap-3">
        {/* Icono */}
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-vega-red sm:h-11 sm:w-11">
          <IconPrinter className="h-5 w-5" />
          {hasCount && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-vega-red ring-2 ring-white" />
          )}
        </span>

        {/* Textos */}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:text-xs">
            Impresas hoy
          </p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tabular-nums text-vega-red sm:text-2xl">
              {count}
            </span>
            <span className="text-[11px] font-medium text-neutral-400 sm:text-xs">
              {count === 1 ? 'etiqueta' : 'etiquetas'}
            </span>
          </p>
        </div>

        {/* Reiniciar */}
        <button
          type="button"
          onClick={onReset}
          disabled={!hasCount}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 underline-offset-4 transition-colors hover:bg-neutral-100 hover:text-neutral-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vega-red/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline disabled:hover:bg-transparent disabled:hover:text-neutral-500"
        >
          Reiniciar
        </button>
      </div>
    </div>
  )
}