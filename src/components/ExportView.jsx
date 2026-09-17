// src/components/ExportView.jsx
import { useState } from 'react'
import PalletLabel from './PalletLabel.jsx'
import { generateLabelPdf } from '../utils/generateLabelPdf.js'
import {
  IconArrowLeft,
  IconPortrait,
  IconLandscape,
  IconDownload,
  IconPrinter,
} from './Icons.jsx'

export default function ExportView({ data, orientation, onOrientation, onBack, onPrinted }) {
  const [saving, setSaving] = useState(false)
  const [hideLogo, setHideLogo] = useState(false)

  const handlePrint = () => {
    window.print()
    onPrinted?.()
  }

  const handleSavePdf = async () => {
    setSaving(true)
    try {
      // PDF vectorial (texto y líneas reales de jsPDF): nítido a
      // cualquier zoom, sin el traslape de caracteres que producía
      // html2canvas al rasterizar con letter-spacing negativo.
      const doc = await generateLabelPdf(data, orientation, { hideLogo })
      const nombre = data.codigo ? data.codigo.replace(/[^a-z0-9-_]+/gi, '_') : 'sin-codigo'
      doc.save(`rotulo-pallet-${nombre}.pdf`)
      onPrinted?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 font-sans">
      {/* Header rojo */}
      <div className="no-print sticky top-0 z-20 border-b-4 border-vega-ink bg-vega-red shadow-lg shadow-red-900/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
          {/* Izquierda: volver (solo desktop) */}
          <button
            onClick={onBack}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:flex"
          >
            <IconArrowLeft className="h-4 w-4" />
            Editar datos
          </button>

          {/* Centro: toggle orientación (solo desktop) */}
          <div className="hidden rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-sm sm:flex">
            <ToggleButton
              active={orientation === 'portrait'}
              onClick={() => onOrientation('portrait')}
              icon={IconPortrait}
              label="Vertical"
            />
            <ToggleButton
              active={orientation === 'landscape'}
              onClick={() => onOrientation('landscape')}
              icon={IconLandscape}
              label="Horizontal"
            />
          </div>

          {/* Acciones */}
          <div className="flex flex-1 gap-2 sm:flex-none">
            <ActionButtons
              saving={saving}
              onSavePdf={handleSavePdf}
              onPrint={handlePrint}
              fullWidth
            />
          </div>
        </div>

        {/* Prueba: exportar sin logo, a toda la hoja */}
        <div className="flex items-center justify-center gap-2 border-t border-white/15 px-4 py-2 sm:px-6">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white/85">
            <input
              type="checkbox"
              checked={hideLogo}
              onChange={(e) => setHideLogo(e.target.checked)}
              className="h-3.5 w-3.5 accent-white"
            />
            Prueba: sin logo (números al máximo)
          </label>
        </div>
      </div>

      {/* Vista previa */}
      <div className="export-stage flex flex-1 items-start justify-center overflow-auto bg-neutral-200 px-4 py-8 sm:px-8">
        <PalletLabel
          codigo={data.codigo}
          fecha={data.fecha}
          cantidad={data.cantidad}
          orientation={orientation}
          hideLogo={hideLogo}
        />
      </div>
    </div>
  )
}

function ToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all',
        active
          ? 'bg-white text-vega-red shadow-sm'
          : 'text-white/80 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function ActionButtons({ saving, onSavePdf, onPrint, fullWidth }) {
  return (
    <>
      <button
        onClick={onSavePdf}
        disabled={saving}
        className={[
          'flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50',
          fullWidth ? 'flex-1 sm:flex-none' : '',
        ].join(' ')}
      >
        <IconDownload className="h-4 w-4" />
        {saving ? 'Generando…' : 'Guardar PDF'}
      </button>
      <button
        onClick={onPrint}
        className={[
          'flex items-center justify-center gap-2 rounded-xl bg-vega-ink px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-black/20 transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
          fullWidth ? 'flex-1 sm:flex-none' : '',
        ].join(' ')}
      >
        <IconPrinter className="h-4 w-4" />
        Imprimir
      </button>
    </>
  )
}