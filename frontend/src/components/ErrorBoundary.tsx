import { Component } from 'react'
import type { ReactNode } from 'react'

// Без границы ошибок любое исключение в рендере роняет всё дерево и страница
// становится пустой — «заказ не открывается». Показываем причину и путь дальше.
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Ошибка рендера:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page">
        <div className="container">
          <div className="card">
            <h2>Не удалось отобразить страницу</h2>
            <div className="alert alert-error" style={{ margin: '12px 0' }}>
              {error.message || String(error)}
            </div>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Данные заказа сохранены — ошибка только в отображении. Сообщите текст
              ошибки разработчику.
            </p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
                Попробовать снова
              </button>
              <button className="btn btn-ghost" onClick={() => { window.location.href = '/' }}>
                На главную
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
