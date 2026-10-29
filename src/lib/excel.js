// src/lib/excel.js
//
// Importar productos / exportar productos e historial con ExcelJS (se carga solo cuando se usa,
// para que la app abra rápido).
import { normalizeEstilo, isValidEstilo, normalizeEan, isValidEan } from './api/productos.js'

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

// Columna opcional de código de barras: "EAN", "EAN13", "Código de barras", "GTIN"…
const isEanHeader = (h) => {
  const n = norm(h)
  return n.includes('ean') || n.includes('barra') || n.includes('gtin') || n === 'upc'
}

// Acepta nombres exactos (N°, Estilo, Código…) y compuestos como
// "ProductoCodigo", "Código producto", "Estilo SAP" o "ProductoDescripcion".
const isEstiloHeader = (h) => {
  const n = norm(h)
  if (isEanHeader(h)) return false
  return (
    ['n', 'n°', 'nº', 'no', 'nro', 'numero', 'cod', 'sku', 'item'].includes(n) ||
    n.includes('codigo') ||
    n.includes('estilo')
  )
}
const isDescHeader = (h) => {
  const n = norm(h)
  if (isEanHeader(h)) return false
  return n.includes('desc') || ['producto', 'nombre', 'articulo'].includes(n)
}

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
    return parseCsv(await file.text()).map((row, i) => Object.assign(row, { fila: i + 1 }))
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
      const raw = cell.value && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value
      // Fechas reales de Excel -> YYYY-MM-DD (ExcelJS las guarda en UTC)
      if (raw instanceof Date) {
        values[col - 1] = Number.isNaN(raw.getTime()) ? '' : raw.toISOString().slice(0, 10)
        return
      }
      // Respeta el formato de la celda (ej. "000000" -> 010247)
      let t = cell.text != null && cell.text !== '' ? String(cell.text) : cellText(cell.value)
      values[col - 1] = t
    })
    const row = values.map((v) => v ?? '')
    row.fila = r.number // n.° de fila real en Excel (para avisar errores)
    rows.push(row)
  })
  return rows
}

/**
 * Lee un Excel/CSV y devuelve
 * { rows: [{estilo, descripcion}], eans: [{ean, estilo}], skipped, duplicated, total }.
 * Detecta las columnas por encabezado (N° / Estilo / Código, Descripción y,
 * opcional, EAN / Código de barras); si no hay encabezado usa columna
 * A = estilo, B = descripción. Un archivo con solo Estilo + EAN carga
 * únicamente los códigos de barras.
 */
export async function parseProductosFile(file) {
  const matrix = await readMatrix(file)
  if (!matrix.length) throw new Error('El archivo está vacío.')

  let headerIdx = -1
  let colEstilo = 0
  let colDesc = 1
  let colEan = -1
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const r = matrix[i]
    // Una columna llamada "Estilo" gana sobre las genéricas (SKU, Código…)
    const exacta = r.findIndex((h) => norm(h).includes('estilo'))
    const e = exacta !== -1 ? exacta : r.findIndex(isEstiloHeader)
    const d = r.findIndex(isDescHeader)
    const b = r.findIndex(isEanHeader)
    if (e !== -1 && (d !== -1 || b !== -1)) {
      headerIdx = i
      colEstilo = e
      colDesc = d
      colEan = b
      break
    }
  }

  // Columna de código de barras con otro nombre (ej. "SKU"): se reconoce
  // porque casi todos sus valores son números de 12 a 14 dígitos.
  if (headerIdx !== -1 && colEan === -1) {
    const muestra = matrix.slice(headerIdx + 1, headerIdx + 51)
    const ancho = Math.max(...matrix[headerIdx].map((_, i) => i + 1), 0)
    for (let c = 0; c < ancho; c++) {
      if (c === colEstilo || c === colDesc) continue
      const vals = muestra.map((r) => normalizeEan(r[c])).filter(Boolean)
      if (vals.length && vals.filter((v) => /^\d{12,14}$/.test(v)).length >= vals.length * 0.8) {
        colEan = c
        break
      }
    }
  }

  // Sin encabezados: usa las dos primeras columnas con datos (la tabla
  // puede empezar en la columna B, C…)
  if (headerIdx === -1) {
    const first = matrix.find((r) => r.filter((v) => String(v ?? '').trim()).length >= 2) || []
    const cols = first.map((v, i) => (String(v ?? '').trim() ? i : -1)).filter((i) => i !== -1)
    if (cols.length >= 2) [colEstilo, colDesc] = cols
  }

  const map = new Map()
  const eanMap = new Map()
  let skipped = 0
  let total = 0
  let conDescripcion = 0
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i]
    const rawE = r[colEstilo]
    const rawD = colDesc !== -1 ? r[colDesc] : ''
    const rawB = colEan !== -1 ? r[colEan] : ''
    if (![rawE, rawD, rawB].some((v) => String(v ?? '').trim())) continue
    total++
    const estilo = normalizeEstilo(rawE)
    const descripcion = String(rawD ?? '').replace(/\s+/g, ' ').trim()
    const ean = normalizeEan(rawB)
    const okProducto = isValidEstilo(estilo) && !!descripcion
    const okEan = isValidEstilo(estilo) && isValidEan(ean)
    if (!okProducto && !okEan) {
      skipped++
      continue
    }
    if (okProducto) {
      conDescripcion++
      map.set(estilo, { estilo, descripcion })
    }
    if (okEan) eanMap.set(ean, { ean, estilo })
  }

  const rows = [...map.values()]
  // Con columna EAN es normal que un estilo se repita (un código por fila)
  const duplicated = colEan === -1 ? conDescripcion - rows.length : 0
  return { rows, eans: [...eanMap.values()], skipped, duplicated, total }
}

