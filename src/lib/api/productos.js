// src/lib/api/productos.js
import { requireSupabase } from '../supabase.js'

export const SORTS = {
  estilo: { column: 'estilo', label: 'Ordenar por estilo' },
  descripcion: { column: 'descripcion', label: 'Ordenar por descripción' },
  marca: { column: 'marca', label: 'Ordenar por marca' },
  recientes: { column: 'updated_at', ascending: false, label: 'Últimos importados' },
}

// Quita los caracteres que rompen la sintaxis de filtros de PostgREST
const cleanTerm = (q) => q.replace(/[,()*%"\\]/g, ' ').trim()

/** Normaliza un estilo: sin espacios, mayúsculas y 6 dígitos si es numérico
 *  (Excel suele comerse los ceros de la izquierda: 10247 -> 010247). */
export function normalizeEstilo(value) {
  let s = String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  if (/^\d{1,5}$/.test(s)) s = s.padStart(6, '0')
  return s
}

export const isValidEstilo = (s) => /^[0-9A-Z-]{1,20}$/.test(s)

export async function listProductos({ search = '', marca = '', sort = 'estilo', page = 0, pageSize = 50 }) {
  const sb = requireSupabase()
  const s = SORTS[sort] || SORTS.estilo
  let query = sb
    .from('productos')
    .select('estilo, descripcion, marca', { count: 'exact' })
    .order(s.column, { ascending: s.ascending ?? true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (s.column !== 'estilo') query = query.order('estilo', { ascending: true })

  const term = cleanTerm(search)
  if (term) query = query.or(`estilo.ilike."%${term}%",descripcion.ilike."%${term}%"`)
  if (marca) query = query.eq('marca', marca)

  const { data, count, error } = await query
  if (error) throw error
  return { rows: data || [], count: count ?? 0 }
}

export async function countProductos() {
  const sb = requireSupabase()
  const { count, error } = await sb.from('productos').select('estilo', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function listMarcas() {
  const sb = requireSupabase()
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('productos_marcas').select('marca, total').range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  return all
}

export async function getProducto(estilo) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('productos')
    .select('estilo, descripcion, marca')
    .eq('estilo', normalizeEstilo(estilo))
    .maybeSingle()
  if (error) throw error
  return data
}

/** Sugerencias para el buscador del rótulo (por estilo o descripción). */
export async function suggestProductos(q, limit = 8) {
  const term = cleanTerm(q)
  if (!term) return []
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('productos')
    .select('estilo, descripcion, marca')
    .or(`estilo.ilike."${term}%",descripcion.ilike."%${term}%"`)
    .order('estilo')
    .limit(limit)
  if (error) throw error
  return data || []
}

/**
 * Descarga toda la base para exportar. Exige la clave de administrador
 * (función exportar_productos de supabase/03_exportar_con_clave.sql).
 */
export async function exportarProductos(clave) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('exportar_productos', { p_clave: clave })
  if (error) throw error
  return data || []
}

/**
 * Importa con la clave de administrador (función importar_productos de
 * supabase/02_importar_con_clave.sql). Nunca duplica: agrega estilos
 * nuevos, actualiza los que cambiaron de descripción y no toca el resto.
 * aplicar=false solo cuenta (vista previa).
 * Devuelve { nuevos, actualizados, sin_cambios }.
 */
export async function importarProductos({ clave, rows, aplicar, onProgress }) {
  const sb = requireSupabase()
  const BATCH = 1000
  const total = { nuevos: 0, actualizados: 0, sin_cambios: 0 }
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await sb.rpc('importar_productos', {
      p_clave: clave,
      p_productos: rows.slice(i, i + BATCH),
      p_aplicar: aplicar,
    })
    if (error) throw error
    total.nuevos += data.nuevos
    total.actualizados += data.actualizados
    total.sin_cambios += data.sin_cambios
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length)
  }
  return total
}
