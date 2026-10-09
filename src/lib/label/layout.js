// src/lib/label/layout.js
//
// Motor de diseño del rótulo. Calcula UNA sola vez (en milímetros) la
// posición y el tamaño de cada línea y cada texto; con ese mismo
// resultado se dibuja:
//   - la vista previa y la impresión (SVG, ver LabelSheet.jsx)
//   - el PDF (jsPDF, ver pdf.js)
// Así los tres salen idénticos, en una sola hoja horizontal y con el
// texto lo más grande que cabe en cada recuadro.

export const LABEL_FONT = 'EtiquetaBlack' // Archivo Black (public/fonts)

export const PAPERS = {
  A4: { id: 'A4', label: 'A4', width: 297, height: 210, jspdf: 'a4' },
  Carta: { id: 'Carta', label: 'Carta', width: 279.4, height: 215.9, jspdf: 'letter' },
}

// Métricas de Archivo Black (tabla OS/2 del .ttf, en "em")
const CAP_HEIGHT = 0.688
const ACCENT = 0.16 // espacio extra arriba para tildes de mayúsculas (Á, Ñ…)
const LINE_GAP = 0.3 // separación entre líneas de un mismo texto

const MARGIN = 5 // mm alrededor de la tabla
export const OUTER_BORDER = 1.2 // mm
export const INNER_BORDER = 0.8 // mm
const CAPTION_RATIO = 0.22 // ancho de la columna de títulos
const PAD_X = 3.5 // mm
const PAD_Y = 3 // mm

// Alto de cada fila (proporción del alto útil). El estilo es solo el
// identificador (fila baja); la descripción es lo que más debe verse.
const ROWS = [
  { key: 'estilo', caption: 'ESTILO', ratio: 0.16 },
  { key: 'descripcion', caption: null, ratio: 0.4 },
  { key: 'fv', caption: 'FV:', ratio: 0.22 },
  { key: 'cantidad', caption: 'CANT.', ratio: 0.22 },
]

/* ---------------------------------------------------------------
   Medición de texto (ancho en "em") con la fuente real del rótulo
   --------------------------------------------------------------- */
let ctx = null
const cache = new Map()
function measureEm(text) {
  const hit = cache.get(text)
  if (hit !== undefined) return hit
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')
  }
  ctx.font = `100px "${LABEL_FONT}"`
  if ('fontKerning' in ctx) ctx.fontKerning = 'none' // igual que jsPDF
  const em = ctx.measureText(text).width / 100
  cache.set(text, em)
  return em
}

let fontPromise = null
/** Espera a que la fuente del rótulo esté cargada (si no, se mide mal). */
export function loadLabelFont() {
  if (!fontPromise) {
    fontPromise = (document.fonts?.load ? document.fonts.load(`100px "${LABEL_FONT}"`) : Promise.resolve())
      .then(() => cache.clear())
      .catch(() => {})
  }
  return fontPromise
}

/* ---------------------------------------------------------------
   Ajuste de texto dentro de una caja
   --------------------------------------------------------------- */
const blockHeightEm = (n, accent) => (accent ? ACCENT : 0) + CAP_HEIGHT + (n - 1) * (CAP_HEIGHT + LINE_GAP)

