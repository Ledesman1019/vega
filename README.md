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

## Escáner de códigos de barras (EAN-13)

En **Crear rótulo**, el botón **Escanear** abre la cámara del celular: al leer un EAN-13
busca el producto y llena el estilo y la descripción. También acepta escribir el código
de 13 dígitos en el campo de estilo (sirve con lectoras USB/Bluetooth).

1. Ejecuta `supabase/04_codigos_barras.sql` en Supabase > SQL Editor (crea la tabla
   `productos_ean`; un estilo puede tener varios códigos).
2. Carga los códigos con **Productos → Importar Excel**: agrega una columna `EAN`
   (o "Código de barras") junto al estilo. Un archivo con solo Estilo + EAN también sirve.

La cámara solo funciona con `https://` (Vercel) o en `localhost`.

## Rótulo automático (solo administrador)

Módulo protegido con la misma clave de Importar Excel; el resto de módulos sigue libre.
Ejecuta una vez `supabase/05_acceso_admin.sql` en Supabase > SQL Editor. La clave se
vuelve a pedir al recargar la app o tras 30 minutos sin uso.

Ejecuta también `supabase/06_rotulo_automatico.sql` y `supabase/07_ingresos_detalle.sql` y `supabase/08_fv_desde_ingreso.sql` (la FV del rótulo sale del ingreso). El módulo tiene tres pestañas:

- **Paletizado:** factor (unidades por caja), cama y altura por producto. Total = cama × altura
  (cajas por pallet); unidades por pallet = factor × total. Se importa por Excel o se escribe a mano.
- **Ingresos:** "Insertar ingreso" (Excel con Código y Cantidad recibida en unidades, o manual).
  El mismo código repetido se suma. Pallets completos = recibido ÷ unidades por pallet (entero):
  se genera un rótulo por pallet completo con CANT. = cajas del pallet; el resto queda como saldo.
  Se avisa en la campana de notificaciones.
- **Rótulos pendientes:** se pone la fecha de vencimiento y se imprimen o descargan; cada hoja queda
  en el Historial de rótulos.

Todo el cálculo lo hace Supabase con números enteros (la vista previa y lo guardado son el mismo cálculo).

## Notificaciones

La campana de la barra superior guarda los avisos (con sonido, que se puede silenciar).
Desde cualquier módulo: `useNotify()({ title, body, type })`.

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
