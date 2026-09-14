// Чертёж раскладки — интерактивный просмотр видов, а не комплект листов.
//
// Графика повторяет присланные дилерами чертежи (News/СП_*.pdf): монохром,
// размерные цепочки снаружи контура, отметки уровней, узлы буквой в рамке
// у самого шва, разрезы узкой полосой в толщину панели. Рамки и основной
// надписи ГОСТ здесь нет намеренно — нужен сам чертёж, а не лист документа.
//
// Координаты внутри вида — в условных единицах холста (viewBox), поэтому
// толщины линий и кегли заданы один раз и не зависят ни от размера стены,
// ни от зума: масштаб делает viewBox, а зум — ширина <svg> в процентах.

import type { ReactNode } from 'react'
import type { ElevItem, ElevWall, ElevDoor } from './WallElevation'
import { ElevationTable } from './WallElevation'
import type { JointType } from '../api'

// ── Оформление ──────────────────────────────────────────────────────────────

const LW = { thick: 0.5, med: 0.3, thin: 0.18 }
const FS = { dim: 2.5, tag: 2.2, label: 3.5, head: 5 }
const FONT = "'ISOCPEUR', 'GOST type A', 'Arial Narrow', 'Helvetica Neue', system-ui, sans-serif"

const GREY_CUT = '#d5d5d5'    // материал в разрезе
const GREY_FILL = '#efefef'   // проём, добор

const PANEL_T = 9             // условная толщина панели, мм изделия
const PROFILE_T = 5           // профиль верхней кромки

const CORNER_OUTER = new Set(['D'])
const CORNER_INNER = new Set(['DG', 'DH'])

// Ширина холста в условных единицах. Всё остальное считается от неё.
const CANVAS_W = 300

// ── Утилиты ─────────────────────────────────────────────────────────────────

// Старые заказы могут не содержать части полей: одно NaN в координате
// превращает весь SVG в «NaN NaN NaN NaN» и вид пропадает целиком.
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const r1 = (v: number) => Math.round(v * 10) / 10
const mm = (v: number) => String(Math.round(num(v)))
// Размер панели пишем как есть, но с десятичной запятой: «651,5», а не «651.5».
// Округлять нельзя — производство режет именно по половинке миллиметра.
const size = (v: number) => String(num(v)).replace('.', ',')
const levelText = (v: number) => `+${(num(v) / 1000).toFixed(3).replace('.', ',')}`
const textW = (s: string, fs: number) => s.length * fs * 0.5   // узкий курсив ≈ 0,5 кегля
const NAME_MAX = 28
const trunc = (v: string, n: number) => (v.length > n ? v.slice(0, n - 1) + '…' : v)

// ── Примитивы ───────────────────────────────────────────────────────────────

/**
 * Размер между двумя точками. Выносные линии от самих точек, размерная — на
 * отступе `off` по нормали, засечки под 45°, надпись над линией и никогда
 * вверх ногами. Работает и на плане (наклонные участки), и на развёртке.
 */
function Dim({ ax, ay, bx, by, off = 8, text, small = false }: {
  ax: number; ay: number; bx: number; by: number; off?: number; text: string; small?: boolean
}) {
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || len < 0.2) return null
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux
  const p = (x: number, y: number, o: number) => [x + nx * o, y + ny * o] as const

  const [x1, y1] = p(ax, ay, off)
  const [x2, y2] = p(bx, by, off)
  const [e1x, e1y] = p(ax, ay, off + 1.6)
  const [e2x, e2y] = p(bx, by, off + 1.6)
  const s = 1.25
  const sx = (ux + nx) * s, sy = (uy + ny) * s

  let ang = Math.atan2(dy, dx) * 180 / Math.PI
  if (ang > 90 || ang < -90) ang += 180
  const fs = small ? FS.tag : FS.dim
  // Надпись ставится НАД размерной линией и не должна её касаться. Глифы растут
  // от базовой линии в сторону −Y локальной системы (после поворота на ang),
  // поэтому и отступ считаем по ней: смещение по нормали давало 1,4 ед при
  // кегле 2,5 — линия проходила ровно сквозь цифры.
  const rad = ang * Math.PI / 180
  const ryx = -Math.sin(rad), ryy = Math.cos(rad)
  const lift = fs * 0.3 + 0.5
  const mx = (x1 + x2) / 2 - ryx * lift, my = (y1 + y2) / 2 - ryy * lift
  const fits = len >= textW(text, fs) + 1.5

  return (
    <g stroke="#000" strokeWidth={LW.thin} fill="none">
      <line x1={ax} y1={ay} x2={e1x} y2={e1y} />
      <line x1={bx} y1={by} x2={e2x} y2={e2y} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - sx} y1={y1 - sy} x2={x1 + sx} y2={y1 + sy} />
      <line x1={x2 - sx} y1={y2 - sy} x2={x2 + sx} y2={y2 + sy} />
      {fits && (
        <text x={mx} y={my} textAnchor="middle" fontSize={fs} fill="#000" stroke="none"
          fontStyle="italic" fontFamily={FONT}
          transform={`rotate(${r1(ang)}, ${r1(mx)}, ${r1(my)})`}>{text}</text>
      )}
    </g>
  )
}

