import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
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
import './index.css'

const navCls = ({ isActive }: { isActive: boolean }) =>
  'sidebar-link' + (isActive ? ' active' : '')

export default function App() {
  return (
    <BrowserRouter>
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
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/wall-60" element={<Configurator series="60" />} />
                <Route path="/wall-50" element={<Configurator series="50" />} />
                <Route path="/framing" element={<Framing />} />
                <Route path="/orders" element={<OrdersList />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/framing-leads" element={<FramingLeads />} />
                {/* Скрыта из навигации — доступна только по прямому адресу /joint-images */}
                <Route path="/joint-images" element={<JointImages />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  )
}
