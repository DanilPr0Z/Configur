// Мёртвый токен: интерцептор сам забывает его и сообщает об этом странице.
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('истёкшая сессия', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    const listeners: Record<string, (() => void)[]> = {}
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => { (listeners[e.type] ?? []).forEach(f => f()); return true },
      addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f) },
    })
  })

  it('403 «учётные данные не предоставлены» очищает токен и шлёт событие', async () => {
    const { api, SESSION_EXPIRED_EVENT, isCascateLoggedIn } = await import('./api')
    localStorage.setItem('cascate_user', JSON.stringify({ token: 'dead', login: 'x', id_person: '1' }))
    const fired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, fired)
    await api.get('/x', {
      adapter: async (config: unknown) => Promise.reject({
        config, response: { status: 403, data: { detail: 'Учетные данные не были предоставлены.' } },
      }),
    }).catch(() => {})
    expect(isCascateLoggedIn()).toBe(false)
    expect(fired).toHaveBeenCalledTimes(1)
  })
})
