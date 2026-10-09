// src/lib/api/historial.js
import { requireSupabase } from '../supabase.js'

const cleanTerm = (q) => q.replace(/[,()*%"\\]/g, ' ').trim()

/** Registra una impresión o descarga. No bloquea la acción si falla. */
export async function registrarRotulo({ estilo, descripcion, fecha, cantidad, accion, papel }) {
  const sb = requireSupabase()
  const { error } = await sb.from('rotulos_historial').insert({
    estilo,
    descripcion,
    fecha_vencimiento: fecha,
    cantidad: Number(cantidad),
    accion,
    papel,
  })
  if (error) throw error
}

// Inicio/fin de un día LOCAL (Perú) convertido a ISO para filtrar created_at
const dayStart = (iso) => new Date(`${iso}T00:00:00`).toISOString()
const dayEnd = (iso) => new Date(`${iso}T23:59:59.999`).toISOString()

function applyFilters(query, { search, accion, desde, hasta }) {
  const term = cleanTerm(search || '')
  if (term) query = query.or(`estilo.ilike."%${term}%",descripcion.ilike."%${term}%"`)
  if (accion) query = query.eq('accion', accion)
  if (desde) query = query.gte('created_at', dayStart(desde))
  if (hasta) query = query.lte('created_at', dayEnd(hasta))
  return query
}

export async function listHistorial({ page = 0, pageSize = 50, ...filters }) {
  const sb = requireSupabase()
  let query = sb
    .from('rotulos_historial')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  query = applyFilters(query, filters)
  const { data, count, error } = await query
  if (error) throw error
  return { rows: data || [], count: count ?? 0 }
}

async function countWhere(filters) {
  const sb = requireSupabase()
  const query = applyFilters(sb.from('rotulos_historial').select('id', { count: 'exact', head: true }), filters)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

/** Resumen para las tarjetas: hoy, impresos y descargados (según filtros). */
export async function resumenHistorial(filters, hoyIso) {
  const [total, impresos, descargados, hoy] = await Promise.all([
    countWhere(filters),
    countWhere({ ...filters, accion: 'impreso' }),
    countWhere({ ...filters, accion: 'descargado' }),
    countWhere({ desde: hoyIso, hasta: hoyIso }),
  ])
  return { total, impresos, descargados, hoy }
}

export async function fetchAllHistorial(filters) {
  const sb = requireSupabase()
  const all = []
  for (let from = 0; ; from += 1000) {
    let query = sb
      .from('rotulos_historial')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    query = applyFilters(query, filters)
    const { data, error } = await query
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  return all
}
