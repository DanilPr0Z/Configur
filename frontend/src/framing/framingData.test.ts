// Расчёт обрамления проёма. Эталон формул — News/cascate_calculator.html,
// контрольные заказы подтверждены производством (см. задание от 09.09.2026).

import { describe, it, expect } from 'vitest'
import { buildCatalog, computeSpec, getDepth, defaultState } from './framingData'
import type { FramingConfig, FramingModel, FramingState } from './framingData'

const model = (over: Partial<FramingModel>): FramingModel => ({
  name: 'X', subtitle: '', nH: 0, nL: 0, dH: 0, dL: 0,
  depth_mode: 'fixed', depth_delta: 0, profile_count: 0, has_glass: false,
  price_category: 'default', has_veneer: false, veneer_surcharge: 800,
  has_shadow: false, shadow_nH: 2, shadow_nL: 4, shadow_price_per_m: 1200,
  ...over,
})

const CONFIG: FramingConfig = {
  models: [
    model({ name: 'PASSO', nH: 110, nL: 220, dH: -17, dL: -15, price_category: 'passo' }),
    model({ name: 'Luna', nH: 45, nL: 90, dH: -22, dL: -25, depth_mode: 'luna' }),
    model({ name: 'Dune', nH: 105, nL: 210, dH: -22, dL: -25, depth_mode: 'cas' }),
  ],
  colors: [{ name: 'Chrome Matt 1K' }],
  profile_prices: { mini: 865, passo: 2760, triangle: 1090, default: 2760 },
  dobor_groups: [{ name: 'ШПОН', is_dobor: true, is_glass: false, glass_price_per_m: 360 }],
  dobors: [{ group: 'ШПОН', name: 'Faggio', price: 10713 }],
}

const CAT = buildCatalog(CONFIG)
const state = (over: Partial<FramingState> = {}): FramingState => ({ ...defaultState(), ...over })

describe('getDepth — глубина добора', () => {
  it('luna: +10 при установке с двух сторон, +5 при одной', () => {
    expect(getDepth(CAT.models[1], 200, 'с двух сторон')).toBe(210)
    expect(getDepth(CAT.models[1], 200, 'с одной стороны')).toBe(205)
  })
  it('cas: равна глубине стены', () => {
    expect(getDepth(CAT.models[2], 200, 'с двух сторон')).toBe(200)
  })
  it('fixed: глубина стены плюс дельта модели', () => {
    expect(getDepth(CAT.models[0], 200, 'с двух сторон')).toBe(200)
  })
})

describe('computeSpec — контрольный заказ PASSO', () => {
  // Подтверждён производством: 2695 x 1018 x 200, с двух сторон,
  // Chrome Matt 1K (2760 ₽/м), добор Faggio (10713 ₽/м²) → 51 426 ₽
  const res = computeSpec(state({ mi: 0, H: 2695, L: 1018, C: 200 }), CAT)

  it('даёт размеры деталей из задания', () => {
    expect(res.rows.map(r => r.dm)).toEqual([
      '2805 мм', '1238 мм', '2678×200 мм', '1003×200 мм',
    ])
  })

  it('даёт количества 4 / 2 / 2 / 1', () => {
    expect(res.rows.map(r => r.qt)).toEqual([4, 2, 2, 1])
  })

  it('даёт итог 51 426 ₽', () => {
    expect(Math.round(res.total)).toBe(51426)
  })
})

describe('computeSpec — комплектация и надбавки', () => {
  it('«только наличник» убирает доборы, «только добор» — наличники', () => {
    const nal = computeSpec(state({ mi: 1, kit: 'nal' }), CAT)
    const dob = computeSpec(state({ mi: 1, kit: 'dob' }), CAT)
    expect(nal.rows.every(r => !r.nm.startsWith('Добор'))).toBe(true)
    expect(dob.rows.every(r => !r.nm.startsWith('Наличник'))).toBe(true)
  })

  it('установка с одной стороны — вдвое меньше наличников', () => {
    const two = computeSpec(state({ mi: 1 }), CAT)
    const one = computeSpec(state({ mi: 1, inst: 'с одной стороны' }), CAT)
    expect(one.rows[0].qt).toBe(2)
    expect(two.rows[0].qt).toBe(4)
    // добор всегда 2 вертикальных и 1 горизонтальный
    expect(one.rows.find(r => r.nm.startsWith('Добор вертикальный'))?.qt).toBe(2)
  })

  it('глубокий добор (>500 мм) даёт надбавку 15 % от стоимости добора', () => {
    const deep = computeSpec(state({ mi: 1, C: 600 }), CAT)
    const sur = deep.rows.find(r => r.cl === 'sur')
    expect(sur).toBeDefined()
    const dobor = deep.rows
      .filter(r => r.nm.startsWith('Добор'))
      .reduce((s, r) => s + r.pr, 0)
    expect(sur!.pr).toBe(Math.round(dobor * 0.15))
    // на мелком проёме надбавки нет
    expect(computeSpec(state({ mi: 1, C: 200 }), CAT).rows.some(r => r.cl === 'sur')).toBe(false)
  })

  it('добор подписывается группой и отделкой', () => {
    const res = computeSpec(state({ mi: 1 }), CAT)
    expect(res.rows.find(r => r.nm.startsWith('Добор вертикальный'))?.nm)
      .toContain('ШПОН · Faggio')
  })

  it('предупреждает о выходе за габарит листа', () => {
    expect(computeSpec(state({ mi: 1, C: 800 }), CAT).warn).toBeTruthy()
    expect(computeSpec(state({ mi: 1 }), CAT).warn).toBeNull()
  })
})
