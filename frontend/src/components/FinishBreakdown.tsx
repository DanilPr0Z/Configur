import { useMemo } from 'react'

export interface FinishBreakdownPanel {
  finishGroup: string
  finishName: string
  decor3d: string
  quantity: number
  areaSqm?: number
  total?: number
}

interface Group {
  finishGroup: string
  finishName: string
  decor3d: string
  quantity: number
  areaSqm: number
  total: number
}

export function groupByFinish(panels: FinishBreakdownPanel[]): Group[] {
  const map = new Map<string, Group>()
  for (const p of panels) {
    const key = `${p.finishGroup}|${p.finishName}|${p.decor3d}`
    let g = map.get(key)
    if (!g) {
      g = { finishGroup: p.finishGroup, finishName: p.finishName, decor3d: p.decor3d, quantity: 0, areaSqm: 0, total: 0 }
      map.set(key, g)
    }
    g.quantity += p.quantity
    g.areaSqm += p.areaSqm ?? 0
    g.total += p.total ?? 0
  }
  return [...map.values()].sort((a, b) =>
    a.finishGroup.localeCompare(b.finishGroup, 'ru') || a.finishName.localeCompare(b.finishName, 'ru'),
  )
}

const fmt = (n: number) => n > 0 ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

/** Сводка «сколько штук и кв.м в какой отделке». Показывается только когда отделок больше одной. */
export default function FinishBreakdown({ panels, subtitle }: {
  panels: FinishBreakdownPanel[]
  subtitle?: string
}) {
  const groups = useMemo(() => groupByFinish(panels), [panels])
  if (groups.length < 2) return null

  const totalQty = groups.reduce((s, g) => s + g.quantity, 0)
  const totalArea = groups.reduce((s, g) => s + g.areaSqm, 0)
  const totalCost = groups.reduce((s, g) => s + g.total, 0)

  return (
    <>
      <h3 className="spec-section-title">
        Разбивка по отделкам: {groups.length}
        {subtitle && <span style={{ fontWeight: 400, color: '#888' }}> — {subtitle}</span>}
      </h3>
      <div className="table-wrap" style={{ marginBottom: 22 }}>
        <table>
          <thead>
            <tr>
              <th>Группа отделок</th>
              <th>Отделка</th>
              <th>Декор 3D / направление</th>
              <th>Кол-во панелей, шт</th>
              <th>Кв.м</th>
              <th>Сумма, ₽</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={i}>
                <td>{g.finishGroup || '—'}</td>
                <td><strong>{g.finishName || '—'}</strong></td>
                <td className="text-muted">{g.decor3d || '—'}</td>
                <td><strong>{g.quantity}</strong></td>
                <td className="text-right"><strong>{g.areaSqm.toFixed(2)}</strong></td>
                <td className="text-right price">{fmt(g.total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right' }}>Итого</td>
              <td><strong>{totalQty}</strong></td>
              <td className="text-right"><strong>{totalArea.toFixed(2)}</strong></td>
              <td className="text-right price"><strong>{fmt(totalCost)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
