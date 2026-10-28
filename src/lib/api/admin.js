// src/lib/api/admin.js
//
// Acceso de administrador sin login: se valida la misma clave de la
// importación (función verificar_clave de supabase/05_acceso_admin.sql).
// La sesión vive solo en memoria: al recargar o cerrar la app se vuelve
// a pedir la clave. La clave queda guardada para las operaciones del
// módulo que la exijan en Supabase.
import { useSyncExternalStore } from 'react'
import { requireSupabase } from '../supabase.js'

// Se bloquea solo tras este tiempo sin actividad en el módulo
const IDLE_MS = 30 * 60 * 1000

let session = null // { clave, lastActive }
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

export async function unlockAdmin(clave) {
  const sb = requireSupabase()
  const { error } = await sb.rpc('verificar_clave', { p_clave: clave })
  if (error) throw error
  session = { clave, lastActive: Date.now() }
  emit()
}

export function lockAdmin() {
  session = null
  emit()
}

/** Bloquea si pasó el tiempo sin actividad. */
export function expireIfIdle() {
  if (session && Date.now() - session.lastActive > IDLE_MS) lockAdmin()
}

/** Marca actividad del administrador (reinicia el tiempo de bloqueo). */
export function touchAdmin() {
  expireIfIdle()
  if (session) session.lastActive = Date.now()
}

/** Clave vigente (para enviarla a las funciones protegidas) o null. */
export function getAdminClave() {
  expireIfIdle()
  if (!session) return null
  session.lastActive = Date.now()
  return session.clave
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAdminUnlocked() {
  return useSyncExternalStore(subscribe, () => !!session)
}
