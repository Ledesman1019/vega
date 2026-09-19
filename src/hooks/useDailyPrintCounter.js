// src/hooks/useDailyPrintCounter.js
import { useEffect, useState } from 'react'
import { todayLocalISO } from '../utils/dateUtils.js'

const COUNT_KEY = 'rotulo-pallet-vega:print-count'
const DATE_KEY  = 'rotulo-pallet-vega:print-date'

// Fecha local (no UTC): con toISOString() el contador se reiniciaba a las 7 pm en Perú.
const today = () => todayLocalISO()

export function useDailyPrintCounter() {
  const [count, setCount] = useState(() => {
    try {
      if (localStorage.getItem(DATE_KEY) !== today()) return 0
      const saved = Number(localStorage.getItem(COUNT_KEY))
      return Number.isFinite(saved) && saved >= 0 ? saved : 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(DATE_KEY, today())
      localStorage.setItem(COUNT_KEY, String(count))
    } catch { /* almacenamiento no disponible */ }
  }, [count])

  return {
    count,
    increment: () => setCount((c) => c + 1),
    reset:     () => setCount(0),
  }
}