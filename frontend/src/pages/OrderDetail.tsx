import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchOrder, updateOrder, fetchJointTypes, fetchFinishGroups, fetchProfileColors,
  createPanel, updatePanel, deletePanel,
  createDoorPanel, updateDoorPanel, deleteDoorPanel,
  importExcel,
} from '../api'
import type { Order, Panel, DoorPanel, JointType, FinishGroup, ProfileColor } from '../api'
import PanelRow from '../components/PanelRow'
import DoorPanelRow from '../components/DoorPanelRow'
import WallCalculator from '../components/WallCalculator'
import OrderSummaryView from '../components/OrderSummaryView'
import WallScheme from '../components/WallScheme'

type Step = 'info' | 'panels'

const emptyPanel = (orderId: number, position: number, wallNumber: string): Partial<Panel> => ({
  order: orderId,
  position,
  wall_number: wallNumber,
  quantity: 1,
  height_mm: 0,
  width_mm: 0,
  joint_left: null,
  joint_right: null,
  joint_top: null,
  joint_bottom: null,
  finish_group: null,
  finish: null,
  veneer_direction: '',
  decor_name: '',
  aluminum_vertical_count: 0,
  aluminum_horizontal_count: 0,
  aluminum_color: null,
  markup_percent: 0,
  notes: '',
})

const emptyDoorPanel = (orderId: number, position: number, wallNumber: string): Partial<DoorPanel> => ({
  order: orderId,
  position,
  wall_number: wallNumber,
  door_order_number: '',
  opening_width: 0,
  opening_height: 0,
  ceiling_height: 0,
  mount_type: 'ceiling',
  opening_direction: 'in',
  joint_top_left: null,
  joint_top_right: null,
  joint_bottom: null,
  edge_left: null,
  edge_right: null,
  edge_top: null,
  edge_bottom: null,
  quantity: 1,
  panel_height: 0,
  panel_width: 0,
  finish_group: null,
  finish: null,
  veneer_direction: '',
  decor_name: '',
  markup_percent: 0,
  notes: '',
})

interface WallGroup<T> {
  wallNum: string
  items: T[]
}

function groupByWall<T extends { wall_number: string }>(items: T[]): WallGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const wn = item.wall_number || '1'
    if (!map.has(wn)) map.set(wn, [])
    map.get(wn)!.push(item)
  }
  return Array.from(map.entries()).map(([wallNum, items]) => ({ wallNum, items }))
}

