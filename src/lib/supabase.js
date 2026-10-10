// src/lib/supabase.js
//
// Cliente único de Supabase. La URL y la anon key vienen del .env
// (SUPABASE_URL / SUPABASE_ANON_KEY) a través de vite.config.js.
import { createClient } from '@supabase/supabase-js'

/* global __SUPABASE_URL__, __SUPABASE_ANON_KEY__ */
const url = __SUPABASE_URL__
const anonKey = __SUPABASE_ANON_KEY__

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null

// Convierte los errores de Supabase/PostgREST en mensajes entendibles.
export function friendlyError(error) {
  if (!error) return 'Error desconocido.'
  const msg = String(error.message || error)
  if (!isSupabaseConfigured) return 'Supabase no está configurado (.env).'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.'
  if (error.code === 'PGRST202' || /importar_productos/i.test(msg)) return 'Falta la función de importar en Supabase. Ejecuta supabase/02_importar_con_clave.sql.'
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(msg))
    return 'Faltan las tablas en Supabase. Ejecuta supabase/01_schema.sql en el SQL Editor.'
  if (error.code === '28P01' || /Clave incorrecta/i.test(msg)) return 'Clave incorrecta.'
  if (error.code === '23505') return 'Ese estilo ya existe en la base.'
  if (error.code === '23514') return 'Datos no válidos (revisa el estilo y la descripción).'
  if (error.code === '42501') return 'Permiso denegado por Supabase (RLS). Vuelve a ejecutar 01_schema.sql.'
  return msg
}

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado. Completa SUPABASE_URL y SUPABASE_ANON_KEY en el .env y reinicia "npm run dev".')
  return supabase
}
