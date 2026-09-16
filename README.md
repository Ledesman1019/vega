# Rótulo de Pallet · VEGA

App sencilla para generar rótulos de identificación de pallets: formulario (Código/Producto,
Fecha de vencimiento, Cantidad de cajas) + vista previa + impresión/PDF a hoja completa (A4),
en vertical u horizontal. Instalable como PWA en teléfono, laptop y PC.

## Probar en tu computadora

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente http://localhost:5173).

## Publicar en Vercel

1. Sube esta carpeta a un repositorio de GitHub (crea uno nuevo y haz push de todos estos archivos).
2. Entra a https://vercel.com → "Add New… → Project" → importa ese repositorio.
3. Vercel detecta Vite automáticamente:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Dale a "Deploy". En un par de minutos tendrás la URL pública (ej. `rotulo-pallet.vercel.app`).

No necesitas configurar nada más: no hay backend, todo corre en el navegador.

## Cómo se usa

1. Llena el código/producto, la fecha de vencimiento y la cantidad de cajas.
2. Elige orientación **Vertical** u **Horizontal**.
3. Revisa la vista previa a la derecha.
4. Pulsa **"Imprimir / Guardar PDF"**:
   - Se abre el diálogo de impresión del navegador con el rótulo ocupando toda la hoja.
   - Para guardarlo como PDF, elige "Guardar como PDF" en el destino de la impresora
     (funciona igual en Windows, Mac, Android y iPhone).

## Instalar como app (PWA)

- **En el teléfono (Android/Chrome):** aparecerá un aviso para "Instalar"; también puedes
  usar el menú del navegador → "Agregar a pantalla de inicio".
- **En PC/laptop (Chrome/Edge):** aparece un ícono de instalación en la barra de direcciones,
  o usa el aviso que sale en la propia app.
- **iPhone (Safari):** botón compartir → "Agregar a pantalla de inicio".

Una vez instalada funciona sin conexión a internet (los datos del último rótulo quedan
guardados en el dispositivo).

## Cambiar el logo

El logo de VEGA está en `public/logo-vega.png` (y sus variantes `icon-192.png`,
`icon-512.png`, `apple-touch-icon.png`, `favicon-16.png`, `favicon-32.png` para los
distintos tamaños de ícono en teléfono, laptop y PC). Para cambiarlo, reemplaza esos
archivos por versiones nuevas del logo con el mismo nombre.

## Estructura del proyecto

```
├── public/              logo e íconos en distintos tamaños
├── src/
│   ├── components/
│   │   ├── PalletForm.jsx    formulario de datos
│   │   └── PalletLabel.jsx   diseño del rótulo (vista previa + impresión)
│   ├── App.jsx                lógica principal (estado, validación, impresión, PWA)
│   ├── index.css               estilos
│   └── main.jsx
├── index.html
└── vite.config.js              configuración de Vite + PWA
```
