// src/hooks/useDebounce.js
// Valor con retraso: evita consultar Supabase en cada tecla.
import { useEffect, useState } from 'react'

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