/** Отметка уровня «+2,785»: полка со стрелкой-треугольником, как на листах СП. */
function Level({ x, y, value, dir = 1 }: { x: number; y: number; value: number; dir?: 1 | -1 }) {
  const t = 1.8
  return (
    <g stroke="#000" strokeWidth={LW.thin} fill="none">
      <path d={`M ${r1(x)} ${r1(y)} l ${-t * dir} ${-t * 1.6} l ${t * 2 * dir} 0 z`} fill="#000" />
      <line x1={x} y1={y - t * 1.6} x2={x + 14 * dir} y2={y - t * 1.6} />
      <text x={x + 15 * dir} y={y - t * 1.6 - 0.8} fontSize={FS.dim} fill="#000" stroke="none"
        fontStyle="italic" fontFamily={FONT} textAnchor={dir === 1 ? 'start' : 'end'}>
        {levelText(value)}
      </text>
    </g>
  )
}

/**
 * Узел: буква в тонкой рамке вплотную к шву.
 * Зазор шва в каталоге хранится ОТРИЦАТЕЛЬНОЙ поправкой: шов 4 мм делает панель
 * на 4 мм уже, поэтому у «Профиль соединительный (зазор 4 мм)» offset_mm = −4,
 * а положительные значения (D = 19,4, H = 58,5) — это заход панели в профиль,
 * не щель. Печатаем именно зазор: −offset.
 */
function NodeTag({ x, y, code, offset }: { x: number; y: number; code?: string; offset?: number }) {
  if (!code) return null
  const gap = offset && offset < 0 ? -offset : 0
  const text = gap ? `${code} ${mm(gap)}` : code
  const w = textW(text, FS.tag) + 1.8, h = FS.tag + 1.4
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h}
        fill="#fff" stroke="#000" strokeWidth={LW.thin} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
        fontSize={FS.tag} fill="#000" stroke="none" fontStyle="italic" fontFamily={FONT}>
        {text}
      </text>
    </g>
  )
}

function Caption({ x, y, text, size: fs = FS.label, anchor = 'middle' }: {
  x: number; y: number; text: string; size?: number; anchor?: 'start' | 'middle' | 'end'
}) {
  if (!text) return null
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fs} fill="#000"
      fontStyle="italic" fontFamily={FONT}>{text}</text>
  )
}

// ── Оболочка вида ───────────────────────────────────────────────────────────

/** Один вид: заголовок и SVG во всю ширину; зум меняет ширину, не геометрию. */
function View({ title, w, h, zoom, children }: {
  title: string; w: number; h: number; zoom: number; children: ReactNode
}) {
  if (!(w > 0 && h > 0)) return null
  return (
    <div className="dw-view">
      <div className="dw-view-title">{title}</div>
      <div className="dw-view-scroll">
        <svg viewBox={`0 0 ${r1(w)} ${r1(h)}`} width={`${Math.round(zoom * 100)}%`}
          style={{ display: 'block', background: '#fff', minWidth: zoom > 1 ? `${zoom * 100}%` : undefined }}>
          {children}
        </svg>
      </div>
    </div>
  )
}

// Поправка узла в мм из справочника: ею подписывается шов.
type OffsetOf = (code?: string) => number | undefined
const offsetsOf = (jointTypes: JointType[]): OffsetOf => {
  const m = new Map(jointTypes.map(j => [j.code, j.offset_mm]))
  return code => (code ? (m.get(code) || undefined) : undefined)
}

// ── Геометрия участка ───────────────────────────────────────────────────────

/** Столбцы участка с разбивкой по рядам (сверху вниз) и фактические панели. */
function wallGeometry(it: ElevWall) {
  const gapBottom = num(it.gapBottom)
  const rowsTotal = Math.max(...it.colRows.map(rs => rs.reduce((s, v) => s + num(v), 0)), 0)
  const blockTop = gapBottom + rowsTotal
  let acc = 0
  const cols = it.widths.map((w, ci) => {
    const x0 = acc; acc += num(w)
    let top = blockTop
    const rows = (it.colRows[ci] ?? []).map(h => { const t = top; top -= num(h); return { top: t, bot: top, mm: num(h) } })
    return { x0, x1: acc, mm: num(w), rows }
  })
  const cells = it.cells.map(c => {
    const c0 = cols[c.col]
    const rg = c0?.rows[c.row]
    const x1 = cols[Math.min(c.col + c.span - 1, cols.length - 1)]?.x1 ?? (c0?.x0 ?? 0)
    const spanRows = (c0?.rows ?? []).slice(c.row, c.row + c.rowSpan)
    return {
      ...c,
      x0: c0?.x0 ?? 0, x1,
      top: rg?.top ?? blockTop,
      bot: spanRows.length ? spanRows[spanRows.length - 1].bot : (rg?.bot ?? 0),
      lastCol: c.col + c.span - 1,
      lastRow: c.row + c.rowSpan - 1,
      rowsOfCol: (c0?.rows ?? []).length,
    }
  })
  return { gapBottom, rowsTotal, blockTop, cols, cells, widthsTotal: acc }
}

const itemWidth = (it: ElevItem) => num(it.kind === 'wall' ? it.wallLength : it.openingW)
const itemHeight = (it: ElevItem) => num(it.kind === 'wall' ? it.wallHeight : it.ceilingH)

// ── Вид: развёртка ──────────────────────────────────────────────────────────

// Сверху оставляем место под две строки подписи участка и отметку уровня:
// при меньшем отступе подпись отделки ложилась прямо на полку отметки.
const EL_PAD = { l: 30, r: 30, t: 26, b: 40 }

/**
 * Развёртка: участки слева направо на общем полу, углы развёрнуты в плоскость.
 * Ниже каждого участка — цепочка ширин столбцов, под всей развёрткой — общий
 * габарит; справа от участка — высоты рядов.
 */
