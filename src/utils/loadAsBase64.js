// src/utils/loadAsBase64.js
//
// Convierte un archivo servido por la app (la fuente .ttf, el logo
// .png) a base64 en el navegador. Se usa para poder registrar la
// fuente real dentro del PDF con jsPDF (doc.addFileToVFS), en vez de
// pegar un string base64 gigante fijo en el código fuente.

export async function fetchAsBase64(url) {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let binary = ''
  const CHUNK = 0x8000 // evitar "Maximum call stack size exceeded" con archivos grandes
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }

  return btoa(binary)
}

export async function fetchAsDataUrl(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}