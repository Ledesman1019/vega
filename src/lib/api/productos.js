// src/lib/api/productos.js
import { requireSupabase } from '../supabase.js'

export const SORTS = {
  estilo: { column: 'estilo', label: 'Ordenar por estilo' },
  descripcion: { column: 'descripcion', label: 'Ordenar por descripción' },
  marca: { column: 'marca', label: 'Ordenar por marca' },
  recientes: { column: 'updated_at', ascending: false, label: 'Últimos importados' },
}

// Quita los caracteres que rompen la sintaxis de filtros de PostgREST
export const cleanTerm = (q) => q.replace(/[,()*%"\\]/g, ' ').trim()

/** Normaliza un estilo: sin espacios, mayúsculas y 6 dígitos si es numérico
 *  (Excel suele comerse los ceros de la izquierda: 10247 -> 010247). */
export function normalizeEstilo(value) {
  let s = String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  if (/^\d{1,5}$/.test(s)) s = s.padStart(6, '0')
  return s
}

export const isValidEstilo = (s) => /^[0-9A-Z-]{1,20}$/.test(s)

/** Limpia un código de barras leído del Excel (sin espacios ni ".0"). */
export function normalizeEan(value) {
  let s = String(value ?? '').trim().replace(/\s+/g, '')
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  return s
}

export const isValidEan = (s) => /^\d{8,14}$/.test(s)

/** EAN-13 con dígito verificador correcto (descarta lecturas fallidas). */
export function isValidEan13(value) {
  const s = String(value ?? '').trim()
  if (!/^\d{13}$/.test(s)) return false
  const sum = [...s.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(s[12])
}

/**
 * Código de barras leído con la cámara: EAN-13, EAN-8 o UPC-A (12 dígitos)
 * con el dígito verificador correcto (descarta lecturas fallidas).
 */
export function isValidCodigoBarras(value) {
  const s = String(value ?? '').trim()
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(s)) return false
  const digits = [...s].map(Number)
  const check = digits.pop()
  // Desde la derecha: pesos 3, 1, 3, 1… (igual para los tres formatos)
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10 === check
}

/**
 * El mismo código escrito de otra forma: UPC-A (12) = EAN-13 con un 0
 * adelante, y en el Excel a veces se pierden los ceros de la izquierda
 * (046500005602 quedó como 46500005602). Se prueban todas esas formas.
 */
export function variantesEan(code) {
  const s = String(code ?? '').trim()
  if (!/^\d{12,13}$/.test(s)) return [s]
  const core = s.replace(/^0+/, '')
  const out = [s]
  for (const n of [core.length, 12, 13]) if (n >= core.length && n >= 11) out.push(core.padStart(n, '0'))
  return [...new Set(out)]
}

export async function listProductos({ search = '', marca = '', sort = 'estilo', page = 0, pageSize = 50 }) {
  const sb = requireSupabase()
  const s = SORTS[sort] || SORTS.estilo
  let query = sb
    .from('productos')
    // eans: códigos de barras del estilo (tabla productos_ean, puede haber varios)
    .select('estilo, descripcion, marca, eans:productos_ean(ean)', { count: 'exact' })
    .order(s.column, { ascending: s.ascending ?? true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (s.column !== 'estilo') query = query.order('estilo', { ascending: true })

  const term = cleanTerm(search)
  if (/^\d{8,14}$/.test(term)) {
    // Un código de barras: busca el estilo por su EAN (o por el texto, por si acaso)
    const { data: hits, error: e } = await sb.from('productos_ean').select('estilo').like('ean', `${term}%`).limit(200)
    if (e) throw e
    const estilos = [...new Set((hits || []).map((h) => h.estilo))]
    query = estilos.length
      ? query.or(`estilo.in.(${estilos.map((x) => `"${x}"`).join(',')}),descripcion.ilike."%${term}%"`)
      : query.or(`estilo.ilike."%${term}%",descripcion.ilike."%${term}%"`)
  } else if (term) query = query.or(`estilo.ilike."%${term}%",descripcion.ilike."%${term}%"`)
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

/** Busca el producto por su código de barras (tabla productos_ean). */
export async function getProductoByEan(ean) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('productos_ean')
    .select('producto:productos(estilo, descripcion, marca)')
    .in('ean', variantesEan(ean))
    .limit(1)
  if (error) throw error
  return data[0]?.producto || null
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

/**
 * Importa los códigos de barras con la misma clave (función importar_eans
 * de supabase/04_codigos_barras.sql). codigos: [{ ean, estilo }].
 * Devuelve { nuevos, actualizados, sin_cambios, sin_producto }.
 */
export async function importarEans({ clave, codigos, aplicar }) {
  const sb = requireSupabase()
  const BATCH = 1000
  const total = { nuevos: 0, actualizados: 0, sin_cambios: 0, sin_producto: 0 }
  for (let i = 0; i < codigos.length; i += BATCH) {
    const { data, error } = await sb.rpc('importar_eans', {
      p_clave: clave,
      p_codigos: codigos.slice(i, i + BATCH),
      p_aplicar: aplicar,
    })
    if (error) throw error
    for (const k of Object.keys(total)) total[k] += data[k] ?? 0
  }
  return total
}

/**
 * Borra TODOS los productos y sus EAN (función eliminar_base_productos de
 * supabase/11_eliminar_base_productos.sql). Exige la clave y la palabra
 * ELIMINAR. Devuelve { productos, eans } borrados.
 */
export async function eliminarBaseProductos({ clave, confirmacion }) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('eliminar_base_productos', { p_clave: clave, p_confirmacion: confirmacion })
  if (error) throw error
  return data
}