export function ElevationView({ items, off, zoom }: { items: ElevItem[]; off: OffsetOf; zoom: number }) {
  const totalMm = items.reduce((s, it) => s + itemWidth(it), 0)
  const maxHmm = Math.max(...items.map(itemHeight).filter(v => v > 0), 1)
  if (!(totalMm > 0)) return null

  const k = (CANVAS_W - EL_PAD.l - EL_PAD.r) / totalMm
  const H = maxHmm * k + EL_PAD.t + EL_PAD.b
  const floorY = EL_PAD.t + maxHmm * k
  const Y = (mmv: number) => floorY - num(mmv) * k

  let cursor = 0
  const placed = items.map(it => {
    const x = EL_PAD.l + cursor * k
    cursor += itemWidth(it)
    return { it, x, w: itemWidth(it) * k }
  })

  return (
    <View title="Развёртка — вид спереди" w={CANVAS_W} h={H} zoom={zoom}>
      {placed.map(({ it, x, w }) => {
        const X = (mmv: number) => x + num(mmv) * k

        if (it.kind === 'wall') {
          const g = wallGeometry(it)
          return (
            <g key={it.id}>
              {/* Габарит участка — тонкой штриховой */}
              <rect x={x} y={Y(it.wallHeight)} width={w} height={num(it.wallHeight) * k}
                fill="none" stroke="#000" strokeWidth={LW.thin} strokeDasharray="4 2" />

              {/* Панели первым проходом: белая заливка соседней иначе затирает метки */}
              {g.cells.map((c, i) => {
                const cw = (c.x1 - c.x0) * k, ch = (c.top - c.bot) * k
                return (
                  <g key={i}>
                    <rect x={X(c.x0)} y={Y(c.top)} width={cw} height={ch}
                      fill="#fff" stroke="#000" strokeWidth={LW.thick} />
                    {cw >= textW(c.drawLabel, FS.label) + 2 && ch >= FS.label + 2 && (
                      <text x={X(c.x0) + cw / 2} y={Y(c.top) + ch / 2 - (ch >= 12 ? 2 : 0)}
                        textAnchor="middle" dominantBaseline="central" fontSize={FS.label}
                        fill="#000" fontStyle="italic" fontFamily={FONT}>{c.drawLabel}</text>
                    )}
                    {ch >= 12 && cw >= textW(`${size(c.height)}×${size(c.width)}`, FS.tag) + 2 && (
                      <text x={X(c.x0) + cw / 2} y={Y(c.top) + ch / 2 + 3.4} textAnchor="middle"
                        dominantBaseline="central" fontSize={FS.tag} fill="#000"
                        fontStyle="italic" fontFamily={FONT}>{size(c.height)}×{size(c.width)}</text>
                    )}
                  </g>
                )
              })}

              {/* Метки узлов — вторым проходом, по шву, а не по обе стороны от него */}
              {g.cells.map((c, i) => {
                const cw = (c.x1 - c.x0) * k, ch = (c.top - c.bot) * k
                const isLeftSeam = c.col !== 0
                const isRightSeam = c.lastCol !== g.cols.length - 1
                const isTopSeam = c.row !== 0
                const isBottomSeam = c.lastRow !== c.rowsOfCol - 1
                const sides = cw >= 16 && ch >= 8
                const topBot = ch >= 16 && cw >= 12
                return (
                  <g key={i}>
                    {sides && <>
                      {!isLeftSeam && <NodeTag x={X(c.x0)} y={Y(c.top) + ch / 2} code={it.leftNode} />}
                      <NodeTag x={X(c.x1)} y={Y(c.top) + ch / 2}
                        code={isRightSeam ? it.connType : it.rightNode}
                        offset={isRightSeam ? off(it.connType) : undefined} />
                    </>}
                    {topBot && <>
                      {!isTopSeam && <NodeTag x={X(c.x0) + cw / 2} y={Y(c.top)} code={it.topEdge} />}
                      <NodeTag x={X(c.x0) + cw / 2} y={Y(c.bot)}
                        code={isBottomSeam ? it.rowConn : it.bottomEdge}
                        offset={isBottomSeam ? off(it.rowConn) : undefined} />
                    </>}
                  </g>
                )
              })}

              {/* Недобор: ширины введены вручную и не дотягивают до длины по узлам */}
              {g.widthsTotal < num(it.lengthByNodes) - 0.5 && (
                <rect x={X(g.widthsTotal)} y={Y(g.blockTop)}
                  width={(num(it.lengthByNodes) - g.widthsTotal) * k} height={g.rowsTotal * k}
                  fill={GREY_FILL} stroke="#000" strokeWidth={LW.thin} strokeDasharray="2 1.5" />
              )}

              {/* Название и отделка над участком */}
              <Caption x={x + w / 2} y={EL_PAD.t - 17}
                text={`${trunc(it.name || 'Участок', NAME_MAX)}${it.copies > 1 ? ` — ${it.copies} компл.` : ''}`} />
              <Caption x={x + w / 2} y={EL_PAD.t - 11} size={FS.tag} text={trunc(finishLine(it), 46)} />

              {/* Ширины столбцов и габарит участка */}
              {g.cols.map((c, i) => (
                <Dim key={i} small ax={X(c.x0)} ay={floorY} bx={X(c.x1)} by={floorY} off={8} text={mm(c.mm)} />
              ))}
              <Dim ax={x} ay={floorY} bx={x + w} by={floorY} off={16} text={mm(it.wallLength)} />

              {/* Высоты рядов — справа от участка */}
              {(g.cols[g.cols.length - 1]?.rows ?? []).map((r, i) => (
                <Dim key={`r${i}`} small ax={X(g.widthsTotal)} ay={Y(r.bot)}
                  bx={X(g.widthsTotal)} by={Y(r.top)} off={6} text={mm(r.mm)} />
              ))}

              {/* Отметки уровней: верх участка и верх панельного блока */}
              <Level x={x + 2} y={Y(it.wallHeight)} value={num(it.wallHeight)} />
              {(num(it.wallHeight) - g.blockTop) * k >= 4 && (
                <Level x={x + 2} y={Y(g.blockTop)} value={g.blockTop} />
              )}
            </g>
          )
        }

        // ── Дверной проём ──
        const openingH = num(it.openingH)
        const ceilingH = Math.max(num(it.ceilingH), openingH, 1)
        const panelH = num(it.panelH)
        const hasPanel = panelH > 0 && num(it.panelW) > 0
        return (
          <g key={it.id}>
            <rect x={x} y={Y(ceilingH)} width={w} height={ceilingH * k}
              fill="none" stroke="#000" strokeWidth={LW.thin} strokeDasharray="4 2" />

            {hasPanel && (() => {
              const pw = num(it.panelW) * k
              const px = x + (w - pw) / 2
              return (
                <g>
                  <rect x={px} y={Y(ceilingH)} width={pw} height={panelH * k}
                    fill="#fff" stroke="#000" strokeWidth={LW.thick} />
                  {pw >= textW(it.panelDrawLabel, FS.label) + 2 && panelH * k >= FS.label + 2 && (
                    <text x={px + pw / 2} y={Y(ceilingH) + panelH * k / 2 - (panelH * k >= 12 ? 2 : 0)}
                      textAnchor="middle" dominantBaseline="central" fontSize={FS.label}
                      fill="#000" fontStyle="italic" fontFamily={FONT}>{it.panelDrawLabel}</text>
                  )}
                  {panelH * k >= 12 && pw >= textW(`${size(panelH)}×${size(it.panelW ?? 0)}`, FS.tag) + 2 && (
                    <text x={px + pw / 2} y={Y(ceilingH) + panelH * k / 2 + 3.4} textAnchor="middle"
                      dominantBaseline="central" fontSize={FS.tag} fill="#000"
                      fontStyle="italic" fontFamily={FONT}>{size(panelH)}×{size(it.panelW ?? 0)}</text>
                  )}
                  {panelH * k >= 10 && <>
                    <NodeTag x={px} y={Y(ceilingH) + panelH * k / 2} code={it.leftNode} />
                    <NodeTag x={px + pw} y={Y(ceilingH) + panelH * k / 2} code={it.rightNode} />
                  </>}
                </g>
              )
            })()}

            {/* Проём, доборы откоса и полотно */}
            <rect x={x} y={Y(openingH)} width={w} height={openingH * k}
              fill={GREY_FILL} stroke="#000" strokeWidth={LW.thick} />
            {it.trim && (() => {
              const t = it.trim
              const dep = (v: number) => Math.max(1.2, Math.min(w / 3, num(v) * k))
              const lw = dep(t.left.w), rw = dep(t.right.w)
              const th = t.top ? Math.max(1.2, Math.min(openingH * k / 3, num(t.top.h) * k)) : 0
              return (
                <g stroke="#000" strokeWidth={LW.thin} fill={GREY_CUT} fillOpacity={0.6}>
                  <rect x={x} y={Y(openingH)} width={lw} height={openingH * k} />
                  <rect x={x + w - rw} y={Y(openingH)} width={rw} height={openingH * k} />
                  {t.top && <rect x={x} y={Y(openingH)} width={w} height={th} />}
                </g>
              )
            })()}
            <line x1={it.hingeLeft ? x : x + w} y1={Y(openingH)} x2={it.hingeLeft ? x : x + w} y2={floorY}
              stroke="#000" strokeWidth={LW.thick} />
            <path d={it.hingeLeft
              ? `M ${r1(x)} ${r1(floorY)} L ${r1(x + w)} ${r1(Y(openingH / 2))} L ${r1(x)} ${r1(Y(openingH))}`
              : `M ${r1(x + w)} ${r1(floorY)} L ${r1(x)} ${r1(Y(openingH / 2))} L ${r1(x + w)} ${r1(Y(openingH))}`}
              fill="none" stroke="#000" strokeWidth={LW.thin} strokeDasharray="3 2" />

            <Caption x={x + w / 2} y={EL_PAD.t - 17}
              text={trunc(`${it.label}${it.doorLabel ? ` · ${it.doorLabel}` : ''}`, NAME_MAX)} />
            <Caption x={x + w / 2} y={EL_PAD.t - 11} size={FS.tag}
              text={`${it.opensOut ? 'наружу' : 'внутрь'}, петли ${it.hingeLeft ? 'слева' : 'справа'}`} />
            <Dim ax={x} ay={floorY} bx={x + w} by={floorY} off={8} text={mm(it.openingW)} />
            <Dim small ax={x + w} ay={floorY} bx={x + w} by={Y(openingH)} off={6} text={mm(openingH)} />
            <Level x={x + 2} y={Y(ceilingH)} value={ceilingH} />
          </g>
        )
      })}

      {/* Пол и общий габарит развёртки */}
      <line x1={EL_PAD.l - 4} y1={floorY} x2={EL_PAD.l + totalMm * k + 4} y2={floorY}
        stroke="#000" strokeWidth={LW.thick} />
      <Dim ax={EL_PAD.l} ay={floorY} bx={EL_PAD.l + totalMm * k} by={floorY} off={26} text={mm(totalMm)} />
    </View>
  )
}

