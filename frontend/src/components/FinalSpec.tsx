import FinishBreakdown from './FinishBreakdown'

// Форма листа «Спецификация заказа стеновых» из шаблона NUOVO 60.

export interface FinalSpecPanel {
  panelLabel: string
  wallName: string
  height: number
  width: number
  leftNode: string
  rightNode: string
  topEdge: string
  bottomEdge: string
  quantity: number
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  aluminumVertical: number
  aluminumHorizontal: number
  aluminumColor: string
  notes: string
  areaSqm?: number
  total?: number
}

export interface FinalSpecProfile {
  article: string
  name: string
  length: number
  quantity: number
  price_per_piece: number
  total_cost: number
  note: string
}

export interface FinalSpecDoor {
  label: string
  doorRef: string
  openingW: number
  openingH: number
  ceilingH: number
  mountType: string
  openingDir: string
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  notes: string
}

export interface FinalSpecHeader {
  counterparty: string
  customer_name: string
  invoice_number: string
  agent_name: string
  city: string
  order_date: string | null
  order_number: string
}

interface Props {
  header: FinalSpecHeader
  panels: FinalSpecPanel[]
  profiles: FinalSpecProfile[]
  doors: FinalSpecDoor[]
  series?: string
}

const DECOR_ARTICLE = 'П 6x6'

/**
 * Печать спецификации.
 *
 * Вся печатная вёрстка (альбомный лист, раскрытие .table-wrap, компактный
 * шрифт, перенос заголовков) живёт в @page и @media print в index.css —
 * поэтому Ctrl+P и «Печать» из меню браузера дают тот же результат, что и
 * эта кнопка.
 */
export function printSpec() {
  window.print()
}

const money = (n: number) => n > 0 ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'
const dash = (s: string | number) => s ? String(s) : '—'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

/** «A \ 2988 * 1509 \ B» — как в колонке «РАЗМЕРЫ ПАНЕЛИ И ТИПЫ КРОМОК» */
function dimensions(p: FinalSpecPanel): string {
  return `${p.leftNode || '—'} \\ ${p.height} * ${p.width} \\ ${p.rightNode || '—'}`
}

/** Панели дверного проёма №n: надпроёмная «Дn» и доборы «Дn.1», «Дn.2»… */
function doorPanels(panels: FinalSpecPanel[], index: number): FinalSpecPanel[] {
  const label = `Д${index + 1}`
  return panels.filter(p => {
    const l = p.panelLabel ?? ''
    return l === label || l.startsWith(`${label}.`)
  })
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <label style={{ fontSize: 11, letterSpacing: '.04em', color: '#888' }}>{label}</label>
      <div style={{ padding: '6px 0', borderBottom: '1px solid #d8e0ec', fontWeight: 600, minHeight: 20 }}>
        {value || '—'}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      background: '#eff6ff', color: '#1e40af', fontWeight: 700, fontSize: '.82rem',
      letterSpacing: '.04em', padding: '8px 12px', borderRadius: 6,
      margin: '26px 0 12px', breakAfter: 'avoid',
    }}>
      {children}
    </h3>
  )
}

