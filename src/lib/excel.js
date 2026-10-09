// src/lib/excel.js
//
// Exportar el historial a Excel con ExcelJS (se carga solo cuando se usa,
// para que la app abra rápido).

const VEGA_RED = 'FFE20514'
const VEGA_INK = 'FF16171A'

const loadExcel = () => import('exceljs').then((m) => m.default || m)

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
