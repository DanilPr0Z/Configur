// Раскладка спереди («развёртка стены») — вид на стену с фасада: панели по
// столбцам и рядам, дверные проёмы с панелью над ними, зазоры сверху и снизу.
// Схема раскладки (WallScheme) показывает вид СВЕРХУ и повороты на углах;
// здесь углы разворачиваются в одну плоскость, как на чертеже развёртки.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { JointType } from '../api'

// ── Данные для отрисовки ─────────────────────────────────────────────────────

export interface ElevWall {
  kind: 'wall'
  id: string
  name: string
  wallLength: number
  wallHeight: number
  lengthByNodes: number    // длина по узлам: панели короче стены на поправки краёв
  gapTop: number
  gapBottom: number
  widths: number[]         // ширина каждого столбца, мм
  colRows: number[][]      // [столбец][ряд сверху вниз] — высоты рядов этого столбца
  // Панели стены: span > 1 — объединённые (шов убран), ширина уже с учётом шва.
  cells: {
    row: number; col: number; span: number; rowSpan: number
    width: number; height: number
    label: string          // номер панели из спецификации (1.1, 1.2…)
    drawLabel: string      // обозначение на чертеже (А1, А2…)
  }[]
  topEdge: string          // узел верха верхнего ряда
  bottomEdge: string       // узел низа нижнего ряда
  leftNode: string
  rightNode: string
  connType: string         // вертикальный стык столбцов
  rowConn: string          // горизонтальный стык рядов
  copies: number
}

export interface ElevDoor {
  kind: 'door'
  id: string
  label: string
  openingW: number
  openingH: number
  ceilingH: number
  panelLabel: string       // «Д1» — панель над проёмом в спецификации
  panelDrawLabel: string   // обозначение панели над проёмом на чертеже (А2…)
  doorLabel: string        // «Д-42641» — дверное полотно по номеру заказа DGV
  topEdge: string          // верхняя кромка панели над проёмом
  panelW: number | null    // null для монтажа В ПОТОЛОК
  panelH: number | null
  leftNode: string
  rightNode: string
  bottomEdge: string       // узел низа надпроёмной панели (G/H, авто)
  hingeLeft: boolean
  opensOut: boolean
  copies: number
  // Добор обрамления: панели в откосе проёма (в развёртке видны с торца).
  // null — добор не заказан.
  trim: {
    label: string          // «Д1» — база номера панели добора в спецификации
    drawLabels: string[]   // обозначения на чертеже: верх, левый, правый
    top: { w: number; h: number; leftNode: string; rightNode: string } | null
    left: { w: number; h: number; wallNode: string }
    right: { w: number; h: number; wallNode: string }
  } | null
}

export type ElevItem = ElevWall | ElevDoor

interface Props {
  items: ElevItem[]
  jointTypes?: JointType[]
  sections?: boolean   // показывать разрезы дверей под развёрткой
}

// ── Геометрия холста ─────────────────────────────────────────────────────────

const PAD_L = 74   // место под вертикальную размерную линию
const PAD_R = 26
const PAD_T = 34   // место под названия участков
const PAD_B = 62   // место под горизонтальную размерную линию и узлы

const nodeColor = (code: string): string => {
  if (['A', 'FL', 'FR', 'E', 'I'].includes(code)) return '#3b82f6'
  if (code === 'B') return '#f97316'
  if (code === 'C') return '#22c55e'
  if (['D', 'DG', 'DH'].includes(code)) return '#a855f7'
  if (['G', 'H'].includes(code)) return '#ef4444'
  return '#64748b'
}

const itemWidth = (it: ElevItem) => it.kind === 'wall' ? it.wallLength : it.openingW
const itemHeight = (it: ElevItem) => it.kind === 'wall' ? it.wallHeight : it.ceilingH

interface HoverState { code: string; jt: JointType | null; x: number; y: number }