// ── Вид: план (сверху) ──────────────────────────────────────────────────────

interface PlanSeg {
  it: ElevItem
  ax: number; ay: number; bx: number; by: number
  ux: number; uy: number; nx: number; ny: number
}

/**
 * Раскладка участков по плану: идём от первого вправо, на угловых узлах
 * поворачиваем (D — наружный, DG/DH — внутренний). Лицевая сторона полосы — по
 * нормали (направление, повёрнутое на +90° в экранных осях).
 */
export function planRun(items: ElevItem[]): PlanSeg[] {
  const out: PlanSeg[] = []
  let x = 0, y = 0, a = 0
  for (const it of items) {
    const len = itemWidth(it)
    if (len > 0) {
      const r = a * Math.PI / 180
      const ux = Math.cos(r), uy = Math.sin(r)
      out.push({ it, ax: x, ay: y, bx: x + ux * len, by: y + uy * len, ux, uy, nx: -uy, ny: ux })
      x += ux * len; y += uy * len
    }
    if (CORNER_OUTER.has(it.rightNode)) a = (a - 90 + 360) % 360
    else if (CORNER_INNER.has(it.rightNode)) a = (a + 90) % 360
  }
  return out
}

const PL_PAD = 34

export function PlanView({ items, zoom }: { items: ElevItem[]; zoom: number }) {
  const segs = planRun(items)
  if (segs.length === 0) return null
  const pts: [number, number][] = []
  for (const s of segs) {
    pts.push([s.ax, s.ay], [s.bx, s.by],
      [s.ax + s.nx * PANEL_T, s.ay + s.ny * PANEL_T],
      [s.bx + s.nx * PANEL_T, s.by + s.ny * PANEL_T])
  }
  const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]))
  const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]))
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1)
  const k = (CANVAS_W - PL_PAD * 2) / spanX
  const H = spanY * k + PL_PAD * 2
  const X = (v: number) => PL_PAD + (num(v) - minX) * k
  const Y = (v: number) => PL_PAD + (num(v) - minY) * k

  return (
    <View title="План — вид сверху" w={CANVAS_W} h={H} zoom={zoom}>
      {segs.map((s, si) => {
        const it = s.it
        const P = (mx: number, my: number) => `${r1(X(mx))},${r1(Y(my))}`
        const strip = [
          P(s.ax, s.ay), P(s.bx, s.by),
          P(s.bx + s.nx * PANEL_T, s.by + s.ny * PANEL_T),
          P(s.ax + s.nx * PANEL_T, s.ay + s.ny * PANEL_T),
        ].join(' ')
        const name = it.kind === 'wall'
          ? (it.name || 'Участок')
          : `${it.label}${it.doorLabel ? ` · ${it.doorLabel}` : ''}`
        // Подпись горизонтальная всегда, поэтому у вертикального участка она
        // «съедает» отступ своей шириной. Соседние подписываются через строку:
        // у короткого проёма рядом с длинной стеной они ложились друг на друга.
        const label = trunc(name, NAME_MAX)
        const capOff = -(24 + (si % 2) * 6 + (Math.abs(s.ux) < 0.5 ? textW(label, FS.label) / 2 : 0))
        const capX = (X(s.ax) + X(s.bx)) / 2 + s.nx * capOff
        const capY = (Y(s.ay) + Y(s.by)) / 2 + s.ny * capOff

        if (it.kind === 'wall') {
          let acc = 0
          const bounds = [0, ...it.widths.map(w => (acc += num(w)))]
          return (
            <g key={it.id}>
              <polygon points={strip} fill={GREY_CUT} stroke="#000" strokeWidth={LW.thick} />
              {bounds.slice(1, -1).map((v, j) => (
                <line key={j} stroke="#000" strokeWidth={LW.thin}
                  x1={X(s.ax + s.ux * v)} y1={Y(s.ay + s.uy * v)}
                  x2={X(s.ax + s.ux * v + s.nx * PANEL_T)} y2={Y(s.ay + s.uy * v + s.ny * PANEL_T)} />
              ))}
              {bounds.slice(0, -1).map((m0, j) => (
                <Dim key={`d${j}`} small
                  ax={X(s.ax + s.ux * m0)} ay={Y(s.ay + s.uy * m0)}
                  bx={X(s.ax + s.ux * bounds[j + 1])} by={Y(s.ay + s.uy * bounds[j + 1])}
                  off={-8} text={mm(it.widths[j])} />
              ))}
              <Dim ax={X(s.ax)} ay={Y(s.ay)} bx={X(s.bx)} by={Y(s.by)} off={-16} text={mm(it.wallLength)} />
              <Caption x={capX} y={capY} text={label} />
              <NodeTag x={X(s.ax) + s.nx * 4} y={Y(s.ay) + s.ny * 4} code={it.leftNode} />
              <NodeTag x={X(s.bx) + s.nx * 4} y={Y(s.by) + s.ny * 4} code={it.rightNode} />
            </g>
          )
        }

        // Дверь: полотно от петли под 45° и дуга открывания
        const L = itemWidth(it) * 0.92
        const hx = it.hingeLeft ? s.ax : s.bx
        const hy = it.hingeLeft ? s.ay : s.by
        const c = (it.hingeLeft ? 1 : -1) * L
        const closed = { x: s.ux * c, y: s.uy * c }
        const rot = (v: { x: number; y: number }, deg: number) => {
          const a = deg * Math.PI / 180
          return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }
        }
        const want = it.opensOut ? 1 : -1
        const cand = [rot(closed, 45), rot(closed, -45)]
        const open = cand.find(v => Math.sign(v.x * s.nx + v.y * s.ny) === want) ?? cand[0]
        const sweep = (open.x * closed.y - open.y * closed.x) > 0 ? 1 : 0
        return (
          <g key={it.id}>
            <polygon points={strip} fill="#fff" stroke="#000" strokeWidth={LW.thin} strokeDasharray="2 1.2" />
            <line x1={X(hx)} y1={Y(hy)} x2={X(hx + open.x)} y2={Y(hy + open.y)}
              stroke="#000" strokeWidth={LW.thick} />
            <path d={`M ${r1(X(hx + closed.x))} ${r1(Y(hy + closed.y))} A ${r1(L * k)} ${r1(L * k)} 0 0 ${sweep} ${r1(X(hx + open.x))} ${r1(Y(hy + open.y))}`}
              fill="none" stroke="#000" strokeWidth={LW.thin} strokeDasharray="2 1.5" />
            <Dim ax={X(s.ax)} ay={Y(s.ay)} bx={X(s.bx)} by={Y(s.by)} off={-16} text={mm(it.openingW)} />
            <Caption x={capX} y={capY} text={label} />
          </g>
        )
      })}
    </View>
  )
}

