import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder, updateOrder, exportToCascate, isCascateLoggedIn, LOGIN_REQUIRED_MSG } from '../api'
import type { Order, CascateExportResult } from '../api'
import WallScheme from '../components/WallScheme'
import FinishBreakdown from '../components/FinishBreakdown'
import FinalSpec from '../components/FinalSpec'
import type { FinalSpecDoor } from '../components/FinalSpec'

type Step = 'info' | 'panels' | 'final'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const navigate = useNavigate()

  const [order, setOrder] = useState<Order | null>(null)
  const [step, setStep] = useState<Step>('info')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    fetchOrder(orderId).then(ord => setOrder(ord))
  }, [orderId])

  const saveOrder = async () => {
    if (!order) return
    if (!isCascateLoggedIn()) { alert(LOGIN_REQUIRED_MSG); return }
    setSaving(true)
    await updateOrder(orderId, {
      customer_name: order.customer_name,
      agent_name: order.agent_name,
      counterparty: order.counterparty,
      order_number: order.order_number,
      invoice_number: order.invoice_number,
      order_date: order.order_date,
      city: order.city,
      notes: order.notes,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setOrderField = (field: keyof Order, value: any) =>
    setOrder(prev => prev ? { ...prev, [field]: value } : prev)

  if (!order) return (
    <div className="page"><div className="container"><div className="card" style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div></div></div>
  )

  return (
    <div className="page">
      <div className="container">
        <div className="flex justify-between flex-center" style={{ marginBottom: 20 }}>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>← К заказам</button>
            <h1 className="page-title" style={{ marginTop: 8, marginBottom: 0 }}>
              {order.order_number ? `Заказ № ${order.order_number}` : `Заказ #${orderId}`}
              <span className={'badge ' + (order.series === '50' ? 'badge-gray' : 'badge-blue')} style={{ marginLeft: 12, verticalAlign: 'middle' }}>NUOVO {order.series || '60'}</span>
              {order.customer_name && <span style={{ fontWeight: 400, fontSize: '1rem', color: '#555', marginLeft: 12 }}>{order.customer_name}</span>}
            </h1>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setExportOpen(true)}>
              Выгрузить в Cascate
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/wall-${order.series || '60'}?order=${orderId}`)}
            >
              Изменить в конфигураторе
            </button>
          </div>
        </div>

        {exportOpen && (
          <CascateExportModal
            order={order}
            onClose={() => setExportOpen(false)}
            onDone={() => fetchOrder(orderId).then(setOrder)}
          />
        )}

        {/* Шаги */}
        <div className="steps">
          <div className={`step ${step === 'info' ? 'active' : 'done'}`} onClick={() => setStep('info')}>
            1. Данные заказа
          </div>
          <div className={`step ${step === 'panels' ? 'active' : ''}`} onClick={() => setStep('panels')}>
            {(() => {
              const sp: SpecPanel[] = order.configurator_state?.spec?.panels ?? []
              const wallCount = sp.filter((p: SpecPanel) => !p.panelLabel.startsWith('Д')).length
              const doorCount = sp.filter((p: SpecPanel) => p.panelLabel.startsWith('Д')).length
              return `2. Панели (${wallCount} ст. / ${doorCount} дв.)`
            })()}
          </div>
          <div className={`step ${step === 'final' ? 'active' : ''}`} onClick={() => setStep('final')}>
            3. Финишная спецификация
          </div>
        </div>

        {/* ── Шаг 1: Данные заказа ── */}
        {step === 'info' && (
          <div className="card">
            <h2>Данные заказа</h2>
            <div className="grid-3" style={{ marginBottom: 14 }}>
              <div className="field">
                <label>ФИО заказчика</label>
                <input value={order.customer_name} onChange={e => setOrderField('customer_name', e.target.value)} />
              </div>
              <div className="field">
                <label>ФИО агента</label>
                <input value={order.agent_name} onChange={e => setOrderField('agent_name', e.target.value)} />
              </div>
              <div className="field">
                <label>Контрагент</label>
                <input value={order.counterparty} onChange={e => setOrderField('counterparty', e.target.value)} />
              </div>
              <div className="field">
                <label>Номер заказа</label>
                <input value={order.order_number} onChange={e => setOrderField('order_number', e.target.value)} />
              </div>
              <div className="field">
                <label>Номер счёта</label>
                <input value={order.invoice_number} onChange={e => setOrderField('invoice_number', e.target.value)} />
              </div>
              <div className="field">
                <label>Дата принятия заказа</label>
                <input type="date" value={order.order_date || ''} onChange={e => setOrderField('order_date', e.target.value)} />
              </div>
              <div className="field">
                <label>Город</label>
                <input value={order.city} onChange={e => setOrderField('city', e.target.value)} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Примечания</label>
              <textarea value={order.notes} onChange={e => setOrderField('notes', e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-success" onClick={saveOrder} disabled={saving}>
                {saving ? <span className="spinner" /> : ''}Сохранить
              </button>
              {saved && <span className="alert alert-success" style={{ padding: '9px 14px' }}>Сохранено ✓</span>}
              <button className="btn btn-primary" onClick={() => setStep('panels')}>
                Далее: Панели →
              </button>
            </div>
          </div>
        )}

        {/* ── Шаг 2: Панели ── */}
        {step === 'panels' && (
          <ConfiguratorSpecView order={order} onEdit={() => navigate(`/wall-${order.series || '60'}?order=${orderId}`)} />
        )}

        {/* ── Шаг 3: Финишная спецификация ── */}
        {step === 'final' && (
          order.configurator_state ? (
            <FinalSpec
              header={{
                counterparty: order.counterparty,
                customer_name: order.customer_name,
                invoice_number: order.invoice_number,
                agent_name: order.agent_name,
                city: order.city,
                order_date: order.order_date,
                order_number: order.order_number,
              }}
              panels={order.configurator_state.spec?.panels ?? []}
              profiles={order.configurator_state.spec?.profiles ?? []}
              doors={(order.configurator_state.doors ?? []) as FinalSpecDoor[]}
            />
          ) : (
            <div className="card">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Спецификация недоступна — заказ создан не через конфигуратор.
              </div>
              <button className="btn btn-primary" onClick={() => navigate(`/wall-${order.series || '60'}?order=${orderId}`)}>
                Открыть в конфигураторе
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Выгрузка в cascate.ru ───────────────────────────────────────────────────

// Уже вошедший в Cascate пользователь (сайдбар кладёт сюда id_person).
function loadCascateUser(): { id_person: string; login: string } | null {
  try {
    const raw = localStorage.getItem('cascate_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function CascateExportModal({ order, onClose, onDone }: {
  order: Order
  onClose: () => void
  onDone: () => void
}) {
  const user = loadCascateUser()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CascateExportResult | null>(null)

  const panels = order.panels ?? []
  const doorPanels = order.door_panels ?? []
  const total = panels.length + doorPanels.length
  const alreadySynced = [...panels, ...doorPanels].filter(p => p.cascate_synced_at).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const creds = user?.id_person
        ? { id_person: user.id_person, force }
        : { login, password, force }
      const res = await exportToCascate(order.id!, creds)
      setResult(res)
      setPassword('')
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Не удалось связаться с сервером')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480, width: '100%', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 style={{ marginTop: 0 }}>Выгрузка в Cascate</h2>

        {result ? (
          <>
            <div className={result.failed ? 'alert alert-info' : 'alert alert-success'} style={{ marginBottom: 14 }}>
              Отправлено: <strong>{result.sent}</strong>
              {result.skipped > 0 && <> · пропущено (уже выгружены): <strong>{result.skipped}</strong></>}
              {result.failed > 0 && <> · с ошибкой: <strong>{result.failed}</strong></>}
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ color: '#b91c1c', marginBottom: 4 }}>
                    <strong>{e.panel}</strong>: {e.error}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={onClose}>Закрыть</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: '#666', fontSize: 13, margin: '0 0 16px' }}>
              Панелей в заказе: <strong>{total}</strong>
              {alreadySynced > 0 && <> · уже выгружено: <strong>{alreadySynced}</strong></>}
            </p>

            {user ? (
              <p style={{ color: '#666', fontSize: 13, margin: '0 0 16px' }}>
                Аккаунт Cascate: <strong>{user.login}</strong>
              </p>
            ) : (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Логин Cascate</label>
                  <input value={login} onChange={e => setLogin(e.target.value)} autoFocus required />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Пароль</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </>
            )}

            {alreadySynced > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
                <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                Отправить заново уже выгруженные ({alreadySynced} шт.) — возможны дубли
              </label>
            )}

            {error && (
              <div className="alert" style={{ background: '#fee2e2', color: '#b91c1c', marginBottom: 14, padding: '9px 14px' }}>
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-success" type="submit" disabled={busy || total === 0}>
                {busy ? <span className="spinner" /> : ''}Выгрузить
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
                Отмена
              </button>
            </div>
            {total === 0 && (
              <p style={{ color: '#999', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                В заказе нет панелей — выгружать нечего.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Спецификация из configurator_state ──────────────────────────────────────

interface SpecPanel {
  panelLabel: string; wallName: string
  height: number; width: number
  leftNode: string; rightNode: string; topEdge: string; bottomEdge: string
  quantity: number; finishGroup: string; finishName: string
  veneerDirection: string; decor3d: string
  aluminumVertical: number; aluminumHorizontal: number; aluminumColor: string
  markup: number; notes: string
  sideCost?: number; topBotCost?: number; areaSqm?: number; total?: number
}

interface SpecProfile {
  article: string; name: string; length: number
  quantity: number; note: string; price_per_piece: number; total_cost: number
}

const fmtN = (n?: number) => n && n > 0 ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

function SchemeHint() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card no-print" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 600, color: '#1a4d8a', textAlign: 'left',
        }}
      >
        <span>Схемы сборки стеновых панелей NUOVO 60 — справочные листы</span>
        <svg width="14" height="14" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: .5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <img src={`${import.meta.env.BASE_URL}scheme1.png`} alt="Схема раскладки" style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5' }} />
          <img src={`${import.meta.env.BASE_URL}scheme2.png`} alt="Типы узлов" style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5' }} />
        </div>
      )}
    </div>
  )
}

function ConfiguratorSpecView({ order, onEdit }: { order: Order; onEdit: () => void }) {
  const cs = order.configurator_state
  const specPanels: SpecPanel[] = cs?.spec?.panels ?? []
  const specProfiles: SpecProfile[] = cs?.spec?.profiles ?? []
  const walls = cs?.walls ?? []
  const doors = cs?.doors ?? []
  const itemOrder = cs?.itemOrder ?? []
  const [zoom, setZoom] = useState(100)

  const totalPanels = specPanels.reduce((s: number, p: SpecPanel) => s + p.quantity, 0)
  const totalArea = specPanels.reduce((s: number, p: SpecPanel) => s + (p.areaSqm ?? 0), 0)
  const grandTotal = specPanels.reduce((s: number, p: SpecPanel) => s + (p.total ?? 0), 0)
  const profilesTotal = specProfiles.reduce((s: number, p: SpecProfile) => s + (p.total_cost ?? 0), 0)

  if (!cs) {
    return (
      <>
        <SchemeHint />
        <div className="card">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Спецификация недоступна — заказ создан не через конфигуратор или был создан до обновления системы.
          </div>
          <button className="btn btn-primary" onClick={onEdit}>Открыть в конфигураторе</button>
        </div>
      </>
    )
  }

  return (
    <>
      <SchemeHint />
      <div className="card">
        <div className="flex justify-between flex-center no-print" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>
            Стеновые панели — {totalPanels} шт. / {totalArea.toFixed(2)} кв.м
            {grandTotal > 0 && (
              <span style={{ marginLeft: 16, color: '#1a4d8a' }}>
                / Итого: {grandTotal.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#666' }}>Масштаб:</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 28, padding: 0, fontWeight: 700 }}
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              disabled={zoom <= 50}
            >−</button>
            <span style={{ fontSize: 13, minWidth: 36, textAlign: 'center', color: '#1a4d8a', fontWeight: 600 }}>{zoom}%</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 28, padding: 0, fontWeight: 700 }}
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              disabled={zoom >= 150}
            >+</button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setZoom(100)}
              style={{ fontSize: 11, color: '#999' }}
            >сброс</button>
            <div style={{ width: 1, height: 20, background: '#e0e8f5', margin: '0 4px' }} />
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Печать</button>
          </div>
        </div>

        {specPanels.length === 0 ? (
          <div className="alert alert-info">Панелей нет. Откройте конфигуратор для добавления.</div>
        ) : (
          <div style={{ zoom: `${zoom}%` }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Наименование</th><th>Высота, мм</th>
                    <th>Узел лев.</th><th>Ширина, мм</th><th>Узел пр.</th>
                    <th>Кол-во, шт</th><th>Ст-ть узлов выс., ₽</th>
                    <th>Узел верх</th><th>Узел низ</th><th>Ст-ть узлов в/н, ₽</th>
                    <th>Группа отделок</th><th>Отделка</th><th>Напр. шпона</th>
                    <th>Декор 3D</th><th>Ал↕</th><th>Ал↔</th><th>Цвет ал.</th>
                    <th>Кв.м</th><th>Наценка</th><th>Итог, ₽</th><th>Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {specPanels.map((p: SpecPanel, i: number) => (
                    <tr key={i}>
                      <td><strong>{p.panelLabel}</strong></td>
                      <td>{p.wallName}</td>
                      <td><strong>{p.height}</strong></td>
                      <td><span className="badge badge-blue">{p.leftNode}</span></td>
                      <td><strong>{p.width}</strong></td>
                      <td><span className="badge badge-blue">{p.rightNode}</span></td>
                      <td><strong>{p.quantity}</strong></td>
                      <td className="text-right">{fmtN(p.sideCost)}</td>
                      <td>{p.topEdge ? <span className="badge badge-gray">{p.topEdge}</span> : '—'}</td>
                      <td>{p.bottomEdge ? <span className="badge badge-gray">{p.bottomEdge}</span> : '—'}</td>
                      <td className="text-right">{fmtN(p.topBotCost)}</td>
                      <td>{p.finishGroup || '—'}</td>
                      <td>{p.finishName || '—'}</td>
                      <td>{p.veneerDirection || '—'}</td>
                      <td className="text-muted">{p.decor3d || '—'}</td>
                      <td>{p.aluminumVertical || '—'}</td>
                      <td>{p.aluminumHorizontal || '—'}</td>
                      <td className="text-muted">{p.aluminumColor || '—'}</td>
                      <td className="text-right">{p.areaSqm?.toFixed(2) ?? '—'}</td>
                      <td>{p.markup > 0 ? `${p.markup}%` : '—'}</td>
                      <td className="text-right price"><strong>{fmtN(p.total)}</strong></td>
                      <td className="text-muted">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24 }}>
              <FinishBreakdown panels={specPanels} />
            </div>

            {specProfiles.length > 0 && (
              <>
                <h3 className="spec-section-title" style={{ marginTop: 24 }}>Профили и комплектующие</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Наименование</th><th>Артикул</th>
                        <th>Длина, мм</th><th>Кол-во, шт</th>
                        <th>Цена/шт, ₽</th><th>Сумма, ₽</th><th>Примечание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specProfiles.map((p: SpecProfile, i: number) => (
                        <tr key={i}>
                          <td><strong>{i + 1}</strong></td>
                          <td>{p.name}</td>
                          <td><span className="badge badge-gray">{p.article}</span></td>
                          <td>{p.length}</td>
                          <td><strong>{p.quantity}</strong></td>
                          <td className="text-right">{p.price_per_piece ? p.price_per_piece.toLocaleString('ru-RU') : '—'}</td>
                          <td className="text-right price">{p.total_cost ? p.total_cost.toLocaleString('ru-RU') : '—'}</td>
                          <td className="text-muted">{p.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {profilesTotal > 0 && (
                  <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600 }}>
                    Итого профили: <span className="price">{profilesTotal.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </>
            )}

            {(grandTotal + profilesTotal) > 0 && (
              <div style={{ textAlign: 'right', marginTop: 16, fontSize: '1.1rem', fontWeight: 700, color: '#1a4d8a', borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
                ИТОГО ВСЕГО: <span className="price">{(grandTotal + profilesTotal).toLocaleString('ru-RU')} ₽</span>
              </div>
            )}
          </div>
        )}
      </div>

      {walls.length > 0 && specPanels.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 16px' }}>Схема раскладки</h2>
          <WallScheme walls={walls} doors={doors} panels={specPanels} itemOrder={itemOrder} />
        </div>
      )}

    </>
  )
}
