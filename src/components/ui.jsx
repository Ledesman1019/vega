// src/components/ui.jsx
//
// Piezas de interfaz reutilizables (botones, tarjetas, modal, etc.)
// con la línea visual VEGA: tinta oscura + rojo corporativo.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react'

const cx = (...c) => c.filter(Boolean).join(' ')

const VARIANTS = {
  primary: 'bg-vega-red text-white shadow-sm shadow-red-900/20 hover:bg-vega-red-dark',
  dark: 'bg-vega-ink text-white shadow-sm hover:bg-neutral-800',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
  outline: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-100',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300',
}
const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export function Button({ variant = 'outline', size = 'md', icon: Icon, loading, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vega-red/40 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Card({ className, children }) {
  return <div className={cx('rounded-xl border border-zinc-200 bg-white shadow-sm', className)}>{children}</div>
}

export function CardHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-vega-red ring-1 ring-red-100">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold text-zinc-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'default', loading }) {
  const tones = {
    default: 'text-zinc-900',
    red: 'text-vega-red',
    green: 'text-emerald-600',
    blue: 'text-sky-600',
  }
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-4">
      {Icon && (
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 sm:flex">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[11px]">{label}</p>
        <p className={cx('text-xl font-extrabold tabular-nums leading-tight sm:text-2xl', tones[tone])}>
          {loading ? <span className="inline-block h-6 w-16 animate-pulse rounded bg-zinc-200 align-middle" /> : value}
        </p>
        {hint && <p className="hidden truncate text-xs text-zinc-400 sm:block">{hint}</p>}
      </div>
    </Card>
  )
}

export function Badge({ tone = 'zinc', className, children }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Field({ label, icon: Icon, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-600">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
        {hint && <span className="text-[11px] font-medium text-zinc-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

export const inputClass = (error) =>
  cx(
    'h-11 w-full rounded-lg border bg-white px-3 text-[15px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-4',
    error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-zinc-300 focus:border-vega-red focus:ring-red-100',
  )

export function Spinner({ className }) {
  return <LoaderCircle className={cx('animate-spin', className || 'h-5 w-5')} />
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="font-bold text-zinc-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorBanner({ children, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span className="min-w-0">{children}</span>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function Pagination({ page, pageSize, count, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const from = count ? page * pageSize + 1 : 0
  const to = Math.min(count, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:px-5">
      <span className="text-zinc-500">
        <span className="font-semibold text-zinc-800 tabular-nums">{from.toLocaleString('es-PE')}–{to.toLocaleString('es-PE')}</span> de{' '}
        <span className="font-semibold text-zinc-800 tabular-nums">{count.toLocaleString('es-PE')}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" icon={ChevronLeft} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Página anterior" />
        <span className="min-w-[72px] text-center text-xs font-semibold text-zinc-600 tabular-nums">
          {page + 1} / {pages}
        </span>
        <Button size="sm" icon={ChevronRight} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente" />
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-[slideUp_.2s_ease-out] sm:rounded-2xl', widths[size])}>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-vega-red">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900">{title}</h3>
              {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3.5 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export { cx }
