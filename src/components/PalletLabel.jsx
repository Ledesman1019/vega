// src/components/PalletLabel.jsx
import { useEffect, useLayoutEffect, useRef } from 'react'
import { fitAll } from '../utils/fitText.js'

export default function PalletLabel({
  codigo,
  fecha,
  cantidad,
  orientation,
  hideLogo = false,
}) {
  const fechaFormateada = formatFecha(fecha)
  const sheetRef = useRef(null)

  // Recalcula tamaños cada vez que cambian los datos, la orientación,
  // el modo sin-logo, o el tamaño del contenedor (responsive) y
  // también cuando cargan las fuentes (si no, se mide con la fuente
  // de reemplazo y luego "EtiquetaBlack" carga y desajusta el tamaño).
  useLayoutEffect(() => {
    fitAll(sheetRef.current)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => fitAll(sheetRef.current))
    }
  }, [codigo, fecha, cantidad, orientation, hideLogo])

  useEffect(() => {
    const el = sheetRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitAll(el))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // El navegador aplica el CSS de impresión (@media print) ANTES de
  // disparar "beforeprint", así que en ese momento las cajas ya tienen
  // el tamaño real de la hoja A4 y podemos recalcular para que el
  // número llene el recuadro sin salirse.
  useEffect(() => {
    const refit = () => fitAll(sheetRef.current)
    window.addEventListener('beforeprint', refit)
    window.addEventListener('afterprint', refit)
    return () => {
      window.removeEventListener('beforeprint', refit)
      window.removeEventListener('afterprint', refit)
    }
  }, [])

  return (
    <div
      ref={sheetRef}
      className={`label-sheet orientation-${orientation} ${hideLogo ? 'no-logo' : ''}`}
    >

      {/* LOGO PEQUEÑO EN LA ESQUINA (se omite en modo "sin logo") */}
      {!hideLogo && (
        <img
          src="/logo-vega.png"
          alt="VEGA"
          className="label-logo"
        />
      )}

      {/* TABLA COMPLETA */}
      <div className="label-body">

        {/* FILA 1 - CÓDIGO */}
        <LabelRow lines={['CÓDIGO']}>
          {codigo || '—'}
        </LabelRow>

        {/* FILA 2 - VENCIMIENTO */}
        <LabelRow lines={['VENCIMIENTO']}>
          {fechaFormateada || '—'}
        </LabelRow>

        {/* FILA 3 - CANTIDAD */}
        <LabelRow lines={['CANTIDAD', 'UNIDADES']} last>
          {cantidad || '0'}
        </LabelRow>

      </div>
    </div>
  )
}


/* =========================================================
   FILA DE LA TABLA
   ========================================================= */

function LabelRow({ lines, last, children }) {
  return (
    <div className={`label-row ${last ? 'last-row' : ''}`}>

      {/* COLUMNA IZQUIERDA (etiqueta) */}
      <div className="label-caption">
        <div className="autofit-box">
          <div className="autofit-text autofit-caption">
            {lines.map((linea) => (
              <span key={linea}>{linea}</span>
            ))}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA (valor) */}
      <div className="label-value-cell">
        <div className="autofit-box">
          <span className="autofit-text autofit-value">{children}</span>
        </div>
      </div>

    </div>
  )
}


/* =========================================================
   FECHA
   ========================================================= */

function formatFecha(iso) {
  if (!iso) return ''

  const [y, m, d] = iso.split('-')

  if (!y || !m || !d) {
    return iso
  }

  return `${d}/${m}/${y}`
}