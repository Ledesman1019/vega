// src/utils/generateLabelPdf.js
//
// Genera el PDF del rótulo dibujando texto y líneas VECTORIALES con
// jsPDF (doc.text / doc.rect / doc.line), en vez de rasterizar el
// HTML con html2canvas. Esto elimina de raíz el problema anterior:
// html2canvas convertía todo en una imagen y, con letter-spacing
// negativo en una fuente tan gruesa, dibujaba los caracteres
// encimados y borrosos. Texto vectorial se ve nítido a cualquier
// zoom y el archivo pesa muchísimo menos.
//
// El resultado reproduce exactamente la proporción de la hoja HTML
// (mismos márgenes, mismo ancho de columna, mismo grosor de línea)
// para que preview, impresión y PDF luzcan idénticos.

import jsPDF from 'jspdf'
import { fetchAsBase64, fetchAsDataUrl } from './loadAsBase64.js'

const FONT_NAME = 'ArchivoBlackVega'
const FONT_URL = '/fonts/ArchivoBlack-Regular.ttf'
const LOGO_URL = '/logo-vega.png'

// Mismas proporciones que src/index.css (.label-body, .label-caption, etc.)
const MARGIN = 4 // mm, margen exterior de la tabla
const TOP_OFFSET = 18 // mm, espacio reservado arriba para el logo
const CAPTION_WIDTH_RATIO = 0.32
const ROW_COUNT = 3

const OUTER_BORDER_MM = 1
const DIVIDER_MM = 0.8

const CAPTION_PADDING_MM = 3
const VALUE_PADDING_X_MM = 4
const VALUE_PADDING_Y_MM = 1

const LOGO_TOP = 4
const LOGO_RIGHT = 5
const LOGO_WIDTH = 16
const LOGO_HEIGHT = 8

// pt -> mm
const PT_TO_MM = 0.3528
const LINE_HEIGHT_FACTOR = 0.92 // proporción alto-de-línea/tamaño, igual que line-height:0.85-0.95 del CSS

let fontBase64Promise = null
function getFontBase64() {
  if (!fontBase64Promise) {
    fontBase64Promise = fetchAsBase64(FONT_URL)
  }
  return fontBase64Promise
}

// 🔑 Cada vez que se llama a generateLabelPdf() se crea un jsPDF
// nuevo, y jsPDF guarda las fuentes registradas POR DOCUMENTO (no
// globalmente). Antes esta función cacheaba la promesa completa
// (incluyendo el addFileToVFS/addFont), así que la primera
// exportación quedaba bien pero la SEGUNDA (sin importar la
// orientación) se saltaba el registro sobre el documento nuevo y
// jsPDF caía a su fuente por defecto (Times) — eso es lo que se veía
// en el PDF vertical. Ahora solo se cachea la descarga del .ttf; el
// addFileToVFS/addFont se repite en cada documento.
async function loadFont(doc) {
  const base64 = await getFontBase64()
  doc.addFileToVFS(`${FONT_NAME}.ttf`, base64)
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, 'normal')
}

let logoPromise = null
function loadLogo() {
  if (!logoPromise) {
    logoPromise = fetchAsDataUrl(LOGO_URL)
  }
  return logoPromise
}

/**
 * Busca (por búsqueda binaria) el mayor tamaño de fuente en puntos
 * que hace que `lines` quepa dentro de maxWidthMm x maxHeightMm,
 * midiendo con las métricas REALES de la fuente ya cargada en `doc`
 * (doc.getTextWidth). Es exactamente lo que jsPDF va a dibujar, así
 * que no hay diferencia entre lo calculado y lo que sale en el PDF.
 */
function fitFontSize(doc, lines, maxWidthMm, maxHeightMm, { min = 6, max = 400 } = {}) {
  let lo = min
  let hi = max
  let best = min

  for (let i = 0; i < 24 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2
    doc.setFontSize(mid)

    const widestLineMm = Math.max(...lines.map((line) => doc.getTextWidth(line)))
    const lineHeightMm = mid * PT_TO_MM * LINE_HEIGHT_FACTOR
    const totalHeightMm = lineHeightMm * lines.length

    if (widestLineMm <= maxWidthMm && totalHeightMm <= maxHeightMm) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }

  doc.setFontSize(best)
  return best
}

function formatFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export async function generateLabelPdf({ codigo, fecha, cantidad }, orientation, { hideLogo = false } = {}) {
  const isLandscape = orientation === 'landscape'

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  await loadFont(doc)
  doc.setFont(FONT_NAME, 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const bodyX = MARGIN
  // Modo de prueba "sin logo": usa toda la hoja (margen parejo),
  // en vez de reservar espacio arriba para el logo.
  const bodyY = hideLogo ? MARGIN : TOP_OFFSET
  const bodyWidth = pageWidth - MARGIN * 2
  const bodyHeight = pageHeight - bodyY - MARGIN

  const captionWidth = bodyWidth * CAPTION_WIDTH_RATIO
  const valueWidth = bodyWidth - captionWidth
  const rowHeight = bodyHeight / ROW_COUNT

  // Marco exterior de la tabla
  doc.setLineWidth(OUTER_BORDER_MM)
  doc.rect(bodyX, bodyY, bodyWidth, bodyHeight)

  const rows = [
    { caption: ['CÓDIGO'], value: codigo || '—' },
    { caption: ['VENCIMIENTO'], value: formatFecha(fecha) || '—' },
    { caption: ['CANTIDAD', 'UNIDADES'], value: String(cantidad || '0') },
  ]

  doc.setLineWidth(DIVIDER_MM)

  rows.forEach((row, i) => {
    const rowY = bodyY + rowHeight * i

    // Línea divisoria horizontal entre filas (el borde exterior ya
    // dibuja el contorno completo, esto solo agrega las internas)
    if (i > 0) {
      doc.line(bodyX, rowY, bodyX + bodyWidth, rowY)
    }

    // Línea divisoria vertical entre columnas
    doc.line(bodyX + captionWidth, rowY, bodyX + captionWidth, rowY + rowHeight)

    // --- Columna izquierda: etiqueta ---
    const captionBoxW = captionWidth - CAPTION_PADDING_MM * 2
    const captionBoxH = rowHeight - CAPTION_PADDING_MM * 2
    const captionSize = fitFontSize(doc, row.caption, captionBoxW, captionBoxH, { max: 200 })
    const captionLineH = captionSize * PT_TO_MM * LINE_HEIGHT_FACTOR
    const captionBlockH = captionLineH * row.caption.length
    const captionBlockTop = rowY + rowHeight / 2 - captionBlockH / 2

    row.caption.forEach((line, li) => {
      const lineCenterY = captionBlockTop + captionLineH * (li + 0.5)
      doc.text(line, bodyX + captionWidth / 2, lineCenterY, {
        align: 'center',
        baseline: 'middle',
      })
    })

    // --- Columna derecha: valor ---
    const valueBoxW = valueWidth - VALUE_PADDING_X_MM * 2
    const valueBoxH = rowHeight - VALUE_PADDING_Y_MM * 2
    fitFontSize(doc, [row.value], valueBoxW, valueBoxH, { max: 400 })

    doc.text(row.value, bodyX + captionWidth + valueWidth / 2, rowY + rowHeight / 2, {
      align: 'center',
      baseline: 'middle',
    })
  })

  // Logo VEGA arriba a la derecha (se omite en modo "sin logo")
  if (!hideLogo) {
    try {
      const logoDataUrl = await loadLogo()
      const logoX = pageWidth - LOGO_RIGHT - LOGO_WIDTH
      doc.addImage(logoDataUrl, 'PNG', logoX, LOGO_TOP, LOGO_WIDTH, LOGO_HEIGHT)
    } catch {
      // Si el logo no carga por algún motivo, seguimos: el rótulo
      // sigue siendo válido sin él.
    }
  }

  return doc
}