// src/lib/router.js
//
// Navegación por hash (#/productos, #/rotulo?estilo=010247, #/historial).
// Funciona en cualquier hosting y offline (PWA) sin configurar rutas.
import { useEffect, useState } from 'react'

export const ROUTES = ['productos', 'rotulo', 'historial']
export const DEFAULT_ROUTE = 'productos'

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  const name = ROUTES.includes(path) ? path : DEFAULT_ROUTE
  return { name, params: Object.fromEntries(new URLSearchParams(qs)) }
}

export function navigate(name, params) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  window.location.hash = `/${name}${qs ? `?${qs}` : ''}`
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
