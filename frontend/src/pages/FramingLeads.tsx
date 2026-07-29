import { useEffect, useState } from 'react'
import { fetchFramingLeads } from '../api'
import type { FramingLead, FramingLeadSpecRow } from '../api'

// Заявки из калькулятора обрамления проёма: список + раскрытие сохранённой
// спецификации. Раньше заявку можно было открыть только в Django-админке.

const fmt = (n?: number) => (n ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })

const STATUS_LABEL: Record<string, string> = {
  new: 'Новая', in_work: 'В работе', done: 'Завершена',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function FramingLeads() {
  const [leads, setLeads] = useState<FramingLead[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    fetchFramingLeads()
      .then(setLeads)
      .catch(() => setError('Не удалось загрузить заявки. Проверьте, что сервер запущен.'))
  }, [])

  if (error) return (
    <div className="page"><div className="container">
      <h1 className="page-title">Заявки обрамления</h1>
      <div className="alert alert-error">{error}</div>
    </div></div>
  )

  if (!leads) return (
    <div className="page"><div className="container">
      <h1 className="page-title">Заявки обрамления</h1>
      <div className="card" style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
    </div></div>
  )

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Заявки обрамления</h1>

        {leads.length === 0 ? (
          <div className="card">
            <div className="alert alert-info">
              Заявок пока нет. Они появляются здесь после оформления заявки в разделе «Обрамление проёма».
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Дата</th><th>Имя</th><th>Телефон</th>
                    <th>Модель</th><th>Проём, мм</th><th>Итого, ₽</th>
                    <th>Статус</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.id}</strong></td>
                      <td>{formatDate(l.created_at)}</td>
                      <td>{l.name}</td>
                      <td>{l.phone}</td>
                      <td>{l.model_name || '—'}</td>
                      <td>{l.opening_height} × {l.opening_width} × {l.wall_depth}</td>
                      <td className="text-right price"><strong>{fmt(l.total)}</strong></td>
                      <td><span className="badge badge-gray">{STATUS_LABEL[l.status] ?? l.status}</span></td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setOpenId(openId === l.id ? null : l.id)}
                        >
                          {openId === l.id ? 'Скрыть' : 'Открыть'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openId !== null && (() => {
          const lead = leads.find(l => l.id === openId)
          if (!lead) return null
          const rows: FramingLeadSpecRow[] = Array.isArray(lead.spec) ? lead.spec : []
          return (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="flex justify-between flex-center no-print" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Заявка №{lead.id} — {lead.name}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Печать</button>
              </div>

              <div className="alert alert-info" style={{ lineHeight: 1.7 }}>
                <strong>Телефон:</strong> {lead.phone}
                {lead.email ? <> · <strong>Email:</strong> {lead.email}</> : null}<br />
                <strong>Модель:</strong> {lead.model_name || '—'} · <strong>Установка:</strong> {lead.install || '—'}<br />
                <strong>Проём:</strong> {lead.opening_height} × {lead.opening_width} × {lead.wall_depth} мм<br />
                {lead.color_name ? <><strong>Наличник:</strong> {lead.color_name} </> : null}
                {lead.dobor_name ? <>· <strong>Добор:</strong> {lead.dobor_name} </> : null}
                {lead.glass ? <>· <strong>Вставка:</strong> {lead.glass}</> : null}
                {lead.invoice_number ? <><br /><strong>Счёт:</strong> {lead.invoice_number}</> : null}
                {lead.buyer ? <> · <strong>Покупатель:</strong> {lead.buyer}</> : null}
              </div>

              {rows.length > 0 ? (
                <div className="table-wrap mt-4">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '46%' }}>Наименование</th>
                        <th style={{ width: '24%' }}>Размер</th>
                        <th style={{ textAlign: 'center' }}>Шт.</th>
                        <th style={{ textAlign: 'right' }}>Сумма, ₽</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.nm}</td>
                          <td className="text-muted">{r.dm}</td>
                          <td style={{ textAlign: 'center' }}>{r.qt}</td>
                          <td className="text-right fw-bold">{fmt(r.pr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-info mt-4">Спецификация к заявке не сохранена.</div>
              )}

              <div className="summary-row total mt-4">
                <span>Итого к заказу</span>
                <span className="price">{fmt(lead.total)} ₽</span>
              </div>

              {(lead.note || lead.comment) && (
                <div className="mt-4">
                  {lead.note && <p><strong>Примечание:</strong> {lead.note}</p>}
                  {lead.comment && <p><strong>Комментарий клиента:</strong> {lead.comment}</p>}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
