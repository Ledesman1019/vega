// src/components/Notifications.jsx
//
// Centro de notificaciones: campana con contador de no leídas, panel
// con la lista y sonido (campanita de dos tonos) al llegar una nueva.
// Cualquier módulo avisa con:
//   const notify = useNotify()
//   notify({ title: 'Rótulos listos', body: '12 rótulos generados', type: 'success' })
// Las notificaciones se guardan en este equipo (últimas 50).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Bell, BellRing, CheckCheck, CircleCheck, CircleX, Info, TriangleAlert, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { cx } from './ui.jsx'

const STORE_KEY = 'vega-rotulos:notificaciones'
const MUTE_KEY = 'vega-rotulos:notificaciones-silencio'
const MAX = 50

const NotifyContext = createContext(null)

const TYPES = {
  success: { icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-600' },
  error: { icon: CircleX, cls: 'bg-red-50 text-red-600' },
  warning: { icon: TriangleAlert, cls: 'bg-amber-50 text-amber-600' },
  info: { icon: Info, cls: 'bg-sky-50 text-sky-600' },
}

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento */
  }
}

/* ---------- Sonido ---------- */
let audioCtx
const getAudio = () => {
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Los navegadores solo permiten sonido después de un toque/clic del usuario:
// se "despierta" el audio con la primera interacción.
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      getAudio()
    } catch {
      /* sin audio */
    }
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function playNotificationSound() {
  try {
    const ctx = getAudio()
    const now = ctx.currentTime
    // Dos notas (Mi6 → La6) con caída suave, tipo campanita
    ;[
      [1318.5, 0],
      [1760, 0.13],
    ].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + 0.5)
    })
    navigator.vibrate?.([60, 40, 60])
  } catch {
    /* sin audio */
  }
}

/* ---------- Proveedor ---------- */
export function NotificationProvider({ children }) {
  const [items, setItems] = useState(() => load(STORE_KEY, []))
  const [muted, setMuted] = useState(() => load(MUTE_KEY, false))
  const [ring, setRing] = useState(0) // cambia para animar la campana
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  useEffect(() => save(STORE_KEY, items), [items])
  useEffect(() => save(MUTE_KEY, muted), [muted])

  const notify = useCallback(({ title, body = '', type = 'info' }) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, body, type, at: Date.now(), read: false }
    setItems((list) => [item, ...list].slice(0, MAX))
    setRing((n) => n + 1)
    if (!mutedRef.current) playNotificationSound()
  }, [])

  const value = {
    items,
    unread: items.filter((i) => !i.read).length,
    muted,
    ring,
    notify,
    toggleMute: () => setMuted((m) => !m),
    markAllRead: () => setItems((list) => list.map((i) => ({ ...i, read: true }))),
    remove: (id) => setItems((list) => list.filter((i) => i.id !== id)),
    clear: () => setItems([]),
  }

  return <NotifyContext.Provider value={value}>{children}</NotifyContext.Provider>
}

export const useNotifications = () => useContext(NotifyContext)
export const useNotify = () => useContext(NotifyContext).notify

/* ---------- Campana + panel ---------- */
export function NotificationBell({ dark }) {
  const { items, unread, muted, ring, toggleMute, markAllRead, remove, clear } = useNotifications()
  const [open, setOpen] = useState(false)
  const [shake, setShake] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!ring) return
    setShake(true)
    const t = setTimeout(() => setShake(false), 900)
    return () => clearTimeout(t)
  }, [ring])

  // Cerrar al tocar fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (open && unread) markAllRead()
    setOpen((o) => !o)
  }

  const Icon = unread ? BellRing : Bell

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={toggle}
        className={cx(
          'relative flex items-center justify-center rounded-lg transition-colors',
          dark ? 'h-8 w-8 text-white hover:bg-white/10' : 'h-9 w-9 border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
          open && !dark && 'border-zinc-300 bg-zinc-50',
        )}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        title="Notificaciones"
      >
        <Icon className={cx('h-[18px] w-[18px]', shake && 'animate-[bellShake_.9s_ease-in-out]')} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-vega-red px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl animate-[slideUp_.15s_ease-out] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
            <p className="font-bold">Notificaciones</p>
            <div className="flex items-center gap-1">
              <IconBtn onClick={toggleMute} title={muted ? 'Activar sonido' : 'Silenciar'}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </IconBtn>
              {items.length > 0 && (
                <>
                  <IconBtn onClick={markAllRead} title="Marcar todo como leído">
                    <CheckCheck className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn onClick={clear} title="Borrar todas">
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </>
              )}
            </div>
          </div>

          <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
            {items.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-zinc-500">
                <Bell className="h-8 w-8 text-zinc-300" />
                No tienes notificaciones.
              </li>
            )}
            {items.map((n) => {
              const t = TYPES[n.type] || TYPES.info
              return (
                <li key={n.id} className={cx('group flex gap-3 px-4 py-3', !n.read && 'bg-red-50/40')}>
                  <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', t.cls)}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-zinc-400">{timeAgo(n.at)}</p>
                  </div>
                  <button
                    onClick={() => remove(n.id)}
                    className="self-start rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                    aria-label="Quitar notificación"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            onClick={playNotificationSound}
            className="flex items-center justify-center gap-2 border-t border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            <Volume2 className="h-3.5 w-3.5" /> Probar sonido
          </button>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, ...props }) {
  return (
    <button {...props} aria-label={props.title} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
      {children}
    </button>
  )
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'Hace un momento'
  const m = Math.round(s / 60)
  if (m < 60) return `Hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `Hace ${h} h`
  return new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
