import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchAluminumProfiles, fetchProfileColors, fetchJointTypes, fetchFinishGroups, fetchOrder, createOrder, updateOrder, createPanel, deletePanel } from '../api'
import type { AluminumProfile, ProfileColor, JointType, FinishGroup, Finish, Order } from '../api'
import { JointSelectCode, StringSelect } from '../components/JointSelect'
import WallScheme from '../components/WallScheme'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnType = 'B' | 'C'

interface WallSeg {
  id: string
  name: string
  wallHeight: number
  wallLength: number
  leftNode: string
  rightNode: string
  topEdge: string
  bottomEdge: string
  numPanels: number
  connType: ConnType
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  copies: number
  aluminumVertical: number
  aluminumHorizontal: number
  aluminumColor: string
  markup: number
  notes: string
}

interface DoorSeg {
  id: string
  label: string
  doorRef: string
  openingW: number
  openingH: number
  ceilingH: number
  mountType: 'В ПОТОЛОК' | 'В ПРОЕМ'
  openingDir: 'ВНУТРЬ' | 'НАРУЖУ'
  hingeDir: 'СЛЕВА' | 'СПРАВА'
  leftNode: string
  rightNode: string
  topEdge: string
  bottomEdge: string
  // Добор обрамления
  wallDepth: number
  trimLeftNode: string
  trimLeftW: number    // ширина левого добора (= wallDepth по умолч.)
  trimLeftH: number    // высота/длина левого добора (= openingH по умолч.)
  trimRightNode: string
  trimRightW: number   // ширина правого добора
  trimRightH: number   // высота/длина правого добора
  trimTopLeftNode: string  // узел левой стороны верхнего добора
  trimTopRightNode: string // узел правой стороны верхнего добора
  trimTopW: number     // ширина верхнего добора (= openingW по умолч.)
  trimTopH: number     // высота верхнего добора (= wallDepth по умолч.)
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  copies: number
  notes: string
}

interface PanelSpec {
  panelLabel: string
  wallName: string
  height: number
  width: number
  leftNode: string
  rightNode: string
  topEdge: string
  bottomEdge: string
  quantity: number
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  aluminumVertical: number
  aluminumHorizontal: number
  aluminumColor: string
  markup: number
  notes: string
}

interface ProfileSpec {
  article: string
  name: string
  length: number
  quantity: number
  note: string
  price_per_piece: number
  total_cost: number
}

// ─── Static node data (для расчётов смещений) ─────────────────────────────────

interface NodeDef {
  code: string
  label: string
  offset: number
  heightOffset?: number  // смещение высоты панели (для верхней/нижней кромки)
  article: string | null
  ppe: number
}

const NODES: NodeDef[] = [
  { code: 'A',  label: 'A — Торцевой (финиш)',   offset: -15,   article: '104.256', ppe: 1   },
  { code: 'B',  label: 'B — Ламель',              offset: 0,     article: 'lamelle', ppe: 0.5 },
  { code: 'C',  label: 'C — Соединительный',      offset: -4,    article: '104.259', ppe: 0.5 },
  { code: 'D',  label: 'D — Угол нар. 90°',       offset: 19.4,  article: '104.270', ppe: 0.5 },
  { code: 'DG', label: 'DG — Угол вн. G',         offset: 51.9,  article: '104.270', ppe: 0.5 },
  { code: 'DH', label: 'DH — Угол вн. H',         offset: 43.5,  article: '104.270', ppe: 0.5 },
  { code: 'E',  label: 'E — Торцевой (+26 мм)',   offset: 26,    article: null,      ppe: 0   },
  { code: 'FL', label: 'FL — Финишный лев.',       offset: -15,   article: null,      ppe: 0   },
  { code: 'FR', label: 'FR — Финишный пр.',        offset: -26,   article: null,      ppe: 0   },
  { code: 'G',  label: 'G — Тип G',               offset: 43,    article: null,      ppe: 0   },
  { code: 'H',  label: 'H — Тип H',               offset: 51.5,  article: null,      ppe: 0   },
  { code: 'O',  label: 'O — Без профиля',          offset: -27.1, article: null,      ppe: 0   },
  { code: 'P',  label: 'P — Декор',               offset: 0,     article: null,      ppe: 0   },
  { code: 'R',  label: 'R — Подрез',              offset: -6,    article: null,      ppe: 0   },
  { code: 'S',  label: 'S — Стык',                offset: 0,     article: null,      ppe: 0   },
  { code: 'T',  label: 'T — Тип T',               offset: 0,     article: null,      ppe: 0   },
  { code: 'I',  label: 'I — Тип I',               offset: -1.2,  article: null,      ppe: 0   },
  // Теневой профиль: уменьшает высоту панели на 12 мм при установке сверху или снизу
  { code: 'TC', label: 'C — Теневой профиль',      offset: 0,     heightOffset: -12,  article: null, ppe: 0 },
]

const NODE_MAP = new Map<string, NodeDef>(NODES.map(n => [n.code, n]))
const EDGE_NODE_CODES = ['A', 'D', 'DG', 'DH', 'E', 'FL', 'FR', 'G', 'H', 'O', 'P', 'R', 'S', 'T', 'I']
const EDGE_TOPBOT_CODES = [...EDGE_NODE_CODES, 'TC']  // + теневой профиль для верх/низ
const CONN_NODE_CODES = ['B', 'C']
const VENEER_DIRECTIONS = ['Вертикальное', 'Горизонтальное']

const DECORS_SHPON_15: string[] = [
  'American walnut 1,5 мм','Walnut Flamed 1,5 мм','Walnut Striped 1,5 мм',
  'Vienna Oak Flamed 1,5 мм','Breeze Oak 1,5 мм','Dark Gray Oak 1,5 мм',
  'Oak moka 1,5 мм','Oak thermo 1,5 мм','Noce Canaletto 1,5 мм','Noce Ondulato 1,5 мм',
  'Rovere Chiaro 1,5 мм','Rovere Fume 1,5 мм','Makassar 1,5 мм','Chok Ebano 1,5 мм','Teak 1,5 мм',
]
const DECORS_SHPON_25: string[] = [
  'American walnut 2,5 мм','Walnut Flamed 2,5 мм','Walnut Striped 2,5 мм',
  'Vienna Oak Flamed 2,5 мм','Breeze Oak 2,5 мм','Dark Gray Oak 2,5 мм',
  'Oak moka 2,5 мм','Oak thermo 2,5 мм','Noce Canaletto 2,5 мм','Noce Ondulato 2,5 мм',
  'Rovere Chiaro 2,5 мм','Rovere Fume 2,5 мм','Makassar 2,5 мм','Chok Ebano 2,5 мм',
  'Teak 2,5 мм','Dark Gey Lati 2,5 мм','Fondo',
]
const DECORS_SHPON_5: string[] = [
  'American walnut 5 мм','Walnut Flamed 5 мм','Walnut Striped 5 мм',
  'Vienna Oak Flamed 5 мм','Breeze Oak 5 мм','Dark Grey Oak 5 мм',
  'Oak moka 5 мм','Oak thermo 5 мм','Noce Canaletto 5 мм','Noce Ondulato 5 мм',
  'Rovere Chiaro 5 мм','Rovere Fume 5 мм','Makassar 5 мм','Chok Ebano 5 мм',
  'Teak 5 мм','Dark Gey Lati 5 мм',
]
const DECORS_LACATO: string[] = [
  'Nero 2,5 mm','Bianco 2,5 mm','Bianco Night 2,5 mm','Grigio 2,5 mm',
  'Grigio Chiaro 2,5 mm','Cioccolato 2,5 mm','Cappuccino 2,5 mm','Avorio 2,5 mm',
  'Rose 2,5 mm','Rocca 2,5 mm','Sabbia 2,5 mm','Viola 2,5 mm','Grigio Seta 2,5 mm',
  'Silver 2,5 mm','Ombra 2,5 mm','Grigio Fume 2,5 mm','Grafite 2,5 mm',
  'Pesco 2,5 mm','Tortora 2,5 mm','Corda 2,5 mm','Bruno 2,5 mm','RAL 2,5 mm',
]
const DECORS_KOZHA: string[] = [
  'Pele Grigio','Pele Fumoso','Pele Marone','Pele Salar','Pele Black',
  '3299 (PELLE)','3153 (PELLE)','3156 (PELLE)','3240 (PELLE)',
]
const DECORS_WOOD: string[] = ['4691 (WOOD)','4653 (WOOD)','4583 (WOOD)']

