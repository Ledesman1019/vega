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

export async function addProducto({ estilo, descripcion }) {
  const sb = requireSupabase()
  const { error } = await sb.from('productos').insert({ estilo: normalizeEstilo(estilo), descripcion: descripcion.trim() })
  if (error) throw error
}

/** Inserta o actualiza (por estilo) en lotes. onProgress(hechos, total). */
export async function upsertProductos(rows, onProgress) {
  const sb = requireSupabase()
  const BATCH = 1000
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await sb.from('productos').upsert(chunk, { onConflict: 'estilo' })
    if (error) throw error
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length)
  }
}

/** Descarga toda la base (en páginas de 1000, el máximo de la API). */
export async function fetchAllProductos(onProgress) {
  const sb = requireSupabase()
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('productos')
      .select('estilo, descripcion, marca')
      .order('estilo')
      .range(from, from + 999)
    if (error) throw error
    all.push(...data)
    onProgress?.(all.length)
    if (data.length < 1000) break
  }
  return all
}

export async function vaciarProductos() {
  const sb = requireSupabase()
  const { error } = await sb.rpc('vaciar_productos')
  if (error) throw error
}
