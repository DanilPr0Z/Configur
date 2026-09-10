import { createBrowserRouter, RouterProvider, Outlet, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Configurator from './pages/Configurator'
import Framing from './pages/Framing'
import FramingLeads from './pages/FramingLeads'
import OrdersList from './pages/OrdersList'
import OrderDetail from './pages/OrderDetail'
import JointImages from './pages/JointImages'
import Footer from './components/Footer'
import SidebarAuth from './components/SidebarAuth'
import ErrorBoundary from './components/ErrorBoundary'
import AuthGate from './components/AuthGate'
import './index.css'

const navCls = ({ isActive }: { isActive: boolean }) =>
  'sidebar-link' + (isActive ? ' active' : '')

function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar no-print">
        <NavLink to="/" className="sidebar-brand">NUOVO</NavLink>
        <nav className="sidebar-nav">
          <div className="sidebar-group">Разделы</div>
          <NavLink to="/wall-60" className={navCls}>Стеновые 60</NavLink>
          <NavLink to="/wall-50" className={navCls}>Стеновые 50</NavLink>
          <NavLink to="/framing" className={navCls}>Обрамление проёма</NavLink>
          <div className="sidebar-group">Личный кабинет</div>
          <NavLink to="/orders" className={navCls}>Заказы</NavLink>
          <NavLink to="/framing-leads" className={navCls}>Заявки обрамления</NavLink>
        </nav>
        <SidebarAuth />
      </aside>

      <div className="app-content">
        <main className="app-main">
          <ErrorBoundary>
            <AuthGate>
              <Outlet />
            </AuthGate>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  )
}

// createBrowserRouter (а не BrowserRouter) — иначе не работает useBlocker,
// на котором держится предложение сохранить заказ при уходе из конфигуратора.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      // key — чтобы при переключении серии конфигуратор пересоздавался
      // с чистого листа, а не тащил панели предыдущей серии
      { path: '/wall-60', element: <Configurator key="60" series="60" /> },
      { path: '/wall-50', element: <Configurator key="50" series="50" /> },
      { path: '/framing', element: <Framing /> },
      { path: '/orders', element: <OrdersList /> },
      { path: '/orders/:id', element: <OrderDetail /> },
      { path: '/framing-leads', element: <FramingLeads /> },
      // Скрыта из навигации — доступна только по прямому адресу /joint-images
      { path: '/joint-images', element: <JointImages /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
