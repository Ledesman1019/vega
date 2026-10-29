// src/lib/api/automatico.js
//
// Rótulo automático (supabase/06_rotulo_automatico.sql). Leer es libre;
// todo cambio usa la clave de la sesión de administrador. Los cálculos
// (pallets, saldo) los hace Supabase con enteros.
import { requireSupabase } from '../supabase.js'
import { getAdminClave, lockAdmin } from './admin.js'

const cleanTerm = (q) => q.replace(/[,()*%"\\]/g, ' ').trim()

function clave() {
  const c = getAdminClave()
  if (!c) throw new Error('La sesión de administrador se cerró. Vuelve a ingresar la clave.')
  return c
}

async function rpc(name, args) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc(name, { p_clave: clave(), ...args })
  if (error) {
    if (error.code === '28P01') lockAdmin() // la clave cambió
    throw error
  }
  return data
}

/* ---------- Paletizado ---------- */

export async function listPaletizado({ search = '', page = 0, pageSize = 50 }) {
  const sb = requireSupabase()
  let query = sb
    .from('paletizado')
    .select('*', { count: 'exact' })
    .order('estilo')
    .range(page * pageSize, page * pageSize + pageSize - 1)
  const term = cleanTerm(search)
  if (term) query = query.or(`estilo.ilike."%${term}%",descripcion.ilike."%${term}%"`)
  const { data, count, error } = await query
  if (error) throw error
  return { rows: data || [], count: count ?? 0 }
}

export async function getPaletizado(estilo) {
  const sb = requireSupabase()
  const { data, error } = await sb.from('paletizado').select('*').eq('estilo', estilo).maybeSingle()
  if (error) throw error
  return data
}

/** items: [{ estilo, descripcion, factor, cama, altura }] (en lotes de 1000). */
export async function guardarPaletizado({ items, aplicar, onProgress }) {
  const BATCH = 1000
  const total = { nuevos: 0, actualizados: 0, sin_cambios: 0, invalidos: 0 }
  for (let i = 0; i < items.length; i += BATCH) {
    const data = await rpc('guardar_paletizado', { p_items: items.slice(i, i + BATCH), p_aplicar: aplicar })
    for (const k of Object.keys(total)) total[k] += data[k] ?? 0
    onProgress?.(Math.min(i + BATCH, items.length), items.length)
  }
  return total
}

export const borrarPaletizado = (estilo) => rpc('borrar_paletizado', { p_estilo: estilo })

/* ---------- Ingresos ---------- */

/**
 * items: [{ estilo, cantidad }] en UNIDADES. aplicar=false solo calcula.
 * Devuelve { ingreso_id, productos, rotulos, invalidos, detalle: [...] }.
 */
export const registrarIngreso = ({ items, nota, aplicar }) =>
  rpc('registrar_ingreso', { p_items: items, p_nota: nota || null, p_aplicar: aplicar })

export async function listIngresos({ page = 0, pageSize = 20 }) {
  const sb = requireSupabase()
  const { data, count, error } = await sb
    .from('ingresos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { rows: data || [], count: count ?? 0 }
}

/** Filas del Excel de un ingreso (estilo, descripción, cantidad, FV). */
export async function listIngresoDetalle(ingresoId) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('ingresos_detalle')
    .select('*')
    .eq('ingreso_id', ingresoId)
    .order('id')
  if (error) throw error
  return data || []
}

/** Borra el ingreso y su detalle. Los rótulos ya generados se conservan. */
export const eliminarIngreso = (id) => rpc('eliminar_ingreso', { p_id: id })

/* ---------- Rótulos automáticos ---------- */

export async function listRotulosAuto({ estado = 'pendiente', limit = 500 }) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('rotulos_automaticos')
    .select('*')
    .eq('estado', estado)
    .order(estado === 'impreso' ? 'impreso_at' : 'created_at', { ascending: false })
    .order('estilo')
    .order('pallet_num')
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function countPendientes() {
  const sb = requireSupabase()
  const { count, error } = await sb
    .from('rotulos_automaticos')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')
  if (error) throw error
  return count ?? 0
}

/** Fecha de vencimiento y/o estado (pendiente | impreso | anulado). */
export const actualizarRotulosAuto = ({ ids, fecha = null, estado = null }) =>
  rpc('actualizar_rotulos_auto', { p_ids: ids, p_fecha: fecha, p_estado: estado })
