// src/components/BottomNav.jsx
import { IconBox, IconPrinter, IconGauge } from './Icons.jsx'

export default function BottomNav({ view, onChangeView, onOpenSettings }) {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur-md lg:hidden">
      <div
        className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        <NavItem
          icon={IconBox}
          label="Inicio"
          active={view === 'form'}
          onClick={() => onChangeView('form')}
        />
        <NavItem
          icon={IconPrinter}
          label="Vista previa"
          active={view === 'export'}
          onClick={() => onChangeView('export')}
        />
        <NavItem
          icon={IconGauge}
          label="Ajustes"
          onClick={onOpenSettings}
        />
      </div>
    </nav>
  )
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-1 flex-col items-center gap-1 px-2 py-1.5"
    >
      <span
        className={[
          'relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all',
          active
            ? 'bg-red-50 text-vega-red'
            : 'text-neutral-400 group-hover:bg-neutral-100 group-hover:text-neutral-700',
        ].join(' ')}
      >
        <Icon className="h-5 w-5" />
        {active && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-vega-red" />
        )}
      </span>
      <span
        className={[
          'text-[10px] font-semibold leading-none transition-colors',
          active ? 'text-vega-red' : 'text-neutral-500 group-hover:text-neutral-700',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}