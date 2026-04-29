import type { Panel, JointType, FinishGroup, ProfileColor } from '../api'
import JointSelect from './JointSelect'

interface Props {
  panel: Panel
  label: string
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  profileColors: ProfileColor[]
  onChange: (updated: Panel) => void
  onDelete: () => void
}

const fmt = (n?: number) => n != null ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

export default function PanelRow({ panel, label, jointTypes, finishGroups, profileColors, onChange, onDelete }: Props) {
  const selectedGroup = finishGroups.find(g => g.id === panel.finish_group)
  const finishes = selectedGroup?.finishes ?? []

  const set = (field: keyof Panel, value: any) => onChange({ ...panel, [field]: value })

  return (
    <tr>
      <td style={{ fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</td>
      <td>
        <input type="number" value={panel.height_mm || ''} placeholder="Выс"
          onChange={e => set('height_mm', +e.target.value)} style={{ width: 72 }} />
      </td>
      <td>
        <JointSelect value={panel.joint_left} jointTypes={jointTypes} onChange={v => set('joint_left', v)} />
      </td>
      <td>
        <input type="number" value={panel.width_mm || ''} placeholder="Шир"
          onChange={e => set('width_mm', +e.target.value)} style={{ width: 72 }} />
      </td>
      <td>
        <JointSelect value={panel.joint_right} jointTypes={jointTypes} onChange={v => set('joint_right', v)} />
      </td>
      <td>
        <input type="number" value={panel.quantity} min={1}
          onChange={e => set('quantity', +e.target.value)} style={{ width: 50 }} />
      </td>
      <td className="text-right">{fmt(panel.joint_side_cost)}</td>

      <td>
        <JointSelect value={panel.joint_top} jointTypes={jointTypes} onChange={v => set('joint_top', v)} />
      </td>
      <td>
        <JointSelect value={panel.joint_bottom} jointTypes={jointTypes} onChange={v => set('joint_bottom', v)} />
      </td>
      <td className="text-right">{fmt(panel.joint_top_bottom_cost)}</td>

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
      <td>
        <input value={panel.veneer_direction || ''} placeholder="Напр. шпона"
          onChange={e => set('veneer_direction', e.target.value)} style={{ width: 90 }} />
      </td>
      <td>
        <input value={panel.decor_name || ''} placeholder="Декор 3D"
          onChange={e => set('decor_name', e.target.value)} style={{ width: 100 }} />
      </td>

      {/* Алюминий */}
      <td>
        <input type="number" value={panel.aluminum_vertical_count || 0} min={0}
          onChange={e => set('aluminum_vertical_count', +e.target.value)} style={{ width: 46 }} />
      </td>
      <td>
        <input type="number" value={panel.aluminum_horizontal_count || 0} min={0}
          onChange={e => set('aluminum_horizontal_count', +e.target.value)} style={{ width: 46 }} />
      </td>
      <td>
        <select value={panel.aluminum_color ?? ''} onChange={e => set('aluminum_color', e.target.value ? +e.target.value : null)}>
          <option value="">—</option>
          {profileColors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>

      {/* Кв.м и наценка */}
      <td className="text-right">{panel.area_sqm != null ? panel.area_sqm.toFixed(2) : '—'}</td>
      <td>
        <select value={panel.markup_percent} onChange={e => set('markup_percent', +e.target.value)}>
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
