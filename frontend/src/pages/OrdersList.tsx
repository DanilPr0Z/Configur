import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchOrders, deleteOrder, createOrder } from '../api'
import type { Order } from '../api'

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchOrders().then(data => { setOrders(data); setLoading(false) })
  }, [])

  const handleCreate = async () => {
    const order = await createOrder({
      customer_name: '', agent_name: '', counterparty: '',
      order_number: '', invoice_number: '', order_date: null, city: '', notes: '',
    })
    navigate(`/orders/${order.id}`)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить заказ?')) return
    await deleteOrder(id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div className="page">
      <div className="container">
        <div className="flex justify-between flex-center" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Заказы стеновых панелей</h1>
          <button className="btn btn-primary" onClick={handleCreate}>+ Новый заказ</button>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card alert alert-info">
            Заказов пока нет. Нажмите «Новый заказ» чтобы начать.
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Номер заказа</th>
                    <th>Заказчик</th>
                    <th>Агент</th>
                    <th>Город</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>
                        <Link to={`/orders/${o.id}`} style={{ color: '#4c6ef5', fontWeight: 600 }}>
                          {o.order_number || `Заказ #${o.id}`}
                        </Link>
                      </td>
                      <td>{o.customer_name || '—'}</td>
                      <td>{o.agent_name || '—'}</td>
                      <td>{o.city || '—'}</td>
                      <td>{o.order_date || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">Открыть</Link>
                          <Link to={`/?order=${o.id}`} className="btn btn-primary btn-sm">Изменить</Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.id!)}>
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
