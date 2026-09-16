import { IconBarcode, IconCalendar, IconBox, IconTagArrow } from './Icons.jsx'

export default function PalletForm({ data, onChange, onGenerate, errors }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value })

  return (
    <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-7 shadow-xl shadow-neutral-900/5 sm:p-10">
      <div className="mb-7 flex items-center gap-4 border-b border-neutral-100 pb-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-vega-red">
          <IconBox className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-900 sm:text-xl">Datos del Pallet</h2>
          <p className="text-sm text-neutral-500">Completa la información para generar la etiqueta.</p>
        </div>
      </div>

      <Field
        id="codigo"
        label="Código / Producto"
        icon={IconBarcode}
        error={errors.codigo}
      >
        <input
          id="codigo"
          type="text"
          placeholder="Ej. 100234 - Leche UHT"
          value={data.codigo}
          onChange={set('codigo')}
          className={inputClass(errors.codigo)}
        />
      </Field>

      <Field
        id="fecha"
        label="Fecha de vencimiento"
        icon={IconCalendar}
        error={errors.fecha}
      >
        <input
          id="fecha"
          type="date"
          value={data.fecha}
          onChange={set('fecha')}
          className={inputClass(errors.fecha)}
        />
      </Field>

      <Field
        id="cantidad"
        label="Cantidad de cajas"
        icon={IconBox}
        error={errors.cantidad}
      >
        <input
          id="cantidad"
          type="number"
          min="0"
          placeholder="Ej. 48"
          value={data.cantidad}
          onChange={set('cantidad')}
          className={inputClass(errors.cantidad)}
        />
      </Field>

      <button
        onClick={onGenerate}
        className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl bg-vega-red py-4 text-base font-bold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-vega-red-dark active:scale-[0.99]"
      >
        <IconTagArrow className="h-5 w-5" />
        Generar vista previa
      </button>
    </div>
  )
}

function Field({ id, label, icon: Icon, error, children }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Icon className="h-4 w-4 text-neutral-400" />
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-amber-700">{error}</p>}
    </div>
  )
}

function inputClass(hasError) {
  return [
    'w-full rounded-xl border bg-neutral-50 px-4 py-3.5 text-base text-neutral-900',
    'placeholder:text-neutral-400 transition-colors',
    'focus:border-vega-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-600/10',
    hasError ? 'border-amber-400' : 'border-neutral-200',
  ].join(' ')
}