// ── Вид: разрезы ────────────────────────────────────────────────────────────

const SEC_CELL = 46      // ширина ячейки одного разреза в единицах холста

/** Разрез каждого участка узкой полосой в толщину панели, как на листах СП. */
export function SectionView({ items, zoom }: { items: ElevItem[]; zoom: number }) {
  const list = items.filter(it => itemHeight(it) > 0)
  if (list.length === 0) return null
  const maxHmm = Math.max(...list.map(itemHeight), 1)
  const perRow = Math.max(1, Math.min(list.length, Math.floor(CANVAS_W / SEC_CELL)))
  const rows = Math.ceil(list.length / perRow)
  const PAD_T = 16, PAD_B = 16
  // Холст по фактическому числу разрезов: при жёсткой ширине четыре полосы
  // занимали две трети поля, а треть оставалась пустой.
  // Справа добавляем место под полку отметки уровня — она вылезала за холст.
  const W = perRow * SEC_CELL + 20
  const rowH = Math.min(200, (W * 0.9) / rows)
  const k = (rowH - PAD_T - PAD_B) / maxHmm
  const H = rows * rowH

  return (
    <View title="Разрезы участков" w={W} h={H} zoom={zoom}>
      {list.map((it, i) => {
        const col = i % perRow, row = Math.floor(i / perRow)
        const cx = col * SEC_CELL + SEC_CELL * 0.55
        const floorY = row * rowH + rowH - PAD_B
        const Y = (v: number) => floorY - num(v) * k
        const sw = Math.max(PANEL_T * k, 0.8)
        const name = it.kind === 'wall' ? (it.name || 'Участок') : it.label

        if (it.kind === 'wall') {
          const g = wallGeometry(it)
          const lastRows = g.cols[g.cols.length - 1]?.rows ?? []
          return (
            <g key={it.id}>
              <Caption x={cx} y={row * rowH + PAD_T - 5} size={FS.dim} text={trunc(name, 18)} />
              <rect x={cx - sw / 2} y={Y(g.blockTop)} width={sw} height={g.rowsTotal * k}
                fill={GREY_CUT} stroke="#000" strokeWidth={LW.thick} />
              <rect x={cx - sw / 2} y={Y(g.blockTop) - PROFILE_T * k} width={sw} height={PROFILE_T * k}
                fill="#fff" stroke="#000" strokeWidth={LW.thin} />
              {lastRows.slice(1).map((r, j) => (
                <line key={j} x1={cx - sw / 2} y1={Y(r.top)} x2={cx + sw / 2} y2={Y(r.top)}
                  stroke="#000" strokeWidth={LW.thin} />
              ))}
              {lastRows.map((r, j) => (
                <Dim key={`h${j}`} small ax={cx - sw / 2} ay={Y(r.top)} bx={cx - sw / 2} by={Y(r.bot)}
                  off={7} text={mm(r.mm)} />
              ))}
              <Level x={cx + sw / 2} y={Y(g.blockTop)} value={g.blockTop} />
              <Dim small ax={cx - sw / 2} ay={floorY + 4} bx={cx + sw / 2} by={floorY + 4}
                off={0} text={mm(PANEL_T)} />
              <line x1={cx - 8} y1={floorY} x2={cx + 8} y2={floorY} stroke="#000" strokeWidth={LW.thick} />
            </g>
          )
        }

        const openingH = num(it.openingH)
        const ceilingH = Math.max(num(it.ceilingH), openingH, 1)
        const panelH = num(it.panelH)
        return (
          <g key={it.id}>
            <Caption x={cx} y={row * rowH + PAD_T - 5} size={FS.dim} text={trunc(name, 18)} />
            {panelH > 0 && (
              <rect x={cx - sw / 2} y={Y(ceilingH)} width={sw} height={panelH * k}
                fill={GREY_CUT} stroke="#000" strokeWidth={LW.thick} />
            )}
            <rect x={cx - sw / 2} y={Y(openingH)} width={sw} height={openingH * k}
              fill={GREY_FILL} stroke="#000" strokeWidth={LW.thin} />
            <line x1={cx} y1={Y(openingH) + 1} x2={cx} y2={floorY - 1} stroke="#000" strokeWidth={LW.med} />
            <Dim small ax={cx - sw / 2} ay={floorY} bx={cx - sw / 2} by={Y(ceilingH)} off={7} text={mm(ceilingH)} />
            <Level x={cx + sw / 2} y={Y(ceilingH)} value={ceilingH} />
            {(ceilingH - openingH) * k >= 4 && <Level x={cx + sw / 2} y={Y(openingH)} value={openingH} />}
            <line x1={cx - 8} y1={floorY} x2={cx + 8} y2={floorY} stroke="#000" strokeWidth={LW.thick} />
          </g>
        )
      })}
    </View>
  )
}

