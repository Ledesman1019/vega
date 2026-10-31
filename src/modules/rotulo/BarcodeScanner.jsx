// src/modules/rotulo/BarcodeScanner.jsx
//
// Escáner de códigos de barras (EAN-13, EAN-8 y UPC-A) con la cámara del celular.
// Usa el detector nativo del navegador (Chrome/Android) cuando existe y,
// si no, ZXing (iPhone, Firefox…), que se descarga solo al abrir el escáner.
// Solo lee la franja del recuadro (así no toma el código del producto de
// al lado) y exige dos lecturas iguales seguidas con dígito verificador
// correcto antes de buscar el producto.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CameraOff, CircleX, Flashlight, FlashlightOff, Keyboard, LoaderCircle, ScanBarcode, Search, X } from 'lucide-react'
import { cx } from '../../components/ui.jsx'
import { isValidCodigoBarras, variantesEan } from '../../lib/api/productos.js'

// Recuadro de lectura, en proporción del video
const CROP = { w: 0.86, h: 0.36 }
const MAX_CANVAS_W = 960

export default function BarcodeScanner({ open, onClose, onLookup, onFound }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const pausedRef = useRef(false)
  const [state, setState] = useState('starting') // starting | scanning | searching | notfound | error
  const [message, setMessage] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [torch, setTorch] = useState(null) // null = la cámara no tiene linterna
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)

  // Busca el código en la base; si no existe sigue escaneando
  const handleCode = async (code) => {
    pausedRef.current = true
    setLastCode(code)
    setState('searching')
    feedback()
    try {
      // UPC-A puede leerse con 12 o 13 dígitos: se prueban ambas formas
      for (const variante of variantesEan(code)) {
        const producto = await onLookup(variante)
        if (producto) {
          onFound(producto, variante)
          return
        }
      }
      setState('notfound')
      setMessage('')
    } catch (e) {
      setState('notfound')
      setMessage(e.message || String(e))
    }
    // Deja ver el aviso un momento antes de volver a leer
    setTimeout(() => {
      pausedRef.current = false
    }, 1500)
  }
  const handleCodeRef = useRef(handleCode)
  handleCodeRef.current = handleCode

  useEffect(() => {
    if (!open) return
    let alive = true
    let timer = 0
    let stream = null
    pausedRef.current = false
    setState('starting')
    setMessage('')
    setLastCode('')
    setTorch(null)
    setManual('')
    setShowManual(false)

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error(), { name: 'Insecure' })
      }
      const [s, decode] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        }),
        createDecoder(),
      ])
      stream = s
      if (!alive) return
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      const caps = track.getCapabilities?.() || {}
      if (caps.focusMode?.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
      }
      if (caps.torch) setTorch(false)
      setState('scanning')

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      let previous = ''

      const tick = async () => {
        if (!alive) return
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          const sw = video.videoWidth * CROP.w
          const sh = video.videoHeight * CROP.h
          const scale = Math.min(1, MAX_CANVAS_W / sw)
          canvas.width = Math.round(sw * scale)
          canvas.height = Math.round(sh * scale)
          ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
          const code = await decode(canvas)
          if (code && isValidCodigoBarras(code)) {
            if (code === previous && alive && !pausedRef.current) {
              previous = ''
              handleCodeRef.current(code)
            } else previous = code
          } else if (!code) previous = ''
        }
        timer = setTimeout(tick, 60)
      }
      tick()
    }

    start().catch((e) => {
      if (!alive) return
      setState('error')
      setMessage(cameraError(e))
    })

    return () => {
      alive = false
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
    }
  }, [open])

  // Escape cierra; sin scroll del fondo mientras está abierto
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const toggleTorch = () => {
    const next = !torch
    trackRef.current
      ?.applyConstraints({ advanced: [{ torch: next }] })
      .then(() => setTorch(next))
      .catch(() => setTorch(null))
  }

  const submitManual = (e) => {
    e.preventDefault()
    const code = manual.trim()
    if (!isValidCodigoBarras(code)) {
      setState('notfound')
      setLastCode(code)
      setMessage('El código debe tener 8, 12 o 13 dígitos y ser válido (revisa el último dígito).')
      return
    }
    handleCode(code)
  }

  if (!open) return null

  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full flex-col overflow-hidden bg-zinc-950 text-white shadow-2xl sm:max-w-xl sm:rounded-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vega-red">
              <ScanBarcode className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold">Escanear código de barras</h3>
              <p className="truncate text-xs text-zinc-400">Apunta al código de barras del producto</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cámara */}
        <div className="relative flex-1 bg-black sm:aspect-[4/3] sm:flex-none">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />

          {state !== 'error' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cx(
                  'relative rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 transition-colors',
                  state === 'notfound' ? 'ring-amber-400' : state === 'searching' ? 'ring-emerald-400' : 'ring-white/90',
                )}
                style={{ width: `${CROP.w * 100}%`, height: `${CROP.h * 100}%` }}
              >
                {state === 'scanning' && (
                  <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-vega-red shadow-[0_0_12px_2px_rgba(226,5,20,0.8)]" />
                )}
              </div>
            </div>
          )}

          {state === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-zinc-300">
              <LoaderCircle className="h-7 w-7 animate-spin" />
              Abriendo la cámara…
            </div>
          )}

          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <CameraOff className="h-10 w-10 text-zinc-500" />
              <p className="text-sm text-zinc-300">{message}</p>
            </div>
          )}

          {torch !== null && (
            <button
              onClick={toggleTorch}
              className={cx(
                'absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full backdrop-blur',
                torch ? 'bg-amber-400 text-zinc-900' : 'bg-white/15 text-white',
              )}
              aria-label={torch ? 'Apagar linterna' : 'Encender linterna'}
            >
              {torch ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* Estado + ingreso manual */}
        <div className="space-y-3 px-4 py-4">
          <Status state={state} code={lastCode} message={message} />

          {showManual ? (
            <form onSubmit={submitManual} className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 13))}
                inputMode="numeric"
                placeholder="Código de 8, 12 o 13 dígitos"
                className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 font-mono text-base tracking-wider text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-500 focus:border-white/40"
                autoFocus
              />
              <button
                type="submit"
                disabled={![8, 12, 13].includes(manual.length) || state === 'searching'}
                className="flex h-11 items-center gap-2 rounded-lg bg-vega-red px-4 text-sm font-bold disabled:opacity-40"
              >
                <Search className="h-4 w-4" /> Buscar
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowManual(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <Keyboard className="h-4 w-4" /> ¿No lee? Escribe el código
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Status({ state, code, message }) {
  if (state === 'searching')
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-emerald-300">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Buscando <b className="font-mono">{code}</b>…
      </p>
    )
  if (state === 'notfound')
    return (
      <p className="flex items-start justify-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-center text-sm text-amber-300">
        <CircleX className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {message || (
            <>
              El código <b className="font-mono">{code}</b> no está registrado en la base de productos.
            </>
          )}
        </span>
      </p>
    )
  if (state === 'scanning')
    return <p className="text-center text-sm text-zinc-400">Centra el código en el recuadro y mantén el celular quieto.</p>
  return null
}

/** Devuelve una función (canvas) => texto del código o null. */
async function createDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats()
      const usar = ['ean_13', 'ean_8', 'upc_a'].filter((x) => formats.includes(x))
      if (usar.includes('ean_13')) {
        const detector = new window.BarcodeDetector({ formats: usar })
        return async (canvas) => {
          try {
            const found = await detector.detect(canvas)
            return found[0]?.rawValue || null
          } catch {
            return null
          }
        }
      }
    } catch {
      /* sin detector nativo: se usa ZXing */
    }
  }

  const [{ MultiFormatReader, BarcodeFormat, DecodeHintType, BinaryBitmap, HybridBinarizer }, { HTMLCanvasElementLuminanceSource }] =
    await Promise.all([import('@zxing/library'), import('@zxing/browser')])
  const reader = new MultiFormatReader()
  reader.setHints(
    new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
      [DecodeHintType.TRY_HARDER, true],
    ]),
  )
  return async (canvas) => {
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)))
      return reader.decodeWithState(bitmap).getText()
    } catch {
      return null
    }
  }
}

function cameraError(e) {
  if (e?.name === 'Insecure') return 'La cámara solo funciona si la app se abre con https:// (o en localhost).'
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError')
    return 'No hay permiso para usar la cámara. Actívalo en la configuración del navegador (ícono del candado junto a la dirección) y vuelve a intentarlo.'
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No se encontró una cámara en este equipo.'
  if (e?.name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentarlo.'
  return `No se pudo abrir la cámara: ${e?.message || e}`
}

// Vibración + "bip" corto al leer un código
let audioCtx
function feedback() {
  try {
    navigator.vibrate?.(80)
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.frequency.value = 1800
    gain.gain.value = 0.08
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.09)
  } catch {
    /* sin audio */
  }
}
