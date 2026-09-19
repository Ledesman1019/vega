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