export default function FinalSpec({ header, panels, profiles, doors, series = '60' }: Props) {
  const wallPanels = panels.filter(p => !(p.panelLabel ?? '').startsWith('Д'))
  const decorProfiles = profiles.filter(p => p.article === DECOR_ARTICLE)
  const mainProfiles = profiles.filter(p => p.article !== DECOR_ARTICLE)

  const panelsTotal = panels.reduce((s, p) => s + (p.total ?? 0), 0)
  const profilesTotal = profiles.reduce((s, p) => s + p.total_cost, 0)
  const retailTotal = panelsTotal + profilesTotal

  const totalQty = wallPanels.reduce((s, p) => s + p.quantity, 0)
  const totalArea = wallPanels.reduce((s, p) => s + (p.areaSqm ?? 0), 0)

  const decorColor = [...new Set(panels.map(p => p.aluminumColor).filter(Boolean))].join(', ')

  return (
    <div className="card">
      <div className="flex justify-between flex-center no-print" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Общая спецификация заказа стеновых панелей</h2>
        <button className="btn btn-ghost btn-sm" onClick={printSpec}>Печать</button>
      </div>

      <div className="print-only" style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 700 }}>
        NUOVO {series} — ОБЩАЯ СПЕЦИФИКАЦИЯ ЗАКАЗА СТЕНОВЫХ ПАНЕЛЕЙ
      </div>

      {/* ── Шапка заказа ── */}
      <div className="grid-3" style={{ marginTop: 16 }}>
        <HeaderField label="КОНТРАГЕНТ" value={header.counterparty} />
        <HeaderField label="Ф.И.О. ЗАКАЗЧИКА" value={header.customer_name} />
        <HeaderField label="НОМЕР СЧЁТА" value={header.invoice_number} />
        <HeaderField label="АГЕНТ" value={header.agent_name} />
        <HeaderField label="ГОРОД" value={header.city} />
        <HeaderField label="ДАТА ПРИНЯТИЯ ЗАКАЗА" value={formatDate(header.order_date)} />
        <HeaderField label="НОМЕР ЗАКАЗА" value={header.order_number} />
      </div>

      {/* ── Дверные проёмы ── */}
      {doors.length > 0 && (
        <>
          <SectionTitle>РАЗМЕРЫ ДВЕРНЫХ ПРОЁМОВ (РАСЧЁТ СТЕНОВОЙ ПАНЕЛИ НАД ДВЕРНЫМ ПРОЁМОМ)</SectionTitle>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№ п/п</th>
                  <th>№ заказа дверного полотна из DGV</th>
                  <th>L проёма, мм</th>
                  <th>H проёма, мм</th>
                  <th>H потолка, мм</th>
                  <th>Тип монтажа двери</th>
                  <th>Открывание двери</th>
                  <th>Группа отделок</th>
                  <th>Отделка</th>
                  <th>Наименование декора (3D) / направление шпона</th>
                  <th>Размеры панели над дверью (узлы обработки)</th>
                  <th>Итоговая стоимость панели, ₽</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {doors.map((d, i) => {
                  const dp = doorPanels(panels, i)
                  const overhead = dp.find(p => p.panelLabel === `Д${i + 1}`)
                  const cost = dp.reduce((s, p) => s + (p.total ?? 0), 0)
                  return (
                    <tr key={i}>
                      <td><strong>{i + 1}</strong></td>
                      <td>{dash(d.doorRef)}</td>
                      <td><strong>{d.openingW}</strong></td>
                      <td><strong>{d.openingH}</strong></td>
                      <td>{d.ceilingH}</td>
                      <td>{dash(d.mountType)}</td>
                      <td>{dash(d.openingDir)}</td>
                      <td>{dash(d.finishGroup)}</td>
                      <td>{dash(d.finishName)}</td>
                      <td className="text-muted">{dash(d.decor3d || d.veneerDirection)}</td>
                      <td>{overhead ? `${dimensions(overhead)} \\ ${overhead.bottomEdge}` : '—'}</td>
                      <td className="text-right price"><strong>{money(cost)}</strong></td>
                      <td className="text-muted">{dash(d.notes)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Стеновые панели ── */}
      <SectionTitle>СПЕЦИФИКАЦИЯ СТЕНОВЫХ ПАНЕЛЕЙ — {totalQty} шт. / {totalArea.toFixed(2)} кв.м</SectionTitle>
      {wallPanels.length === 0 ? (
        <div className="alert alert-info">Стеновых панелей в заказе нет.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№ п/п</th>
                <th>Размеры панели и типы кромок</th>
                <th>Тип обработки узла верх панели</th>
                <th>Тип обработки узла низ панели</th>
                <th>Количество панелей, шт</th>
                <th>Группа отделок</th>
                <th>Отделка</th>
                <th>Наименование декора (3D) / направление шпона</th>
                <th>Кол-во вертикального алюм. декора, шт</th>
                <th>Кол-во горизонтального алюм. декора, шт</th>
                <th>Цвет декора</th>
                <th>Кв.м</th>
                <th>Итоговая стоимость панели, ₽</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {wallPanels.map((p, i) => (
                <tr key={i}>
                  <td><strong>{i + 1}</strong></td>
                  <td><strong>{dimensions(p)}</strong></td>
                  <td>{p.topEdge ? <span className="badge badge-gray">{p.topEdge}</span> : '—'}</td>
                  <td>{p.bottomEdge ? <span className="badge badge-gray">{p.bottomEdge}</span> : '—'}</td>
                  <td><strong>{p.quantity}</strong></td>
                  <td>{dash(p.finishGroup)}</td>
                  <td>{dash(p.finishName)}</td>
                  <td className="text-muted">{dash(p.decor3d || p.veneerDirection)}</td>
                  <td>{p.aluminumVertical || '—'}</td>
                  <td>{p.aluminumHorizontal || '—'}</td>
                  <td className="text-muted">{dash(p.aluminumColor)}</td>
                  <td className="text-right"><strong>{(p.areaSqm ?? 0).toFixed(2)}</strong></td>
                  <td className="text-right price"><strong>{money(p.total ?? 0)}</strong></td>
                  <td className="text-muted">{dash(p.notes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Разбивка по отделкам ── */}
      <div style={{ marginTop: 26 }}>
        <FinishBreakdown panels={panels} subtitle="все панели заказа, включая дверные" />
      </div>

      {/* ── Алюминиевый профиль ── */}
      {mainProfiles.length > 0 && (
        <>
          <SectionTitle>СПЕЦИФИКАЦИЯ АЛЮМИНИЕВОГО ПРОФИЛЯ</SectionTitle>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№ п/п</th>
                  <th>Вид профиля и его номер</th>
                  <th>Артикул</th>
                  <th>Длина, мм</th>
                  <th>Количество, шт</th>
                  <th>Цена/шт, ₽</th>
                  <th>Стоимость, ₽</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {mainProfiles.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{i + 1}</strong></td>
                    <td>{p.name}</td>
                    <td><span className="badge badge-gray">{p.article}</span></td>
                    <td>{p.length}</td>
                    <td><strong>{p.quantity}</strong></td>
                    <td className="text-right">{money(p.price_per_piece)}</td>
                    <td className="text-right price">{money(p.total_cost)}</td>
                    <td className="text-muted">{dash(p.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Алюминиевый профиль-декор ── */}
      {decorProfiles.length > 0 && (
        <>
          <SectionTitle>СПЕЦИФИКАЦИЯ АЛЮМИНИЕВОГО ПРОФИЛЯ — ДЕКОРА</SectionTitle>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№ п/п</th>
                  <th>Вид профиля и его номер</th>
                  <th>Артикул</th>
                  <th>Цвет отделки алюминиевого профиля</th>
                  <th>Длина, мм</th>
                  <th>Количество, шт</th>
                  <th>Стоимость, ₽</th>
                </tr>
              </thead>
              <tbody>
                {decorProfiles.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{i + 1}</strong></td>
                    <td>Профиль декор</td>
                    <td><span className="badge badge-gray">{p.article}</span></td>
                    <td className="text-muted">{dash(decorColor)}</td>
                    <td>{p.length}</td>
                    <td><strong>{p.quantity}</strong></td>
                    <td className="text-right price">{money(p.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Розничная стоимость ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'baseline',
        marginTop: 24, paddingTop: 14, borderTop: '2px solid #e2e8f0',
        fontSize: '1.1rem', fontWeight: 700, color: '#1a4d8a',
      }}>
        <span>РОЗНИЧНАЯ СТОИМОСТЬ ЗАКАЗА</span>
        <span className="price">{retailTotal.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
      </div>

      {/* ── Подписи ── */}
      <div className="grid-3" style={{ marginTop: 36 }}>
        <HeaderField label="ПОДПИСЬ ЗАКАЗЧИКА" value="" />
        <HeaderField label="ПОДПИСЬ АГЕНТА" value="" />
        <HeaderField label="ДАТА" value={formatDate(header.order_date)} />
      </div>
    </div>
  )
}