// ── Вид: доборы проёмов ─────────────────────────────────────────────────────

/**
 * Доборы (наличник откоса) — отдельные панели спецификации (Д1.1…Д1.3),
 * поэтому показываем их плашмя с габаритами и кромками: рядом с проёмом они
 * помещались только в масштаб вроде 1:80, а размер без масштаба не читается.
 */
export function TrimsView({ items, zoom }: { items: ElevItem[]; zoom: number }) {
  const doors = items.filter((it): it is ElevDoor => it.kind === 'door' && !!it.trim)
  if (doors.length === 0) return null

  const parts = doors.flatMap(it => {
    const t = it.trim!
    return [
      t.top ? { key: `${it.id}-t`, lab: t.drawLabels[0], door: it.label, name: 'верхний',
        h: num(t.top.h), w: num(t.top.w), left: t.top.leftNode, right: t.top.rightNode } : null,
      { key: `${it.id}-l`, lab: t.drawLabels[1], door: it.label, name: 'левый',
        h: num(t.left.h), w: num(t.left.w), left: t.left.wallNode, right: 'O' },
      { key: `${it.id}-r`, lab: t.drawLabels[2], door: it.label, name: 'правый',
        h: num(t.right.h), w: num(t.right.w), left: 'O', right: t.right.wallNode },
    ].filter(Boolean)
  }) as { key: string; lab: string; door: string; name: string; h: number; w: number; left: string; right: string }[]
  if (parts.length === 0) return null

  const GAP_MM = 260
  const totalW = parts.reduce((a, p) => a + p.w, 0) + GAP_MM * (parts.length - 1)
  const maxH = Math.max(...parts.map(p => p.h), 1)
  const PAD = { l: 16, r: 22, t: 18, b: 26 }
  const k = (CANVAS_W - PAD.l - PAD.r) / Math.max(totalW, 1)
  const H = maxH * k + PAD.t + PAD.b
  const floorY = PAD.t + maxH * k

  let cx = PAD.l
  return (
    <View title="Доборы проёмов" w={CANVAS_W} h={H} zoom={zoom}>
      {parts.map(p => {
        const w = p.w * k, h = p.h * k, x = cx, y = floorY - h
        cx += w + GAP_MM * k
        return (
          <g key={p.key}>
            <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#000" strokeWidth={LW.thick} />
            <Caption x={x + w / 2} y={y - 3} size={FS.dim} text={`${p.lab} · ${p.door} ${p.name}`} />
            {w >= textW(`${size(p.h)}×${size(p.w)}`, FS.tag) + 2 && h >= 10 && (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
                fontSize={FS.tag} fill="#000" fontStyle="italic" fontFamily={FONT}>
                {size(p.h)}×{size(p.w)}
              </text>
            )}
            {w >= 8 && <>
              <NodeTag x={x} y={y + h / 2} code={p.left} />
              <NodeTag x={x + w} y={y + h / 2} code={p.right} />
            </>}
            <Dim small ax={x} ay={floorY} bx={x + w} by={floorY} off={8} text={mm(p.w)} />
            <Dim small ax={x + w} ay={floorY} bx={x + w} by={y} off={6} text={mm(p.h)} />
          </g>
        )
      })}
      <line x1={PAD.l - 4} y1={floorY} x2={cx - GAP_MM * k + 4} y2={floorY}
        stroke="#000" strokeWidth={LW.thick} />
    </View>
  )
}

