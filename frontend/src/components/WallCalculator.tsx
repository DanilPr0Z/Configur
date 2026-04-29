import { useState } from 'react'
import { calculateWall } from '../api'
import type { JointType, WallCalcResult } from '../api'
import JointSelect from './JointSelect'

interface Props {
  jointTypes: JointType[]
  onAddPanels?: (width: number, count: number, jointLeft: string, jointRight: string) => void
}

export default function WallCalculator({ jointTypes, onAddPanels }: Props) {
  const [wallLength, setWallLength] = useState(0)
  const [panelCount, setPanelCount] = useState(1)
  const [jointLeft, setJointLeft] = useState('A')
  const [jointRight, setJointRight] = useState('A')
  const [connection, setConnection] = useState('B')
  const [result, setResult] = useState<WallCalcResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCalc = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await calculateWall({
        wall_length: wallLength,
        panel_count: panelCount,
        joint_left_code: jointLeft,
        joint_right_code: jointRight,
        connection_type_code: connection,
      })
      setResult(res)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Ошибка расчёта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Калькулятор раскладки стены</h2>
      <p className="text-muted" style={{ marginBottom: 14 }}>
        Введите параметры отрезка стены — получите ширину каждой панели
      </p>

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Длина стены, мм</label>
          <input type="number" value={wallLength || ''} onChange={e => setWallLength(+e.target.value)} />
        </div>
        <div className="field">
          <label>Кол-во панелей</label>
          <input type="number" min={1} max={10} value={panelCount}
            onChange={e => setPanelCount(+e.target.value)} />
        </div>
        <div className="field">
          <label>Узел левого края</label>
          <JointSelect
            value={jointTypes.find(j => j.code === jointLeft)?.id ?? null}
            jointTypes={jointTypes}
            onChange={id => setJointLeft(jointTypes.find(j => j.id === id)?.code ?? '')}
          />
        </div>
        <div className="field">
          <label>Узел правого края</label>
          <JointSelect
            value={jointTypes.find(j => j.code === jointRight)?.id ?? null}
            jointTypes={jointTypes}
            onChange={id => setJointRight(jointTypes.find(j => j.id === id)?.code ?? '')}
          />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Тип соединения панелей между собой</label>
          <JointSelect
            value={jointTypes.find(j => j.code === connection)?.id ?? null}
            jointTypes={jointTypes}
            onChange={id => setConnection(jointTypes.find(j => j.id === id)?.code ?? '')}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={handleCalc} disabled={loading}>
          {loading ? <span className="spinner" /> : ''}
          Рассчитать
        </button>
      </div>

      {result && (
        <div className="mt-4 alert alert-success">
          <strong>Результат:</strong> {result.panel_count} панел. по{' '}
          <strong>{result.panel_width} мм</strong>
          {' '}(общая длина по панелям: {result.total_panel_length} мм)
          {onAddPanels && (
            <button
              className="btn btn-success btn-sm"
              style={{ marginLeft: 14 }}
              onClick={() => onAddPanels(result.panel_width, result.panel_count, result.joint_left, result.joint_right)}
            >
              Добавить панели в спецификацию
            </button>
          )}
        </div>
      )}
    </div>
  )
}
