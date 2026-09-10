// Весь конфигуратор доступен только после входа через cascate.ru: без входа
// бэкенд отвечает 403 на любой запрос, поэтому вместо пустых экранов и ошибок
// показываем приглашение войти.

import { useEffect, useState } from 'react'
import { isCascateLoggedIn } from '../api'

export const AUTH_EVENT = 'cascate-auth'        // вход/выход — обновить гейт
export const OPEN_LOGIN_EVENT = 'cascate-open-login'  // открыть форму входа в сайдбаре

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [logged, setLogged] = useState(isCascateLoggedIn)

  useEffect(() => {
    const sync = () => setLogged(isCascateLoggedIn())
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', sync)   // вход во второй вкладке
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (logged) return <>{children}</>

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px' }}>Нужен вход</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: 18 }}>
          Конфигуратор, заказы и обрамление доступны после входа через cascate.ru.
          Заказы у каждого свои — вы видите только то, что создали сами.
        </p>
        <button className="btn btn-primary"
          onClick={() => window.dispatchEvent(new Event(OPEN_LOGIN_EVENT))}>
          Войти
        </button>
      </div>
    </div>
  )
}