// ── Вид: узлы ───────────────────────────────────────────────────────────────

/** Все коды узлов, встречающиеся в заказе, в порядке первого появления. */
export function usedNodeCodes(items: ElevItem[]): string[] {
  const out: string[] = []
  const push = (c?: string) => { if (c && !out.includes(c)) out.push(c) }
  for (const it of items) {
    push(it.leftNode); push(it.rightNode); push(it.topEdge); push(it.bottomEdge)
    if (it.kind === 'wall') { push(it.connType); push(it.rowConn) }
    else if (it.trim) {
      push(it.trim.left.wallNode); push(it.trim.right.wallNode)
      if (it.trim.top) { push(it.trim.top.leftNode); push(it.trim.top.rightNode) }
    }
  }
  return out
}

/**
 * Чертежи применённых узлов из каталога (`image_url` → media/joints/). Это те же
 * чертежи, по которым собирают на объекте, поэтому отдельный альбом не нужен.
 */
export function NodesView({ items, jointTypes, zoom }: {
  items: ElevItem[]; jointTypes: JointType[]; zoom: number
}) {
  const codes = usedNodeCodes(items)
  if (codes.length === 0) return null
  const byCode = new Map(jointTypes.map(j => [j.code, j]))
  const COLS = Math.min(3, codes.length)
  const cw = CANVAS_W / 3, ch = cw * 0.78
  const rows = Math.ceil(codes.length / COLS)

  return (
    <View title="Узлы, применённые в заказе" w={COLS * cw} h={rows * ch} zoom={zoom}>
      {codes.map((code, i) => {
        const jt = byCode.get(code)
        const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch
        const imgH = ch - 16
        const lines = [
          jt?.name ?? '',
          jt && jt.offset_mm !== 0 ? `поправка ${String(jt.offset_mm).replace('.', ',')} мм` : '',
          jt?.profile_article
            ? `профиль ${jt.profile_article}${jt.profile_count > 1 ? ` ×${jt.profile_count}` : ''}` : '',
        ].filter(Boolean)
        return (
          <g key={code}>
            <rect x={x + 1.5} y={y + 1.5} width={cw - 3} height={ch - 3}
              fill="none" stroke="#000" strokeWidth={LW.thin} />
            {jt?.image_url ? (
              <image href={jt.image_url} x={x + 4} y={y + 4} width={cw - 8} height={imgH - 4}
                preserveAspectRatio="xMidYMid meet" />
            ) : (
              <text x={x + cw / 2} y={y + imgH / 2} textAnchor="middle" dominantBaseline="central"
                fontSize={FS.head} fill="#999" fontStyle="italic" fontFamily={FONT}>
                чертёж не загружен
              </text>
            )}
            <text x={x + 5} y={y + ch - 9} fontSize={FS.head} fill="#000"
              fontStyle="italic" fontWeight="700" fontFamily={FONT}>{code}</text>
            {lines.map((l, j) => (
              <text key={j} x={x + 16} y={y + ch - 11 + j * 3.6} fontSize={FS.tag} fill="#000"
                fontStyle="italic" fontFamily={FONT}>{trunc(l, 40)}</text>
            ))}
          </g>
        )
      })}
    </View>
  )
}

