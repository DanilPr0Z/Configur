import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Configurator from './pages/Configurator'
import OrdersList from './pages/OrdersList'
import OrderDetail from './pages/OrderDetail'
import JointImages from './pages/JointImages'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="navbar no-print">
        <div className="container">
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginRight: 24 }}>
            NUOVO 60
          </span>
          <NavLink to="/" end>Конфигуратор</NavLink>
          <NavLink to="/orders" style={{ marginLeft: 16 }}>Заказы</NavLink>
          <NavLink to="/joint-images" style={{ marginLeft: 16 }}>Фото узлов</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Configurator />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/joint-images" element={<JointImages />} />
      </Routes>
    </BrowserRouter>
  )
}
