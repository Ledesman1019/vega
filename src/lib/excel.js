// src/lib/excel.js
//
// Importar productos / exportar productos e historial con ExcelJS (se carga solo cuando se usa,
// para que la app abra rápido).
import { normalizeEstilo, isValidEstilo } from './api/productos.js'

const VEGA_RED = 'FFE20514'
const VEGA_INK = 'FF16171A'

const loadExcel = () => import('exceljs').then((m) => m.default || m)

/* =========================================================
   IMPORTAR
   ========================================================= */

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9°º]/g, '')

const isEstiloHeader = (h) => ['n', 'n°', 'nº', 'no', 'nro', 'numero', 'estilo', 'codigo', 'cod', 'sku', 'item'].includes(norm(h))
const isDescHeader = (h) => norm(h).startsWith('desc') || ['producto', 'nombre', 'articulo'].includes(norm(h))

function cellText(v) {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('')
    if ('result' in v) return cellText(v.result)
    if (v.text != null) return String(v.text)
    if (v instanceof Date) return v.toISOString().slice(0, 10)
  }
  return String(v)
}

function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); rows.push(row); row = []; cur = ''
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

async function readMatrix(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsv(await file.text())
  }
  if (name.endsWith('.xls')) {
    throw new Error('El formato .xls (Excel 97-2003) no es compatible. Ábrelo en Excel y guárdalo como .xlsx.')
  }
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0) || wb.worksheets[0]
  if (!ws) return []
  const rows = []
  ws.eachRow({ includeEmpty: false }, (r) => {
    const values = []
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      // Respeta el formato de la celda (ej. "000000" -> 010247)
      let t = cell.text != null && cell.text !== '' ? String(cell.text) : cellText(cell.value)
      values[col - 1] = t
    })
    rows.push(values.map((v) => v ?? ''))
  })
  return rows
}

/**
 * Lee un Excel/CSV y devuelve { rows: [{estilo, descripcion}], skipped, duplicated, total }.
 * Detecta las columnas por encabezado (N° / Estilo / Código y Descripción);
 * si no hay encabezado usa columna A = estilo, B = descripción.
 */
export async function parseProductosFile(file) {
  const matrix = await readMatrix(file)
  if (!matrix.length) throw new Error('El archivo está vacío.')

  let headerIdx = -1
  let colEstilo = 0
  let colDesc = 1
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const r = matrix[i]
    const e = r.findIndex(isEstiloHeader)
    const d = r.findIndex(isDescHeader)
    if (e !== -1 && d !== -1) {
      headerIdx = i
      colEstilo = e
      colDesc = d
      break
    }
  }

  const map = new Map()
  let skipped = 0
  let total = 0
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i]
    const rawE = r[colEstilo]
    const rawD = r[colDesc]
    if (!String(rawE ?? '').trim() && !String(rawD ?? '').trim()) continue
    total++
    const estilo = normalizeEstilo(rawE)
    const descripcion = String(rawD ?? '').replace(/\s+/g, ' ').trim()
    if (!isValidEstilo(estilo) || !descripcion) {
      skipped++
      continue
    }
    map.set(estilo, { estilo, descripcion })
  }

  const rows = [...map.values()]
  return { rows, skipped, duplicated: total - skipped - rows.length, total }
}

/* =========================================================
   EXPORTAR
   ========================================================= */

function download(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/**
 * Hoja con estilo corporativo: título, subtítulo, encabezado rojo VEGA,
 * filas cebra, filtros y encabezado fijo.
 */
async function buildSheet({ sheetName, title, subtitle, columns, rows }) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'VEGA · Sistema de rótulos'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }))
  const lastCol = String.fromCharCode(64 + columns.length)

  ws.mergeCells(`A1:${lastCol}1`)
  const t = ws.getCell('A1')
  t.value = title
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VEGA_INK } }
  t.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 30

  ws.mergeCells(`A2:${lastCol}2`)
  const s = ws.getCell('A2')
  s.value = subtitle
  s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } }
  s.alignment = { indent: 1 }
  ws.getRow(2).height = 18

  const header = ws.getRow(4)
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VEGA_RED } }
    cell.alignment = { vertical: 'middle', horizontal: c.align || 'left' }
    cell.border = { bottom: { style: 'medium', color: { argb: VEGA_INK } } }
  })
  header.height = 22

  rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx)
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = c.value(r)
      if (c.numFmt) cell.numFmt = c.numFmt
      cell.font = { name: 'Calibri', size: 11, bold: !!c.bold }
      cell.alignment = { vertical: 'middle', horizontal: c.align || 'left' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F8' } }
    })
  })

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: columns.length } }
  return wb
}

export async function exportProductosExcel(productos) {
  const wb = await buildSheet({
    sheetName: 'Productos',
    title: 'VEGA · Base de productos',
    subtitle: `${productos.length.toLocaleString('es-PE')} productos · Exportado el ${new Date().toLocaleString('es-PE')}`,
    columns: [
      // Estilo como TEXTO: así Excel no le quita los ceros (010247)
      { key: 'estilo', header: 'N°', width: 14, value: (r) => r.estilo, numFmt: '@', bold: true },
      { key: 'descripcion', header: 'Descripcion', width: 62, value: (r) => r.descripcion },
      { key: 'marca', header: 'Marca', width: 20, value: (r) => r.marca },
    ],
    rows: productos,
  })
  download(await wb.xlsx.writeBuffer(), `VEGA_productos_${stamp()}.xlsx`)
}

export async function exportHistorialExcel(items) {
  const wb = await buildSheet({
    sheetName: 'Historial',
    title: 'VEGA · Historial de rótulos',
    subtitle: `${items.length.toLocaleString('es-PE')} registros · Exportado el ${new Date().toLocaleString('es-PE')}`,
    columns: [
      { key: 'created_at', header: 'Fecha y hora', width: 20, value: (r) => new Date(r.created_at), numFmt: 'dd/mm/yyyy hh:mm' },
      { key: 'estilo', header: 'Estilo', width: 12, value: (r) => r.estilo, numFmt: '@', bold: true },
      { key: 'descripcion', header: 'Descripción', width: 50, value: (r) => r.descripcion },
      { key: 'fv', header: 'Vencimiento', width: 14, value: (r) => { const [y, m, d] = r.fecha_vencimiento.split('-'); return `${d}/${m}/${y}` }, align: 'center' },
      { key: 'cantidad', header: 'Cantidad', width: 11, value: (r) => r.cantidad, align: 'right' },
      { key: 'accion', header: 'Acción', width: 13, value: (r) => (r.accion === 'impreso' ? 'Impreso' : 'Descargado'), align: 'center' },
      { key: 'papel', header: 'Papel', width: 9, value: (r) => r.papel, align: 'center' },
    ],
    rows: items,
  })
  download(await wb.xlsx.writeBuffer(), `VEGA_historial_rotulos_${stamp()}.xlsx`)
}
