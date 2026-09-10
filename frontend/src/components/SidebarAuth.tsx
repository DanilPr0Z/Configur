import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cascateLogin, type CascateUser } from '../api'
import { AUTH_EVENT, OPEN_LOGIN_EVENT } from './AuthGate'

const STORE_KEY = 'cascate_user'
const CASCATE_URL = 'https://cascate.ru/cabinet/'

function loadUser(): CascateUser | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function SidebarAuth() {
  const [user, setUser] = useState<CascateUser | null>(loadUser)
  const [open, setOpen] = useState(false)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const u = await cascateLogin(login.trim(), password)
      localStorage.setItem(STORE_KEY, JSON.stringify(u))
      setUser(u)
      window.dispatchEvent(new Event(AUTH_EVENT))
      setOpen(false); setLogin(''); setPassword('')
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Не удалось войти. Проверьте почту и пароль.')
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    localStorage.removeItem(STORE_KEY)
    setUser(null)
    window.dispatchEvent(new Event(AUTH_EVENT))
  }

  // Кнопка «Войти» с экрана-заглушки открывает эту же форму
  useEffect(() => {
    const open = () => setOpen(true)
    window.addEventListener(OPEN_LOGIN_EVENT, open)
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, open)
  }, [])

  return (
    <div className="sidebar-foot no-print">
      {user ? (
        <>
          <div className="sidebar-user" title={user.login}>
            <span className="sidebar-user-name">{user.login}</span>
          </div>
          <a className="sidebar-auth-link" href={CASCATE_URL} target="_blank" rel="noopener noreferrer">Профиль</a>
          <button className="sidebar-auth-btn ghost" onClick={logout}>Выйти</button>
        </>
      ) : (
        <>
          <button className="sidebar-auth-btn" onClick={() => setOpen(true)}>Войти</button>
          <a className="sidebar-auth-link" href={CASCATE_URL} target="_blank" rel="noopener noreferrer">Профиль</a>
        </>
      )}

      {open && createPortal(
        <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Вход</h2>
            <p className="text-muted" style={{ marginBottom: 14 }}>
              Через личный кабинет cascate.ru
            </p>
            <form onSubmit={submit}>
              <div className="field">
                <label>Почта</label>
                <input type="text" value={login} autoFocus placeholder="email@example.com"
                  onChange={e => setLogin(e.target.value)} />
              </div>
              <div className="field mt-4">
                <label>Пароль</label>
                <input type="password" value={password} placeholder="••••••••"
                  onChange={e => setPassword(e.target.value)} />
              </div>
              {err && <div className="alert alert-error mt-4">{err}</div>}
              <div className="flex gap-3 mt-6">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !login.trim() || !password}>
                  {busy ? <span className="spinner" /> : 'Войти'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