// Извлекает базовое имя декора без суффикса толщины ("Breeze Oak 1,5 мм" → "Breeze Oak")
function getDecorBaseName(decor: string): string {
  return decor.replace(/ (?:1[,.]5|2[,.]5|5) (?:мм|mm)$/i, '').trim()
}

// Возвращает варианты декора для КОНКРЕТНОЙ отделки (не для группы)
function getDecorOptions(finishName: string, groupName: string): { group: string; items: string[] }[] {
  const g = groupName.toUpperCase()

  if (g.startsWith('ШПО')) {
    const byThickness = [
      { group: 'ШПОН 1,5 мм', src: DECORS_SHPON_15 },
      { group: 'ШПОН 2,5 мм', src: DECORS_SHPON_25 },
      { group: 'ШПОН 5 мм',   src: DECORS_SHPON_5  },
    ]
    // Конкретная отделка выбрана — фильтруем только её декоры
    if (finishName) {
      const result: { group: string; items: string[] }[] = []
      for (const { group, src } of byThickness) {
        const items = src.filter(d => getDecorBaseName(d) === finishName)
        if (items.length > 0) result.push({ group, items })
      }
      return result
    }
    // Отделка не выбрана — показываем все декоры конкретной толщины или все
    if (g === 'ШПОН 1,5 ММ') return [{ group: 'ШПОН 1,5 мм', items: DECORS_SHPON_15 }]
    if (g === 'ШПОН 2,5 ММ' || g === 'ШПОН 2.5ММ') return [{ group: 'ШПОН 2,5 мм', items: DECORS_SHPON_25 }]
    if (g === 'ШПОН 5 ММ'   || g === 'ШПОН 5ММ')   return [{ group: 'ШПОН 5 мм',   items: DECORS_SHPON_5  }]
    return []
  }

  if (g === 'LACATO' || g === 'LACATO 2,5 ММ') {
    if (finishName) {
      const items = DECORS_LACATO.filter(d => getDecorBaseName(d) === finishName)
      if (items.length > 0) return [{ group: 'LACATO 2,5 мм', items }]
    }
    return [{ group: 'LACATO 2,5 мм', items: DECORS_LACATO }]
  }

  if (g === 'КОЖА') return [{ group: 'КОЖА (Pele)', items: DECORS_KOZHA }]
  if (g === 'WOOD')  return [{ group: 'WOOD',         items: DECORS_WOOD  }]
  return []
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _seq = 0
const uid = () => `id${++_seq}`

// ─── Factories ────────────────────────────────────────────────────────────────

function makeWall(n: number): WallSeg {
  return {
    id: uid(), name: `Стена ${n}`,
    wallHeight: 2700, wallLength: 3000,
    leftNode: 'A', rightNode: 'A',
    topEdge: '', bottomEdge: '',
    numPanels: 3, connType: 'C',
    finishGroup: '', finishName: '',
    veneerDirection: '', decor3d: '',
    copies: 1,
    aluminumVertical: 0, aluminumHorizontal: 0, aluminumColor: '',
    markup: 0, notes: '',
  }
}

function makeDoor(n: number): DoorSeg {
  return {
    id: uid(), label: `Дверной проём ${n}`,
    doorRef: '', openingW: 900, openingH: 2100, ceilingH: 2700,
    mountType: 'В ПРОЕМ', openingDir: 'ВНУТРЬ', hingeDir: 'СЛЕВА',
    leftNode: 'A', rightNode: 'A',
    topEdge: '', bottomEdge: '',
    wallDepth: 200, trimLeftNode: 'A', trimLeftW: 200, trimLeftH: 2100,
    trimRightNode: 'A', trimRightW: 200, trimRightH: 2100,
    trimTopLeftNode: 'A', trimTopRightNode: 'A', trimTopW: 900, trimTopH: 200,
    finishGroup: '', finishName: '',
    veneerDirection: '', decor3d: '',
    copies: 1, notes: '',
  }
}

// ─── State persistence (localStorage) ─────────────────────────────────────────

interface SavedConfigState {
  walls: WallSeg[]
  doors: DoorSeg[]
  itemOrder: { type: 'wall' | 'door'; id: string }[]
  wallSeq: number
  doorSeq: number
}

const _SAVED_CONFIG: SavedConfigState | null = (() => {
  try {
    const raw = localStorage.getItem('nuovo60_config')
    if (!raw) return null
    const data = JSON.parse(raw) as SavedConfigState
    if (!Array.isArray(data.walls) || !Array.isArray(data.doors)) return null
    // Синхронизируем счётчик ID, чтобы новые ID не коллидировали с восстановленными
    for (const item of [...(data.walls ?? []), ...(data.doors ?? [])]) {
      const n = parseInt((item.id ?? '').replace('id', ''))
      if (!isNaN(n) && n > _seq) _seq = n
    }
    return data
  } catch {
    return null
  }
})()

function getInitialConfig() {
  if (_SAVED_CONFIG?.walls?.length) {
    const io: { type: 'wall' | 'door'; id: string }[] =
      _SAVED_CONFIG.itemOrder?.length
        ? _SAVED_CONFIG.itemOrder
        : [
            ..._SAVED_CONFIG.walls.map(w => ({ type: 'wall' as const, id: w.id })),
            ..._SAVED_CONFIG.doors.map(d => ({ type: 'door' as const, id: d.id })),
          ]
    // Мигрируем старые DoorSeg без новых полей добора
    const doors = _SAVED_CONFIG.doors.map(d => ({
      wallDepth: 200,
      trimLeftNode: 'A', trimLeftW: (d as any).wallDepth ?? 200, trimLeftH: (d as any).openingH ?? 2100,
      trimRightNode: 'A', trimRightW: (d as any).wallDepth ?? 200, trimRightH: (d as any).openingH ?? 2100,
      trimTopLeftNode: 'A', trimTopRightNode: 'A',
      trimTopW: (d as any).openingW ?? 900, trimTopH: (d as any).wallDepth ?? 200,
      ...d,
    }))
    return {
      walls: _SAVED_CONFIG.walls,
      doors,
      itemOrder: io,
      wallSeq: _SAVED_CONFIG.wallSeq ?? _SAVED_CONFIG.walls.length,
      doorSeq: _SAVED_CONFIG.doorSeq ?? _SAVED_CONFIG.doors.length,
    }
  }
  const w = makeWall(1)
  return {
    walls: [w],
    doors: [] as DoorSeg[],
    itemOrder: [{ type: 'wall' as const, id: w.id }],
    wallSeq: 1,
    doorSeq: 0,
  }
}

const _INIT = getInitialConfig()

// ─── Calculations ─────────────────────────────────────────────────────────────

function calcWall(w: WallSeg) {
  if (!w.wallHeight || !w.wallLength || !w.numPanels || w.numPanels < 1)
    return { wallLengthByPanels: 0, panelHeight: 0, panelWidth: 0, valid: false }
  const lOff = NODE_MAP.get(w.leftNode)?.offset ?? 0
  const rOff = NODE_MAP.get(w.rightNode)?.offset ?? 0
  const connAdj = w.connType === 'C' ? (w.numPanels - 1) * 4 : 0
  const wlbp = w.wallLength + lOff + rOff - connAdj
  const topOff = NODE_MAP.get(w.topEdge)?.heightOffset ?? 0
  const botOff = NODE_MAP.get(w.bottomEdge)?.heightOffset ?? 0
  const ph = w.wallHeight + topOff + botOff
  const pw = Math.round((wlbp / w.numPanels) * 10) / 10
  return { wallLengthByPanels: Math.round(wlbp * 10) / 10, panelHeight: ph, panelWidth: pw, valid: true }
}

function suggestPanels(w: WallSeg, maxW = 1200): number {
  const lOff = NODE_MAP.get(w.leftNode)?.offset ?? 0
  const rOff = NODE_MAP.get(w.rightNode)?.offset ?? 0
  const est = w.wallLength + lOff + rOff
  let n = Math.max(1, Math.ceil(est / maxW))
  if (w.connType === 'C') {
    const refined = est - (n - 1) * 4
    n = Math.max(1, Math.ceil(refined / maxW))
  }
  return n
}

function buildSpec(
  walls: WallSeg[],
  doors: DoorSeg[],
  priceMap: Record<string, number> = {},
): { panels: PanelSpec[]; profiles: ProfileSpec[] } {
  const panels: PanelSpec[] = []
  const pc: Record<string, number> = {
    '104.256': 0, '104.259': 0, '104.270': 0,
    'lamelle': 0, 'lamelle_G': 0, 'lamelle_H': 0, 'hanger': 0, 'al_decor': 0,
  }
  let totalPanels = 0

  function addEdge(code: string, mult: number) {
    const info = NODE_MAP.get(code)
    if (!info || info.ppe === 0 || info.article === null) return
    const key = info.article
    if (key in pc) pc[key] += info.ppe * mult
  }

  walls.forEach((w, wi) => {
    const c = calcWall(w)
    if (!c.valid) return
    const copies = Math.max(1, w.copies)
    const N = w.numPanels
    totalPanels += N * copies
    for (let i = 0; i < N; i++) {
      panels.push({
        panelLabel: `${wi + 1}.${i + 1}`,
        wallName: w.name,
        height: c.panelHeight,
        width: c.panelWidth,
        leftNode:  i === 0     ? w.leftNode  : w.connType,
        rightNode: i === N - 1 ? w.rightNode : w.connType,
        topEdge: w.topEdge,
        bottomEdge: w.bottomEdge,
        quantity: copies,
        finishGroup: w.finishGroup,
        finishName: w.finishName,
        veneerDirection: w.veneerDirection,
        decor3d: w.decor3d,
        aluminumVertical: w.aluminumVertical,
        aluminumHorizontal: w.aluminumHorizontal,
        aluminumColor: w.aluminumColor,
        markup: w.markup,
        notes: w.notes,
      })
    }
    addEdge(w.leftNode, copies)
    addEdge(w.rightNode, copies)
    if (N > 1) addEdge(w.connType, 2 * (N - 1) * copies)
    if (w.aluminumVertical > 0 || w.aluminumHorizontal > 0) {
      const alV = Math.ceil(c.panelHeight / 2995) * w.aluminumVertical
      const alH = Math.ceil(c.panelWidth / 2995) * w.aluminumHorizontal
      pc['al_decor'] += (alV + alH) * N * copies
    }
  })

  doors.forEach((d, di) => {
    const copies = Math.max(1, d.copies)
    const doorLabel = `Д${di + 1}`
    const doorName = d.label + (d.doorRef ? ` (${d.doorRef})` : '')
    const trimBase = {
      topEdge: '', bottomEdge: '',
      quantity: copies,
      finishGroup: d.finishGroup, finishName: d.finishName,
      veneerDirection: d.veneerDirection, decor3d: d.decor3d,
      aluminumVertical: 0, aluminumHorizontal: 0, aluminumColor: '',
      markup: 0, notes: '',
    }

    // Панель НАД проёмом (только В ПРОЕМ)
    if (d.mountType !== 'В ПОТОЛОК') {
      const dtype = d.openingDir === 'НАРУЖУ' ? 'G' : 'H'
      const ph = Math.round((d.ceilingH - d.openingH + (dtype === 'G' ? 43 : 51.5)) * 10) / 10
      panels.push({
        panelLabel: doorLabel,
        wallName: doorName,
        height: ph, width: d.openingW,
        leftNode: d.leftNode, rightNode: d.rightNode,
        topEdge: d.topEdge, bottomEdge: d.bottomEdge,
        quantity: copies,
        finishGroup: d.finishGroup, finishName: d.finishName,
        veneerDirection: d.veneerDirection, decor3d: d.decor3d,
        aluminumVertical: 0, aluminumHorizontal: 0, aluminumColor: '',
        markup: 0, notes: d.notes,
      })
      totalPanels += copies
      addEdge(d.leftNode, copies)
      addEdge(d.rightNode, copies)
      if (dtype === 'G') pc['lamelle_G'] += copies
      else pc['lamelle_H'] += copies
    }

    // Панели добора обрамления
    let trimN = 1

    if (d.mountType !== 'В ПОТОЛОК') {
      const tw = d.trimTopW || d.openingW
      const th = d.trimTopH || d.wallDepth
      panels.push({
        ...trimBase,
        panelLabel: `${doorLabel}.${trimN++}`,
        wallName: `${doorName} — Верхнее`,
        height: th, width: tw,
        leftNode: d.trimTopLeftNode || 'A', rightNode: d.trimTopRightNode || 'A',
      })
      totalPanels += copies
      addEdge('A', copies * 2)
    }

    const lw = d.trimLeftW || d.wallDepth
    const lh = d.trimLeftH || d.openingH
    panels.push({
      ...trimBase,
      panelLabel: `${doorLabel}.${trimN++}`,
      wallName: `${doorName} — Левое`,
      height: lh, width: lw,
      leftNode: 'A', rightNode: d.trimLeftNode,
    })
    totalPanels += copies
    addEdge('A', copies)
    addEdge(d.trimLeftNode, copies)

    const rw = d.trimRightW || d.wallDepth
    const rh = d.trimRightH || d.openingH
    panels.push({
      ...trimBase,
      panelLabel: `${doorLabel}.${trimN++}`,
      wallName: `${doorName} — Правое`,
      height: rh, width: rw,
      leftNode: d.trimRightNode, rightNode: 'A',
    })
    totalPanels += copies
    addEdge(d.trimRightNode, copies)
    addEdge('A', copies)
  })

  pc['hanger'] = totalPanels * 4

  const profiles: ProfileSpec[] = []
  const push = (article: string, name: string, length: number, qty: number, note: string) => {
    const price = priceMap[article] ?? 0
    profiles.push({ article, name, length, quantity: qty, note, price_per_piece: price, total_cost: price * qty })
  }
  if (pc['104.256'] > 0)  push('104.256',    'Торцевой финишный профиль',              2995, Math.ceil(pc['104.256']),  'Считается поштучно')
  if (pc['104.259'] > 0)  push('104.259',    'Соединительный профиль',                 2995, Math.ceil(pc['104.259']),  '')
  if (pc['104.270'] > 0)  push('104.270',    'Угловой профиль',                        2995, Math.ceil(pc['104.270']),  '')
  if (pc['lamelle'] > 0)  push('ламель',   'Ламель соединительная (тип B)',          2995, Math.ceil(pc['lamelle']),   '')
  if (pc['lamelle_H'] > 0) push('ламель', 'Ламель стыковочная 51,5 мм (тип H)',    2000, Math.ceil(pc['lamelle_H']), 'Для дверных проёмов')
  if (pc['lamelle_G'] > 0) push('ламель', 'Ламель стыковочная 43 мм (тип G)',      2000, Math.ceil(pc['lamelle_G']), 'Для дверных проёмов')
  if (pc['hanger'] > 0)   push('МДФ 10',  'Навес стеновой панели',                 900,  pc['hanger'],              '4 шт на каждую панель')
  if (pc['al_decor'] > 0) push('П 6x6',      'Алюминиевый декоративный профиль П 6×6', 2995, Math.ceil(pc['al_decor']), 'Декоративный алюминий')

  return { panels, profiles }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVeneerGroup(name: string) {
  return name.startsWith('ШПО')
}

function getJointPrice(jointTypes: JointType[], code: string): number {
  return jointTypes.find(j => j.code === code)?.price_per_meter ?? 0
}

function getFinishPrice(finishGroups: FinishGroup[], groupName: string, finishName: string): number {
  const g = finishGroups.find(g => g.name === groupName)
  if (!g) return 0
  return (g.finishes as Finish[]).find(f => f.name === finishName)?.price_sqm ?? 0
}

function calcPanelCosts(
  p: PanelSpec,
  jointTypes: JointType[],
  finishGroups: FinishGroup[],
  priceMap: Record<string, number> = {},
) {
  const lp = getJointPrice(jointTypes, p.leftNode)
  const rp = getJointPrice(jointTypes, p.rightNode)
  const tp = getJointPrice(jointTypes, p.topEdge)
  const bp = getJointPrice(jointTypes, p.bottomEdge)
  const sideCost = (lp + rp) * p.height * 0.001 * p.quantity
  const topBotCost = (tp + bp) * p.width * 0.001 * p.quantity
  const areaSqm = Math.max(p.height * p.width / 1_000_000, 0.5) * p.quantity
  const finishPrice = getFinishPrice(finishGroups, p.finishGroup, p.finishName)
  const finishCost = finishPrice * areaSqm * (1 + p.markup / 100)
  const alVertPieces = p.aluminumVertical * Math.ceil(p.height / 2995)
  const alHorizPieces = p.aluminumHorizontal * Math.ceil(p.width / 2995)
  const alCost = (alVertPieces + alHorizPieces) * (priceMap['П 6x6'] ?? 0) * p.quantity
  const total = sideCost + topBotCost + finishCost + alCost
  return { sideCost, topBotCost, areaSqm, finishCost, alCost, total }
}

const fmt = (n: number) => n > 0 ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

// ─── WallCard ─────────────────────────────────────────────────────────────────

interface WallCardProps {
  wall: WallSeg
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  profileColors: ProfileColor[]
  onChange: (u: Partial<WallSeg>) => void
  onRemove: () => void
  canRemove: boolean
}

function WallCard({ wall, jointTypes, finishGroups, profileColors, onChange, onRemove, canRemove }: WallCardProps) {
  const calc = calcWall(wall)
  const selectedGroup = finishGroups.find(g => g.name === wall.finishGroup)
  const finishes: Finish[] = (selectedGroup?.finishes as Finish[]) ?? []
  const isVeneer = isVeneerGroup(wall.finishGroup)
  const decorOptions = getDecorOptions(wall.finishName, wall.finishGroup)
  const hasDecors = decorOptions.length > 0

  return (
    <div className="card" style={{ borderLeft: '3px solid #4c6ef5' }}>
      <div className="flex justify-between flex-center" style={{ marginBottom: 12 }}>
        <input
          value={wall.name}
          onChange={e => onChange({ name: e.target.value })}
          style={{ fontWeight: 700, fontSize: '1rem', border: 'none', background: 'transparent', outline: 'none', padding: 0, color: '#1a1a2e', flex: 1 }}
        />
        {canRemove && <button className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>}
      </div>

      {/* Размеры + кол-во */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Высота стены, мм</label>
          <input type="number" value={wall.wallHeight || ''} min={0}
            onChange={e => onChange({ wallHeight: +e.target.value })} />
        </div>
        <div className="field">
          <label>Длина стены, мм</label>
          <input type="number" value={wall.wallLength || ''} min={0}
            onChange={e => onChange({ wallLength: +e.target.value })} />
        </div>
        <div className="field">
          <label>
            Кол-во панелей
            <button type="button" onClick={() => onChange({ numPanels: suggestPanels(wall) })}
              title="Авто (макс. 1200 мм)"
              style={{ marginLeft: 6, fontSize: '.72rem', color: '#4c6ef5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              [авто]
            </button>
          </label>
          <input type="number" min={1} max={30} value={wall.numPanels || ''}
            onChange={e => onChange({ numPanels: Math.max(1, +e.target.value) })} />
        </div>
        <div className="field">
          <label>Копий (одинак. стен)</label>
          <input type="number" min={1} value={wall.copies}
            onChange={e => onChange({ copies: Math.max(1, +e.target.value) })} />
        </div>
      </div>

      {/* Узлы */}
      <div className="grid-3" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Узел левого края</label>
          <JointSelectCode value={wall.leftNode} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ leftNode: code })} />
        </div>
        <div className="field">
          <label>Соединение панелей</label>
          <JointSelectCode value={wall.connType} codes={CONN_NODE_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ connType: code as ConnType })} />
        </div>
        <div className="field">
          <label>Узел правого края</label>
          <JointSelectCode value={wall.rightNode} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ rightNode: code })} />
        </div>
      </div>

      {/* Верх/Низ кромки */}
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Верхняя кромка (тип узла)</label>
          <JointSelectCode value={wall.topEdge} codes={EDGE_TOPBOT_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ topEdge: code })} allowEmpty
            fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
        </div>
        <div className="field">
          <label>Нижняя кромка (тип узла)</label>
          <JointSelectCode value={wall.bottomEdge} codes={EDGE_TOPBOT_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ bottomEdge: code })} allowEmpty
            fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
        </div>
      </div>

      {/* Отделка */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Группа отделки</label>
          <StringSelect
            value={wall.finishGroup}
            options={finishGroups.map(g => g.name)}
            onChange={v => onChange({ finishGroup: v, finishName: '', veneerDirection: '', decor3d: '' })}
            placeholder="— выберите —"
          />
        </div>
        <div className="field">
          <label>Отделка</label>
          {finishes.length > 0 ? (
            <StringSelect
              value={wall.finishName}
              options={finishes.map(f => f.name)}
              onChange={v => onChange({ finishName: v, decor3d: '' })}
              placeholder="— выберите —"
            />
          ) : (
            <input value={wall.finishName} placeholder="Введите название"
              onChange={e => onChange({ finishName: e.target.value, decor3d: '' })} />
          )}
        </div>
        <div className="field">
          <label>Направление шпона</label>
          {isVeneer ? (
            <StringSelect
              value={wall.veneerDirection}
              options={VENEER_DIRECTIONS}
              onChange={v => onChange({ veneerDirection: v })}
              placeholder="— не указано —"
            />
          ) : (
            <input value={wall.veneerDirection} placeholder="—" disabled style={{ background: '#f5f5f5' }} />
          )}
        </div>
        <div className="field">
          <label>Декор 3D</label>
          {hasDecors ? (
            <StringSelect
              value={wall.decor3d}
              options={decorOptions.flatMap(g => g.items)}
              onChange={v => onChange({ decor3d: v })}
              placeholder="— не указан —"
            />
          ) : (
            <input value="" placeholder="— нет для этой группы —" disabled style={{ background: '#f5f5f5' }} />
          )}
        </div>
      </div>

      {/* Алюминий + наценка */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Ал. декор верт., шт</label>
          <input type="number" value={wall.aluminumVertical || 0} min={0}
            onChange={e => onChange({ aluminumVertical: +e.target.value })} />
        </div>
        <div className="field">
          <label>Ал. декор гор., шт</label>
          <input type="number" value={wall.aluminumHorizontal || 0} min={0}
            onChange={e => onChange({ aluminumHorizontal: +e.target.value })} />
        </div>
        <div className="field">
          <label>Цвет алюминия</label>
          {profileColors.length > 0 ? (
            <StringSelect
              value={wall.aluminumColor}
              options={profileColors.map(c => c.name)}
              onChange={v => onChange({ aluminumColor: v })}
              placeholder="— не указан —"
            />
          ) : (
            <input value={wall.aluminumColor} placeholder="Цвет алюминия"
              onChange={e => onChange({ aluminumColor: e.target.value })} />
          )}
        </div>
        <div className="field">
          <label>Наценка, %</label>
          <StringSelect
            value={wall.markup === 0 ? '0%' : `${wall.markup}%`}
            options={['0%', '5%', '10%', '15%', '20%', '100%']}
            onChange={v => onChange({ markup: parseInt(v) })}
          />
        </div>
      </div>

      {/* Примечание */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Примечание</label>
        <input value={wall.notes} placeholder="—"
          onChange={e => onChange({ notes: e.target.value })} />
      </div>

      {/* Результат расчёта */}
      {calc.valid && (
        <div className="calc-result">
          <strong>Расчёт:</strong>{' '}
          длина по панелям <strong>{calc.wallLengthByPanels} мм</strong>
          {' '}&nbsp;|&nbsp;{' '}
          размер панели <strong>{calc.panelHeight} × {calc.panelWidth} мм</strong>
          {wall.numPanels > 1 && (
            <span style={{ color: '#6366f1', marginLeft: 10 }}>
              ({wall.numPanels} шт. по {calc.panelWidth} мм)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DoorCard ─────────────────────────────────────────────────────────────────

interface DoorCardProps {
  door: DoorSeg
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  onChange: (u: Partial<DoorSeg>) => void
  onRemove: () => void
}

function DoorCard({ door, jointTypes, finishGroups, onChange, onRemove }: DoorCardProps) {
  const selectedGroup = finishGroups.find(g => g.name === door.finishGroup)
  const finishes: Finish[] = (selectedGroup?.finishes as Finish[]) ?? []
  const isVeneer = isVeneerGroup(door.finishGroup)
  const decorOptions = getDecorOptions(door.finishName, door.finishGroup)
  const hasDecors = decorOptions.length > 0
  const inOpening = door.mountType === 'В ПРОЕМ'
  const dtype = inOpening ? (door.openingDir === 'НАРУЖУ' ? 'G' : 'H') : null
  const panelH = dtype !== null
    ? Math.round((door.ceilingH - door.openingH + (dtype === 'G' ? 43 : 51.5)) * 10) / 10
    : null

  return (
    <div className="card" style={{ borderLeft: '3px solid #2f9e44' }}>
      <div className="flex justify-between flex-center" style={{ marginBottom: 12 }}>
        <input
          value={door.label}
          onChange={e => onChange({ label: e.target.value })}
          style={{ fontWeight: 700, fontSize: '1rem', border: 'none', background: 'transparent', outline: 'none', padding: 0, color: '#1a1a2e', flex: 1 }}
        />
        <button className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>
      </div>

      {/* Размеры проёма */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Ширина проёма, мм</label>
          <input type="number" value={door.openingW || ''} min={0}
            onChange={e => onChange({ openingW: +e.target.value })} />
        </div>
        <div className="field">
          <label>Высота проёма, мм</label>
          <input type="number" value={door.openingH || ''} min={0}
            onChange={e => onChange({ openingH: +e.target.value })} />
        </div>
        <div className="field">
          <label>Высота потолка, мм</label>
          <input type="number" value={door.ceilingH || ''} min={0}
            onChange={e => onChange({ ceilingH: +e.target.value })} />
        </div>
        <div className="field">
          <label>Копий</label>
          <input type="number" min={1} value={door.copies}
            onChange={e => onChange({ copies: Math.max(1, +e.target.value) })} />
        </div>
      </div>

      {/* Монтаж + открывание + петли */}
      <div className="grid-3" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Монтаж коробки</label>
          <StringSelect
            value={door.mountType}
            options={['В ПРОЕМ', 'В ПОТОЛОК']}
            onChange={v => onChange({ mountType: v as DoorSeg['mountType'] })}
          />
        </div>
        <div className="field">
          <label>Открывание двери</label>
          <StringSelect
            value={door.openingDir}
            options={['ВНУТРЬ', 'НАРУЖУ']}
            onChange={v => onChange({ openingDir: v as DoorSeg['openingDir'] })}
          />
        </div>
        <div className="field">
          <label>Петли</label>
          <StringSelect
            value={door.hingeDir}
            options={['СЛЕВА', 'СПРАВА']}
            onChange={v => onChange({ hingeDir: v as DoorSeg['hingeDir'] })}
          />
        </div>
      </div>

      {/* Узлы */}
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Узел левого края</label>
          <JointSelectCode value={door.leftNode} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ leftNode: code })} />
        </div>
        <div className="field">
          <label>Узел правого края</label>
          <JointSelectCode value={door.rightNode} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ rightNode: code })} />
        </div>
      </div>

      {/* Верх/Низ кромки */}
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Верхняя кромка</label>
          <JointSelectCode value={door.topEdge} codes={EDGE_TOPBOT_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ topEdge: code })} allowEmpty
            fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
        </div>
        <div className="field">
          <label>Нижняя кромка</label>
          <JointSelectCode value={door.bottomEdge} codes={EDGE_TOPBOT_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ bottomEdge: code })} allowEmpty
            fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
        </div>
      </div>

      {/* Добор обрамления */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
        <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Добор обрамления
        </div>

        <div className="field" style={{ maxWidth: 180, marginBottom: 10 }}>
          <label>Глубина стены, мм</label>
          <input type="number" value={door.wallDepth ?? 200} min={0}
            onChange={e => { const v = +e.target.value; onChange({ wallDepth: v, trimLeftW: v, trimRightW: v, trimTopH: v }) }} />
        </div>

        {/* 3 секции: левое / правое / верхнее */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {/* Левое */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Левое обрамление</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Ширина, мм</label>
                <input type="number" value={door.trimLeftW ?? door.wallDepth ?? 200} min={0}
                  onChange={e => onChange({ trimLeftW: +e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Высота, мм</label>
                <input type="number" value={door.trimLeftH ?? door.openingH ?? 2100} min={0}
                  onChange={e => onChange({ trimLeftH: +e.target.value })} />
              </div>
            </div>
          </div>

          {/* Правое */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Правое обрамление</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Ширина, мм</label>
                <input type="number" value={door.trimRightW ?? door.wallDepth ?? 200} min={0}
                  onChange={e => onChange({ trimRightW: +e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Высота, мм</label>
                <input type="number" value={door.trimRightH ?? door.openingH ?? 2100} min={0}
                  onChange={e => onChange({ trimRightH: +e.target.value })} />
              </div>
            </div>
          </div>

          {/* Верхнее */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Верхнее обрамление</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Ширина, мм</label>
                <input type="number" value={door.trimTopW ?? door.openingW ?? 900} min={0}
                  onChange={e => onChange({ trimTopW: +e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Высота, мм</label>
                <input type="number" value={door.trimTopH ?? door.wallDepth ?? 200} min={0}
                  onChange={e => onChange({ trimTopH: +e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* № заказа двери */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>№ заказа дверного полотна (DGV)</label>
        <input value={door.doorRef} placeholder="—"
          onChange={e => onChange({ doorRef: e.target.value })} />
      </div>

      {/* Отделка */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Группа отделки</label>
          <StringSelect
            value={door.finishGroup}
            options={finishGroups.map(g => g.name)}
            onChange={v => onChange({ finishGroup: v, finishName: '', veneerDirection: '', decor3d: '' })}
            placeholder="— выберите —"
          />
        </div>
        <div className="field">
          <label>Отделка</label>
          {finishes.length > 0 ? (
            <StringSelect
              value={door.finishName}
              options={finishes.map(f => f.name)}
              onChange={v => onChange({ finishName: v, decor3d: '' })}
              placeholder="— выберите —"
            />
          ) : (
            <input value={door.finishName} placeholder="Введите название"
              onChange={e => onChange({ finishName: e.target.value, decor3d: '' })} />
          )}
        </div>
        <div className="field">
          <label>Направление шпона</label>
          {isVeneer ? (
            <StringSelect
              value={door.veneerDirection}
              options={VENEER_DIRECTIONS}
              onChange={v => onChange({ veneerDirection: v })}
              placeholder="— не указано —"
            />
          ) : (
            <input value={door.veneerDirection} placeholder="—" disabled style={{ background: '#f5f5f5' }} />
          )}
        </div>
        <div className="field">
          <label>Декор 3D</label>
          {hasDecors ? (
            <StringSelect
              value={door.decor3d}
              options={decorOptions.flatMap(g => g.items)}
              onChange={v => onChange({ decor3d: v })}
              placeholder="— не указан —"
            />
          ) : (
            <input value="" placeholder="— нет для этой группы —" disabled style={{ background: '#f5f5f5' }} />
          )}
        </div>
      </div>

      {/* Примечание */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Примечание</label>
        <input value={door.notes} placeholder="—"
          onChange={e => onChange({ notes: e.target.value })} />
      </div>

      {dtype !== null && panelH !== null && (
        <div className="calc-result" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
          <strong>Панель над дверью</strong> (тип {dtype}):
          {' '}<strong>{panelH} × {door.openingW} мм</strong>
        </div>
      )}
      {door.mountType === 'В ПОТОЛОК' && (
        <div style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 7, padding: '10px 14px', fontSize: '.87rem' }}>
          Монтаж «В ПОТОЛОК» — панель над дверью не создаётся.
        </div>
      )}
    </div>
  )
}

// ─── SchemeHint ───────────────────────────────────────────────────────────────

function SchemeHint() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card no-print" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 600, color: '#1a4d8a', textAlign: 'left',
        }}
      >
        <span>Схемы сборки стеновых панелей NUOVO 60 — справочные листы</span>
        <svg width="14" height="14" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: .5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <img
            src="/scheme1.png"
            alt="Схема сборки — план раскладки"
            style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5', display: 'block' }}
          />
          <img
            src="/scheme2.png"
            alt="Схема сборки — типы узлов"
            style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5', display: 'block' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── SaveOrderModal ───────────────────────────────────────────────────────────

interface SaveOrderModalProps {
  panels: PanelSpec[]
  panelCosts: ReturnType<typeof calcPanelCosts>[]
  profiles: ProfileSpec[]
  walls: WallSeg[]
  doors: DoorSeg[]
  itemOrder: { type: 'wall' | 'door'; id: string }[]
  wallSeq: number
  doorSeq: number
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  profileColors: ProfileColor[]
  editOrder: Order | null
  onClose: () => void
  onSaved: (orderId: number) => void
}

function SaveOrderModal({
  panels, panelCosts, profiles, walls, doors, itemOrder, wallSeq, doorSeq,
  jointTypes, finishGroups, profileColors, editOrder, onClose, onSaved,
}: SaveOrderModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    customer_name: editOrder?.customer_name ?? '',
    agent_name: editOrder?.agent_name ?? '',
    counterparty: editOrder?.counterparty ?? '',
    order_number: editOrder?.order_number ?? '',
    invoice_number: editOrder?.invoice_number ?? '',
    order_date: editOrder?.order_date ?? today,
    city: editOrder?.city ?? '',
    notes: editOrder?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const buildConfiguratorState = () => ({
    walls, doors, itemOrder, wallSeq, doorSeq,
    spec: {
      panels: panels.map((p, i) => ({ ...p, ...panelCosts[i] })),
      profiles,
    },
  })

  const savePanels = async (orderId: number) => {
    if (panels.length === 0) return
    const wallNumMap = new Map<string, string>()
    let wallIdx = 0
    for (const p of panels) {
      if (!wallNumMap.has(p.wallName)) {
        wallNumMap.set(p.wallName, String(++wallIdx))
      }
    }
    const jt = (code: string) => code ? (jointTypes.find(j => j.code === code)?.id ?? null) : null
    const colorId = (name: string) => name ? (profileColors.find(c => c.name === name)?.id ?? null) : null
    const wallPositions = new Map<string, number>()

    for (let i = 0; i < panels.length; i++) {
      const p = panels[i]
      setProgress(`Сохранение панелей: ${i + 1} / ${panels.length}`)
      const wallNum = wallNumMap.get(p.wallName) ?? String(i + 1)
      const pos = (wallPositions.get(wallNum) ?? 0) + 1
      wallPositions.set(wallNum, pos)
      const fg = finishGroups.find(g => g.name === p.finishGroup)
      const fin = (fg?.finishes as Finish[] | undefined)?.find(f => f.name === p.finishName)
      await createPanel({
        order: orderId,
        position: pos,
        wall_number: wallNum,
        quantity: p.quantity,
        height_mm: p.height,
        width_mm: p.width,
        joint_left: jt(p.leftNode),
        joint_right: jt(p.rightNode),
        joint_top: jt(p.topEdge),
        joint_bottom: jt(p.bottomEdge),
        finish_group: fg?.id ?? null,
        finish: fin?.id ?? null,
        veneer_direction: p.veneerDirection,
        decor_name: p.decor3d,
        aluminum_vertical_count: p.aluminumVertical,
        aluminum_horizontal_count: p.aluminumHorizontal,
        aluminum_color: colorId(p.aluminumColor),
        markup_percent: p.markup,
        notes: p.notes,
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const configurator_state = buildConfiguratorState()

      if (editOrder) {
        // Режим редактирования: обновляем заказ + пересоздаём панели
        setProgress('Обновление заказа...')
        await updateOrder(editOrder.id!, { ...form, configurator_state })

        // Удаляем старые панели
        const oldPanels = editOrder.panels ?? []
        for (let i = 0; i < oldPanels.length; i++) {
          setProgress(`Удаление старых панелей: ${i + 1} / ${oldPanels.length}`)
          if (oldPanels[i].id) await deletePanel(oldPanels[i].id!)
        }
        await savePanels(editOrder.id!)
        onSaved(editOrder.id!)
      } else {
        // Режим создания
        setProgress('Создание заказа...')
        const order = await createOrder({ ...form, configurator_state })
        await savePanels(order.id!)
        onSaved(order.id!)
      }
    } catch {
      setError('Ошибка при сохранении заказа')
      setSaving(false)
      setProgress('')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 520, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1a1a2e' }}>
            {editOrder ? 'Обновить заказ' : 'Сохранить заказ'}
          </h2>
          {!saving && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1 }}
            >✕</button>
          )}
        </div>

        {panels.length > 0 && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f6ff', borderRadius: 8, fontSize: 13, color: '#1a4d8a' }}>
            {editOrder ? 'Панели будут пересозданы: ' : 'Будет сохранено: '}
            <strong>{panels.reduce((s, p) => s + p.quantity, 0)} панел.</strong>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>ФИО заказчика</label>
            <input
              value={form.customer_name}
              placeholder="Иванов Иван Иванович"
              onChange={e => set('customer_name', e.target.value)}
              autoFocus
              disabled={saving}
            />
          </div>
          <div className="field">
            <label>Агент</label>
            <input value={form.agent_name} placeholder="—" onChange={e => set('agent_name', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Контрагент</label>
            <input value={form.counterparty} placeholder="—" onChange={e => set('counterparty', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Номер заказа</label>
            <input value={form.order_number} placeholder="2025-001" onChange={e => set('order_number', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Номер счёта</label>
            <input value={form.invoice_number} placeholder="—" onChange={e => set('invoice_number', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Дата заказа</label>
            <input type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Город</label>
            <input value={form.city} placeholder="Москва" onChange={e => set('city', e.target.value)} disabled={saving} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Примечания</label>
            <input value={form.notes} placeholder="—" onChange={e => set('notes', e.target.value)} disabled={saving} />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

        {saving && progress && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0f6ff', borderRadius: 8, fontSize: 13, color: '#1a4d8a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" style={{ width: 14, height: 14 }} />
            {progress}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : editOrder ? 'Обновить заказ' : 'Сохранить заказ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Configurator ─────────────────────────────────────────────────────────────

export default function Configurator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editOrderId = searchParams.get('order')

  const [walls, setWalls] = useState<WallSeg[]>(_INIT.walls)
  const [doors, setDoors] = useState<DoorSeg[]>(_INIT.doors)
  const [wallSeq, setWallSeq] = useState(_INIT.wallSeq)
  const [doorSeq, setDoorSeq] = useState(_INIT.doorSeq)
  const [itemOrder, setItemOrder] = useState<{ type: 'wall' | 'door'; id: string }[]>(_INIT.itemOrder)
  const [copied, setCopied] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  const [jointTypes, setJointTypes] = useState<JointType[]>([])
  const [finishGroups, setFinishGroups] = useState<FinishGroup[]>([])
  const [aluminumProfiles, setAluminumProfiles] = useState<AluminumProfile[]>([])
  const [profileColors, setProfileColors] = useState<ProfileColor[]>([])

  useEffect(() => {
    fetchJointTypes().then(setJointTypes).catch(() => {})
    fetchFinishGroups().then(setFinishGroups).catch(() => {})
    fetchAluminumProfiles().then(setAluminumProfiles).catch(() => {})
    fetchProfileColors().then(setProfileColors).catch(() => {})
  }, [])

  // Загружаем заказ для редактирования при ?order=ID
  useEffect(() => {
    if (!editOrderId) return
    setLoadingOrder(true)
    fetchOrder(Number(editOrderId)).then(order => {
      setEditOrder(order)
      const cs = order.configurator_state
      if (cs?.walls?.length) {
        // Синхронизируем _seq чтобы новые ID не коллидировали
        for (const item of [...(cs.walls ?? []), ...(cs.doors ?? [])]) {
          const n = parseInt((item.id ?? '').replace('id', ''))
          if (!isNaN(n) && n > _seq) _seq = n
        }
        setWalls(cs.walls)
        setDoors(cs.doors ?? [])
        setItemOrder(cs.itemOrder ?? cs.walls.map((w: WallSeg) => ({ type: 'wall', id: w.id })))
        setWallSeq(cs.wallSeq ?? cs.walls.length)
        setDoorSeq(cs.doorSeq ?? (cs.doors?.length ?? 0))
      }
      setLoadingOrder(false)
    }).catch(() => setLoadingOrder(false))
  }, [editOrderId])

  // Сохраняем состояние в localStorage при каждом изменении
  useEffect(() => {
    localStorage.setItem('nuovo60_config', JSON.stringify({ walls, doors, itemOrder, wallSeq, doorSeq }))
  }, [walls, doors, itemOrder, wallSeq, doorSeq])

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of aluminumProfiles) m[p.article] = p.price_per_piece
    return m
  }, [aluminumProfiles])

  const spec = useMemo(() => buildSpec(walls, doors, priceMap), [walls, doors, priceMap])

  const totalPanels = spec.panels.reduce((s, p) => s + p.quantity, 0)
  const totalAreaSqm = spec.panels.reduce(
    (s, p) => s + Math.max(p.height * p.width / 1_000_000, 0.5) * p.quantity, 0,
  )

  const panelCosts = useMemo(
    () => spec.panels.map(p => calcPanelCosts(p, jointTypes, finishGroups, priceMap)),
    [spec.panels, jointTypes, finishGroups, priceMap],
  )

  const grandTotal = panelCosts.reduce((s, c) => s + c.total, 0)
  const profilesTotal = spec.profiles.reduce((s, p) => s + p.total_cost, 0)

  const addWall = () => {
    const n = wallSeq + 1; setWallSeq(n)
    const w = makeWall(n)
    setWalls(prev => [...prev, w])
    setItemOrder(prev => [...prev, { type: 'wall', id: w.id }])
  }
  const removeWall = (id: string) => {
    setWalls(prev => prev.filter(w => w.id !== id))
    setItemOrder(prev => prev.filter(item => !(item.type === 'wall' && item.id === id)))
  }
  const updateWall = (id: string, u: Partial<WallSeg>) => setWalls(prev => prev.map(w => w.id === id ? { ...w, ...u } : w))

  const addDoor = () => {
    const n = doorSeq + 1; setDoorSeq(n)
    const d = makeDoor(n)
    setDoors(prev => [...prev, d])
    setItemOrder(prev => [...prev, { type: 'door', id: d.id }])
  }
  const removeDoor = (id: string) => {
    setDoors(prev => prev.filter(d => d.id !== id))
    setItemOrder(prev => prev.filter(item => !(item.type === 'door' && item.id === id)))
  }
  const updateDoor = (id: string, u: Partial<DoorSeg>) => setDoors(prev => prev.map(d => d.id === id ? { ...d, ...u } : d))

  const copySpec = () => {
    let text = 'СПЕЦИФИКАЦИЯ СТЕНОВЫХ ПАНЕЛЕЙ NUOVO 60\n\n'
    text += '№\tНаименование\tВыс, мм\tУзел лев.\tШир, мм\tУзел пр.\tКол-во\tСт-ть узлов выс.\tУзел верх\tУзел низ\tСт-ть узлов в/н\tГруппа\tОтделка\tНапр. шпона\tДекор 3D\tАл↕\tАл↔\tЦвет ал.\tКв.м\tНаценка\tИтог\tПримечание\n'
    spec.panels.forEach((p, i) => {
      const c = panelCosts[i]
      text += `${p.panelLabel}\t${p.wallName}\t${p.height}\t${p.leftNode}\t${p.width}\t${p.rightNode}\t${p.quantity}\t${Math.round(c.sideCost)}\t${p.topEdge || '—'}\t${p.bottomEdge || '—'}\t${Math.round(c.topBotCost)}\t${p.finishGroup}\t${p.finishName || '—'}\t${p.veneerDirection || '—'}\t${p.decor3d || '—'}\t${p.aluminumVertical || '—'}\t${p.aluminumHorizontal || '—'}\t${p.aluminumColor || '—'}\t${c.areaSqm.toFixed(2)}\t${p.markup}%\t${Math.round(c.total)}\t${p.notes || '—'}\n`
    })
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  return (
    <div>
      {showSaveModal && (
        <SaveOrderModal
          panels={spec.panels}
          panelCosts={panelCosts}
          profiles={spec.profiles}
          walls={walls}
          doors={doors}
          itemOrder={itemOrder}
          wallSeq={wallSeq}
          doorSeq={doorSeq}
          jointTypes={jointTypes}
          finishGroups={finishGroups}
          profileColors={profileColors}
          editOrder={editOrder}
          onClose={() => setShowSaveModal(false)}
          onSaved={id => navigate(`/orders/${id}`)}
        />
      )}
      <div className="page">
        <div className="container">
          <h1 className="page-title">Конфигуратор стеновых панелей</h1>

          <SchemeHint />

          <div className="flex gap-2 no-print" style={{ marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={addWall}>+ Добавить стену</button>
            <button className="btn btn-ghost" onClick={addDoor}>+ Дверной проём</button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {editOrder && (
                <span style={{ fontSize: 13, color: '#555' }}>
                  Редактирование: <strong>{editOrder.order_number || `Заказ #${editOrder.id}`}</strong>
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={() => setShowSaveModal(true)}
                disabled={loadingOrder}
              >
                {loadingOrder ? 'Загрузка...' : editOrder ? 'Обновить заказ' : 'Сохранить заказ'}
              </button>
            </div>
          </div>

          {itemOrder.map(item => {
            if (item.type === 'wall') {
              const w = walls.find(w => w.id === item.id)
              if (!w) return null
              return (
                <WallCard key={w.id} wall={w} jointTypes={jointTypes} finishGroups={finishGroups} profileColors={profileColors}
                  onChange={u => updateWall(w.id, u)}
                  onRemove={() => removeWall(w.id)}
                  canRemove={walls.length > 1} />
              )
            } else {
              const d = doors.find(d => d.id === item.id)
              if (!d) return null
              return (
                <DoorCard key={d.id} door={d} jointTypes={jointTypes} finishGroups={finishGroups}
                  onChange={u => updateDoor(d.id, u)}
                  onRemove={() => removeDoor(d.id)} />
              )
            }
          })}

          {/* ── Спецификация ── */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="flex justify-between flex-center no-print" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Спецификация</h2>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={copySpec}>
                  {copied ? '✓ Скопировано' : 'Копировать'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Печать</button>
              </div>
            </div>

            <div className="print-only" style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 700 }}>
              СПЕЦИФИКАЦИЯ СТЕНОВЫХ ПАНЕЛЕЙ NUOVO 60
            </div>

            {spec.panels.length === 0 ? (
              <div className="alert alert-info">
                Заполните параметры стен выше — спецификация рассчитается автоматически.
              </div>
            ) : (
              <>
                <h3 className="spec-section-title">
                  Стеновые панели — {totalPanels} шт. / {totalAreaSqm.toFixed(2)} кв.м
                  {grandTotal > 0 && (
                    <span style={{ marginLeft: 16, color: '#1a4d8a' }}>
                      / Итого: {grandTotal.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                    </span>
                  )}
                </h3>

                <div className="table-wrap" style={{ marginBottom: 22 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Наименование</th>
                        <th>Высота, мм</th>
                        <th>Узел лев.</th>
                        <th>Ширина, мм</th>
                        <th>Узел пр.</th>
                        <th>Кол-во, шт</th>
                        <th>Ст-ть узлов выс., ₽</th>
                        <th>Узел верх</th>
                        <th>Узел низ</th>
                        <th>Ст-ть узлов в/н, ₽</th>
                        <th>Группа отделок</th>
                        <th>Отделка</th>
                        <th>Напр. шпона</th>
                        <th>Декор 3D</th>
                        <th>Ал↕, шт</th>
                        <th>Ал↔, шт</th>
                        <th>Цвет ал.</th>
                        <th>Кв.м</th>
                        <th>Наценка, %</th>
                        <th>Итог, ₽</th>
                        <th>Примечание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.panels.map((p, i) => {
                        const c = panelCosts[i]
                        return (
                          <tr key={i}>
                            <td><strong>{p.panelLabel}</strong></td>
                            <td>{p.wallName}</td>
                            <td><strong>{p.height}</strong></td>
                            <td><span className="badge badge-blue">{p.leftNode}</span></td>
                            <td><strong>{p.width}</strong></td>
                            <td><span className="badge badge-blue">{p.rightNode}</span></td>
                            <td><strong>{p.quantity}</strong></td>
                            <td className="text-right">{fmt(c.sideCost)}</td>
                            <td>{p.topEdge ? <span className="badge badge-gray">{p.topEdge}</span> : '—'}</td>
                            <td>{p.bottomEdge ? <span className="badge badge-gray">{p.bottomEdge}</span> : '—'}</td>
                            <td className="text-right">{fmt(c.topBotCost)}</td>
                            <td>{p.finishGroup || '—'}</td>
                            <td>{p.finishName || '—'}</td>
                            <td>{p.veneerDirection || '—'}</td>
                            <td className="text-muted">{p.decor3d || '—'}</td>
                            <td>{p.aluminumVertical || '—'}</td>
                            <td>{p.aluminumHorizontal || '—'}</td>
                            <td className="text-muted">{p.aluminumColor || '—'}</td>
                            <td className="text-right">{c.areaSqm.toFixed(2)}</td>
                            <td>{p.markup > 0 ? `${p.markup}%` : '—'}</td>
                            <td className="text-right price"><strong>{fmt(c.total)}</strong></td>
                            <td className="text-muted">{p.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Профили */}
                {spec.profiles.length > 0 && (
                  <>
                    <h3 className="spec-section-title">Профили и комплектующие</h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Наименование</th>
                            <th>Артикул</th>
                            <th>Длина, мм</th>
                            <th>Кол-во, шт</th>
                            <th>Цена/шт, ₽</th>
                            <th>Сумма, ₽</th>
                            <th>Примечание</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spec.profiles.map((p, i) => (
                            <tr key={i}>
                              <td><strong>{i + 1}</strong></td>
                              <td>{p.name}</td>
                              <td><span className="badge badge-gray">{p.article}</span></td>
                              <td>{p.length}</td>
                              <td><strong>{p.quantity}</strong></td>
                              <td className="text-right">{p.price_per_piece ? p.price_per_piece.toLocaleString('ru-RU') : '—'}</td>
                              <td className="text-right price">{p.total_cost ? p.total_cost.toLocaleString('ru-RU') : '—'}</td>
                              <td className="text-muted">{p.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {profilesTotal > 0 && (
                      <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600, color: '#1a1a2e' }}>
                        Итого профили: <span className="price">{profilesTotal.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    )}
                  </>
                )}

                {(grandTotal + profilesTotal) > 0 && (
                  <div style={{ textAlign: 'right', marginTop: 16, fontSize: '1.1rem', fontWeight: 700, color: '#1a4d8a', borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
                    ИТОГО ВСЕГО: <span className="price">{(grandTotal + profilesTotal).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Схема раскладки ── */}
          {spec.panels.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <h2 style={{ margin: '0 0 16px' }}>Схема раскладки</h2>
              <WallScheme walls={walls} doors={doors} panels={spec.panels} itemOrder={itemOrder} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
