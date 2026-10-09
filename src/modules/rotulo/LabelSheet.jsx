// src/modules/rotulo/LabelSheet.jsx
//
// Dibuja el rótulo como SVG en milímetros (viewBox = tamaño real de la
// hoja). En pantalla escala al ancho disponible; al imprimir ocupa la
// hoja completa en horizontal.
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { LABEL_FONT, OUTER_BORDER, INNER_BORDER } from '../../lib/label/layout.js'

export function LabelSvg({ layout, className = '', style }) {
  const f = layout.frame
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="Vista previa del rótulo"
    >
      <rect x="0" y="0" width={layout.width} height={layout.height} fill="#fff" />
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke="#000" strokeWidth={OUTER_BORDER} />
      {layout.lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#000" strokeWidth={INNER_BORDER} />
      ))}
      {layout.texts.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          fontSize={t.size}
          textAnchor="middle"
          fill="#000"
          style={{ fontFamily: `"${LABEL_FONT}", Arial, sans-serif`, fontKerning: 'none' }}
        >
          {t.text}
        </text>
      ))}
    </svg>
  )
}

/** Copia del rótulo que SOLO aparece al imprimir (una hoja horizontal). */
export function PrintableLabel({ layout }) {
  useEffect(() => {
    const id = 'label-page-style'
    let tag = document.getElementById(id)
    if (!tag) {
      tag = document.createElement('style')
      tag.id = id
      document.head.appendChild(tag)
    }
    tag.textContent = `@page { size: ${layout.width}mm ${layout.height}mm; margin: 0; }`
    return () => tag.remove()
  }, [layout.width, layout.height])

  return createPortal(
    <div className="print-area" aria-hidden="true">
      {/* 0.6 mm menos de alto: evita que un redondeo genere una 2.ª hoja */}
      <LabelSvg layout={layout} style={{ width: `${layout.width}mm`, height: `${layout.height - 0.6}mm`, display: 'block' }} />
    </div>,
    document.body,
  )
}
