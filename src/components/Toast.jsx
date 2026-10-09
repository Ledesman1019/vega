// src/components/Toast.jsx
// Avisos flotantes (éxito / error / info).
import { createContext, useCallback, useContext, useState } from 'react'
import { CircleCheck, CircleX, Info, X } from 'lucide-react'

const ToastContext = createContext(() => {})

const STYLES = {
  success: { icon: CircleCheck, cls: 'text-emerald-600' },
  error: { icon: CircleX, cls: 'text-red-600' },
  info: { icon: Info, cls: 'text-sky-600' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message, type = 'success', ms = 4000) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((t) => [...t.slice(-3), { id, message, type }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type] || STYLES.info
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-xl animate-[slideUp_.2s_ease-out]"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="text-zinc-400 hover:text-zinc-700" aria-label="Cerrar aviso">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
