// src/App.jsx
import AppShell from './layout/AppShell.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { useRoute } from './lib/router.js'
import ProductosPage from './modules/productos/ProductosPage.jsx'
import RotuloPage from './modules/rotulo/RotuloPage.jsx'
import HistorialPage from './modules/historial/HistorialPage.jsx'

export default function App() {
  const route = useRoute()

  return (
    <ToastProvider>
      <AppShell route={route.name}>
        {route.name === 'productos' && <ProductosPage />}
        {route.name === 'rotulo' && <RotuloPage params={route.params} />}
        {route.name === 'historial' && <HistorialPage />}
      </AppShell>
    </ToastProvider>
  )
}
