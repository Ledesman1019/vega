// src/lib/label/pdf.js
//
// PDF vectorial (texto y líneas reales, nítido a cualquier zoom) a
// partir del mismo layout que la vista previa.
import { fetchAsBase64 } from '../../utils/loadAsBase64.js'
import { OUTER_BORDER, INNER_BORDER } from './layout.js'

const FONT_URL = '/fonts/ArchivoBlack-Regular.ttf'
const PDF_FONT = 'ArchivoBlackVega'
const MM_PER_PT = 25.4 / 72

let fontBase64 = null

export async function buildLabelPdf(layout) {
  const [{ default: jsPDF }, base64] = await Promise.all([
    import('jspdf'),
    fontBase64 || (fontBase64 = fetchAsBase64(FONT_URL)),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: layout.paper.jspdf })
  // jsPDF registra fuentes por documento: hay que hacerlo en cada PDF
  doc.addFileToVFS(`${PDF_FONT}.ttf`, base64)
  doc.addFont(`${PDF_FONT}.ttf`, PDF_FONT, 'normal')
  doc.setFont(PDF_FONT, 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)

  const f = layout.frame
  doc.setLineWidth(OUTER_BORDER)
  doc.rect(f.x, f.y, f.w, f.h)

  doc.setLineWidth(INNER_BORDER)
  for (const l of layout.lines) doc.line(l.x1, l.y1, l.x2, l.y2)

  for (const t of layout.texts) {
    doc.setFontSize(t.size / MM_PER_PT)
    doc.text(t.text, t.x, t.y, { align: 'center', baseline: 'alphabetic' })
  }

  return doc
}
