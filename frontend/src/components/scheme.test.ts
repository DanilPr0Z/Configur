// Отрисовка чертежей: проверяем, что SVG не уезжает в NaN/Infinity и что
// подписи не выходят за viewBox. Рендерим в строку через renderToStaticMarkup —
// jsdom для этого не нужен, порталы при отсутствии наведения не создаются.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WallScheme from './WallScheme'
import WallElevation from './WallElevation'
import Drawing, { planRun, usedNodeCodes, finishLine, noteLines } from './Drawing'

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

  it('объединённые панели рисуются своей шириной, а не равными долями', () => {
    // Стена 3000 мм: первые два столбца объединены (999 + 999 + шов 4 = 2002),
    // третий — 999. На плане должно быть ДВЕ ячейки и ОДИН шов, а не три
    // равные трети с повторяющимся номером панели.
    const svg = render(WallScheme, {
      walls: [wall({ numPanels: 3 })],
      doors: [], panels: [
        { wallName: 'Стена 1', panelLabel: '1.1', width: 2002, height: 2688 },
        { wallName: 'Стена 1', panelLabel: '1.3', width: 999, height: 2688 },
      ],
      itemOrder: [{ type: 'wall', id: 'w1' }],
    })
    clean(svg)
    // Номера панелей — ровно те, что в спецификации, каждый по одному разу.
    expect(svg.match(/>1\.1</g)?.length).toBe(1)
    expect(svg.match(/>1\.3</g)?.length).toBe(1)
    expect(svg).not.toMatch(/>1\.2</)
    // Шов между панелями один, и он на 2/3 длины, а не на половине.
    const seams = [...svg.matchAll(/<line x1="([\d.]+)" y1="-22"/g)].map(m => +m[1])
    expect(seams).toHaveLength(1)
    expect(seams[0] / (3000 * 0.22)).toBeCloseTo(2002 / 3001, 2)
  })

  it('в план попадает только верхний ряд многорядной стены', () => {
    // Два ряда, в верхнем первые два столбца объединены. На плане (вид сверху)
    // видно только верхний ряд: раньше третьей ячейкой подставлялась панель
    // второго ряда «1.2.1», и цепочка размеров давала 4000 мм вместо 3000.
    const svg = render(WallScheme, {
      walls: [wall({ numPanels: 3 })],
      doors: [], panels: [
        { wallName: 'Стена 1', panelLabel: '1.1.1', width: 2002, height: 1344 },
        { wallName: 'Стена 1', panelLabel: '1.1.3', width: 999, height: 1344 },
        { wallName: 'Стена 1', panelLabel: '1.2.1', width: 999, height: 1344 },
        { wallName: 'Стена 1', panelLabel: '1.2.2', width: 999, height: 1344 },
        { wallName: 'Стена 1', panelLabel: '1.2.3', width: 999, height: 1344 },
      ],
      itemOrder: [{ type: 'wall', id: 'w1' }],
    })
    clean(svg)
    expect(svg).toMatch(/>1\.1\.1</)
    expect(svg).toMatch(/>1\.1\.3</)
    expect(svg).not.toMatch(/>1\.2\./)
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

  it('панель над проёмом висит от потолка, а не торчит выше него', () => {
    // panelH = ceilingH − openingH + заход в узел H (51,5) = 651,5 при просвете
    // 600 мм. Если откладывать высоту вверх от верха проёма, панель вылезает
    // на 51,5 мм выше потолка и выше соседней стеновой панели.
    const door = {
      kind: 'door' as const, id: 'd1', label: 'Проём', copies: 1,
      openingW: 900, openingH: 2100, ceilingH: 2700,
      panelH: 651.5, panelW: 782.5, panelDrawLabel: 'А1', doorLabel: 'Д1',
      leftNode: 'B', rightNode: 'B', topEdge: '', bottomEdge: 'H',
      opensOut: false, hingeLeft: true, trim: null,
    }
    const svg = render(WallElevation, { items: [elevWall, door] })
    clean(svg)
    // Зелёная панель (fill #dcfce7) начинается ровно на отметке потолка —
    // на самом верху поля чертежа (PAD_T = 46), не выше.
    const panel = /<rect[^>]*\sy="([\d.]+)"[^>]*fill="#dcfce7"/.exec(svg)
    expect(panel).not.toBeNull()
    expect(+panel![1]).toBe(46)
  })

  it('разрезы рисуются по всем участкам, а не только по проёмам', () => {
    // Заказ из одних стен: раньше DoorSections возвращал null и кнопка
    // «Разрез» молча ничего не показывала.
    const svg = render(WallElevation, { items: [elevWall], sections: true })
    clean(svg)
    expect(svg).toContain('Разрез Стена 1')
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

describe('Drawing — чертёж раскладки', () => {
  const elevWall = {
    kind: 'wall' as const, id: 'w1', name: 'П50 · Стена 1', copies: 1,
    wallLength: 3000, wallHeight: 2700, gapTop: 7, gapBottom: 5,
    lengthByNodes: 2962, widths: [987, 987, 988],
    colRows: [[2100, 588], [2100, 588], [2100, 588]],
    cells: [0, 1, 2].flatMap(col => [0, 1].map(row => ({
      col, row, span: 1, rowSpan: 1, width: 987, height: row === 0 ? 2100 : 588,
      label: `1.${row + 1}.${col + 1}`, drawLabel: `п.${col * 2 + row + 1}`,
    }))),
    leftNode: 'A', rightNode: 'D', connType: 'C', topEdge: 'A', bottomEdge: 'A', rowConn: 'S',
  }
  const elevDoor = {
    kind: 'door' as const, id: 'd1', label: 'Д1', copies: 1,
    openingW: 900, openingH: 2100, ceilingH: 2700,
    panelH: 651.5, panelW: 782.5, panelLabel: 'Д1', panelDrawLabel: 'А4', doorLabel: 'Д-64808',
    leftNode: 'B', rightNode: 'B', topEdge: 'A', bottomEdge: 'H',
    opensOut: false, hingeLeft: true,
    trim: { label: 'Д1', drawLabels: ['А5', 'А6', 'А7'],
      top: { w: 900, h: 200, leftNode: 'A', rightNode: 'A' },
      left: { w: 200, h: 2100, wallNode: 'A' }, right: { w: 200, h: 2100, wallNode: 'A' } },
  }
  const draw = (view: string, extra = {}) =>
    render(Drawing, { items: [elevWall, elevDoor], view, ...extra })

  it('каждый вид рисуется без NaN', () => {
    for (const v of ['elevation', 'plan', 'section', 'trims', 'nodes']) clean(draw(v))
  })

  it('вид «Всё» собирает развёртку, план, разрезы, доборы и узлы', () => {
    const svg = draw('all', { jointTypes: [{ code: 'C', offset_mm: -4, name: 'Профиль', image_url: null }] })
    for (const t of ['Развёртка', 'План —', 'Разрезы участков', 'Доборы проёмов', 'Узлы, применённые'])
      expect(svg).toContain(t)
    // Рамки и основной надписи ГОСТ на чертеже быть не должно.
    expect(svg).not.toContain('Формат')
    expect(svg).not.toContain('Копировал')
  })

  it('переключатель показывает только выбранный вид', () => {
    const svg = draw('plan')
    expect(svg).toContain('План —')
    expect(svg).not.toContain('Разрезы участков')
  })

  it('на шве печатается зазор, на кромке и в углу — только буква', () => {
    // В каталоге зазор хранится ОТРИЦАТЕЛЬНОЙ поправкой: «зазор 4 мм» → −4.
    // Положительная поправка (угловой D = 19,4) — заход в профиль, не щель.
    const svg = render(Drawing, {
      items: [elevWall], view: 'elevation',
      jointTypes: [{ code: 'C', offset_mm: -4 }, { code: 'D', offset_mm: 19.4 },
        { code: 'A', offset_mm: -15 }, { code: 'S', offset_mm: 0 }],
    })
    expect(svg).toContain('C 4')
    expect(svg).not.toMatch(/D 19/)
    expect(svg).not.toMatch(/A 15/)
  })

  it('отделка и примечания собираются из заказа', () => {
    const it = { ...elevWall, spec: {
      finishGroup: 'ШПОН 1,5 ММ', finishName: 'Breeze Oak', veneerDirection: 'вертикально',
      aluminumVertical: 2, aluminumHorizontal: 1, aluminumColor: 'Чёрный матовый',
      wallFacing: 'back' as const, notes: 'фрезеровка по эскизу',
    } }
    expect(finishLine(it as never)).toBe('ШПОН 1,5 ММ · Breeze Oak · вертикально')
    expect(noteLines(it as never)).toEqual([
      'Декор алюм. П 6×6: верт. 2, гор. 1 — Чёрный матовый',
      'Сторона монтажа: тыльная',
      'фрезеровка по эскизу',
    ])
  })

  it('лист узлов собирает все применённые коды', () => {
    expect(usedNodeCodes([elevWall, elevDoor] as never))
      .toEqual(['A', 'D', 'C', 'S', 'B', 'H'])
  })

  it('угловой узел D разворачивает план на 90°', () => {
    const segs = planRun([elevWall, { ...elevDoor, id: 'd2' }] as never)
    expect(segs).toHaveLength(2)
    expect(Math.round(segs[0].ux)).toBe(1)
    expect(Math.round(segs[1].uy)).toBe(-1)
  })

  it('переживает битые данные старого заказа', () => {
    const bad = {
      ...elevWall, wallHeight: undefined as unknown as number,
      lengthByNodes: undefined as unknown as number,
      colRows: [[]], widths: [0], cells: [],
    }
    clean(render(Drawing, {
      items: [bad, { ...elevDoor, panelH: null, panelW: null, ceilingH: 0, trim: null }],
      view: 'all',
    }))
  })
})
