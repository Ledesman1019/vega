// src/lib/api/consulta.js
//
// Módulo Consulta (solo lectura, sin clave): busca por descripción,
// estilo o EAN y junta lo de productos (descripción y EAN) con lo de
// paletizado (cama, altura y total).
import { requireSupabase } from '../supabase.js'
import { cleanTerm, normalizeEstilo } from './productos.js'

const LIMIT = 30
const quote = (list) => `(${list.map((x) => `"${x}"`).join(',')})`

/**
 * Devuelve [{ estilo, descripcion, eans: [..], cama, altura, total }]
 * (cama/altura/total en null si el producto no tiene paletizado).
 */
export async function consultarProductos(q) {
  const term = cleanTerm(q)
  if (!term) return []
  const sb = requireSupabase()
  const words = term.split(/\s+/).filter(Boolean)

  // Filtro común para productos y paletizado
  let estilosEan = []
  if (/^\d{8,14}$/.test(term)) {
    const { data, error } = await sb.from('productos_ean').select('estilo').like('ean', `${term}%`).limit(50)
    if (error) throw error
    estilosEan = [...new Set(data.map((d) => d.estilo))]
  }
  const apply = (query) => {
    // Varias palabras: la descripción debe tener TODAS (ej. "angel zuck")
    if (words.length > 1) return words.reduce((qq, w) => qq.ilike('descripcion', `%${w}%`), query)
    const ors = [`estilo.ilike."${term}%"`, `descripcion.ilike."%${term}%"`]
    const est = normalizeEstilo(term)
    if (est !== term.toUpperCase()) ors.push(`estilo.eq."${est}"`) // 10185 -> 010185
    if (estilosEan.length) ors.push(`estilo.in.${quote(estilosEan)}`)
    return query.or(ors.join(','))
  }

  const [prods, pals] = await Promise.all([
    apply(sb.from('productos').select('estilo, descripcion, eans:productos_ean(ean)')).order('estilo').limit(LIMIT),
    apply(sb.from('paletizado').select('estilo, descripcion, cama, altura, total')).order('estilo').limit(LIMIT),
  ])
  if (prods.error) throw prods.error
  if (pals.error) throw pals.error

  const map = new Map()
  for (const p of prods.data) map.set(p.estilo, { estilo: p.estilo, descripcion: p.descripcion, eans: p.eans.map((e) => e.ean), cama: null, altura: null, total: null })
  for (const p of pals.data) {
    const cur = map.get(p.estilo) || { estilo: p.estilo, descripcion: p.descripcion, eans: [] }
    map.set(p.estilo, { ...cur, cama: p.cama, altura: p.altura, total: p.total })
  }

  // Completa lo que falte de la otra tabla (paletizado de productos encontrados, EAN de paletizados)
  const sinPal = [...map.values()].filter((x) => x.total == null).map((x) => x.estilo)
  const sinEan = [...map.values()].filter((x) => !x.eans.length).map((x) => x.estilo)
  const [extraPal, extraEan] = await Promise.all([
    sinPal.length ? sb.from('paletizado').select('estilo, cama, altura, total').in('estilo', sinPal) : { data: [] },
    sinEan.length ? sb.from('productos_ean').select('estilo, ean').in('estilo', sinEan) : { data: [] },
  ])
  if (extraPal.error) throw extraPal.error
  if (extraEan.error) throw extraEan.error
  for (const p of extraPal.data) Object.assign(map.get(p.estilo), { cama: p.cama, altura: p.altura, total: p.total })
  for (const e of extraEan.data) map.get(e.estilo).eans.push(e.ean)

  // Primero las coincidencias exactas de estilo o EAN
  const exact = (x) => x.estilo === normalizeEstilo(term) || x.eans.includes(term)
  return [...map.values()].sort((a, b) => exact(b) - exact(a) || a.estilo.localeCompare(b.estilo)).slice(0, LIMIT)
}

/** Para el escáner: el producto de ese EAN (o null). */
export async function consultarPorEan(ean) {
  const list = await consultarProductos(ean)
  return list.find((x) => x.eans.includes(ean)) || null
}
