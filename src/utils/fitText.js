// src/utils/fitText.js
//
// Auto-ajusta el font-size de un texto para que llene su caja (ancho
// y alto) sin desbordarse, sin importar cuántos caracteres tenga
// el contenido (código de 6 dígitos, fecha "10/09/2027", cantidad...).
//
// CÓMO MIDE (importante, es lo que se arregló en esta versión):
// en vez de medir el propio contenedor flex (cuyo scrollWidth puede
// no reflejar el ancho real del texto según el navegador, si el
// texto vive dentro de un <span> forzado a width:100%), este método
// mide DIRECTAMENTE el elemento de texto (`.autofit-text`), que no
// tiene ancho forzado (display:inline-block, se ajusta a su
// contenido) y lo compara contra el tamaño fijo del contenedor
// (`.autofit-box`). offsetWidth/offsetHeight del texto = su tamaño
// real renderizado a ese font-size, sin ambigüedad.

const MIN_FONT_PX = 8
const MAX_FONT_PX = 400
const SAFETY_MARGIN = 0.985 // pequeño margen para que nunca toque el borde

/**
 * Ajusta el font-size de `textEl` para que quepa dentro de las
 * dimensiones actuales de `container`, mediante búsqueda binaria.
 */
export function fitText(container, textEl, { min = MIN_FONT_PX, max = MAX_FONT_PX } = {}) {
  if (!container || !textEl) return

  const targetWidth = container.clientWidth * SAFETY_MARGIN
  const targetHeight = container.clientHeight * SAFETY_MARGIN

  if (targetWidth <= 0 || targetHeight <= 0) return

  let lo = min
  let hi = max
  let best = min

  // Búsqueda binaria: ~20 iteraciones alcanzan precisión de ~0.5px
  for (let i = 0; i < 20 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2
    textEl.style.fontSize = `${mid}px`

    const fits = textEl.offsetWidth <= targetWidth && textEl.offsetHeight <= targetHeight

    if (fits) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }

  textEl.style.fontSize = `${best}px`
}

/**
 * Ajusta todas las cajas marcadas con `.autofit-box` dentro de `root`.
 * Cada caja debe contener, en algún nivel, UN elemento `.autofit-text`
 * (el texto real a medir/ajustar).
 */
export function fitAll(root) {
  if (!root) return
  const boxes = root.querySelectorAll('.autofit-box')
  boxes.forEach((box) => {
    const textEl = box.querySelector('.autofit-text')
    if (textEl) fitText(box, textEl)
  })
}