// ── Описание изделия текстом ────────────────────────────────────────────────

/** Отделка одной строкой: «ШПОН 1,5 ММ · Breeze Oak · вертикально». */
export function finishLine(it: ElevItem): string {
  const sp = it.spec
  if (!sp) return ''
  const parts = [sp.finishGroup, sp.finishName, sp.decor3d, sp.veneerDirection]
    .map(v => (v ?? '').trim()).filter(Boolean)
  return parts.filter((v, i) => parts.indexOf(v) === i).join(' · ')
}

/**
 * Примечания к участку: всё, что есть в заказе, но не выражается геометрией.
 * Позиции алюминиевого декора в заказе не задаются (только количество), поэтому
 * он идёт текстом — рисовать выдуманные полосы на чертеже нельзя.
 */
export function noteLines(it: ElevItem): string[] {
  const sp = it.spec
  if (!sp) return []
  const out: string[] = []
  const av = num(sp.aluminumVertical), ah = num(sp.aluminumHorizontal)
  if (av > 0 || ah > 0) {
    const pcs = [av > 0 ? `верт. ${av}` : '', ah > 0 ? `гор. ${ah}` : ''].filter(Boolean).join(', ')
    out.push(`Декор алюм. П 6×6: ${pcs}${sp.aluminumColor ? ` — ${sp.aluminumColor}` : ''}`)
  }
  if (sp.wallFacing === 'back') out.push('Сторона монтажа: тыльная')
  if (sp.mountType) out.push(`Монтаж двери: ${sp.mountType.toLowerCase()}`)
  if (num(sp.wallDepth) > 0) out.push(`Глубина стены: ${mm(sp.wallDepth!)} мм`)
  if (it.kind === 'door') {
    out.push(`Открывание: ${it.opensOut ? 'наружу' : 'внутрь'}, петли ${it.hingeLeft ? 'слева' : 'справа'}`)
  }
  if (sp.notes?.trim()) out.push(sp.notes.trim())
  return out
}

/** Примечания по всем участкам — обычным списком, а не выноской на чертеже. */
function NotesBlock({ items }: { items: ElevItem[] }) {
  const blocks = items
    .map(it => ({ name: it.kind === 'wall' ? it.name : it.label, lines: noteLines(it) }))
    .filter(b => b.lines.length > 0)
  if (blocks.length === 0) return null
  return (
    <div className="dw-notes">
      <div className="dw-view-title">Примечания</div>
      {blocks.map((b, i) => (
        <div key={i} className="dw-note">
          <strong>{b.name}</strong>
          <ul>{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
        </div>
      ))}
    </div>
  )
}

// ── Переключатель видов ─────────────────────────────────────────────────────

export type DrawView = 'plan' | 'elevation' | 'section' | 'trims' | 'nodes' | 'edges' | 'all'

const ALL_VIEWS: { id: DrawView; label: string }[] = [
  { id: 'elevation', label: 'Развёртка' },
  { id: 'plan', label: 'План' },
  { id: 'section', label: 'Разрезы' },
  { id: 'trims', label: 'Доборы' },
  { id: 'nodes', label: 'Узлы' },
  { id: 'edges', label: 'Кромки' },
  { id: 'all', label: 'Всё' },
]

/** Виды, которым есть что показать: без дверей с обрамлением «Доборы» пусты. */
export function availableViews(items: ElevItem[]) {
  const hasTrim = items.some(it => it.kind === 'door' && !!it.trim)
  return ALL_VIEWS.filter(v => v.id !== 'trims' || hasTrim)
}

export default function Drawing({ items, jointTypes = [], view, zoom = 1 }: {
  items: ElevItem[]
  jointTypes?: JointType[]
  view: DrawView
  zoom?: number
}) {
  const drawable = items.filter(it => itemWidth(it) > 0)
  if (drawable.length === 0) return null
  const off = offsetsOf(jointTypes)
  const show = (v: DrawView) => view === 'all' || view === v
  return (
    <div className="dw-doc">
      {show('elevation') && <ElevationView items={drawable} off={off} zoom={zoom} />}
      {show('plan') && <PlanView items={drawable} zoom={zoom} />}
      {show('section') && <SectionView items={drawable} zoom={zoom} />}
      {show('trims') && <TrimsView items={drawable} zoom={zoom} />}
      {show('nodes') && <NodesView items={drawable} jointTypes={jointTypes} zoom={zoom} />}
      {show('edges') && (
        <div className="dw-view">
          <div className="dw-view-title">Панели и типы кромок</div>
          <ElevationTable items={drawable} />
        </div>
      )}
      {(view === 'all' || view === 'elevation') && <NotesBlock items={drawable} />}
    </div>
  )
}