function nextWallNum(items: { wall_number: string }[]): string {
  if (items.length === 0) return '1'
  const nums = items.map(p => parseInt(p.wall_number, 10)).filter(n => !isNaN(n))
  if (nums.length === 0) return '1'
  return String(Math.max(...nums) + 1)
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const navigate = useNavigate()

  const [order, setOrder] = useState<Order | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [doorPanels, setDoorPanels] = useState<DoorPanel[]>([])
  const [jointTypes, setJointTypes] = useState<JointType[]>([])
  const [finishGroups, setFinishGroups] = useState<FinishGroup[]>([])
  const [profileColors, setProfileColors] = useState<ProfileColor[]>([])
  const [step, setStep] = useState<Step>('info')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetchOrder(orderId),
      fetchJointTypes(),
      fetchFinishGroups(),
      fetchProfileColors(),
    ]).then(([ord, jt, fg, pc]) => {
      setOrder(ord)
      setPanels(ord.panels ?? [])
      setDoorPanels(ord.door_panels ?? [])
      setJointTypes(jt)
      setFinishGroups(fg)
      setProfileColors(pc)
    })
  }, [orderId])

  const saveOrder = async () => {
    if (!order) return
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

  // ─── Стеновые панели ────────────────────────────────────────────────────────

  const wallGroups = useMemo(() => groupByWall(panels), [panels])

  const addPanel = async (wallNum: string) => {
    const pos = panels.filter(p => p.wall_number === wallNum).length + 1
    const created = await createPanel(emptyPanel(orderId, pos, wallNum))
    setPanels(prev => [...prev, created])
  }

  const addWall = async () => {
    const wallNum = nextWallNum(panels)
    const created = await createPanel(emptyPanel(orderId, 1, wallNum))
    setPanels(prev => [...prev, created])
  }

  const renameWall = async (oldNum: string, newNum: string) => {
    if (!newNum.trim() || oldNum === newNum) return
    const toUpdate = panels.filter(p => p.wall_number === oldNum)
    const updated = panels.map(p => p.wall_number === oldNum ? { ...p, wall_number: newNum } : p)
    setPanels(updated)
    for (const p of toUpdate) {
      if (p.id) await updatePanel(p.id, { wall_number: newNum })
    }
  }

  const changePanel = (panelId: number, updated: Panel) => {
    setPanels(prev => prev.map(p => p.id === panelId ? updated : p))
  }

  const savePanel = async (panel: Panel) => {
    if (!panel.id) return
    const saved = await updatePanel(panel.id, panel)
    setPanels(prev => prev.map(p => p.id === saved.id ? saved : p))
  }

  const removePanel = async (panel: Panel) => {
    if (panel.id) await deletePanel(panel.id)
    setPanels(prev => prev.filter(p => p.id !== panel.id))
  }

  const addPanelsFromCalc = useCallback(async (width: number, count: number, leftCode: string, rightCode: string) => {
    const leftJoint = jointTypes.find(j => j.code === leftCode)
    const rightJoint = jointTypes.find(j => j.code === rightCode)
    const wallNum = nextWallNum(panels)
    const newPanels: Panel[] = []
    for (let i = 0; i < count; i++) {
      const created = await createPanel({
        ...emptyPanel(orderId, i + 1, wallNum),
        width_mm: width,
        joint_left: leftJoint?.id ?? null,
        joint_right: rightJoint?.id ?? null,
      })
      newPanels.push(created)
    }
    setPanels(prev => [...prev, ...newPanels])
  }, [orderId, panels, jointTypes])

  // ─── Дверные панели ─────────────────────────────────────────────────────────

  const doorWallGroups = useMemo(() => groupByWall(doorPanels), [doorPanels])

  const addDoorPanel = async (wallNum: string) => {
    const pos = doorPanels.filter(p => p.wall_number === wallNum).length + 1
    const created = await createDoorPanel(emptyDoorPanel(orderId, pos, wallNum))
    setDoorPanels(prev => [...prev, created])
  }

  const addDoorWall = async () => {
    const wallNum = nextWallNum(doorPanels)
    const created = await createDoorPanel(emptyDoorPanel(orderId, 1, wallNum))
    setDoorPanels(prev => [...prev, created])
  }

  const renameDoorWall = async (oldNum: string, newNum: string) => {
    if (!newNum.trim() || oldNum === newNum) return
    const toUpdate = doorPanels.filter(p => p.wall_number === oldNum)
    const updated = doorPanels.map(p => p.wall_number === oldNum ? { ...p, wall_number: newNum } : p)
    setDoorPanels(updated)
    for (const p of toUpdate) {
      if (p.id) await updateDoorPanel(p.id, { wall_number: newNum })
    }
  }

  const changeDoorPanel = (panelId: number, updated: DoorPanel) => {
    setDoorPanels(prev => prev.map(p => p.id === panelId ? updated : p))
  }

  const saveDoorPanel = async (panel: DoorPanel) => {
    if (!panel.id) return
    const saved = await updateDoorPanel(panel.id, panel)
    setDoorPanels(prev => prev.map(p => p.id === saved.id ? saved : p))
  }

  const removeDoorPanel = async (panel: DoorPanel) => {
    if (panel.id) await deleteDoorPanel(panel.id)
    setDoorPanels(prev => prev.filter(p => p.id !== panel.id))
  }

  // ─── Импорт Excel ───────────────────────────────────────────────────────────

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    try {
      const res = await importExcel(orderId, file)
      setImportMsg(`Импортировано ${res.panels_imported} панел.${res.order_updated ? ' Данные заказа обновлены.' : ''}`)
      const ord = await fetchOrder(orderId)
      setOrder(ord)
      setPanels(ord.panels ?? [])
      setDoorPanels(ord.door_panels ?? [])
    } catch (err: any) {
      setImportMsg(err.response?.data?.error ?? 'Ошибка импорта')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
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
              {order.customer_name && <span style={{ fontWeight: 400, fontSize: '1rem', color: '#555', marginLeft: 12 }}>{order.customer_name}</span>}
            </h1>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/?order=${orderId}`)}
          >
            Изменить в конфигураторе
          </button>
        </div>

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
          <ConfiguratorSpecView order={order} onEdit={() => navigate(`/?order=${orderId}`)} />
        )}
      </div>
    </div>
  )
}

// ─── Вспомогательный компонент: секция одной стены ──────────────────────────

interface WallSectionProps {
  wallNum: string
  label?: string
  onRename: (newNum: string) => void
  onAddPanel: () => void
  addLabel?: string
  children: React.ReactNode
}

function WallSection({ wallNum, label = 'Стена', onRename, onAddPanel, addLabel = '+ Добавить панель', children }: WallSectionProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(wallNum)

  const commit = () => {
    setEditing(false)
    onRename(draft)
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex flex-center gap-2" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a4d8a' }}>{label}</span>
        {editing ? (
          <>
            <input
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: 80, fontWeight: 700 }}
            />
          </>
        ) : (
          <span
            style={{ fontWeight: 700, fontSize: '1rem', cursor: 'pointer', borderBottom: '1px dashed #aaa', minWidth: 30 }}
            title="Нажмите чтобы изменить номер"
            onClick={() => { setDraft(wallNum); setEditing(true) }}
          >
            {wallNum}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onAddPanel} style={{ marginLeft: 12 }}>{addLabel}</button>
      </div>
      {children}
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
          <img src="/scheme1.png" alt="Схема раскладки" style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5' }} />
          <img src="/scheme2.png" alt="Типы узлов" style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5' }} />
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