/* =========================================================
   RÓTULO AUTOMÁTICO: paletizado e ingresos
   ========================================================= */

/**
 * Entero positivo de una celda. Acepta "1920", "1,920", "1.920" y "1920.0".
 * Devuelve null si la celda está vacía y NaN si no es un entero válido
 * (decimales, texto, negativos): así nunca se redondea nada a escondidas.
 */
export function parseEntero(v) {
  const s = String(v ?? '').trim().replace(/\s+/g, '')
  if (!s) return null
  let digits = null
  if (/^\d+$/.test(s)) digits = s
  else if (/^\d+[.,]0+$/.test(s)) digits = s.split(/[.,]/)[0]
  else if (/^\d{1,3}(,\d{3})+$/.test(s) || /^\d{1,3}(\.\d{3})+$/.test(s)) digits = s.replace(/[.,]/g, '')
  // Con miles y decimales en cero: "1,080.00" o "1.080,00"
  else if (/^\d{1,3}(,\d{3})+\.0+$/.test(s)) digits = s.split('.')[0].replace(/,/g, '')
  else if (/^\d{1,3}(\.\d{3})+,0+$/.test(s)) digits = s.split(',')[0].replace(/\./g, '')
  if (digits == null) return NaN
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : NaN
}

/**
 * Fecha de una celda -> 'YYYY-MM-DD'. Acepta fecha de Excel, "19/05/2030",
 * "1/06/2030", "2030-05-19" y número de serie de Excel (47257).
 * Devuelve null si la celda está vacía y false si no es una fecha real
 * (ej. 31/02/2030): nunca se corrige una fecha a escondidas.
 */
export function parseFecha(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  let y, m, d, mt
  if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = mt
  else if ((mt = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = mt // día/mes/año (Perú)
  else if (/^\d{5}(\.0+)?$/.test(s)) {
    // Número de serie de Excel: días desde el 30/12/1899
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.trunc(Number(s)) * 86400000)
    return dt.toISOString().slice(0, 10)
  } else return false
  const dt = new Date(Date.UTC(+y, +m - 1, +d))
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return false
  return dt.toISOString().slice(0, 10)
}

/**
 * Busca (en las 10 primeras filas) la de encabezados con todas las
 * columnas requeridas. detectors: { clave: (encabezado) => boolean }.
 * Devuelve { headerIdx, cols: { clave: índice o -1 } } o null.
 */
function findHeader(matrix, detectors, required) {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const r = matrix[i]
    // Una columna llamada "Estilo" gana sobre las genéricas (Código, SKU…)
    const hayEstilo = r.some((h) => norm(h).includes('estilo'))
    const tests = {
      estilo: (h) => (hayEstilo ? norm(h).includes('estilo') : isEstiloHeader(h)),
      ...detectors,
    }
    const cols = {}
    for (const [key, test] of Object.entries(tests)) {
      cols[key] = r.findIndex((h, idx) => test(h) && !Object.values(cols).includes(idx))
    }
    if (required.every((k) => cols[k] !== -1)) return { headerIdx: i, cols }
  }
  return null
}

/**
 * Tabla 1 (paletizado): Código/Estilo, Descripción (opcional), Factor,
 * Cama, Altura y Total (opcional: si viene, se verifica que sea cama × altura).
 * Devuelve { items, errores: [{fila, estilo, motivo}], repetidos, total }.
 */
