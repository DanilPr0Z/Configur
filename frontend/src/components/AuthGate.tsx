// Весь конфигуратор доступен только после входа через cascate.ru: без входа
// бэкенд отвечает 403 на любой запрос, поэтому вместо пустых экранов и ошибок
// показываем приглашение войти.

import { useEffect, useState } from 'react'
import { isCascateLoggedIn, SESSION_EXPIRED_EVENT } from '../api'

export const AUTH_EVENT = 'cascate-auth'        // вход/выход — обновить гейт
export const OPEN_LOGIN_EVENT = 'cascate-open-login'  // открыть форму входа в сайдбаре

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [logged, setLogged] = useState(isCascateLoggedIn)
  // Сессия кончилась посреди работы: страницу не убираем (иначе пропадёт
  // набранное), а показываем плашку «войдите снова».
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const sync = () => {
      const ok = isCascateLoggedIn()
      setLogged(ok)
      if (ok) setExpired(false)
    }
    const onExpired = () => { setExpired(true); window.dispatchEvent(new Event(OPEN_LOGIN_EVENT)) }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', sync)   // вход во второй вкладке
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (logged) return <>{children}</>

  if (expired) return (
    <>
      <div className="no-print" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '10px 14px', margin: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 220 }}>Сессия истекла — войдите снова. Набранное не потеряно, после входа можно сохранить заказ.</span>
        <button className="btn btn-primary btn-sm" onClick={() => window.dispatchEvent(new Event(OPEN_LOGIN_EVENT))}>Войти</button>
      </div>
      {children}
    </>
  )

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
