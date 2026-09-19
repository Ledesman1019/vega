import {
  IconBarcode,
  IconCalendar,
  IconBox,
  IconTagArrow,
  IconTrash,
} from "./Icons.jsx"
import { todayLocalISO } from "../utils/dateUtils.js"

export default function PalletForm({
  data,
  onChange,
  onGenerate,
  onClear,
  errors,
}) {
  const set = (field) => (e) =>
    onChange({
      ...data,
      [field]: e.target.value,
    })

  // Fecha de hoy en zona local (mínima permitida y referencia del calendario)
  const hoyISO = todayLocalISO()

  // Formulario "limpio" = sin código, sin cantidad y con la fecha de hoy
  const estaLimpio =
    !data.codigo && !data.cantidad && data.fecha === hoyISO

  // Código: solo dígitos, máximo 6
  const handleCodigo = (e) => {
    const soloDigitos = e.target.value
      .replace(/\D/g, "")
      .slice(0, 6)

    onChange({
      ...data,
      codigo: soloDigitos,
    })
  }

  const codigoCompleto = data.codigo.length === 6

  return (
    <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-7 shadow-xl shadow-neutral-900/5 sm:p-10">

      {/* Encabezado */}
      <div className="mb-7 flex items-center gap-4 border-b border-neutral-100 pb-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-vega-red">
          <IconBox className="h-6 w-6" />
        </span>

        <div>
          <h2 className="text-lg font-bold text-neutral-900 sm:text-xl">
            Datos del Pallet
          </h2>

          <p className="text-sm text-neutral-500">
            Completa la información para generar la etiqueta.
          </p>
        </div>
      </div>

      {/* Código */}
      <Field
        id="codigo"
        label="Código / Producto"
        icon={IconBarcode}
        error={errors.codigo}
        hint={
          !errors.codigo && data.codigo
            ? `${data.codigo.length} / 6 dígitos`
            : "6 dígitos numéricos"
        }
        hintOk={codigoCompleto}
      >
        <input
          id="codigo"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="off"
          placeholder="Ej. 255663"
          value={data.codigo}
          onChange={handleCodigo}
          className={[
            inputClass(errors.codigo),
            codigoCompleto && !errors.codigo
              ? "border-emerald-400 ring-2 ring-emerald-100"
              : "",
          ].join(" ")}
        />
      </Field>

      {/* Fecha */}
      <Field
        id="fecha"
        label="Fecha de vencimiento"
        icon={IconCalendar}
        error={errors.fecha}
      >
        <input
          id="fecha"
          type="date"
          min={hoyISO}
          value={data.fecha}
          onChange={set("fecha")}
          className={inputClass(errors.fecha)}
        />
      </Field>

      {/* Cantidad */}
      <Field
        id="cantidad"
        label="Cantidad de cajas"
        icon={IconBox}
        error={errors.cantidad}
      >
        <input
          id="cantidad"
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="Ej. 48"
          value={data.cantidad}
          onChange={set("cantidad")}
          className={inputClass(errors.cantidad)}
        />
      </Field>

      {/* Botón */}
      <button
        onClick={onGenerate}
        className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl bg-vega-red py-4 text-base font-bold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-vega-red-dark active:scale-[0.99]"
      >
        <IconTagArrow className="h-5 w-5" />
        Generar vista previa
      </button>

      {/* Botón limpiar */}
      <button
        type="button"
        onClick={onClear}
        disabled={estaLimpio}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
      >
        <IconTrash className="h-4 w-4" />
        Limpiar datos
      </button>
    </div>
  )
}

function Field({
  id,
  label,
  icon: Icon,
  error,
  hint,
  hintOk,
  children,
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-800"
        >
          <Icon className="h-4 w-4 text-neutral-400" />
          {label}
        </label>

        {hint && !error && (
          <span
            className={[
              "text-[11px] font-semibold tabular-nums",
              hintOk
                ? "text-emerald-600"
                : "text-neutral-400",
            ].join(" ")}
          >
            {hint}
          </span>
        )}
      </div>

      {children}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">
          {error}
        </p>
      )}
    </div>
  )
}

function inputClass(hasError) {
  return [
    "w-full rounded-xl border bg-neutral-50 px-4 py-3.5 text-base text-neutral-900",
    "placeholder:text-neutral-400 transition-colors",
    "focus:border-vega-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-600/10",
    hasError
      ? "border-amber-400"
      : "border-neutral-200",
  ].join(" ")
}