// Отрисовка чертежей: проверяем, что SVG не уезжает в NaN/Infinity и что
// подписи не выходят за viewBox. Рендерим в строку через renderToStaticMarkup —
// jsdom для этого не нужен, порталы при отсутствии наведения не создаются.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WallScheme from './WallScheme'
import WallElevation from './WallElevation'

const render = (c: unknown, props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(c as never, props as never))

const wall = (over = {}) => ({
  id: 'w1', name: 'Стена 1', wallLength: 3000, wallHeight: 2700,
  numPanels: 3, connType: 'C', leftNode: 'A', rightNode: 'A', copies: 1, ...over,
})

const door = (over = {}) => ({
  id: 'd1', label: 'Дверной проём 1', doorRef: '', openingW: 900, openingH: 2100,
  mountType: 'В ПРОЕМ', openingDir: 'ВНУТРЬ', hingeDir: 'СЛЕВА',
  leftNode: 'B', rightNode: 'B', copies: 1, wallDepth: 200, hasTrim: true,
  trimLeftW: 200, trimRightW: 200, trimTopH: 200,
  trimTopLeftNode: 'A', trimTopRightNode: 'A', ...over,
})

const clean = (svg: string) => {
  expect(svg.length).toBeGreaterThan(200)   // что-то действительно нарисовалось
  expect(svg).not.toMatch(/NaN/)
  expect(svg).not.toMatch(/Infinity/)
  expect(svg).not.toMatch(/(x|y|width|height|cx|cy|r)="-?\d+\.?\d*e[+-]/)
}

describe('WallScheme — план', () => {
  it('рисует стену с проёмом без NaN', () => {
    const svg = render(WallScheme, {
      walls: [wall()], doors: [door()], panels: [],
      itemOrder: [{ type: 'wall', id: 'w1' }, { type: 'door', id: 'd1' }],
    })
    clean(svg)
  })

  it('переживает битые данные старого заказа', () => {
    const svg = render(WallScheme, {
      walls: [wall({ numPanels: 0 })],
      doors: [door({ wallDepth: undefined, trimLeftW: undefined, trimRightW: undefined, trimTopH: undefined })],
      panels: [],
      itemOrder: [{ type: 'wall', id: 'w1' }, { type: 'door', id: 'd1' }],
    })
    clean(svg)
  })

  it('не падает, когда itemOrder ссылается на несуществующие участки', () => {
    const svg = render(WallScheme, {
      walls: [wall()], doors: [], panels: [],
      itemOrder: [{ type: 'wall', id: 'нет-такого' }],
    })
    expect(svg).toBe('')
  })

  it('на повороте 180° название участка не ложится на размерную цепочку', () => {
    // D справа у первой стены разворачивает вторую; третья идёт обратно (180°).
    const svg = render(WallScheme, {
      walls: [
        wall({ id: 'w1', name: 'Стена 1', rightNode: 'D' }),
        wall({ id: 'w2', name: 'Стена 2', rightNode: 'D' }),
        wall({ id: 'w3', name: 'Стена 3' }),
      ],
      doors: [], panels: [],
      itemOrder: [1, 2, 3].map(i => ({ type: 'wall', id: `w${i}` })),
    })
    clean(svg)
    // У сегмента под 180° подпись уходит в положительный y, а размерная
    // цепочка — в отрицательный: значит они на разных сторонах полосы.
    expect(svg).toContain('rotate(-180')
  })
})

describe('WallElevation — развёртка', () => {
  const elevWall = {
    kind: 'wall' as const, id: 'w1', name: 'Стена 1', copies: 1,
    wallLength: 3000, wallHeight: 2700, gapTop: 7, gapBottom: 5,
    lengthByNodes: 2962, widths: [987, 987, 988], colRows: [[2688], [2688], [2688]],
    cells: [0, 1, 2].map(col => ({
      col, row: 0, span: 1, rowSpan: 1, width: 987, height: 2688, drawLabel: `А${col + 1}`,
    })),
    leftNode: 'A', rightNode: 'A', connType: 'C', topEdge: 'A', bottomEdge: 'A', rowConn: 'S',
  }

  it('рисует стену и проём без NaN', () => {
    const svg = render(WallElevation, { items: [elevWall] })
    clean(svg)
  })

  it('проём выше потолка не даёт прямоугольник отрицательной высоты', () => {
    const bad = {
      kind: 'door' as const, id: 'd1', label: 'Проём', copies: 1,
      openingW: 900, openingH: 2800, ceilingH: 2700,
      panelH: -48.5, panelW: 782.5, panelDrawLabel: 'А1', doorLabel: 'Д1',
      leftNode: 'B', rightNode: 'B', topEdge: '', bottomEdge: 'H',
      opensOut: false, hingeLeft: true, trim: null,
    }
    const svg = render(WallElevation, { items: [bad] })
    clean(svg)
    expect(svg).not.toMatch(/height="-/)
  })
})