export default function WallElevation({ items, jointTypes = [], sections = true }: Props) {
  const [hover, setHover] = useState<HoverState | null>(null)
  if (items.length === 0) return null

  const jtByCode = new Map(jointTypes.map(j => [j.code, j]))
  const hoverProps = (code: string) => ({
    style: { cursor: 'pointer' as const },
    onMouseEnter: (e: React.MouseEvent) =>
      setHover({ code, jt: jtByCode.get(code) ?? null, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setHover(null),
  })
  const totalMm = items.reduce((s, it) => s + itemWidth(it), 0)
  const maxHmm = Math.max(...items.map(itemHeight), 1)
  if (totalMm <= 0) return null

  // Масштаб подбираем так, чтобы развёртка влезла и по ширине, и по высоте.
  const scale = Math.min(1060 / totalMm, 460 / maxHmm, 0.3)
  const W = totalMm * scale
  const H = maxHmm * scale
  const svgW = W + PAD_L + PAD_R
  const svgH = H + PAD_T + PAD_B

  // y=0 — пол (низ развёртки); вверх идёт отрицательное направление SVG.
  const yOf = (mm: number) => PAD_T + H - mm * scale
  const floorY = yOf(0)

  // Позиции элементов слева направо
  let cursor = 0
  const placed = items.map(it => {
    const x = PAD_L + cursor * scale
    cursor += itemWidth(it)
    return { it, x, w: itemWidth(it) * scale }
  })

  // Подпись узла в рамке — как на чертежах СП: буква узла стоит у самого шва.
  const EdgeTag = ({ x, y, code }: { x: number; y: number; code?: string }) => {
    if (!code) return null
    const w = 7 + code.length * 4.5
    const jt = jtByCode.get(code)
    return (
      <g {...hoverProps(code)}>
        <title>{jt ? `${code} — ${jt.name}` : code}</title>
        <rect x={x - w / 2} y={y - 6} width={w} height={12} rx={1.5}
          fill="#fff" stroke={nodeColor(code)} strokeWidth="0.9" />
        <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central"
          fontSize="7.5" fontWeight="700" fill={nodeColor(code)} fontFamily="monospace">
          {code}
        </text>
      </g>
    )
  }

  const Badge = ({ x, y, code }: { x: number; y: number; code?: string }) => {
    if (!code) return null
    const r = code.length > 2 ? 9 : 7.5
    const jt = jtByCode.get(code)
    return (
      <g {...hoverProps(code)}>
        <title>{jt ? `${code} — ${jt.name}` : code}</title>
        <circle cx={x} cy={y} r={r} fill={nodeColor(code)} opacity={0.92} />
        <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central"
          fontSize={code.length > 2 ? 6.5 : 8} fontWeight="700" fill="#fff" fontFamily="monospace">
          {code}
        </text>
      </g>
    )
  }

  // Размерная линия с засечками и подписью
  const DimH = ({ x1, x2, y, text }: { x1: number; x2: number; y: number; text: string }) => (
    <g stroke="#94a3b8" strokeWidth="0.8">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 3.5} x2={x1} y2={y + 3.5} />
      <line x1={x2} y1={y - 3.5} x2={x2} y2={y + 3.5} />
      {x2 - x1 >= 26 && (
        <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" fontSize="7.5" fill="#64748b" stroke="none">
          {text}
        </text>
      )}
    </g>
  )

  const DimV = ({ y1, y2, x, text }: { y1: number; y2: number; x: number; text: string }) => (
    <g stroke="#94a3b8" strokeWidth="0.8">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 3.5} y1={y1} x2={x + 3.5} y2={y1} />
      <line x1={x - 3.5} y1={y2} x2={x + 3.5} y2={y2} />
      {Math.abs(y2 - y1) >= 24 && (
        <text x={x - 5} y={(y1 + y2) / 2} textAnchor="middle" fontSize="7.5" fill="#64748b"
          stroke="#fff" strokeWidth="2.5" paintOrder="stroke"
          transform={`rotate(-90, ${x - 5}, ${(y1 + y2) / 2})`}>
          {text}
        </text>
      )}
    </g>
  )

  // Отметка высоты: «+2,785» со стрелкой на уровень, как на чертежах СП.
  const level = (mm: number) => `+${(mm / 1000).toFixed(3).replace('.', ',')}`
  const Level = ({ x, y, mm, anchor = 'start' }: { x: number; y: number; mm: number; anchor?: 'start' | 'end' }) => {
    const dir = anchor === 'start' ? 1 : -1
    return (
      <g>
        <path d={`M ${x} ${y} l ${5 * dir} -5 l ${5 * dir} 5 z`} fill="none" stroke="#475569" strokeWidth="0.9" />
        <line x1={x} y1={y - 5} x2={x + 22 * dir} y2={y - 5} stroke="#475569" strokeWidth="0.8" />
        <text x={x + 24 * dir} y={y - 7.5} textAnchor={anchor} fontSize="7.5" fill="#334155" fontWeight="600"
          stroke="#fff" strokeWidth="2.5" paintOrder="stroke">
          {level(mm)}
        </text>
      </g>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}>

        {/* Пол — общая линия под всей развёрткой */}
        <line x1={PAD_L - 10} y1={floorY} x2={PAD_L + W + 8} y2={floorY}
          stroke="#475569" strokeWidth="1.6" />

        {/* Вертикальная размерная линия: высота первого участка */}
        {(() => {
          const first = placed[0]
          const h = itemHeight(first.it)
          return <DimV x={PAD_L - 34} y1={yOf(h)} y2={floorY} text={`${h} мм`} />
        })()}

        {placed.map(({ it, x, w }) => {
          if (it.kind === 'wall') {
            const topY = yOf(it.wallHeight)
            // Панельный блок: от пола вверх с зазорами снизу и сверху.
            const blockBottom = yOf(it.gapBottom)
            // Столбцы могут делиться на разное число рядов (как П52 и П53 в СП):
            // высота блока — по самому высокому столбцу, каждый столбец режется сам.
            const rowsTotal = Math.max(...it.colRows.map(rs => rs.reduce((s, v) => s + v, 0)), 0)
            const blockTop = blockBottom - rowsTotal * scale
            const widthsTotal = it.widths.reduce((s, v) => s + v, 0)

            // X-границы столбцов внутри блока + Y-границы их рядов сверху вниз
            let cx = x
            const cols = it.widths.map((mm, ci) => {
              const c = { x: cx, w: mm * scale, mm, rows: [] as { y: number; h: number; mm: number }[] }
              cx += mm * scale
              let cy = blockTop
              for (const rmm of it.colRows[ci] ?? []) {
                c.rows.push({ y: cy, h: rmm * scale, mm: rmm })
                cy += rmm * scale
              }
              return c
            })

            // Геометрия панелей с учётом объединений: ячейка занимает span столбцов.
            const cells = it.cells.map(cl => {
              const c0 = cols[cl.col]
              const rowGeom = c0?.rows[cl.row]
              const wpx = it.widths.slice(cl.col, cl.col + cl.span)
                .reduce((s2, mm) => s2 + mm * scale, 0)
              const spanRows = (c0?.rows ?? []).slice(cl.row, cl.row + cl.rowSpan)
              const hpx = spanRows.reduce((s2, rr) => s2 + rr.h, 0)
              return {
                ...cl,
                x: c0?.x ?? x, w: wpx,
                y: rowGeom?.y ?? blockTop, h: hpx,
                lastCol: cl.col + cl.span - 1,
                lastRow: cl.row + cl.rowSpan - 1,
              }
            })

            return (
              <g key={it.id}>
                {/* Контур стены (габарит участка) */}
                <rect x={x} y={topY} width={w} height={floorY - topY}
                  fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3" />

                {/* Панели */}
                {cells.map((c, k) => (
                  <g key={k}>
                    <rect x={c.x} y={c.y} width={c.w} height={c.h}
                      fill="#dbeafe" stroke="#60a5fa" strokeWidth="1" />
                    {c.w >= 30 && c.h >= 18 && (
                      <text x={c.x + c.w / 2} y={c.y + c.h / 2 - 5} textAnchor="middle"
                        dominantBaseline="central" fontSize="11" fill="#1e40af" fontWeight="700">
                        {c.drawLabel}
                      </text>
                    )}
                    {c.w >= 52 && c.h >= 32 && (
                      <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 8} textAnchor="middle"
                        dominantBaseline="central" fontSize="7" fill="#3b5bdb">
                        {c.height} × {c.width}
                      </text>
                    )}
                  </g>
                ))}

                {/* Недобор: ширины введены вручную и не дотягивают до длины по узлам.
                    С длиной стены не сравниваем — панели штатно короче неё на поправки
                    краевых узлов (A даёт −15 мм с каждой стороны). */}
                {widthsTotal < it.lengthByNodes - 0.5 && (
                  <rect x={x + widthsTotal * scale} y={blockTop}
                    width={(it.lengthByNodes - widthsTotal) * scale} height={blockBottom - blockTop}
                    fill="#fee2e2" stroke="#fca5a5" strokeWidth="1" strokeDasharray="3 2" />
                )}

                {/* Зазоры сверху и снизу */}
                {it.gapTop > 0 && blockTop - topY >= 3 && (
                  <rect x={x} y={topY} width={w} height={blockTop - topY} fill="#fef3c7" opacity={0.75} />
                )}
                {it.gapBottom > 0 && floorY - blockBottom >= 3 && (
                  <rect x={x} y={blockBottom} width={w} height={floorY - blockBottom} fill="#fef3c7" opacity={0.75} />
                )}

                {/* Название участка */}
                <text x={x + w / 2} y={PAD_T - 20} textAnchor="middle" fontSize="10.5" fill="#1e293b" fontWeight="600">
                  {it.name}{it.copies > 1 ? ` ×${it.copies}` : ''}
                </text>
                <text x={x + w / 2} y={PAD_T - 8} textAnchor="middle" fontSize="8" fill="#64748b">
                  {it.wallLength} × {it.wallHeight} мм
                </text>

                {/* Узлы на швах каждой панели — как на чертеже СП: вертикальные кромки
                    подписаны у левого и правого края панели, горизонтальные — у верха и низа. */}
                {cells.map((c, k) => {
                  const rowsOfCol = cols[c.col]?.rows ?? []
                  const left = c.col === 0 ? it.leftNode : it.connType
                  const right = c.lastCol === cols.length - 1 ? it.rightNode : it.connType
                  const top = c.row === 0 ? it.topEdge : it.rowConn
                  const bottom = c.lastRow === rowsOfCol.length - 1 ? it.bottomEdge : it.rowConn
                  return (
                    <g key={`n${k}`}>
                      {c.w >= 46 && c.h >= 26 && <>
                        <EdgeTag x={c.x + 12} y={c.y + c.h / 2} code={left} />
                        {/* у последнего столбца метку сдвигаем внутрь: снаружи идёт цепочка высот */}
                        <EdgeTag x={c.x + c.w - (c.lastCol === cols.length - 1 ? 22 : 12)} y={c.y + c.h / 2} code={right} />
                      </>}
                      {c.h >= 40 && c.w >= 34 && <>
                        <EdgeTag x={c.x + c.w / 2} y={c.y + 9} code={top} />
                        <EdgeTag x={c.x + c.w / 2} y={c.y + c.h - 9} code={bottom} />
                      </>}
                    </g>
                  )
                })}

                {/* Размеры столбцов по низу */}
                {cols.map((c, i) => (
                  <DimH key={i} x1={c.x} x2={c.x + c.w} y={floorY + 26} text={`${c.mm}`} />
                ))}

                {/* Цепочка высот рядов последнего столбца — у правого края участка */}
                {(cols[cols.length - 1]?.rows ?? []).map((r, i) => (
                  <DimV key={`h${i}`} x={x + w - 8} y1={r.y} y2={r.y + r.h} text={`${r.mm}`} />
                ))}

                {/* Отметки высот: верх стены и верх панельного блока */}
                <Level x={x + 6} y={topY} mm={it.wallHeight} />
                {blockTop - topY >= 10 && <Level x={x + 6} y={blockTop} mm={it.gapBottom + rowsTotal} />}
              </g>
            )
          }

          // ── Дверной проём ────────────────────────────────────────────────
          const openTop = yOf(it.openingH)
          const ceilY = yOf(it.ceilingH)
          const hasPanel = it.panelH !== null && it.panelW !== null

          return (
            <g key={it.id}>
              {/* Габарит участка */}
              <rect x={x} y={ceilY} width={w} height={floorY - ceilY}
                fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3" />

              {/* Панель над проёмом — реальной ширины (уже проёма на узлы коробки), по центру */}
              {hasPanel && (() => {
                const ph = (it.panelH as number) * scale
                const pw = (it.panelW as number) * scale
                const px = x + (w - pw) / 2
                const py = openTop - ph
                return (
                  <g>
                    <rect x={px} y={py} width={pw} height={ph}
                      fill="#dcfce7" stroke="#4ade80" strokeWidth="1" />
                    {pw >= 34 && ph >= 16 && (
                      <text x={px + pw / 2} y={py + ph / 2 - 5}
                        textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#166534" fontWeight="700">
                        {it.panelDrawLabel}
                      </text>
                    )}
                    {pw >= 60 && ph >= 28 && (
                      <text x={px + pw / 2} y={py + ph / 2 + 8}
                        textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#15803d">
                        {it.panelH} × {it.panelW}
                      </text>
                    )}
                    {/* Узлы боков надпроёмной панели (B/C) и её низа (G/H).
                        Нижний держим ВНУТРИ панели: на границе его перекрывал проём. */}
                    <Badge x={px + 9} y={py + ph / 2} code={it.leftNode} />
                    <Badge x={px + pw - 9} y={py + ph / 2} code={it.rightNode} />
                    {ph >= 26 && <Badge x={px + pw / 2} y={openTop - 10} code={it.bottomEdge} />}
                  </g>
                )
              })()}

              {/* Проём */}
              <rect x={x} y={openTop} width={w} height={floorY - openTop}
                fill="#eef2f6" stroke="#94a3b8" strokeWidth="1.2" />

              {/* Добор обрамления: откос уходит вглубь стены, поэтому в развёртке
                  показываем его полосой по краю проёма шириной в глубину добора. */}
              {it.trim && (() => {
                const t = it.trim
                // Глубина добора в мм → пиксели, но не тоньше 6 px и не шире трети проёма.
                const depth = (mm: number) => Math.max(6, Math.min(w / 3, mm * scale))
                const lw = depth(t.left.w)
                const rw = depth(t.right.w)
                const th = t.top ? Math.max(6, Math.min((floorY - openTop) / 3, t.top.h * scale)) : 0
                return (
                  <g>
                    <rect x={x} y={openTop} width={lw} height={floorY - openTop}
                      fill="#fde68a" fillOpacity={0.5} stroke="#d97706" strokeWidth="0.9" strokeDasharray="4 3" />
                    <rect x={x + w - rw} y={openTop} width={rw} height={floorY - openTop}
                      fill="#fde68a" fillOpacity={0.5} stroke="#d97706" strokeWidth="0.9" strokeDasharray="4 3" />
                    {t.top && (
                      <rect x={x} y={openTop} width={w} height={th}
                        fill="#fde68a" fillOpacity={0.5} stroke="#d97706" strokeWidth="0.9" strokeDasharray="4 3" />
                    )}
                    {/* Обозначения и размеры доборов */}
                    {t.top && w >= 60 && (
                      <text x={x + w / 2} y={openTop + th / 2} textAnchor="middle" dominantBaseline="central"
                        fontSize="7" fill="#92400e">
                        {t.drawLabels[0]} · {t.top.w}×{t.top.h}
                      </text>
                    )}
                    <text x={x + lw / 2} y={(openTop + floorY) / 2} textAnchor="middle"
                      fontSize="7" fill="#92400e" transform={`rotate(-90, ${x + lw / 2}, ${(openTop + floorY) / 2})`}>
                      {t.drawLabels[1]} · {t.left.h}×{t.left.w}
                    </text>
                    <text x={x + w - rw / 2} y={(openTop + floorY) / 2} textAnchor="middle"
                      fontSize="7" fill="#92400e"
                      transform={`rotate(-90, ${x + w - rw / 2}, ${(openTop + floorY) / 2})`}>
                      {t.drawLabels[2]} · {t.right.h}×{t.right.w}
                    </text>
                    {/* Узлы внешних краёв доборов — к стене */}
                    <EdgeTag x={x + lw / 2} y={floorY - 12} code={t.left.wallNode} />
                    <EdgeTag x={x + w - rw / 2} y={floorY - 12} code={t.right.wallNode} />
                    {t.top && <>
                      <EdgeTag x={x + lw + 12} y={openTop + th / 2} code={t.top.leftNode} />
                      <EdgeTag x={x + w - rw - 12} y={openTop + th / 2} code={t.top.rightNode} />
                    </>}
                  </g>
                )
              })()}

              {/* Полотно двери: петли слева/справа + направление открывания */}
              <line x1={it.hingeLeft ? x + 1.5 : x + w - 1.5} y1={openTop} x2={it.hingeLeft ? x + 1.5 : x + w - 1.5} y2={floorY}
                stroke="#16a34a" strokeWidth="2.4" />
              <path d={it.hingeLeft
                ? `M ${x + 1.5} ${floorY} L ${x + w} ${(openTop + floorY) / 2} L ${x + 1.5} ${openTop}`
                : `M ${x + w - 1.5} ${floorY} L ${x} ${(openTop + floorY) / 2} L ${x + w - 1.5} ${openTop}`}
                fill="none" stroke="#16a34a" strokeWidth="1" strokeDasharray="4 3" />
              {w >= 46 && (
                <>
                  <text x={x + w / 2} y={(openTop + floorY) / 2 - 8} textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fill="#166534" fontWeight="700">
                    {it.doorLabel}
                  </text>
                  <text x={x + w / 2} y={(openTop + floorY) / 2 + 6} textAnchor="middle" dominantBaseline="central"
                    fontSize="7.5" fill="#15803d" opacity={0.85}>
                    {it.opensOut ? 'наружу' : 'внутрь'}, {it.hingeLeft ? 'петли слева' : 'петли справа'}
                  </text>
                </>
              )}

              {/* Название проёма */}
              <text x={x + w / 2} y={PAD_T - 20} textAnchor="middle" fontSize="10.5" fill="#166534" fontWeight="600">
                {it.label}{it.copies > 1 ? ` ×${it.copies}` : ''}
              </text>
              <text x={x + w / 2} y={PAD_T - 8} textAnchor="middle" fontSize="8" fill="#64748b">
                {it.openingW} × {it.openingH} мм
              </text>

              {/* Размер проёма по низу + высота проёма сбоку */}
              <DimH x1={x} x2={x + w} y={floorY + 26} text={`${it.openingW}`} />
              <DimV x={x + w - 8} y1={openTop} y2={floorY} text={`${it.openingH}`} />

              {/* Отметки высот: потолок и верх проёма.
                  Потолок — справа, иначе отметка налезает на подпись участка. */}
              <Level x={x + w - 6} y={ceilY} mm={it.ceilingH} anchor="end" />
              <Level x={x + 6} y={openTop} mm={it.openingH} />
            </g>
          )
        })}

        {/* Общая размерная линия по низу */}
        <DimH x1={PAD_L} x2={PAD_L + W} y={floorY + 46} text={`${totalMm} мм — вся развёртка`} />
      </svg>

      {sections && <DoorSections items={items} />}

      {/* Превью узла при наведении — рядом с курсором, с зажимом в окно */}
      {hover && createPortal(
        <div style={{
          position: 'fixed',
          top: Math.min(hover.y + 16, window.innerHeight - 232),
          left: Math.min(hover.x + 16, window.innerWidth - 248),
          zIndex: 99999, pointerEvents: 'none', background: '#fff',
          border: '1.5px solid #d0d7e3', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,.16)', width: 230,
        }}>
          {hover.jt?.image_url ? (
            <img src={hover.jt.image_url} alt={hover.code}
              style={{ display: 'block', width: 230, height: 172, objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: 230, height: 172,
              background: 'linear-gradient(135deg, #e8f0fe 0%, #d0dcf5 100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: '#1a4d8a', opacity: .25, lineHeight: 1 }}>
                {hover.code}
              </span>
              <span style={{ fontSize: 11, color: '#888' }}>фото не загружено</span>
            </div>
          )}
          <div style={{
            padding: '8px 12px', background: '#f4f8ff', borderTop: '1px solid #e0e8f5',
            display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1a4d8a' }}>{hover.code}</span>
            {hover.jt?.name && <span style={{ fontSize: 12, color: '#666' }}>{hover.jt.name}</span>}
            {hover.jt && hover.jt.offset_mm !== 0 && (
              <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                {hover.jt.offset_mm > 0 ? '+' : ''}{hover.jt.offset_mm} мм
              </span>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Разрез по дверному проёму ────────────────────────────────────────────────
// Вид сбоку узкой полосой, как на листах СП: толщина панели условно 9 мм,
// сверху панель над проёмом, ниже — проём с дверным полотном.

function DoorSections({ items }: { items: ElevItem[] }) {
  const doors = items.filter((it): it is ElevDoor => it.kind === 'door')
  if (doors.length === 0) return null

  const maxH = Math.max(...doors.map(d => d.ceilingH), 1)
  const scale = Math.min(190 / maxH, 0.07)
  const H = maxH * scale
  const STRIP = 9      // ширина полосы разреза на экране
  const CELL = 132     // ширина ячейки под один разрез
  const TOP = 26
  const BOT = 22

  return (
    <div style={{ overflowX: 'auto', marginTop: 14 }}>
      <svg width={doors.length * CELL} height={H + TOP + BOT}
        viewBox={`0 0 ${doors.length * CELL} ${H + TOP + BOT}`}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}>
        {doors.map((d, i) => {
          const x = i * CELL + 52
          const floorY = TOP + H
          const yOf = (mm: number) => TOP + H - mm * scale
          const ceilY = yOf(d.ceilingH)
          const openTop = yOf(d.openingH)
          return (
            <g key={d.id}>
              <text x={x - 44} y={14} fontSize="9" fill="#1e293b" fontWeight="600">
                Разрез {d.label}
              </text>

              {/* Панель над проёмом */}
              {d.panelH !== null && (
                <rect x={x} y={openTop - d.panelH * scale} width={STRIP} height={d.panelH * scale}
                  fill="#dcfce7" stroke="#4ade80" strokeWidth="1" />
              )}
              {/* Верхний добор: в разрезе уходит вглубь стены от верха проёма */}
              {d.trim?.top && (
                <rect x={x + STRIP} y={openTop} width={Math.max(6, d.trim.top.h * scale)} height={4}
                  fill="#fde68a" fillOpacity={0.6} stroke="#d97706" strokeWidth="0.8" />
              )}

              {/* Коробка и полотно двери */}
              <rect x={x} y={openTop} width={STRIP} height={floorY - openTop}
                fill="#eef2f6" stroke="#94a3b8" strokeWidth="1.1" />
              <line x1={x + STRIP / 2} y1={openTop + 2} x2={x + STRIP / 2} y2={floorY - 2}
                stroke="#16a34a" strokeWidth="1.6" />

              {/* Пол и потолок */}
              <line x1={x - 16} y1={floorY} x2={x + STRIP + 16} y2={floorY} stroke="#475569" strokeWidth="1.4" />
              <line x1={x - 16} y1={ceilY} x2={x + STRIP + 16} y2={ceilY}
                stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />

              {/* Размеры и отметки */}
              <g stroke="#94a3b8" strokeWidth="0.8">
                <line x1={x - 22} y1={ceilY} x2={x - 22} y2={floorY} />
                <line x1={x - 25.5} y1={ceilY} x2={x - 18.5} y2={ceilY} />
                <line x1={x - 25.5} y1={floorY} x2={x - 18.5} y2={floorY} />
                <text x={x - 27} y={(ceilY + floorY) / 2} textAnchor="middle" fontSize="7.5" fill="#64748b" stroke="none"
                  transform={`rotate(-90, ${x - 27}, ${(ceilY + floorY) / 2})`}>
                  {d.ceilingH}
                </text>
              </g>
              <text x={x + STRIP + 6} y={ceilY + 8} fontSize="7.5" fill="#334155" fontWeight="600">
                {`+${(d.ceilingH / 1000).toFixed(3).replace('.', ',')}`}
              </text>
              <text x={x + STRIP + 6} y={openTop - 3} fontSize="7.5" fill="#334155" fontWeight="600">
                {`+${(d.openingH / 1000).toFixed(3).replace('.', ',')}`}
              </text>
              {d.panelH !== null && (
                <text x={x + STRIP + 6} y={openTop - d.panelH * scale / 2} fontSize="7" fill="#15803d">
                  {d.panelH}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}


// ── Таблица панелей в формате чертежа (Зотов А.М., «Стеновые панели, Выставка») ──
//
// Кромки обозначаются по кругу от верха по часовой стрелке:
//   А — верх, В — правая, С — низ, D — левая.
// Пустая кромка на чертеже пишется как «без. обр.» (без обработки).

export interface ElevRow {
  no: number
  name: string        // обозначение на чертеже: А1, А2…
  height: number
  width: number
  qty: number
  edgeA: string
  edgeB: string
  edgeC: string
  edgeD: string
  specLabel: string   // номер строки в спецификации (1.1, Д1…)
}

export function elevationRows(items: ElevItem[]): ElevRow[] {
  const rows: ElevRow[] = []
  for (const it of items) {
    if (it.kind === 'wall') {
      const N = it.widths.length
      for (const c of it.cells) {
        const colRows = it.colRows[c.col] ?? []
        rows.push({
          no: rows.length + 1,
          name: c.drawLabel,
          height: c.height,
          width: c.width,
          qty: it.copies,
          edgeA: c.row === 0 ? it.topEdge : it.rowConn,
          edgeB: c.col + c.span - 1 === N - 1 ? it.rightNode : it.connType,
          edgeC: c.row + c.rowSpan === colRows.length ? it.bottomEdge : it.rowConn,
          edgeD: c.col === 0 ? it.leftNode : it.connType,
          specLabel: c.label,
        })
      }
    } else {
      if (it.panelH !== null && it.panelW !== null) {
        rows.push({
          no: rows.length + 1,
          name: it.panelDrawLabel,
          height: it.panelH,
          width: it.panelW,
          qty: it.copies,
          edgeA: it.topEdge,
          edgeB: it.rightNode,
          edgeC: it.bottomEdge,
          edgeD: it.leftNode,
          specLabel: it.panelLabel,
        })
      }
      if (it.trim) {
        const t = it.trim
        let n = 1
        if (t.top) {
          rows.push({
            no: rows.length + 1, name: t.drawLabels[0],
            height: t.top.h, width: t.top.w, qty: it.copies,
            edgeA: '', edgeB: t.top.rightNode, edgeC: '', edgeD: t.top.leftNode,
            specLabel: `${t.label}.${n++}`,
          })
        }
        rows.push({
          no: rows.length + 1, name: t.drawLabels[1],
          height: t.left.h, width: t.left.w, qty: it.copies,
          edgeA: '', edgeB: 'O', edgeC: '', edgeD: t.left.wallNode,
          specLabel: `${t.label}.${n++}`,
        })
        rows.push({
          no: rows.length + 1, name: t.drawLabels[2],
          height: t.right.h, width: t.right.w, qty: it.copies,
          edgeA: '', edgeB: t.right.wallNode, edgeC: '', edgeD: 'O',
          specLabel: `${t.label}.${n++}`,
        })
      }
    }
  }
  // Строки идут в порядке обозначений чертежа (А1, А2…), а не по столбцам.
  const num = (s: string) => parseInt(s.replace(/\D+/g, ''), 10) || 0
  rows.sort((a, b) => num(a.name) - num(b.name))
  rows.forEach((r, i) => { r.no = i + 1 })
  return rows
}

export function ElevationTable({ items }: { items: ElevItem[] }) {
  const rows = elevationRows(items)
  if (rows.length === 0) return null
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>п.п.</th>
            <th>Наимен.</th>
            <th>Высота с/п, мм</th>
            <th>Ширина с/п, мм</th>
            <th>Колич.</th>
            <th>Кромка А (верх)</th>
            <th>Кромка В (прав.)</th>
            <th>Кромка С (низ)</th>
            <th>Кромка D (лев.)</th>
            <th>№ в спецификации</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.no}>
              <td>{r.no}</td>
              <td><strong>{r.name}</strong></td>
              <td><strong>{r.height}</strong></td>
              <td><strong>{r.width}</strong></td>
              <td>{r.qty}</td>
              <td>{r.edgeA ? <span className="badge badge-gray">{r.edgeA}</span> : 'без. обр.'}</td>
              <td>{r.edgeB ? <span className="badge badge-blue">{r.edgeB}</span> : 'без. обр.'}</td>
              <td>{r.edgeC ? <span className="badge badge-gray">{r.edgeC}</span> : 'без. обр.'}</td>
              <td>{r.edgeD ? <span className="badge badge-blue">{r.edgeD}</span> : 'без. обр.'}</td>
              <td className="text-muted">{r.specLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Соответствие «типов кромок» чертежа нашим кодам узлов.
          Источник — чертёж «Стеновые панели, Выставка, стена 1» (Зотов А.М., 20.07.2021). */}
      <div style={{ marginTop: 10, fontSize: '.78rem', color: '#64748b', lineHeight: 1.7 }}>
        <strong style={{ color: '#475569' }}>Типы кромок чертежа:</strong>{' '}
        <span className="badge badge-gray">тип 1</span> — 104.259 соединительный, 104.256 торцевой (узлы C, A, I){' · '}
        <span className="badge badge-gray">тип 2</span> — 104.270 угловой (узлы D, DG, DH){' · '}
        <span className="badge badge-gray">тип 3</span> — 1630-12, открывание наружу (узел G){' · '}
        <span className="badge badge-gray">тип 4</span> — 1630-12, открывание внутрь (узел H)
      </div>
    </div>
  )
}
