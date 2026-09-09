// Геометрия стеновых панелей: раскладка, ряды по столбцам, объединения.
// Цифры сверены с расчётом Excel «Ввод данных к заказу» и чертежами СП.

import { describe, it, expect } from 'vitest'
import { calcWall, buildSpec, makeWall, makeDoor, offsetsOf } from './Configurator'
import type { WallSeg } from './Configurator'
import type { JointType } from '../api'

// Узлы серии 60 из справочника — только те, что нужны расчёту.
const JOINTS = [
  { code: 'A', offset_mm: -15 }, { code: 'B', offset_mm: 0 },
  { code: 'C', offset_mm: -4 }, { code: 'R', offset_mm: -6 },
  { code: 'S', offset_mm: 0 }, { code: 'P', offset_mm: 0 },
  { code: 'G', offset_mm: 50.1 }, { code: 'H', offset_mm: 58.5 },
].map((j, i) => ({
  id: i + 1, name: j.code, price_per_meter: 0, profile_article: '',
  profile_count: 0, image_url: null, ...j,
})) as JointType[]

const OFF = offsetsOf(JOINTS)

function wall(over: Partial<WallSeg> = {}): WallSeg {
  return { ...makeWall(1), wallHeight: 2700, wallLength: 3000, numPanels: 3, ...over }
}

describe('calcWall — базовая раскладка', () => {
  it('делит длину по узлам поровну и вычитает зазоры из высоты', () => {
    const c = calcWall(wall(), OFF)
    // 3000 − 15 − 15 (два торцевых A) − 2×4 (два стыка C) = 2962
    expect(c.wallLengthByPanels).toBe(2962)
    expect(c.widths).toEqual([987.5, 987.5, 987.5])
    // 2700 − 7 − 5 (зазоры сверху/снизу)
    expect(c.panelHeight).toBe(2688)
    expect(c.cells).toHaveLength(3)
  })

  it('делит стену на ряды по высоте', () => {
    const c = calcWall(wall({ numRows: 2 }), OFF)
    expect(c.rowHeights).toEqual([1344, 1344])
    expect(c.cells).toHaveLength(6)
  })

  it('берёт ручные ширины как есть, без поправок узлов', () => {
    const c = calcWall(wall({ widthMode: 'manual', panelWidths: [903, 979, 978] }), OFF)
    expect(c.widths).toEqual([903, 979, 978])
    expect(c.widthsSum).toBe(2860)
  })
})

describe('calcWall — своя разбивка столбца по рядам', () => {
  it('режет столбец собственными рядами, остальные — общими', () => {
    const c = calcWall(wall({
      numRows: 2,
      colRowHeights: [[], [], [348, 1170, 1170]],
    }), OFF)
    expect(c.colRows[0]).toEqual([1344, 1344])
    expect(c.colRows[2]).toEqual([348, 1170, 1170])
    expect(c.cells).toHaveLength(2 + 2 + 3)
  })
})

describe('calcWall — объединение панелей', () => {
  it('по ширине: складывает ширины и возвращает съеденный стыком зазор', () => {
    const c = calcWall(wall({ merges: [{ row: 0, col: 0, span: 2 }] }), OFF)
    expect(c.cells).toHaveLength(2)
    // 987.5 + 987.5 + 4 (убранный стык C)
    expect(c.cells[0]).toMatchObject({ col: 0, span: 2, rowSpan: 1, width: 1979 })
    expect(c.cells[1]).toMatchObject({ col: 2, span: 1, width: 987.5 })
  })

  it('по ширине: у ламели B шва нет, ширина — просто сумма', () => {
    const c = calcWall(wall({ connType: 'B', merges: [{ row: 0, col: 0, span: 2 }] }), OFF)
    expect(c.cells[0].width).toBe(c.widths[0] + c.widths[1])
  })

  it('по высоте: складывает ряды столбца', () => {
    const c = calcWall(wall({ numRows: 2, merges: [{ row: 0, col: 1, span: 1, rowSpan: 2 }] }), OFF)
    const merged = c.cells.find(x => x.col === 1 && x.row === 0)!
    expect(merged.rowSpan).toBe(2)
    expect(merged.height).toBe(2688)          // стык рядов S зазора не даёт
    expect(c.cells).toHaveLength(5)           // 6 панелей минус одна поглощённая
  })

  it('игнорирует объединение, если ряды столбцов лежат по-разному', () => {
    const c = calcWall(wall({
      numRows: 2,
      colRowHeights: [[], [], [348, 1170, 1170]],
      merges: [{ row: 0, col: 1, span: 2 }],   // столбцы 1 и 2 режутся по-разному
    }), OFF)
    expect(c.cells.every(x => x.span === 1)).toBe(true)
  })

  it('игнорирует объединение за пределами стены', () => {
    const c = calcWall(wall({ merges: [{ row: 0, col: 2, span: 2 }] }), OFF)
    expect(c.cells).toHaveLength(3)
  })
})

describe('buildSpec — панели и профили', () => {
  const spec = (w: WallSeg) => buildSpec([w], [], OFF,
    { hG: 43, hH: 51.5, wOutB: 100.5, wOutC: 108.5, wInB: 117.5, wInC: 125.5 })

  it('кромки крайних панелей — торцевые, внутренних — соединительные', () => {
    const { panels } = spec(wall())
    expect(panels.map(p => [p.leftNode, p.rightNode])).toEqual([
      ['A', 'C'], ['C', 'C'], ['C', 'A'],
    ])
  })

  it('объединение убирает панель и внутренний шов из профилей', () => {
    const plain = spec(wall())
    const merged = spec(wall({ merges: [{ row: 0, col: 0, span: 2 }] }))
    expect(merged.panels).toHaveLength(plain.panels.length - 1)
    const conn = (r: ReturnType<typeof spec>) =>
      r.profiles.find(p => p.article === '104.259')?.quantity ?? 0
    expect(conn(merged)).toBeLessThan(conn(plain))
  })

  it('у объединения по высоте нижняя кромка берётся от нижнего ряда', () => {
    const { panels } = spec(wall({
      numRows: 2, topEdge: 'A', bottomEdge: 'A',
      merges: [{ row: 0, col: 0, span: 1, rowSpan: 2 }],
    }))
    const tall = panels.find(p => p.height === 2688)!
    expect(tall.topEdge).toBe('A')
    expect(tall.bottomEdge).toBe('A')
  })
})

describe('buildSpec — панель над дверным проёмом', () => {
  it('считает размер по формулам листа «Ввод данных к заказу»', () => {
    const door = { ...makeDoor(1), openingW: 900, openingH: 2100, ceilingH: 2700 }
    const { panels } = buildSpec([], [door], OFF,
      { hG: 43, hH: 51.5, wOutB: 100.5, wOutC: 108.5, wInB: 117.5, wInC: 125.5 })
    // ВНУТРЬ + ламель B: высота 2700 − 2100 + 51.5, ширина 900 − 117.5
    expect(panels[0]).toMatchObject({ height: 651.5, width: 782.5 })
  })
})
