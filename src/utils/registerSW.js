// src/utils/registerSW.js
//
// Registra el service worker y hace que la app se ACTUALICE sola:
//  - busca una versión nueva al volver a la pestaña y cada 30 min
//  - cuando el service worker nuevo toma el control, recarga la página
//    una vez (así nadie se queda con una versión vieja).
export function registerSW() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      // Si ya había un SW controlando la página, un "controllerchange"
      // significa que hay versión nueva. Si no lo había, es la primera
      // instalación y no hace falta recargar.
      const hadController = !!navigator.serviceWorker.controller

      const reg = await navigator.serviceWorker.register('/sw.js')

      const checkForUpdate = () => reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      setInterval(checkForUpdate, 30 * 60 * 1000)

      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return
        reloading = true
        window.location.reload()
      })
    } catch (err) {
      console.warn('No se pudo registrar el service worker:', err)
    }
  })
}