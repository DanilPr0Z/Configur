// Схема раскладки стеновых панелей — SVG-визуализация с поворотами при угловых узлах.
// Текстовые подписи (название, размеры) всегда горизонтальные (counter-rotate).
// Размеры панелей перенесены внутрь полосы, чтобы не выходить за пределы.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { JointType } from '../api'

// ── Типы ────────────────────────────────────────────────────────────────────

interface W {
  id: string; name: string
  wallLength: number; wallHeight: number
  numPanels: number; connType: string
  leftNode: string; rightNode: string; copies: number
  wallFacing?: 'front' | 'back'
}

interface D {
  id: string; label: string; doorRef: string
  openingW: number; openingH: number
  mountType: string; openingDir: string; hingeDir: string
  leftNode: string; rightNode: string; copies: number
  wallDepth?: number
  hasTrim?: boolean
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
  jointTypes?: JointType[]
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

// ── Компонент ────────────────────────────────────────────────────────────────

interface HoverState { code: string; jt: JointType | null; x: number; y: number }

export default function WallScheme({ walls, doors, panels, itemOrder, jointTypes = [] }: Props) {
  if (walls.length === 0) return null

  // Карта код → узел справочника (для превью фото при наведении)
  const jtByCode = new Map(jointTypes.map(j => [j.code, j]))
  const [hover, setHover] = useState<HoverState | null>(null)

  // Бейдж узла — кликабельный, при наведении показывает превью фото.
  // Определён внутри компонента: замыкает jtByCode и setHover, поэтому
  // места вызова <Badge .../> остаются без изменений.
  function Badge({ x, y, code, angle = 0 }: { x: number; y: number; code: string; angle?: number }) {
    const fill = nodeColor(code)
    const r  = code.length > 2 ? 13 : 10
    const fs = code.length > 2 ? 7  : 9
    return (
      <g style={{ cursor: 'pointer' }}
        onMouseEnter={e => setHover({ code, jt: jtByCode.get(code) ?? null, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHover(null)}>
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

  const PAD      = 70    // отступ вокруг схемы
  const ITEM_GAP = 52    // px между элементами — достаточно чтобы значки не касались
  const BAR_H    = 44    // высота полосы (две строки внутри)

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
  const maxDoorPx = doors.length > 0 ? Math.max(...doors.map(d => d.openingW * scale)) : 0
  const LABEL_SPACE = BAR_H / 2 + maxDoorPx + 110
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
    textAnchor?: React.SVGProps<SVGTextElement>['textAnchor']
    fontSize?: string | number; fill?: string; fontWeight?: string | number
    dominantBaseline?: React.SVGProps<SVGTextElement>['dominantBaseline']
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
                {/* Акцентная полоска — всегда снизу (лицевая сторона) */}
                <rect x={0} y={BAR_H / 2 - 4} width={seg.pxLen} height={4}
                  fill="#3b82f6" opacity={0.7} rx="1" />

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

          // opensOut — открывание НАРУЖУ (к лицевой стороне, дуга вниз).
          // openingDir хранит ВНУТРЬ/НАРУЖУ; mountType (В ПРОЕМ/В ПОТОЛОК) — это
          // монтаж коробки по высоте и к направлению открывания отношения не имеет.
          const opensOut = d.openingDir === 'НАРУЖУ'
          const isLeft   = d.hingeDir !== 'СПРАВА'
          const L        = seg.pxLen  // радиус дуги = полная ширина проёма

          // faceY — лицевая сторона стены (совпадает с синей полоской акцента снизу)
          const faceY = BAR_H / 2

          let arcPath: string
          let hingeX: number
          let openEndY: number  // конец вертикальной линии открытой двери

          if (isLeft && opensOut) {
            arcPath = `M ${L} ${faceY} A ${L} ${L} 0 0 1 0 ${faceY + L}`
            hingeX = 0; openEndY = faceY + L
          } else if (isLeft && !opensOut) {
            arcPath = `M ${L} ${faceY} A ${L} ${L} 0 0 0 0 ${faceY - L}`
            hingeX = 0; openEndY = faceY - L
          } else if (!isLeft && opensOut) {
            arcPath = `M 0 ${faceY} A ${L} ${L} 0 0 0 ${L} ${faceY + L}`
            hingeX = L; openEndY = faceY + L
          } else {
            arcPath = `M 0 ${faceY} A ${L} ${L} 0 0 1 ${L} ${faceY - L}`
            hingeX = L; openEndY = faceY - L
          }

          // ── Доборы: размерные линии + узлы (без отрисовки панелей) ──────────────
          const TRIM_GAP    = 4
          const trimEnabled = d.hasTrim !== false
          const leftTrimPx  = trimEnabled ? Math.max(10, Math.min(70, (d.trimLeftW  || d.wallDepth || 200) * scale)) : 0
          const rightTrimPx = trimEnabled ? Math.max(10, Math.min(70, (d.trimRightW || d.wallDepth || 200) * scale)) : 0
          const showTopTrim = trimEnabled && d.mountType !== 'В ПОТОЛОК'

          return (
            <g key={seg.id} transform={transform}>
              {/* ── Левый добор: штриховая линия + метка + узел к коробке (авто O) */}
              {trimEnabled && <>
                <line x1={-leftTrimPx} y1={0} x2={0} y2={0}
                  stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
                {leftTrimPx >= 22 && (
                  <HText lx={-leftTrimPx / 2} ly={-BAR_H / 2 - 13} angle={a}
                    textAnchor="middle" fontSize="7" fill="#64748b">
                    {d.trimLeftW || d.wallDepth || 200}мм
                  </HText>
                )}
                <Badge x={-12} y={0} code={'O'} angle={a} />
              </>}

              {/* ── Правый добор: штриховая линия + метка + узел к коробке (авто O) */}
              {trimEnabled && <>
                <line x1={seg.pxLen} y1={0} x2={seg.pxLen + rightTrimPx} y2={0}
                  stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
                {rightTrimPx >= 22 && (
                  <HText lx={seg.pxLen + rightTrimPx / 2} ly={-BAR_H / 2 - 13} angle={a}
                    textAnchor="middle" fontSize="7" fill="#64748b">
                    {d.trimRightW || d.wallDepth || 200}мм
                  </HText>
                )}
                <Badge x={seg.pxLen + 12} y={0} code={'O'} angle={a} />
              </>}

              {/* ── Верхний добор (только В ПРОЕМ): СВЕРХУ проёма — штриховая линия + метка + узлы краёв.
                  Панель над дверью физически выше проёма, поэтому узлы рисуем над полосой. */}
              {showTopTrim && (
                <g>
                  <line x1={0} y1={-(BAR_H / 2 + TRIM_GAP)} x2={seg.pxLen} y2={-(BAR_H / 2 + TRIM_GAP)}
                    stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
                  <HText lx={seg.pxLen / 2} ly={-(BAR_H / 2 + TRIM_GAP + 13)} angle={a}
                    textAnchor="middle" fontSize="7" fill="#64748b">
                    верх {d.trimTopH || d.wallDepth || 200}мм
                  </HText>
                  {d.trimTopLeftNode && (
                    <Badge x={-12} y={-(BAR_H / 2 + TRIM_GAP + 28)} code={d.trimTopLeftNode} angle={a} />
                  )}
                  {d.trimTopRightNode && (
                    <Badge x={seg.pxLen + 12} y={-(BAR_H / 2 + TRIM_GAP + 28)} code={d.trimTopRightNode} angle={a} />
                  )}
                </g>
              )}

              {/* ── Тело проёма — светло-серый прямоугольник (пустота/воздух) */}
              <rect x={0} y={-BAR_H / 2} width={seg.pxLen} height={BAR_H}
                fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

              {/* Порог (линия пола) */}
              <line x1={0} y1={BAR_H / 2 - 1} x2={seg.pxLen} y2={BAR_H / 2 - 1}
                stroke="#64748b" strokeWidth="2" />

              {/* Полотно двери — полная ширина проёма (закрытое положение) */}
              <line x1={0} y1={faceY} x2={seg.pxLen} y2={faceY}
                stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5 3" />

              {/* Дуга хода двери */}
              <path d={arcPath} fill="none" stroke="#16a34a" strokeWidth="1.5" />

              {/* Линия открытой двери — вертикаль от петли */}
              <line x1={hingeX} y1={faceY} x2={hingeX} y2={openEndY}
                stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5 3" />

              {/* Точка петли */}
              <circle cx={hingeX} cy={faceY} r={3.5} fill="#16a34a" />

              {/* Направление открывания: Н — наружу (дуга вниз), В — внутрь (вверх) */}
              <text x={isLeft ? L * 0.4 : seg.pxLen - L * 0.4}
                y={faceY + (opensOut ? 1 : -1) * L * 0.4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="8" fill="#15803d" opacity={0.9}>
                {opensOut ? '↓ Н' : '↑ В'}
              </text>

              {/* Название + размеры */}
              {(() => {
                const labelOff = !opensOut
                  ? L + 46
                  : (showTopTrim ? BAR_H / 2 + TRIM_GAP + 28 + 40 : BAR_H / 2 + 50)
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

              {/* Монтаж коробки + направление открывания — две строки.
                  Монтаж (В ПРОЕМ/В ПОТОЛОК) и открывание (внутрь/наружу + петля)
                  разнесены, чтобы «в проём» не читалось как направление. */}
              {(() => {
                const trimOff = showTopTrim
                  ? BAR_H / 2 + TRIM_GAP + 46
                  : BAR_H / 2 + 18
                const mountOff = opensOut ? Math.max(L + BAR_H / 2 + 18, trimOff + 16) : trimOff
                const cx = seg.pxLen / 2
                return (
                  <HText lx={cx} ly={mountOff} angle={a}
                    textAnchor="middle" fontSize="8" fill="#94a3b8">
                    <tspan x={cx}>Монтаж {d.mountType.toLowerCase()}</tspan>
                    <tspan x={cx} dy={11}>
                      Открывание {d.openingDir.toLowerCase()} {d.hingeDir.toLowerCase()}
                    </tspan>
                  </HText>
                )
              })()}

              {/* Узлы двери (leftNode/rightNode). В ПРОЕМ — на нижних углах проёма
                  (бывшее место верхнего добора); иначе — по бокам за доборами. */}
              {showTopTrim ? (
                <>
                  <Badge x={-12}            y={BAR_H / 2 + TRIM_GAP + 28} code={d.leftNode}  angle={a} />
                  <Badge x={seg.pxLen + 12} y={BAR_H / 2 + TRIM_GAP + 28} code={d.rightNode} angle={a} />
                </>
              ) : (
                <>
                  <Badge x={-(leftTrimPx + 14)}            y={0} code={d.leftNode}  angle={a} />
                  <Badge x={seg.pxLen + rightTrimPx + 14}  y={0} code={d.rightNode} angle={a} />
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* Превью узла при наведении — портал к body, рядом с курсором */}
      {hover && createPortal(
        <div style={{
          position: 'fixed',
          top: Math.min(hover.y + 16, window.innerHeight - 232),
          left: Math.min(hover.x + 16, window.innerWidth - 248),
          zIndex: 99999,
          pointerEvents: 'none',
          background: '#fff',
          border: '1.5px solid #d0d7e3',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,.16)',
          width: 230,
        }}>
          {hover.jt?.image_url ? (
            <img src={hover.jt.image_url} alt={hover.code}
              style={{ display: 'block', width: 230, height: 172, objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: 230, height: 172,
              background: 'linear-gradient(135deg, #e8f0fe 0%, #d0dcf5 100%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: '#1a4d8a', opacity: .25, lineHeight: 1 }}>
                {hover.code}
              </span>
              <span style={{ fontSize: 11, color: '#888' }}>фото не загружено</span>
            </div>
          )}
          <div style={{
            padding: '8px 12px', background: '#f4f8ff',
            borderTop: '1px solid #e0e8f5',
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
