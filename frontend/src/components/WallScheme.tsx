// Схема раскладки стеновых панелей — SVG-визуализация с поворотами при угловых узлах.
// Текстовые подписи (название, размеры) всегда горизонтальные (counter-rotate).
// Размеры панелей перенесены внутрь полосы, чтобы не выходить за пределы.

import type { ReactNode } from 'react'

// ── Типы ────────────────────────────────────────────────────────────────────

interface W {
  id: string; name: string
  wallLength: number; wallHeight: number
  numPanels: number; connType: string
  leftNode: string; rightNode: string; copies: number
}

interface D {
  id: string; label: string; doorRef: string
  openingW: number; openingH: number
  mountType: string; openingDir: string; hingeDir: string
  leftNode: string; rightNode: string; copies: number
  wallDepth?: number
  trimLeftNode?: string; trimLeftW?: number
  trimRightNode?: string; trimRightW?: number
  trimTopLeftNode?: string; trimTopRightNode?: string; trimTopH?: number
  topEdge?: string; bottomEdge?: string
}

interface P {
  wallName: string; width: number; height: number; panelLabel: string
}

interface OrderItem {
  type: 'wall' | 'door'
  id: string
}

interface Props {
  walls: W[]
  doors: D[]
  panels: P[]
  itemOrder: OrderItem[]
}

// ── Углы, вызывающие поворот ─────────────────────────────────────────────────

const CORNER_OUTER = new Set(['D'])         // +90° (по часовой) — наружный угол
const CORNER_INNER = new Set(['DG', 'DH'])  // −90° (против часовой) — внутренний угол
// G и H — просто профили, НЕ вызывают поворот схемы

// ── Цвета узлов ──────────────────────────────────────────────────────────────

function nodeColor(code: string): string {
  if (['A', 'FL', 'FR', 'E'].includes(code)) return '#3b82f6'
  if (code === 'B') return '#f97316'
  if (code === 'C') return '#22c55e'
  if (['D', 'DG', 'DH'].includes(code)) return '#a855f7'
  if (['G', 'H'].includes(code)) return '#ef4444'
  return '#64748b'
}

function Badge({ x, y, code, angle = 0 }: { x: number; y: number; code: string; angle?: number }) {
  const fill = nodeColor(code)
  const r  = code.length > 2 ? 13 : 10
  const fs = code.length > 2 ? 7  : 9
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} opacity={0.92} />
      {/* Counter-rotate текст внутри бейджа — всегда читаемый */}
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central"
        fontSize={fs} fontWeight="700" fill="#fff" fontFamily="monospace"
        transform={`rotate(${-angle}, ${x}, ${y + 0.5})`}>
        {code}
      </text>
    </g>
  )
}

// ── Компонент ────────────────────────────────────────────────────────────────

