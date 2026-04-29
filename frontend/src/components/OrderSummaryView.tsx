import { useEffect, useState } from 'react'
import { fetchOrderSummary } from '../api'
import type { OrderSummary } from '../api'

interface Props { orderId: number }

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'

export default function OrderSummaryView({ orderId }: Props) {
  const [data, setData] = useState<OrderSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchOrderSummary(orderId).then(d => { setData(d); setLoading(false) })
  }, [orderId])

  if (loading) return <div className="card" style={{ textAlign: 'center' }}><div className="spinner" /></div>
  if (!data) return null

  return (
    <div className="card">
      <h2>Итоговая спецификация</h2>

      <div className="summary-row">
        <span>Стеновые панели ({data.panels_count} поз.)</span>
        <span className="fw-bold">{fmt(data.panels_total)}</span>
      </div>
      <div className="summary-row">
        <span>Панели над дверями</span>
        <span className="fw-bold">{fmt(data.door_panels_total)}</span>
      </div>

      {data.profiles.length > 0 && (
        <>
          <h2 style={{ marginTop: 16, marginBottom: 10 }}>Алюминиевые профили</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Наименование</th>
                  <th>Длина, мм</th>
                  <th>Кол-во, шт</th>
                  <th>Цена/шт</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((p, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-gray">{p.article}</span></td>
                    <td>{p.name}</td>
                    <td>{p.length_mm}</td>
                    <td>{p.quantity}</td>
                    <td>{fmt(p.price_per_piece)}</td>
                    <td className="price">{fmt(p.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="summary-row mt-2">
            <span>Итого профили</span>
            <span className="fw-bold">{fmt(data.profiles_total)}</span>
          </div>
        </>
      )}

      <div className="summary-row total">
        <span>ИТОГО ЗАКАЗ</span>
        <span className="price">{fmt(data.grand_total)}</span>
      </div>
    </div>
  )
}
