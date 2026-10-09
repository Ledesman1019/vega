// src/utils/dateUtils.js
//
// Fecha de HOY en la zona horaria LOCAL del equipo, formato YYYY-MM-DD
// (el que usa <input type="date">).
//
// ⚠️ No usar new Date().toISOString().slice(0, 10): eso devuelve la
// fecha en UTC. En Perú (UTC-5), a partir de las 7:00 pm ya devuelve
// el día siguiente.
export function todayLocalISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
// YYYY-MM-DD -> DD/MM/YYYY
export function formatFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

// timestamp -> { fecha: '09/10/2026', hora: '14:35' } en hora local
export function formatFechaHora(ts) {
  const d = new Date(ts)
  return {
    fecha: d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
  }
}