export default function WallScheme({ walls, doors, panels, itemOrder }: Props) {
  if (walls.length === 0) return null

  const PAD      = 70    // отступ вокруг схемы
  const ITEM_GAP = 52    // px между элементами — достаточно чтобы значки не касались
  const BAR_H    = 44    // высота полосы (две строки внутри)
  const MAX_ARC  = 50    // макс. радиус дуги двери

  // ── Масштаб ─────────────────────────────────────────────────────────────────
  const totalMm = itemOrder.reduce((s, item) => {
    if (item.type === 'wall') return s + (walls.find(w => w.id === item.id)?.wallLength ?? 0)
    return s + (doors.find(d => d.id === item.id)?.openingW ?? 0)
  }, 0)
  const scale = totalMm > 0 ? Math.min(0.22, 700 / totalMm) : 0.15

  // ── Сегменты: начальная точка + угол направления ──────────────────────────
  // angle: 0 = вправо, 90 = вниз, 180 = влево, 270 = вверх
  interface Seg {
    type: 'wall' | 'door'
    id: string
    x: number
    y: number
    angle: number
    pxLen: number
  }

  const segs: Seg[] = []
  let cx = 0, cy = 0, curAngle = 0

  for (const item of itemOrder) {
    if (item.type === 'wall') {
      const wall = walls.find(w => w.id === item.id)
      if (!wall) continue
      const pxLen = wall.wallLength * scale
      segs.push({ type: 'wall', id: wall.id, x: cx, y: cy, angle: curAngle, pxLen })

      const rad = curAngle * Math.PI / 180
      cx += Math.cos(rad) * (pxLen + ITEM_GAP)
      cy += Math.sin(rad) * (pxLen + ITEM_GAP)

      if (CORNER_OUTER.has(wall.rightNode))      curAngle = (curAngle + 90) % 360
      else if (CORNER_INNER.has(wall.rightNode)) curAngle = (curAngle - 90 + 360) % 360

    } else {
      const door = doors.find(d => d.id === item.id)
      if (!door) continue
      const pxLen = door.openingW * scale
      segs.push({ type: 'door', id: door.id, x: cx, y: cy, angle: curAngle, pxLen })

      const rad = curAngle * Math.PI / 180
      cx += Math.cos(rad) * (pxLen + ITEM_GAP)
      cy += Math.sin(rad) * (pxLen + ITEM_GAP)

      if (CORNER_OUTER.has(door.rightNode))      curAngle = (curAngle + 90) % 360
      else if (CORNER_INNER.has(door.rightNode)) curAngle = (curAngle - 90 + 360) % 360
    }
  }

  // ── Вычисление bounding box ──────────────────────────────────────────────
  // Включаем место для горизонтальных подписей над/сбоку от полосы
  // При !isIn: дуга до -(faceY+MAX_ARC)=-(22+50)=72, label offset=96+текст~30=126
  const LABEL_SPACE = BAR_H / 2 + MAX_ARC + 110
  const allPts: [number, number][] = []

  for (const seg of segs) {
    const rad   = seg.angle * Math.PI / 180
    const fwdX  = Math.cos(rad), fwdY  = Math.sin(rad)
    const perpX = -Math.sin(rad), perpY = Math.cos(rad)
    const ex = seg.x + fwdX * seg.pxLen
    const ey = seg.y + fwdY * seg.pxLen

    for (const [px, py] of [[seg.x, seg.y], [ex, ey]] as [number, number][]) {
      allPts.push([px + perpX * LABEL_SPACE, py + perpY * LABEL_SPACE])
      allPts.push([px - perpX * LABEL_SPACE, py - perpY * LABEL_SPACE])
      // Горизонтальный текст занимает дополнительное место вдоль оси X/Y
      allPts.push([px + 100, py + 30])
      allPts.push([px - 100, py - 30])
    }
  }

  const minX = Math.min(...allPts.map(p => p[0])) - PAD
  const minY = Math.min(...allPts.map(p => p[1])) - PAD
  const maxX = Math.max(...allPts.map(p => p[0])) + PAD
  const maxY = Math.max(...allPts.map(p => p[1])) + PAD
  const svgW = maxX - minX
  const svgH = maxY - minY

  // ── Вспомогательный компонент: горизонтальный текст в локальных coords ────
  // Применяет counter-rotate, чтобы текст всегда был горизонтальным,
  // даже если родительская группа повёрнута.
  function HText({
    lx, ly, angle, children, ...props
  }: {
    lx: number; ly: number; angle: number; children: ReactNode
    textAnchor?: string; fontSize?: string | number; fill?: string
    fontWeight?: string | number; dominantBaseline?: string
  }) {
    return (
      <text
        x={lx} y={ly}
        transform={`rotate(${-angle}, ${lx}, ${ly})`}
        {...props}
      >
        {children}
      </text>
    )
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
      <svg
        width={svgW} height={svgH}
        viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}
      >
        {/* ── Легенда ── */}
        {[
          { code: 'A', label: 'Торцевой',  fill: '#3b82f6' },
          { code: 'C', label: 'Соединит.', fill: '#22c55e' },
          { code: 'B', label: 'Ламель',    fill: '#f97316' },
          { code: 'D', label: 'Угол',      fill: '#a855f7' },
        ].map((li, i) => (
          <g key={li.code}>
            <circle cx={minX + PAD + i * 90} cy={maxY - PAD / 2} r={5} fill={li.fill} opacity={0.85} />
            <text x={minX + PAD + i * 90 + 8} y={maxY - PAD / 2}
              dominantBaseline="central" fontSize="8" fill="#94a3b8">
              {li.code} — {li.label}
            </text>
          </g>
        ))}

        {/* ── Сегменты ──────────────────────────────────────────────────────── */}
        {/* transform = translate(x,y) rotate(angle)                            */}
        {/* Все элементы в локальных координатах: от (0,0) вправо.              */}
        {/* Текстовые подписи counter-rotate'd → всегда горизонтальные.        */}

        {segs.map(seg => {
          const transform = `translate(${seg.x}, ${seg.y}) rotate(${seg.angle})`
          const a = seg.angle  // для counter-rotate

          // ── Стена ──────────────────────────────────────────────────────────
          if (seg.type === 'wall') {
            const w = walls.find(w => w.id === seg.id)
            if (!w) return null
            const N = w.numPanels
            const px = seg.pxLen / N
            const wPanels = panels.filter(p => p.wallName === w.name)

            // Y-координаты ВНУТРИ полосы (BAR_H=44, диапазон -22..+22)
            const topY    = -8   // верхняя строка (номер панели)
            const bottomY =  9   // нижняя строка (размер панели)

            return (
              <g key={seg.id} transform={transform}>
                {/* Полоса стены */}
                <rect x={0} y={-BAR_H / 2} width={seg.pxLen} height={BAR_H}
                  fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" rx="2" />

                {/* Лицевая сторона: акцентная полоска на верхнем крае (local -y = face side) */}
                <rect x={0} y={-BAR_H / 2} width={seg.pxLen} height={3}
                  fill="#1e40af" rx="1" opacity={0.4} />

                {/* Стрелка лицевой стороны — LOCAL coords, поворачивается вместе с полосой.
                    ↑ всегда указывает на local -y (лицевая): 0°=↑  90°=→  180°=↓  270°=←
                    lx=14 (рядом с левым значком) — не конфликтует с центрированным лейблом
                    для вертикальных стен (у них label и стрелка на разной global_y). */}
                <text x={14} y={-BAR_H / 2 - 6}
                  textAnchor="middle" dominantBaseline="auto"
                  fontSize="12" fill="#1e40af" opacity={0.8} fontWeight="700">
                  ↑
                </text>

                {/* Разделители панелей */}
                {Array.from({ length: N - 1 }, (_, i) => (
                  <line key={i}
                    x1={px * (i + 1)} y1={-BAR_H / 2}
                    x2={px * (i + 1)} y2={BAR_H / 2}
                    stroke="#60a5fa" strokeWidth="1" />
                ))}

                {/* Метки панелей с HText (counter-rotate) — всегда читаемые при любом угле.
                    Скрываем при px < 24 (ячейка слишком узкая). */}
                {Array.from({ length: N }, (_, i) => {
                  const p = wPanels[i]
                  const label = p?.panelLabel ?? `${walls.indexOf(w) + 1}.${i + 1}`
                  const cellX = px * i + px / 2
                  if (px < 24) return null
                  return (
                    <g key={i}>
                      <HText lx={cellX} ly={topY} angle={a}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize="9" fill="#1e40af" fontWeight="600">
                        {label}
                      </HText>
                      {p?.width && px >= 52 && (
                        <HText lx={cellX} ly={bottomY} angle={a}
                          textAnchor="middle" dominantBaseline="central"
                          fontSize="7" fill="#3b5bdb">
                          {p.width}×{p.height}
                        </HText>
                      )}
                    </g>
                  )
                })}

                {/* Название + Габариты стены — один HText с двумя tspan.
                    lyLabel: для угла 90–270° знак флипается (иначе при 180° текст под полосой).
                    tspan+dy гарантирует вертикальный стек в глобальных экранных координатах.
                    Offset 50 = BAR_H/2(22) + стрелка(8) + зазор(20) — стрелка не перекрывает. */}
                {(() => {
                  const ly = Math.cos(a * Math.PI / 180) >= 0
                    ? -(BAR_H / 2 + 50)
                    :  (BAR_H / 2 + 50)
                  const dy = ly < 0 ? 14 : -14
                  return (
                    <HText lx={seg.pxLen / 2} ly={ly} angle={a} textAnchor="middle">
                      <tspan x={seg.pxLen / 2} fontSize="11" fill="#1e293b" fontWeight="600">
                        {w.name}{w.copies > 1 ? ` ×${w.copies}` : ''}
                      </tspan>
                      <tspan x={seg.pxLen / 2} dy={dy} fontSize="9" fill="#64748b">
                        {w.wallLength} × {w.wallHeight} мм
                      </tspan>
                    </HText>
                  )
                })()}

                {/* Значки узлов — connType скрываем если ячейка < 28px (значки бы накладывались) */}
                <Badge x={0}         y={0} code={w.leftNode}  angle={a} />
                {px >= 28 && Array.from({ length: N - 1 }, (_, i) => (
                  <Badge key={i} x={px * (i + 1)} y={0} code={w.connType} angle={a} />
                ))}
                <Badge x={seg.pxLen} y={0} code={w.rightNode} angle={a} />

              </g>
            )
          }

          // ── Дверной проём ──────────────────────────────────────────────────
          const d = doors.find(d => d.id === seg.id)
          if (!d) return null

          const isIn   = d.openingDir === 'ВНУТРЬ'
          const isLeft = d.hingeDir !== 'СПРАВА'
          const r      = Math.min(seg.pxLen, MAX_ARC)

          // faceY — лицевая сторона стены (там синяя полоска акцента)
          // Все дверные элементы (петля, полотно, дуга) привязаны к faceY.
          // +y = ВНУТРЬ (в комнату), −y = НАРУЖУ (в сторону лица стены)
          const faceY = -BAR_H / 2

          let arcPath: string
          let leafEndX: number, leafEndY: number
          let hingeX: number

          if (isLeft && isIn) {
            arcPath = `M ${r} ${faceY} A ${r} ${r} 0 0 1 0 ${faceY + r}`
            leafEndX = 0; leafEndY = faceY + r; hingeX = 0
          } else if (isLeft && !isIn) {
            arcPath = `M ${r} ${faceY} A ${r} ${r} 0 0 0 0 ${faceY - r}`
            leafEndX = 0; leafEndY = faceY - r; hingeX = 0
          } else if (!isLeft && isIn) {
            arcPath = `M ${seg.pxLen - r} ${faceY} A ${r} ${r} 0 0 0 ${seg.pxLen} ${faceY + r}`
            leafEndX = seg.pxLen; leafEndY = faceY + r; hingeX = seg.pxLen
          } else {
            arcPath = `M ${seg.pxLen - r} ${faceY} A ${r} ${r} 0 0 1 ${seg.pxLen} ${faceY - r}`
            leafEndX = seg.pxLen; leafEndY = faceY - r; hingeX = seg.pxLen
          }

          // ── Полосы доборов (обрамления) ────────────────────────────────────
          const TRIM_TOP_H = 20   // высота полосы верхнего добора, px
          const TRIM_GAP   = 4    // зазор между дверью и полосой верхнего добора
          const leftTrimPx  = Math.max(10, Math.min(70, (d.trimLeftW  || d.wallDepth || 200) * scale))
          const rightTrimPx = Math.max(10, Math.min(70, (d.trimRightW || d.wallDepth || 200) * scale))
          const showTopTrim = d.mountType !== 'В ПОТОЛОК'

          return (
            <g key={seg.id} transform={transform}>
              {/* ── Левый добор (обрамление) — зелёная полоса */}
              <rect x={-leftTrimPx} y={-BAR_H / 2} width={leftTrimPx} height={BAR_H}
                fill="#d1fae5" stroke="#34d399" strokeWidth="1.5" rx="1" />
              <rect x={-leftTrimPx} y={-BAR_H / 2} width={leftTrimPx} height={3}
                fill="#059669" opacity={0.5} rx="1" />
              {leftTrimPx >= 28 && (
                <HText lx={-leftTrimPx / 2} ly={9} angle={a}
                  textAnchor="middle" fontSize="7" fill="#065f46">
                  {d.trimLeftW || d.wallDepth || 200}
                </HText>
              )}

              {/* ── Правый добор (обрамление) — зелёная полоса */}
              <rect x={seg.pxLen} y={-BAR_H / 2} width={rightTrimPx} height={BAR_H}
                fill="#d1fae5" stroke="#34d399" strokeWidth="1.5" rx="1" />
              <rect x={seg.pxLen} y={-BAR_H / 2} width={rightTrimPx} height={3}
                fill="#059669" opacity={0.5} rx="1" />
              {rightTrimPx >= 28 && (
                <HText lx={seg.pxLen + rightTrimPx / 2} ly={9} angle={a}
                  textAnchor="middle" fontSize="7" fill="#065f46">
                  {d.trimRightW || d.wallDepth || 200}
                </HText>
              )}

              {/* ── Верхний добор (обрамление) — зелёная полоса снизу проёма */}
              {showTopTrim && (
                <g>
                  <rect x={0} y={BAR_H / 2 + TRIM_GAP} width={seg.pxLen} height={TRIM_TOP_H}
                    fill="#d1fae5" stroke="#34d399" strokeWidth="1.5" rx="1" />
                  <HText lx={seg.pxLen / 2} ly={BAR_H / 2 + TRIM_GAP + TRIM_TOP_H / 2} angle={a}
                    textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#065f46" fontWeight="600">
                    верх {d.trimTopH || d.wallDepth || 200} мм
                  </HText>
                  {d.topEdge && (
                    <Badge x={-14} y={BAR_H / 2 + TRIM_GAP + TRIM_TOP_H + 39} code={d.topEdge} angle={a} />
                  )}
                  {d.bottomEdge && (
                    <Badge x={seg.pxLen + 14} y={BAR_H / 2 + TRIM_GAP + TRIM_TOP_H + 39} code={d.bottomEdge} angle={a} />
                  )}
                </g>
              )}

              {/* ── Тело проёма — светло-серый прямоугольник (пустота/воздух) */}
              <rect x={0} y={-BAR_H / 2} width={seg.pxLen} height={BAR_H}
                fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

              {/* Порог (линия пола) */}
              <line x1={0} y1={BAR_H / 2 - 1} x2={seg.pxLen} y2={BAR_H / 2 - 1}
                stroke="#64748b" strokeWidth="2" />

              {/* Полотно двери */}
              <line x1={hingeX} y1={faceY} x2={leafEndX} y2={leafEndY}
                stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5 3" />

              {/* Дуга хода двери */}
              <path d={arcPath} fill="none" stroke="#16a34a" strokeWidth="1.5" />

              {/* Точка петли */}
              <circle cx={hingeX} cy={faceY} r={3.5} fill="#16a34a" />

              {/* Направление */}
              <text x={isLeft ? r * 0.4 : seg.pxLen - r * 0.4}
                y={faceY + (isIn ? 1 : -1) * r * 0.4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="8" fill="#15803d" opacity={0.9}>
                {isIn ? '↙В' : '↖Н'}
              </text>

              {/* Название + размеры */}
              {(() => {
                const labelOff = !isIn
                  ? Math.max(r + 46, BAR_H / 2 + 50)
                  : BAR_H / 2 + 50
                const ly = Math.cos(a * Math.PI / 180) >= 0 ? -labelOff : labelOff
                const dy = ly < 0 ? 14 : -14
                return (
                  <HText lx={seg.pxLen / 2} ly={ly} angle={a} textAnchor="middle">
                    <tspan x={seg.pxLen / 2} fontSize="10" fill="#1e293b" fontWeight="600">
                      {d.label}{d.doorRef ? ` (${d.doorRef})` : ''}{d.copies > 1 ? ` ×${d.copies}` : ''}
                    </tspan>
                    <tspan x={seg.pxLen / 2} dy={dy} fontSize="9" fill="#64748b">
                      {d.openingW} × {d.openingH} мм
                    </tspan>
                  </HText>
                )
              })()}

              {/* Монтаж — тыльная сторона, ниже верхнего добора */}
              {(() => {
                const trimOff = showTopTrim
                  ? BAR_H / 2 + TRIM_GAP + TRIM_TOP_H + 22
                  : BAR_H / 2 + 18
                const mountOff = isIn ? Math.max(r + 18, trimOff) : trimOff
                return (
                  <HText lx={seg.pxLen / 2} ly={mountOff} angle={a}
                    textAnchor="middle" fontSize="8" fill="#94a3b8">
                    {d.mountType} · {d.hingeDir}
                  </HText>
                )
              })()}

              {/* Значки основных узлов — за краями доборов */}
              <Badge x={-(leftTrimPx + 14)}            y={0} code={d.leftNode}  angle={a} />
              <Badge x={seg.pxLen + rightTrimPx + 14}  y={0} code={d.rightNode} angle={a} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