/** Parte `words` en líneas que no superen maxEm. null si una palabra no entra. */
function wrap(words, maxEm) {
  const lines = []
  let current = ''
  for (const w of words) {
    if (measureEm(w) > maxEm) return null
    const candidate = current ? `${current} ${w}` : w
    if (measureEm(candidate) <= maxEm) {
      current = candidate
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Tamaño (mm) máximo para un texto de una o varias líneas fijas. */
function fitFixed(lines, boxW, boxH, accent) {
  const widest = Math.max(...lines.map(measureEm), 0.01)
  return Math.min(boxW / widest, boxH / blockHeightEm(lines.length, accent))
}

/** Texto libre (descripción): busca el tamaño más grande permitiendo saltos de línea. */
function fitWrapped(text, boxW, boxH, accent) {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return { size: 0, lines: [] }
  let lo = 1
  let hi = Math.max(boxW, boxH)
  let best = { size: lo, lines: wrap(words, boxW / lo) || [text] }
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2
    const lines = wrap(words, boxW / mid)
    if (lines && mid * blockHeightEm(lines.length, accent) <= boxH) {
      best = { size: mid, lines }
      lo = mid
    } else {
      hi = mid
    }
  }
  return best
}

/** Coloca las líneas centradas (horizontal y vertical) dentro de la caja. */
function place(lines, size, box, accent) {
  const blockH = size * blockHeightEm(lines.length, accent)
  const firstBaseline = box.y + (box.h - blockH) / 2 + size * ((accent ? ACCENT : 0) + CAP_HEIGHT)
  return lines.map((text, i) => ({
    text,
    x: box.x + box.w / 2,
    y: firstBaseline + i * size * (CAP_HEIGHT + LINE_GAP),
    size,
  }))
}

const hasAccent = (s) => /[ÁÉÍÓÚÑÜÀÈÌÒÙ]/.test(s)

export function formatFechaLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/**
 * @param {{estilo, descripcion, fecha, cantidad}} data
 * @param {'A4'|'Carta'} paperId
 */
export function computeLabelLayout(data, paperId = 'A4') {
  const paper = PAPERS[paperId] || PAPERS.A4
  const W = paper.width
  const H = paper.height

  const body = { x: MARGIN, y: MARGIN, w: W - MARGIN * 2, h: H - MARGIN * 2 }
  const captionW = body.w * CAPTION_RATIO

  const values = {
    estilo: String(data.estilo || '').trim(),
    descripcion: String(data.descripcion || '').trim().toUpperCase(),
    fv: formatFechaLabel(data.fecha),
    cantidad: data.cantidad ? String(data.cantidad) : '',
  }

  const lines = []
  const texts = []

  // Filas
  let y = body.y
  const rows = ROWS.map((r, i) => {
    const h = body.h * r.ratio
    const row = { ...r, y, h }
    if (i > 0) lines.push({ x1: body.x, y1: y, x2: body.x + body.w, y2: y })
    y += h
    return row
  })

  // Títulos: todos del mismo tamaño (el que quepa en el más largo)
  const captionRows = rows.filter((r) => r.caption)
  const captionSize = Math.min(
    ...captionRows.map((r) => fitFixed([r.caption], captionW - PAD_X * 2, r.h - PAD_Y * 2, false)),
  ) * 0.92

  for (const r of rows) {
    const value = values[r.key]
    if (r.caption) {
      lines.push({ x1: body.x + captionW, y1: r.y, x2: body.x + captionW, y2: r.y + r.h })
      const capBox = { x: body.x, y: r.y, w: captionW, h: r.h }
      texts.push(...place([r.caption], captionSize, capBox, false).map((t) => ({ ...t, role: 'caption' })))

      if (value) {
        const box = { x: body.x + captionW + PAD_X, y: r.y + PAD_Y, w: body.w - captionW - PAD_X * 2, h: r.h - PAD_Y * 2 }
        const size = fitFixed([value], box.w, box.h, hasAccent(value))
        texts.push(...place([value], size, box, hasAccent(value)).map((t) => ({ ...t, role: 'value' })))
      }
    } else if (value) {
      const box = { x: body.x + PAD_X, y: r.y + PAD_Y, w: body.w - PAD_X * 2, h: r.h - PAD_Y * 2 }
      const accent = hasAccent(value)
      const { size, lines: wrapped } = fitWrapped(value, box.w, box.h, accent)
      texts.push(...place(wrapped, size, box, accent).map((t) => ({ ...t, role: 'description' })))
    }
  }

  return {
    paper,
    width: W,
    height: H,
    frame: body,
    lines,
    texts,
  }
}
