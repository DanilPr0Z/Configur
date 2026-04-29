import type { DoorPanel, JointType, FinishGroup } from '../api'
import JointSelect from './JointSelect'

interface Props {
  panel: DoorPanel
  label: string
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  onChange: (updated: DoorPanel) => void
  onDelete: () => void
}

const fmt = (n?: number) => n != null ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

export default function DoorPanelRow({ panel, label, jointTypes, finishGroups, onChange, onDelete }: Props) {
  const selectedGroup = finishGroups.find(g => g.id === panel.finish_group)
  const finishes = selectedGroup?.finishes ?? []

  const set = (field: keyof DoorPanel, value: any) => onChange({ ...panel, [field]: value })

  // При изменении размеров проёма — пересчитываем размеры панели
  const setOpening = (field: 'opening_width' | 'opening_height' | 'ceiling_height', value: number) => {
    const updated = { ...panel, [field]: value }
    const h = updated.ceiling_height - updated.opening_height
    const w = updated.opening_width
    onChange(h > 0 && w > 0 ? { ...updated, panel_height: Math.round(h), panel_width: Math.round(w) } : updated)
  }

  return (
    <tr>
      <td style={{ fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</td>

      {/* № заказа двери */}
      <td>
        <input value={panel.door_order_number || ''} placeholder="№ двери (DGV)"
          onChange={e => set('door_order_number', e.target.value)} style={{ width: 100 }} />
      </td>

      {/* Размеры проёма */}
      <td>
        <input type="number" value={panel.opening_width || ''} placeholder="мм"
          onChange={e => setOpening('opening_width', +e.target.value)} style={{ width: 68 }} />
      </td>
      <td>
        <input type="number" value={panel.opening_height || ''} placeholder="мм"
          onChange={e => setOpening('opening_height', +e.target.value)} style={{ width: 68 }} />
      </td>
      <td>
        <input type="number" value={panel.ceiling_height || ''} placeholder="мм"
          onChange={e => setOpening('ceiling_height', +e.target.value)} style={{ width: 68 }} />
      </td>

      {/* Тип монтажа и открывание */}
      <td>
        <select value={panel.mount_type} onChange={e => set('mount_type', e.target.value)}>
          <option value="ceiling">В потолок</option>
          <option value="opening">В проём</option>
        </select>
      </td>
      <td>
        <select value={panel.opening_direction} onChange={e => set('opening_direction', e.target.value)}>
          <option value="in">Внутрь</option>
          <option value="out">Наружу</option>
        </select>
      </td>

      {/* Узлы соединения с соседними панелями */}
      <td>
        <JointSelect value={panel.joint_top_left} jointTypes={jointTypes} onChange={v => set('joint_top_left', v)} />
      </td>
      <td>
        <JointSelect value={panel.joint_top_right} jointTypes={jointTypes} onChange={v => set('joint_top_right', v)} />
      </td>
      <td>
        <JointSelect value={panel.joint_bottom} jointTypes={jointTypes} onChange={v => set('joint_bottom', v)} />
      </td>

      {/* Кромки самой панели */}
      <td>
        <JointSelect value={panel.edge_left} jointTypes={jointTypes} onChange={v => set('edge_left', v)} />
      </td>
      <td>
        <JointSelect value={panel.edge_right} jointTypes={jointTypes} onChange={v => set('edge_right', v)} />
      </td>
      <td>
        <JointSelect value={panel.edge_top} jointTypes={jointTypes} onChange={v => set('edge_top', v)} />
      </td>
      <td>
        <JointSelect value={panel.edge_bottom} jointTypes={jointTypes} onChange={v => set('edge_bottom', v)} />
      </td>

      {/* Количество */}
      <td>
        <input type="number" value={panel.quantity || 1} min={1}
          onChange={e => set('quantity', +e.target.value)} style={{ width: 50 }} />
      </td>

      {/* Размеры панели (авторасчёт) */}
      <td className="text-right" style={{ whiteSpace: 'nowrap', color: '#555' }}>
        {panel.panel_height > 0 ? panel.panel_height : '—'}
      </td>
      <td className="text-right" style={{ whiteSpace: 'nowrap', color: '#555' }}>
        {panel.panel_width > 0 ? panel.panel_width : '—'}
      </td>

      {/* Стоимости кромок */}
      <td className="text-right">{fmt(panel.edge_side_cost)}</td>
      <td className="text-right">{fmt(panel.edge_top_bottom_cost)}</td>

      {/* Отделка */}
      <td>
        <select value={panel.finish_group ?? ''} onChange={e => {
          const fg = e.target.value ? +e.target.value : null
          onChange({ ...panel, finish_group: fg, finish: null })
        }}>
          <option value="">—</option>
          {finishGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </td>
      <td>
        <select value={panel.finish ?? ''} onChange={e => set('finish', e.target.value ? +e.target.value : null)}>
          <option value="">—</option>
          {finishes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </td>

      {/* Направление шпона и Декор 3D — два отдельных поля */}
      <td>
        <input value={panel.veneer_direction || ''} placeholder="Напр. шпона"
          onChange={e => set('veneer_direction', e.target.value)} style={{ width: 90 }} />
      </td>
      <td>
        <input value={panel.decor_name || ''} placeholder="Декор 3D"
          onChange={e => set('decor_name', e.target.value)} style={{ width: 100 }} />
      </td>

      {/* Площадь, наценка, итог */}
      <td className="text-right">{panel.area_sqm != null ? panel.area_sqm.toFixed(2) : '—'}</td>
      <td>
        <select value={panel.markup_percent ?? 0} onChange={e => set('markup_percent', +e.target.value)}>
          {[0, 5, 10, 15, 20, 100].map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </td>
      <td className="text-right price">{fmt(panel.total_cost)}</td>

      {/* Примечание */}
      <td>
        <input value={panel.notes || ''} placeholder="Примечание"
          onChange={e => set('notes', e.target.value)} style={{ width: 120 }} />
      </td>

      <td>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>✕</button>
      </td>
    </tr>
  )
}