export async function parsePaletizadoFile(file) {
  const matrix = await readMatrix(file)
  if (!matrix.length) throw new Error('El archivo está vacío.')

  const found = findHeader(
    matrix,
    {
      descripcion: isDescHeader,
      factor: (h) => norm(h).startsWith('fact') || norm(h).includes('unidadesporcaja') || norm(h).includes('undxcaja'),
      cama: (h) => norm(h).includes('cama'),
      altura: (h) => norm(h).includes('altura') || norm(h) === 'alto' || norm(h).includes('nivel'),
      total: (h) => norm(h).startsWith('total'),
    },
    ['estilo', 'factor', 'cama', 'altura'],
  )
  if (!found) {
    throw new Error('No se encontraron los encabezados. El Excel debe tener las columnas: Estilo (o ProductoCodigo), Factor, Cama y Altura.')
  }

  const { headerIdx, cols } = found
  const get = (r, k) => (cols[k] === -1 ? '' : r[cols[k]])
  const map = new Map()
  const errores = []
  let total = 0
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i]
    if (!['estilo', 'factor', 'cama', 'altura'].some((k) => String(get(r, k) ?? '').trim())) continue
    total++
    const fila = r.fila ?? i + 1
    const estilo = normalizeEstilo(get(r, 'estilo'))
    const descripcion = String(get(r, 'descripcion') ?? '').replace(/\s+/g, ' ').trim()
    const factor = parseEntero(get(r, 'factor'))
    const cama = parseEntero(get(r, 'cama'))
    const altura = parseEntero(get(r, 'altura'))
    const totalExcel = parseEntero(get(r, 'total'))

    let motivo = ''
    if (!isValidEstilo(estilo)) motivo = 'Estilo vacío o no válido'
    else if (!(factor >= 1 && factor <= 100000)) motivo = 'Factor vacío o no es un entero entre 1 y 100 000'
    else if (!(cama >= 1 && cama <= 1000)) motivo = 'Cama vacía o no es un entero entre 1 y 1 000'
    else if (!(altura >= 1 && altura <= 1000)) motivo = 'Altura vacía o no es un entero entre 1 y 1 000'
    else if (totalExcel != null && totalExcel !== cama * altura)
      motivo = `El total del Excel (${totalExcel}) no es cama × altura (${cama} × ${altura} = ${cama * altura})`
    if (motivo) {
      errores.push({ fila, estilo: estilo || String(get(r, 'estilo') ?? ''), motivo })
      continue
    }
    map.set(estilo, { estilo, descripcion, factor, cama, altura })
  }

  const items = [...map.values()]
  return { items, errores, repetidos: total - errores.length - items.length, total }
}

/**
 * Tabla 2 (ingreso): Código/Estilo, Descripción (opcional), Cantidad
 * recibida en UNIDADES y Fecha de vencimiento (opcional). Las filas sin
 * cantidad se ignoran; el mismo estilo repetido se suma (lo hace Supabase).
 * Devuelve { items: [{fila, estilo, descripcion, cantidad, fecha}], errores, vacias, total }.
 */
export async function parseIngresoFile(file) {
  const matrix = await readMatrix(file)
  if (!matrix.length) throw new Error('El archivo está vacío.')

  const isCantidad = (h) => {
    const n = norm(h)
    return n.includes('cant') || n.includes('recib') || n.includes('unidades') || n === 'qty'
  }
  const isFecha = (h) => {
    const n = norm(h)
    return n.includes('fecha') || n.includes('venc') || n === 'fv'
  }
  const found = findHeader(matrix, { cantidad: isCantidad, descripcion: isDescHeader, fecha: isFecha }, ['estilo', 'cantidad'])
  if (!found) {
    throw new Error('No se encontraron los encabezados. El Excel debe tener las columnas: Estilo (o ProductoCodigo) y Cantidad.')
  }

  const { headerIdx, cols } = found
  const items = []
  const errores = []
  let vacias = 0
  let total = 0
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i]
    const rawE = String(r[cols.estilo] ?? '').trim()
    const rawC = r[cols.cantidad]
    if (!rawE && !String(rawC ?? '').trim()) continue
    total++
    const fila = r.fila ?? i + 1
    const estilo = normalizeEstilo(rawE)
    const cantidad = parseEntero(rawC)
    if (cantidad === null) {
      vacias++
      continue
    }
    const rawF = cols.fecha === -1 ? '' : r[cols.fecha]
    const fecha = parseFecha(rawF)
    const descripcion = cols.descripcion === -1 ? '' : String(r[cols.descripcion] ?? '').replace(/\s+/g, ' ').trim()
    let motivo = ''
    if (!isValidEstilo(estilo)) motivo = 'Estilo vacío o no válido'
    else if (!(cantidad >= 1)) motivo = `Cantidad "${String(rawC).trim()}" no es un entero positivo`
    else if (fecha === false) motivo = `Fecha "${String(rawF).trim()}" no es una fecha válida (día/mes/año)`
    if (motivo) {
      errores.push({ fila, estilo: estilo || rawE, motivo })
      continue
    }
    items.push({ fila, estilo, descripcion, cantidad, fecha })
  }
  return { items, errores, vacias, total }
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
