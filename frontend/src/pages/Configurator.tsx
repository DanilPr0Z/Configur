import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { fetchAluminumProfiles, fetchProfileColors, fetchJointTypes, fetchFinishGroups, fetchOrder, createOrder, updateOrder, createPanel, deletePanel, isCascateLoggedIn, LOGIN_REQUIRED_MSG } from '../api'
import type { AluminumProfile, ProfileColor, JointType, FinishGroup, Finish, Order, Series } from '../api'
import { visibleFinishGroups } from '../api'
import { JointSelectCode, StringSelect } from '../components/JointSelect'
import WallScheme from '../components/WallScheme'
import WallElevation, { ElevationTable } from '../components/WallElevation'
import type { ElevItem } from '../components/WallElevation'
import FinishBreakdown, { groupByFinish } from '../components/FinishBreakdown'
import { printSpec } from '../components/FinalSpec'

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
  // Ширины панелей: авто — поровну от длины по узлам; вручную — свои значения
  // (например 664 / 597 / 597 / 664 или наличник 796,2 между узлами DG).
  widthMode: 'auto' | 'manual'
  panelWidths: number[]
  // Зазоры сверху/снизу (по умолчанию 7 и 5 мм) — вычитаются из высоты стены.
  gapTop: number
  gapBottom: number
  // Ряды по высоте: панели одна над другой (лист до 3000 мм, стена выше).
  numRows: number
  rowConn: string          // узел горизонтального стыка рядов (S/B/C/T…)
  heightMode: 'auto' | 'manual'
  rowHeights: number[]
  // Столбец со своей разбивкой по рядам (как П52/П53 в СП): [столбец] → высоты
  // рядов сверху вниз. Пустой элемент — столбец режется общими rowHeights.
  colRowHeights: number[][]
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
  wallFacing: 'front' | 'back'
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
  trimLeftWallNode: string   // узел внешнего (к стене) края левого добора
  trimRightWallNode: string  // узел внешнего (к стене) края правого добора
  finishGroup: string
  finishName: string
  veneerDirection: string
  decor3d: string
  copies: number
  hasTrim: boolean
  notes: string
}

type ItemOrder = { type: 'wall' | 'door'; id: string }[]

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
  { code: 'G',  label: 'G — Стык с коробкой (НАРУЖУ)',  offset: 50.1, article: null, ppe: 0 },
  { code: 'H',  label: 'H — Стык с коробкой (ВНУТРЬ)', offset: 58.5, article: null, ppe: 0 },
  { code: 'O',  label: 'O — Без профиля',          offset: -27.1, article: null,      ppe: 0   },
  { code: 'P',  label: 'P — Профиль-декор П-обр 6×6', offset: 0,  article: null,      ppe: 0   },
  { code: 'R',  label: 'R — Профиль П-обр 6×6 (зазор 6 мм)', offset: -6, article: null, ppe: 0 },
  { code: 'S',  label: 'S — Стык',                offset: 0,     article: null,      ppe: 0   },
  // Полка Step врезается в панель (лист «Схема сборки … COMPLANAR 60»), размер
  // панели не меняет — отдельный код, чтобы не путать со стыком рядов S.
  { code: 'STEP', label: 'S — Полка Step',        offset: 0,     article: null,      ppe: 0   },
  { code: 'T',  label: 'T — Тип T',               offset: 0,     article: null,      ppe: 0   },
  { code: 'I',  label: 'I — Тип I',               offset: -1.2,  article: null,      ppe: 0   },
  // Теневой профиль: уменьшает высоту панели на 12 мм при установке сверху или снизу
  { code: 'TC', label: 'C — Теневой профиль',      offset: 0,     heightOffset: -12,  article: null, ppe: 0 },
]

const NODE_MAP = new Map<string, NodeDef>(NODES.map(n => [n.code, n]))

// Поправки узлов (offset) у NUOVO 50 и 60 РАЗНЫЕ (DG, DH, G, H), поэтому берём
// их из справочника серии, а NODES оставляем как fallback и для heightOffset
// узла TC, которого в справочнике нет.
type OffsetMap = Map<string, number>

function offsetsOf(jointTypes: JointType[]): OffsetMap {
  return new Map(jointTypes.map(j => [j.code, j.offset_mm]))
}

function offsetOf(off: OffsetMap, code: string): number {
  return off.get(code) ?? NODE_MAP.get(code)?.offset ?? 0
}

// Панель над дверью, лист «Ввод данных к заказу» Excel:
//   высота = Н потолка − H проёма + (узел G ? hG : hH)
//   ширина = L проёма − (открывание/узел соединения)
// Константы у 50 и 60 разные — в 60 это K119/L119 (43 / 51,5 и 100,5…125,5),
// в 50 те же ячейки дают 33 / 46 и 80…115.
interface DoorGeom { hG: number; hH: number; wOutB: number; wOutC: number; wInB: number; wInC: number }

const DOOR_GEOM: Record<Series, DoorGeom> = {
  '60': { hG: 43, hH: 51.5, wOutB: 100.5, wOutC: 108.5, wInB: 117.5, wInC: 125.5 },
  '50': { hG: 33, hH: 46,   wOutB: 80,    wOutC: 88,    wInB: 107,   wInC: 115   },
}
// Лист «Ограничения и особенности» Excel NUOVO 60/50: лист 1200 × 3000 мм,
// минимальная панель 150 × 400 (шпон с 3D-фрезеровкой — 200 × 400), при
// стыковке по высоте каждая часть не меньше 400 мм, площадь < 0,5 кв.м
// считается как 0,5 кв.м.
const LIMITS = { maxW: 1200, maxH: 3000, minW: 150, minW3d: 200, minH: 400, minRowH: 400 }
const DEFAULT_GAP_TOP = 7
const DEFAULT_GAP_BOTTOM = 5
const ROW_CONN_CODES = ['S', 'B', 'C', 'R', 'P', 'T', 'A', 'O', 'I', 'STEP']

const EDGE_NODE_CODES = ['A', 'D', 'DG', 'DH', 'E', 'FL', 'FR', 'G', 'H', 'O', 'P', 'R', 'S', 'T', 'I']
const EDGE_TOPBOT_CODES = [...EDGE_NODE_CODES, 'TC', 'STEP']  // + теневой профиль для верх/низ
// Узлы вертикальных соединений листа «Схема сборки … COMPLANAR 60»: B, C, R, P
const CONN_NODE_CODES = ['B', 'C', 'R', 'P']
// У двери ширина панели над проёмом посчитана только для ламели и соединительного
// профиля (лист «Ввод данных к заказу»), поэтому выбор здесь уже.
const DOOR_CONN_CODES = ['B', 'C']
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
// Группа КОЖА в Excel — только Pele; артикулы «(PELLE)» и «(WOOD)» входят
// в КОМПОЗИТ и выбираются там как отделка, отдельного декора им не нужно.
const DECORS_KOZHA: string[] = [
  'Pele Grigio','Pele Fumoso','Pele Marone','Pele Salar','Pele Black',
]

// Извлекает базовое имя декора без суффикса толщины ("Breeze Oak 1,5 мм" → "Breeze Oak")
function getDecorBaseName(decor: string): string {
  return decor.replace(/ ?(?:1[,.]5|2[,.]5|5) ?(?:мм|mm)$/i, '').trim()
}

// Уникальные базовые названия шпоновых декоров ("Breeze Oak", "American walnut", …)
// — это и есть список «Отделка» для группы ШПОН.
const SHPON_BASE_NAMES: string[] = [...new Set(
  [...DECORS_SHPON_15, ...DECORS_SHPON_25, ...DECORS_SHPON_5].map(getDecorBaseName)
)]

// Возвращает варианты декора для КОНКРЕТНОЙ отделки (не для группы)
function getDecorOptions(finishName: string, groupName: string): { group: string; items: string[] }[] {
  const g = groupName.toUpperCase()

  if (g.startsWith('ШПО')) {
    const byThickness = [
      { group: 'ШПОН 1,5 мм', src: DECORS_SHPON_15 },
      { group: 'ШПОН 2,5 мм', src: DECORS_SHPON_25 },
      { group: 'ШПОН 5 мм',   src: DECORS_SHPON_5  },
    ]
    // Отделка (базовое имя, напр. «Breeze Oak») выбрана — показываем только её
    // варианты по толщине: Breeze Oak 1,5 / 2,5 / 5 мм.
    if (finishName) {
      const result: { group: string; items: string[] }[] = []
      for (const { group, src } of byThickness) {
        const items = src.filter(d => getDecorBaseName(d) === finishName)
        if (items.length > 0) result.push({ group, items })
      }
      return result
    }
    // Отделка ещё не выбрана — показываем все декоры всех толщин.
    return byThickness.map(({ group, src }) => ({ group, items: src }))
  }

  if (g === 'LACATO' || g === 'LACATO 2,5 ММ') {
    if (finishName) {
      const items = DECORS_LACATO.filter(d => getDecorBaseName(d) === finishName)
      if (items.length > 0) return [{ group: 'LACATO 2,5 мм', items }]
    }
    return [{ group: 'LACATO 2,5 мм', items: DECORS_LACATO }]
  }

  if (g === 'КОЖА') return [{ group: 'КОЖА (Pele)', items: DECORS_KOZHA }]
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
    numPanels: 0, connType: 'C',
    widthMode: 'auto', panelWidths: [],
    gapTop: DEFAULT_GAP_TOP, gapBottom: DEFAULT_GAP_BOTTOM,
    numRows: 1, rowConn: 'S', heightMode: 'auto', rowHeights: [], colRowHeights: [],
    finishGroup: '', finishName: '',
    veneerDirection: '', decor3d: '',
    copies: 1,
    aluminumVertical: 0, aluminumHorizontal: 0, aluminumColor: '',
    markup: 0, notes: '',
    wallFacing: 'front' as const,
  }
}

function makeDoor(n: number): DoorSeg {
  return {
    id: uid(), label: `Дверной проём ${n}`,
    doorRef: '', openingW: 900, openingH: 2100, ceilingH: 2700,
    mountType: 'В ПРОЕМ', openingDir: 'ВНУТРЬ', hingeDir: 'СЛЕВА',
    leftNode: 'B', rightNode: 'B',
    topEdge: '', bottomEdge: '',
    wallDepth: 200, trimLeftNode: 'A', trimLeftW: 200, trimLeftH: 2100,
    trimRightNode: 'A', trimRightW: 200, trimRightH: 2100,
    trimTopLeftNode: 'A', trimTopRightNode: 'A', trimTopW: 900, trimTopH: 200,
    trimLeftWallNode: 'A', trimRightWallNode: 'A',
    finishGroup: '', finishName: '',
    veneerDirection: '', decor3d: '',
    copies: 1, hasTrim: false, notes: '',
  }
}

// Конфигуратор всегда открывается с чистого листа: черновик в localStorage больше
// не восстанавливается (иначе панели от NUOVO 60 «протекали» в NUOVO 50 и наоборот).
// Чистим ключ старых версий, чтобы он не висел в браузерах агентов.
try { localStorage.removeItem('nuovo60_config') } catch { /* приватный режим */ }

// Мигрируем стены (wallFacing) — восстановленные из localStorage и из заказа
function migrateWalls(raw: any[]): WallSeg[] {
  return (raw ?? []).filter(Boolean).map((wa: any) => ({
    ...wa,
    id: wa.id ?? uid(),
    name: wa.name ?? 'Стена',
    wallHeight: wa.wallHeight ?? 2700,
    wallLength: wa.wallLength ?? 3000,
    numPanels: wa.numPanels ?? 0,
    connType: wa.connType ?? 'C',
    widthMode: wa.widthMode === 'manual' ? 'manual' : 'auto',
    panelWidths: Array.isArray(wa.panelWidths) ? wa.panelWidths : [],
    gapTop: wa.gapTop ?? DEFAULT_GAP_TOP,
    gapBottom: wa.gapBottom ?? DEFAULT_GAP_BOTTOM,
    numRows: Math.max(1, wa.numRows ?? 1),
    rowConn: wa.rowConn ?? 'S',
    heightMode: wa.heightMode === 'manual' ? 'manual' : 'auto',
    rowHeights: Array.isArray(wa.rowHeights) ? wa.rowHeights : [],
    colRowHeights: Array.isArray(wa.colRowHeights) ? wa.colRowHeights : [],
    leftNode: wa.leftNode ?? 'A',
    rightNode: wa.rightNode ?? 'A',
    topEdge: wa.topEdge ?? '',
    bottomEdge: wa.bottomEdge ?? '',
    copies: wa.copies ?? 1,
    finishGroup: wa.finishGroup ?? '',
    finishName: wa.finishName ?? '',
    veneerDirection: wa.veneerDirection ?? '',
    decor3d: wa.decor3d ?? '',
    aluminumVertical: wa.aluminumVertical ?? 0,
    aluminumHorizontal: wa.aluminumHorizontal ?? 0,
    aluminumColor: wa.aluminumColor ?? '',
    markup: wa.markup ?? 0,
    notes: wa.notes ?? '',
    wallFacing: (wa.wallFacing ?? 'front') as 'front' | 'back',
  }))
}

// Мигрируем старые DoorSeg без новых полей добора обрамления
function migrateDoors(raw: any[]): DoorSeg[] {
  return (raw ?? []).filter(Boolean).map((da: any) => ({
    ...da,
    id: da.id ?? uid(),
    label: da.label ?? 'Дверной проём',
    doorRef: da.doorRef ?? '',
    openingW: da.openingW ?? 900,
    openingH: da.openingH ?? 2100,
    ceilingH: da.ceilingH ?? 2700,
    mountType: da.mountType ?? 'В ПРОЕМ',
    openingDir: da.openingDir ?? 'ВНУТРЬ',
    hingeDir: da.hingeDir ?? 'СЛЕВА',
    topEdge: da.topEdge ?? '',
    bottomEdge: da.bottomEdge ?? '',
    finishGroup: da.finishGroup ?? '',
    finishName: da.finishName ?? '',
    veneerDirection: da.veneerDirection ?? '',
    decor3d: da.decor3d ?? '',
    copies: da.copies ?? 1,
    notes: da.notes ?? '',
    wallDepth: da.wallDepth ?? 200,
    trimLeftNode: da.trimLeftNode ?? 'A',
    trimLeftW: da.trimLeftW ?? da.wallDepth ?? 200,
    trimLeftH: da.trimLeftH ?? da.openingH ?? 2100,
    trimRightNode: da.trimRightNode ?? 'A',
    trimRightW: da.trimRightW ?? da.wallDepth ?? 200,
    trimRightH: da.trimRightH ?? da.openingH ?? 2100,
    trimTopLeftNode: da.trimTopLeftNode ?? 'A',
    trimTopRightNode: da.trimTopRightNode ?? 'A',
    trimTopW: da.trimTopW ?? da.openingW ?? 900,
    trimTopH: da.trimTopH ?? da.wallDepth ?? 200,
    trimLeftWallNode: da.trimLeftWallNode ?? 'A',
    trimRightWallNode: da.trimRightWallNode ?? 'A',
    hasTrim: da.hasTrim ?? false,
    leftNode: ['B', 'C'].includes(da.leftNode) ? da.leftNode : 'B',
    rightNode: ['B', 'C'].includes(da.rightNode) ? da.rightNode : 'B',
  }))
}

// ─── Calculations ─────────────────────────────────────────────────────────────

const half = (n: number) => Math.round(n * 2) / 2

interface WallCalc {
  valid: boolean
  wallLengthByPanels: number   // длина по узлам (с поправками краёв и стыков)
  panelHeight: number          // высота панели целиком (все ряды)
  panelWidth: number           // ширина при авто-раскладке (поровну)
  widths: number[]             // ширина каждой панели (авто или вручную)
  widthsSum: number            // сумма ширин (в ручном режиме сверяем с длиной по узлам)
  rowHeights: number[]         // высота каждого ряда (авто поровну или вручную)
  rowHeightsSum: number
  colRows: number[][]          // [столбец][ряд] — фактическая разбивка столбца
}

const EMPTY_CALC: WallCalc = {
  valid: false, wallLengthByPanels: 0, panelHeight: 0, panelWidth: 0,
  widths: [], widthsSum: 0, rowHeights: [], rowHeightsSum: 0, colRows: [],
}

function calcWall(w: WallSeg, off: OffsetMap): WallCalc {
  if (!w.wallHeight || !w.wallLength || !w.numPanels || w.numPanels < 1) return EMPTY_CALC
  const N = w.numPanels
  const R = Math.max(1, w.numRows || 1)
  const lOff = offsetOf(off, w.leftNode)
  const rOff = offsetOf(off, w.rightNode)
  const connAdj = w.connType === 'C' ? (N - 1) * 4 : 0
  const wlbp = w.wallLength + lOff + rOff - connAdj
  const topOff = NODE_MAP.get(w.topEdge)?.heightOffset ?? 0
  const botOff = NODE_MAP.get(w.bottomEdge)?.heightOffset ?? 0
  // Зазоры 7 + 5 мм по умолчанию; их можно изменить или обнулить в карточке стены.
  const gapTop = w.gapTop ?? DEFAULT_GAP_TOP
  const gapBottom = w.gapBottom ?? DEFAULT_GAP_BOTTOM
  const ph = w.wallHeight + topOff + botOff - gapTop - gapBottom
  const pw = half(wlbp / N)

  const widths = w.widthMode === 'manual'
    ? Array.from({ length: N }, (_, i) => w.panelWidths[i] || 0)
    : Array.from({ length: N }, () => pw)
  const widthsSum = Math.round(widths.reduce((s, x) => s + x, 0) * 10) / 10

  // Ряды по высоте: соединительный профиль C съедает 4 мм на стык, как и по ширине.
  const rowAdj = w.rowConn === 'C' ? (R - 1) * 4 : 0
  const rh = half((ph - rowAdj) / R)
  const rowHeights = w.heightMode === 'manual' && R > 1
    ? Array.from({ length: R }, (_, i) => w.rowHeights[i] || 0)
    : Array.from({ length: R }, () => R === 1 ? ph : rh)
  const rowHeightsSum = Math.round(rowHeights.reduce((s, x) => s + x, 0) * 10) / 10

  // Столбец с собственной разбивкой перекрывает общую (верхний ряд-добор и т.п.)
  const colRows = widths.map((_, i) => {
    const own = w.colRowHeights?.[i]
    return own && own.length ? own.map(v => v || 0) : rowHeights
  })

  return {
    valid: true,
    wallLengthByPanels: Math.round(wlbp * 10) / 10,
    panelHeight: ph, panelWidth: pw,
    widths, widthsSum, rowHeights, rowHeightsSum, colRows,
  }
}

// Ширина/высота панели вне лимитов листа — текст предупреждения или null.
function panelLimitWarning(width: number, height: number, is3d: boolean): string | null {
  const problems: string[] = []
  if (width > LIMITS.maxW) problems.push(`ширина ${width} > ${LIMITS.maxW} мм`)
  if (height > LIMITS.maxH) problems.push(`высота ${height} > ${LIMITS.maxH} мм`)
  const minW = is3d ? LIMITS.minW3d : LIMITS.minW
  if (width > 0 && width < minW) problems.push(`ширина ${width} < ${minW} мм`)
  if (height > 0 && height < LIMITS.minH) problems.push(`высота ${height} < ${LIMITS.minH} мм`)
  return problems.length ? problems.join(', ') : null
}

function calcDoorPanelWidth(d: DoorSeg, g: DoorGeom): number {
  const node = d.leftNode
  const adj = (d.openingDir === 'НАРУЖУ' && node === 'B') ? g.wOutB
            : (d.openingDir === 'НАРУЖУ')                  ? g.wOutC
            : (node === 'B')                               ? g.wInB
            :                                                g.wInC
  return Math.round((d.openingW - adj) * 2) / 2
}

function calcDoorPanelHeight(d: DoorSeg, dtype: 'G' | 'H', g: DoorGeom): number {
  return d.ceilingH - d.openingH + (dtype === 'G' ? g.hG : g.hH)
}

function suggestPanels(w: WallSeg, off: OffsetMap, maxW = 1200): number {
  const lOff = offsetOf(off, w.leftNode)
  const rOff = offsetOf(off, w.rightNode)
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
  off: OffsetMap,
  geom: DoorGeom,
  priceMap: Record<string, number> = {},
  itemOrder?: ItemOrder,
): { panels: PanelSpec[]; profiles: ProfileSpec[] } {
  const panels: PanelSpec[] = []
  const pc: Record<string, number> = {
    '104.256': 0, '104.259': 0, '104.270': 0,
    'lamelle': 0, 'hanger': 0, 'al_decor': 0,
  }
  let totalPanels = 0

  function addEdge(code: string, mult: number) {
    const info = NODE_MAP.get(code)
    if (!info || info.ppe === 0 || info.article === null) return
    const key = info.article
    if (key in pc) pc[key] += info.ppe * mult
  }

  const addWallPanels = (w: WallSeg) => {
    const wi = walls.indexOf(w)
    const c = calcWall(w, off)
    if (!c.valid) return
    const copies = Math.max(1, w.copies)
    const N = w.numPanels
    const maxR = Math.max(...c.colRows.map(rs => rs.length), 1)
    totalPanels += c.colRows.reduce((s, rs) => s + rs.length, 0) * copies
    // Ряды сверху вниз, в ряду слева направо: схема раскладки берёт первые N
    // панелей стены как верхний ряд. Столбцы могут делиться по-разному.
    for (let r = 0; r < maxR; r++) {
      for (let i = 0; i < N; i++) {
        const colRows = c.colRows[i] ?? []
        if (r >= colRows.length) continue
        panels.push({
          panelLabel: maxR > 1 ? `${wi + 1}.${r + 1}.${i + 1}` : `${wi + 1}.${i + 1}`,
          wallName: w.name,
          height: colRows[r],
          width: c.widths[i],
          leftNode:  i === 0     ? w.leftNode  : w.connType,
          rightNode: i === N - 1 ? w.rightNode : w.connType,
          topEdge:    r === 0     ? w.topEdge    : w.rowConn,
          bottomEdge: r === colRows.length - 1 ? w.bottomEdge : w.rowConn,
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
    }
    // Профили считаем по кромкам каждой панели: у общей раскладки результат тот
    // же, но столбцы с разным числом рядов учитываются верно.
    c.colRows.forEach((colRows, i) => {
      const rn = colRows.length
      if (rn === 0) return
      addEdge(i === 0 ? w.leftNode : w.connType, copies * rn)
      addEdge(i === N - 1 ? w.rightNode : w.connType, copies * rn)
      if (rn > 1) addEdge(w.rowConn, 2 * (rn - 1) * copies)
    })
    if (w.aluminumVertical > 0 || w.aluminumHorizontal > 0) {
      const alV = Math.ceil(c.panelHeight / 2995) * w.aluminumVertical
      const alH = Math.ceil(c.panelWidth / 2995) * w.aluminumHorizontal
      pc['al_decor'] += (alV + alH) * N * copies
    }
  }

  const addDoorPanels = (d: DoorSeg) => {
    const di = doors.indexOf(d)
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
      const ph = Math.round(calcDoorPanelHeight(d, dtype, geom) * 2) / 2
      const pw = calcDoorPanelWidth(d, geom)
      panels.push({
        panelLabel: doorLabel,
        wallName: doorName + ' — Надпроёмная',
        height: ph, width: pw,
        leftNode: d.leftNode, rightNode: d.rightNode,
        topEdge: d.topEdge, bottomEdge: dtype,
        quantity: copies,
        finishGroup: d.finishGroup, finishName: d.finishName,
        veneerDirection: d.veneerDirection, decor3d: d.decor3d,
        aluminumVertical: 0, aluminumHorizontal: 0, aluminumColor: '',
        markup: 0, notes: d.notes,
      })
      totalPanels += copies
      addEdge(d.leftNode, copies)
      addEdge(d.rightNode, copies)
      // Отдельная ламель на узлы G и H не начисляется: их обработка уже
      // оплачена ценой узла (800 руб/пм), а строка ламели давала вторую
      // оплату того же. Подтверждено Виталием Габбасовым 01.09.2026.
    }

    // Панели добора обрамления (только если hasTrim)
    if (d.hasTrim === true) {
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
        leftNode: d.trimLeftWallNode || 'A', rightNode: 'O',
      })
      totalPanels += copies
      addEdge(d.trimLeftWallNode || 'A', copies)

      const rw = d.trimRightW || d.wallDepth
      const rh = d.trimRightH || d.openingH
      panels.push({
        ...trimBase,
        panelLabel: `${doorLabel}.${trimN++}`,
        wallName: `${doorName} — Правое`,
        height: rh, width: rw,
        leftNode: 'O', rightNode: d.trimRightWallNode || 'A',
      })
      totalPanels += copies
      addEdge(d.trimRightWallNode || 'A', copies)
    }
  }

  // Панели идут в порядке карточек на экране: дверной проём, вставленный
  // после «Стены 1», в спецификации стоит сразу за ней, а не в самом низу.
  const order: ItemOrder = itemOrder?.length
    ? itemOrder
    : [...walls.map(w => ({ type: 'wall' as const, id: w.id })), ...doors.map(d => ({ type: 'door' as const, id: d.id }))]
  for (const item of order) {
    if (item.type === 'wall') {
      const w = walls.find(w => w.id === item.id)
      if (w) addWallPanels(w)
    } else {
      const d = doors.find(d => d.id === item.id)
      if (d) addDoorPanels(d)
    }
  }

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
  if (pc['hanger'] > 0)   push('МДФ 10',  'Навес стеновой панели',                 900,  pc['hanger'],              '4 шт на каждую панель')
  if (pc['al_decor'] > 0) push('П 6x6',      'Алюминиевый декоративный профиль П 6×6', 2995, Math.ceil(pc['al_decor']), 'Декоративный алюминий')

  return { panels, profiles }
}

// Развёртка (вид спереди): участки идут слева направо в порядке карточек,
// углы разворачиваются в одну плоскость. Панели те же, что в спецификации.
function buildElevation(
  walls: WallSeg[], doors: DoorSeg[], itemOrder: ItemOrder,
  off: OffsetMap, geom: DoorGeom,
): ElevItem[] {
  const items: ElevItem[] = []
  // Обозначения панелей на чертеже — сквозные А1, А2, … слева направо, как в
  // чертеже развёртки Зотова А.М. («Стеновые панели, Выставка, стена 1»):
  // панель над проёмом получает свой номер в этой же последовательности.
  let drawSeq = 0
  const nextDraw = () => `А${++drawSeq}`
  const order: ItemOrder = itemOrder.length
    ? itemOrder
    : [...walls.map(w => ({ type: 'wall' as const, id: w.id })), ...doors.map(d => ({ type: 'door' as const, id: d.id }))]

  for (const item of order) {
    if (item.type === 'wall') {
      const w = walls.find(x => x.id === item.id)
      if (!w) continue
      const c = calcWall(w, off)
      if (!c.valid) continue
      const wi = walls.indexOf(w)
      const maxR = Math.max(...c.colRows.map(rs => rs.length), 1)
      const N = w.numPanels
      // Обозначения на чертеже идут в том же порядке, что и строки спецификации:
      // ряд сверху вниз, в ряду слева направо.
      const draw: string[][] = Array.from({ length: N }, () => [])
      for (let r = 0; r < maxR; r++) {
        for (let i = 0; i < N; i++) {
          if (r < (c.colRows[i]?.length ?? 0)) draw[i].push(nextDraw())
        }
      }
      items.push({
        kind: 'wall', id: w.id, name: w.name,
        wallLength: w.wallLength, wallHeight: w.wallHeight,
        lengthByNodes: c.wallLengthByPanels,
        gapTop: w.gapTop ?? DEFAULT_GAP_TOP, gapBottom: w.gapBottom ?? DEFAULT_GAP_BOTTOM,
        widths: c.widths, colRows: c.colRows,
        labels: Array.from({ length: N }, (_, i) =>
          Array.from({ length: c.colRows[i]?.length ?? 0 },
            (_, r) => maxR > 1 ? `${wi + 1}.${r + 1}.${i + 1}` : `${wi + 1}.${i + 1}`)),
        drawLabels: draw,
        leftNode: w.leftNode, rightNode: w.rightNode,
        topEdge: w.topEdge, bottomEdge: w.bottomEdge,
        connType: w.connType, rowConn: w.rowConn || 'S',
        copies: Math.max(1, w.copies),
      })
    } else {
      const d = doors.find(x => x.id === item.id)
      if (!d) continue
      const di = doors.indexOf(d)
      const inOpening = d.mountType !== 'В ПОТОЛОК'
      const dtype = inOpening ? (d.openingDir === 'НАРУЖУ' ? 'G' : 'H') : null
      items.push({
        kind: 'door', id: d.id,
        label: d.label + (d.doorRef ? ` (${d.doorRef})` : ''),
        openingW: d.openingW, openingH: d.openingH, ceilingH: d.ceilingH,
        panelLabel: `Д${di + 1}`,
        panelDrawLabel: dtype ? nextDraw() : '',
        doorLabel: d.doorRef ? `Д-${d.doorRef}` : `Дверь ${di + 1}`,
        panelW: dtype ? calcDoorPanelWidth(d, geom) : null,
        panelH: dtype ? half(calcDoorPanelHeight(d, dtype, geom)) : null,
        leftNode: d.leftNode, rightNode: d.rightNode,
        topEdge: d.topEdge, bottomEdge: dtype ?? '',
        hingeLeft: d.hingeDir !== 'СПРАВА',
        opensOut: d.openingDir === 'НАРУЖУ',
        copies: Math.max(1, d.copies),
        trim: d.hasTrim === true ? {
          label: `Д${di + 1}`,
          drawLabels: [
            inOpening ? nextDraw() : '',   // верхний добор только при монтаже в проём
            nextDraw(), nextDraw(),
          ],
          top: inOpening ? {
            w: d.trimTopW || d.openingW,
            h: d.trimTopH || d.wallDepth,
            leftNode: d.trimTopLeftNode || 'A',
            rightNode: d.trimTopRightNode || 'A',
          } : null,
          left: {
            w: d.trimLeftW || d.wallDepth,
            h: d.trimLeftH || d.openingH,
            wallNode: d.trimLeftWallNode || 'A',
          },
          right: {
            w: d.trimRightW || d.wallDepth,
            h: d.trimRightH || d.openingH,
            wallNode: d.trimRightWallNode || 'A',
          },
        } : null,
      })
    }
  }
  return items
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVeneerGroup(name: string) {
  return name.startsWith('ШПО')
}

function getJointPrice(jointTypes: JointType[], code: string): number {
  return jointTypes.find(j => j.code === code)?.price_per_meter ?? 0
}

// Нормализует имя декора для сопоставления с прайсом в БД
// ("Breeze Oak 1,5 мм" / "Noce Ondulato 1,5мм" → "breeze oak 1.5мм")
function normDecor(s: string): string {
  return s.toLowerCase().replace('ё', 'е').replace(',', '.').replace(/\s*(мм|mm)/, 'мм').replace(/\s+/g, ' ').trim()
}

// Отделка, по которой считается цена панели. Шпон: цена зависит от выбранного
// декора с толщиной (напр. «Breeze Oak 5 мм»), который лежит в группах
// ШПОН 1,5/2,5/5 ММ. Та же отделка сохраняется в панель заказа — по ней
// бэкенд считает total_cost для выгрузки в Cascate.
function findPricedFinish(finishGroups: FinishGroup[], groupName: string, finishName: string, decor3d?: string): Finish | undefined {
  if (isVeneerGroup(groupName) && decor3d) {
    const target = normDecor(decor3d)
    for (const g of finishGroups) {
      const f = (g.finishes as Finish[]).find(f => normDecor(f.name) === target)
      if (f) return f
    }
    return undefined
  }
  const g = finishGroups.find(g => g.name === groupName)
  return (g?.finishes as Finish[] | undefined)?.find(f => f.name === finishName)
}

function getFinishPrice(finishGroups: FinishGroup[], groupName: string, finishName: string, decor3d?: string): number {
  return findPricedFinish(finishGroups, groupName, finishName, decor3d)?.price_sqm ?? 0
}

function calcPanelCosts(
  p: PanelSpec,
  jointTypes: JointType[],
  finishGroups: FinishGroup[],
) {
  const lp = getJointPrice(jointTypes, p.leftNode)
  const rp = getJointPrice(jointTypes, p.rightNode)
  const tp = getJointPrice(jointTypes, p.topEdge)
  const bp = getJointPrice(jointTypes, p.bottomEdge)
  const sideCost = (lp + rp) * p.height * 0.001 * p.quantity
  const topBotCost = (tp + bp) * p.width * 0.001 * p.quantity
  // Excel: R = ЕСЛИ(AN<0,5;"0,5"; В×Ш×Кол/1000000) — минимум 0,5 кв.м
  // применяется к строке целиком (с количеством), а не к каждой панели.
  const areaSqm = Math.max(p.height * p.width / 1_000_000 * p.quantity, 0.5)
  const finishPrice = getFinishPrice(finishGroups, p.finishGroup, p.finishName, p.decor3d)
  const finishCost = finishPrice * areaSqm * (1 + p.markup / 100)
  // Алюминиевый декор П 6×6 в стоимость панели не входит — он идёт отдельной
  // строкой в спецификации профилей (как T145 и L198 в Excel-шаблоне).
  const total = sideCost + topBotCost + finishCost
  return { sideCost, topBotCost, areaSqm, finishCost, total }
}

const fmt = (n: number) => n > 0 ? n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—'

// ─── StepNav ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Стены и узлы', 'Отделки', 'Спецификация', 'Оформление']

function StepNav({ step, onStep }: { step: number; onStep: (s: number) => void }) {
  return (
    <div className="no-print" style={{
      display: 'flex', borderRadius: 10, overflow: 'hidden',
      border: '1.5px solid #e2e8f0', marginBottom: 24,
    }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const active = step === n
        const done = step > n
        return (
          <button key={n} type="button"
            onClick={() => onStep(n)}
            style={{
              flex: 1, padding: '11px 6px', border: 'none',
              borderRight: n < 4 ? '1px solid #e2e8f0' : 'none',
              cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
              background: active ? '#4c6ef5' : done ? '#eef2ff' : '#fafafa',
              color: active ? '#fff' : done ? '#4c6ef5' : '#94a3b8',
            }}
          >
            <span style={{ display: 'block', fontSize: '0.62rem', opacity: active ? 0.85 : 0.7, marginBottom: 3, fontWeight: 600, letterSpacing: '.03em' }}>
              {done ? '✓ готово' : `ШАГ ${n}`}
            </span>
            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: active ? 700 : done ? 600 : 400 }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── WallCard ─────────────────────────────────────────────────────────────────

interface WallCardProps {
  wall: WallSeg
  panels?: PanelSpec[]   // панели этой стены из спецификации — для мини-схемы
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  profileColors: ProfileColor[]
  onChange: (u: Partial<WallSeg>) => void
  onRemove: () => void
  canRemove: boolean
  phase?: 'geometry' | 'finish'
}

function WallCard({ wall, panels = [], jointTypes, finishGroups, profileColors, onChange, onRemove, canRemove, phase }: WallCardProps) {
  const wallOffsets = useMemo(() => offsetsOf(jointTypes), [jointTypes])
  const calc = calcWall(wall, wallOffsets)
  const is3d = isVeneerGroup(wall.finishGroup) && !!wall.decor3d
  const R = calc.rowHeights.length
  const limitWarnings = calc.valid
    ? [...new Set(calc.widths.flatMap((w, i) =>
        (calc.colRows[i] ?? []).map(h => panelLimitWarning(w, h, is3d))).filter(Boolean))] as string[]
    : []
  const hasColRows = (wall.colRowHeights ?? []).some(rs => rs && rs.length > 0)
  const setColRows = (i: number, rs: number[]) => {
    const arr = Array.from({ length: wall.numPanels }, (_, k) => wall.colRowHeights?.[k] ?? [])
    arr[i] = rs
    onChange({ colRowHeights: arr })
  }
  const widthDiff = Math.round((calc.widthsSum - calc.wallLengthByPanels) * 10) / 10
  const heightDiff = Math.round((calc.rowHeightsSum - calc.panelHeight) * 10) / 10
  const setWidth = (i: number, v: number) => {
    const arr = Array.from({ length: wall.numPanels }, (_, k) => wall.panelWidths[k] || 0)
    arr[i] = v
    onChange({ panelWidths: arr })
  }
  const setRowHeight = (i: number, v: number) => {
    const arr = Array.from({ length: R }, (_, k) => wall.rowHeights[k] || 0)
    arr[i] = v
    onChange({ rowHeights: arr })
  }
  // Переход в ручной режим: стартуем с авто-значений, чтобы не вводить всё с нуля.
  const toManualWidths = () => onChange({ widthMode: 'manual', panelWidths: [...calc.widths] })
  const toManualHeights = () => onChange({ heightMode: 'manual', rowHeights: [...calc.rowHeights] })
  // «Остаток в последнюю»: все панели кроме последней как введены, последняя добирает длину по узлам.
  const fillLastWidth = () => {
    const arr = Array.from({ length: wall.numPanels }, (_, k) => wall.panelWidths[k] || 0)
    const rest = arr.slice(0, -1).reduce((a, b) => a + b, 0)
    arr[arr.length - 1] = Math.max(0, half(calc.wallLengthByPanels - rest))
    onChange({ panelWidths: arr })
  }
  const fillLastHeight = () => {
    const arr = Array.from({ length: R }, (_, k) => wall.rowHeights[k] || 0)
    const rest = arr.slice(0, -1).reduce((a, b) => a + b, 0)
    const rowAdj = wall.rowConn === 'C' ? (R - 1) * 4 : 0
    arr[arr.length - 1] = Math.max(0, half(calc.panelHeight - rowAdj - rest))
    onChange({ rowHeights: arr })
  }
  const selectedGroup = finishGroups.find(g => g.name === wall.finishGroup)
  const finishes: Finish[] = (selectedGroup?.finishes as Finish[]) ?? []
  const isVeneer = isVeneerGroup(wall.finishGroup)
  // Для шпона «Отделка» — это базовые названия декоров (Breeze Oak, …)
  // Шпон: к базовым названиям декоров добавляем отделки из справочника группы.
  // Раньше список был только из декоров, и 17 отделок ШПОН, которые есть в Excel
  // (Faggio, Noce Americano, Rovere Whisky и др.), выбрать было нельзя. Обратное
  // тоже верно: «Dark Gey Lati» лежит только в группах с толщиной, поэтому берём
  // объединение, а не одну сторону.
  const finishOptions = isVeneer
    ? [...new Set([...finishes.map(f => f.name), ...SHPON_BASE_NAMES])]
    : finishes.map(f => f.name)
  const decorOptions = getDecorOptions(wall.finishName, wall.finishGroup)
  const hasDecors = decorOptions.length > 0

  return (
    <div className="card" style={{ borderLeft: '3px solid #4c6ef5' }}>
      <div className="flex justify-between flex-center" style={{ marginBottom: 12 }}>
        <input
          value={wall.name}
          onChange={e => onChange({ name: e.target.value })}
          title="Название участка стены — можно переименовать (например «Стена 1, справа от двери»)"
          style={{ fontWeight: 700, fontSize: '1rem', border: 'none', background: 'transparent', outline: 'none', padding: 0, color: '#1a1a2e', flex: 1 }}
        />
        <span className="no-print" style={{ fontSize: '.72rem', color: '#94a3b8', marginRight: 10, whiteSpace: 'nowrap' }}>
          участок стены · название можно изменить
        </span>
        {canRemove && <button className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>}
      </div>

      {/* ── Геометрия (шаг 1) ──────────────────────────────── */}
      {(!phase || phase === 'geometry') && <>
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
              <button type="button" onClick={() => onChange({ numPanels: suggestPanels(wall, wallOffsets) })}
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

        {/* Зазоры по высоте + ряды */}
        <div className="grid-4" style={{ marginBottom: 10 }}>
          <div className="field">
            <label>Зазор сверху, мм</label>
            <input type="number" min={0} value={wall.gapTop ?? DEFAULT_GAP_TOP}
              onChange={e => onChange({ gapTop: Math.max(0, +e.target.value) })} />
          </div>
          <div className="field">
            <label>Зазор снизу, мм</label>
            <input type="number" min={0} value={wall.gapBottom ?? DEFAULT_GAP_BOTTOM}
              onChange={e => onChange({ gapBottom: Math.max(0, +e.target.value) })} />
          </div>
          <div className="field">
            <label>Рядов по высоте</label>
            <input type="number" min={1} max={10} value={wall.numRows || 1}
              onChange={e => onChange({ numRows: Math.max(1, +e.target.value), heightMode: 'auto', rowHeights: [] })} />
          </div>
          <div className="field">
            <label>Стык рядов (верх/низ)</label>
            {(wall.numRows || 1) > 1 ? (
              <JointSelectCode value={wall.rowConn || 'S'} codes={ROW_CONN_CODES} jointTypes={jointTypes}
                onChange={code => onChange({ rowConn: code })}
                fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
            ) : (
              <input value="один ряд" disabled style={{ background: '#f5f5f5' }} />
            )}
          </div>
        </div>

        {/* Ширины панелей: авто поровну или вручную */}
        {calc.valid && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Ширины панелей
              </span>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="radio" checked={wall.widthMode !== 'manual'}
                  onChange={() => onChange({ widthMode: 'auto' })} />
                авто — поровну ({calc.panelWidth} мм)
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="radio" checked={wall.widthMode === 'manual'} onChange={toManualWidths} />
                вручную — разные ширины
              </label>
              {wall.widthMode === 'manual' && wall.numPanels > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={fillLastWidth}
                  title="Последняя панель добирает длину по узлам">
                  остаток → последняя
                </button>
              )}
            </div>
            {wall.widthMode === 'manual' && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {calc.widths.map((wv, i) => {
                    // Подсвечиваем панели, ширина которых отличается от авторасчёта.
                    const custom = Math.abs(wv - calc.panelWidth) > 0.05
                    return (
                      <div className="field" key={i} style={{ width: 110 }}>
                        <label style={custom ? { color: '#b45309' } : undefined}>
                          Панель {i + 1}, мм{custom ? ' •' : ''}
                        </label>
                        <input type="number" min={0} step={0.5} value={wv || ''}
                          onChange={e => setWidth(i, +e.target.value)}
                          title={custom ? `Задано вручную · авто — ${calc.panelWidth} мм` : undefined}
                          style={custom ? { borderColor: '#f59e0b', background: '#fffbeb' } : undefined} />
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: '.78rem', marginTop: 6, color: widthDiff === 0 ? '#166534' : '#b45309' }}>
                  Сумма <strong>{calc.widthsSum} мм</strong>, длина по узлам <strong>{calc.wallLengthByPanels} мм</strong>
                  {widthDiff !== 0 && <> — расхождение <strong>{widthDiff > 0 ? '+' : ''}{widthDiff} мм</strong></>}
                  {' '}· в ручном режиме поправки узлов к ширинам не применяются — вводите готовый размер панели
                </div>
              </>
            )}
          </div>
        )}

        {/* Высоты рядов: авто поровну или вручную */}
        {calc.valid && R > 1 && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Высоты рядов
              </span>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="radio" checked={wall.heightMode !== 'manual'}
                  onChange={() => onChange({ heightMode: 'auto' })} />
                авто — поровну ({calc.rowHeights[0]} мм)
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="radio" checked={wall.heightMode === 'manual'} onChange={toManualHeights} />
                вручную
              </label>
              {wall.heightMode === 'manual' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={fillLastHeight}
                  title="Нижний ряд добирает высоту панели">
                  остаток → нижний
                </button>
              )}
            </div>
            {wall.heightMode === 'manual' && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {calc.rowHeights.map((hv, i) => (
                    <div className="field" key={i} style={{ width: 130 }}>
                      <label>Ряд {i + 1} (сверху), мм</label>
                      <input type="number" min={0} step={0.5} value={hv || ''}
                        onChange={e => setRowHeight(i, +e.target.value)} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '.78rem', marginTop: 6, color: heightDiff === 0 ? '#166534' : '#b45309' }}>
                  Сумма <strong>{calc.rowHeightsSum} мм</strong>, высота панели <strong>{calc.panelHeight} мм</strong>
                  {heightDiff !== 0 && <> — расхождение <strong>{heightDiff > 0 ? '+' : ''}{heightDiff} мм</strong></>}
                </div>
              </>
            )}
          </div>
        )}

        {/* Своя разбивка столбца по рядам — как П52/П53 в СП */}
        {calc.valid && wall.numPanels > 1 && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={hasColRows}
                onChange={e => onChange({
                  colRowHeights: e.target.checked
                    ? calc.widths.map(() => [...calc.rowHeights])
                    : [],
                })} />
              <span style={{ fontWeight: 600, color: '#64748b' }}>Разбивка по столбцам</span>
              <span style={{ color: '#94a3b8' }}>— у столбца свои ряды (верхний добор и т.п.)</span>
            </label>
            {hasColRows && (
              <>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                  {calc.widths.map((wv, i) => {
                    const rs = calc.colRows[i] ?? []
                    const sum = Math.round(rs.reduce((s, v) => s + v, 0) * 10) / 10
                    return (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, background: '#fff' }}>
                        <div style={{ fontSize: '.78rem', fontWeight: 600, marginBottom: 6 }}>
                          Столбец {i + 1} · {wv} мм
                          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }}
                            onClick={() => setColRows(i, [...rs, 0])}>+ ряд</button>
                          {rs.length > 1 && (
                            <button type="button" className="btn btn-ghost btn-sm"
                              onClick={() => setColRows(i, rs.slice(0, -1))}>− ряд</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {rs.map((hv, r) => (
                            <div className="field" key={r} style={{ width: 96 }}>
                              <label>Ряд {r + 1}, мм</label>
                              <input type="number" min={0} step={0.5} value={hv || ''}
                                onChange={e => {
                                  const next = [...rs]
                                  next[r] = +e.target.value
                                  setColRows(i, next)
                                }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '.74rem', marginTop: 4, color: sum === calc.panelHeight ? '#166534' : '#b45309' }}>
                          Сумма {sum} из {calc.panelHeight} мм
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

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
      </>}

      {/* ── Отделка (шаг 2) ──────────────────────────────── */}
      {(!phase || phase === 'finish') && <>
      {/* Отделка */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Группа отделки</label>
          <StringSelect
            value={wall.finishGroup}
            options={visibleFinishGroups(finishGroups).map(g => g.name)}
            onChange={v => onChange({ finishGroup: v, finishName: '', veneerDirection: '', decor3d: '' })}
            placeholder="— выберите —"
          />
        </div>
        <div className="field">
          <label>Отделка</label>
          {finishOptions.length > 0 ? (
            <StringSelect
              value={wall.finishName}
              options={finishOptions}
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
      </>}

      {/* Результат расчёта */}
      {(!phase || phase === 'geometry') && calc.valid && (
        <>
          <div className="calc-result">
            <strong>Расчёт:</strong>{' '}
            длина по узлам <strong>{calc.wallLengthByPanels} мм</strong>
            {' '}&nbsp;|&nbsp;{' '}
            высота панели <strong>{calc.panelHeight} мм</strong>
            <span style={{ color: '#6366f1', marginLeft: 6, fontSize: '.85em' }}>
              (стена {wall.wallHeight} − зазоры {wall.gapTop ?? DEFAULT_GAP_TOP} + {wall.gapBottom ?? DEFAULT_GAP_BOTTOM})
            </span>
            {R > 1 && (
              <span style={{ color: '#6366f1', marginLeft: 10 }}>
                · {R} ряда по высоте: {calc.rowHeights.join(' / ')} мм
              </span>
            )}
            {' '}&nbsp;|&nbsp;{' '}
            {wall.widthMode === 'manual' ? (
              <>ширины <strong>{calc.widths.join(' / ')} мм</strong> (вручную)</>
            ) : (
              <>размер панели <strong>{calc.rowHeights[0]} × {calc.panelWidth} мм</strong>
                {wall.numPanels > 1 && (
                  <span style={{ color: '#6366f1', marginLeft: 10 }}>
                    ({wall.numPanels} шт. по {calc.panelWidth} мм)
                  </span>
                )}</>
            )}
          </div>
          {limitWarnings.length > 0 && (
            <div style={{ marginTop: 8, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 7, padding: '8px 12px', fontSize: '.85rem' }}>
              <strong>Вне лимитов листа:</strong> {limitWarnings.join('; ')}.
              {' '}Лист {LIMITS.maxW} × {LIMITS.maxH} мм — увеличьте число панелей или рядов по высоте.
            </div>
          )}
          {panels.length > 0 && (
            <div className="no-print" style={{ marginTop: 10, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: 2 }}>Вид сверху — узлы этого участка</div>
              <WallScheme walls={[wall]} doors={[]} panels={panels}
                itemOrder={[{ type: 'wall', id: wall.id }]} jointTypes={jointTypes} compact />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── DoorCard ─────────────────────────────────────────────────────────────────

interface DoorCardProps {
  door: DoorSeg
  series: Series
  jointTypes: JointType[]
  finishGroups: FinishGroup[]
  onChange: (u: Partial<DoorSeg>) => void
  onRemove: () => void
  phase?: 'geometry' | 'finish'
}

function DoorCard({ door, series, jointTypes, finishGroups, onChange, onRemove, phase }: DoorCardProps) {
  const doorGeom = DOOR_GEOM[series]
  const selectedGroup = finishGroups.find(g => g.name === door.finishGroup)
  const finishes: Finish[] = (selectedGroup?.finishes as Finish[]) ?? []
  const isVeneer = isVeneerGroup(door.finishGroup)
  // Для шпона «Отделка» — это базовые названия декоров (Breeze Oak, …)
  // Шпон: к базовым названиям декоров добавляем отделки из справочника группы.
  // Раньше список был только из декоров, и 17 отделок ШПОН, которые есть в Excel
  // (Faggio, Noce Americano, Rovere Whisky и др.), выбрать было нельзя. Обратное
  // тоже верно: «Dark Gey Lati» лежит только в группах с толщиной, поэтому берём
  // объединение, а не одну сторону.
  const finishOptions = isVeneer
    ? [...new Set([...finishes.map(f => f.name), ...SHPON_BASE_NAMES])]
    : finishes.map(f => f.name)
  const decorOptions = getDecorOptions(door.finishName, door.finishGroup)
  const hasDecors = decorOptions.length > 0
  const inOpening = door.mountType === 'В ПРОЕМ'
  const dtype = inOpening ? (door.openingDir === 'НАРУЖУ' ? 'G' : 'H') : null
  const panelH = dtype !== null
    ? Math.round(calcDoorPanelHeight(door, dtype, doorGeom) * 10) / 10
    : null
  const panelW = dtype !== null ? calcDoorPanelWidth(door, doorGeom) : null

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

      {/* № заказа дверного полотна — первым полем */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>№ заказа дверного полотна (DGV)</label>
        <input value={door.doorRef} placeholder="—"
          onChange={e => onChange({ doorRef: e.target.value })} />
      </div>

      {/* Размеры проёма */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Ширина проёма, мм</label>
          <input type="number" value={door.openingW || ''} min={0}
            onChange={e => { const v = +e.target.value; onChange({ openingW: v, trimTopW: v }) }} />
        </div>
        <div className="field">
          <label>Высота проёма, мм</label>
          <input type="number" value={door.openingH || ''} min={0}
            onChange={e => { const v = +e.target.value; onChange({ openingH: v, trimLeftH: v, trimRightH: v }) }} />
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

      {/* Узлы левый/правый — только B или C */}
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Узел левого края (только B/C)</label>
          <JointSelectCode value={door.leftNode} codes={DOOR_CONN_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ leftNode: code })} />
        </div>
        <div className="field">
          <label>Узел правого края (только B/C)</label>
          <JointSelectCode value={door.rightNode} codes={DOOR_CONN_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ rightNode: code })} />
        </div>
      </div>

      {/* Верхняя кромка + нижняя (авто) */}
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Верхняя кромка</label>
          <JointSelectCode value={door.topEdge} codes={EDGE_TOPBOT_CODES} jointTypes={jointTypes}
            onChange={code => onChange({ topEdge: code })} allowEmpty
            fallback={NODES.map(n => ({ code: n.code, name: n.label }))} />
        </div>
        <div className="field">
          <label>Нижняя кромка (авто по открыванию)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, background: '#f8fafc' }}>
            {dtype !== null ? (
              <>
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{dtype}</span>
                <span style={{ fontSize: 11, color: '#555' }}>{dtype === 'G' ? 'Тип G (наружу)' : 'Тип H (внутрь)'}</span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>В ПОТОЛОК — не задано</span>
            )}
          </div>
        </div>
      </div>

      {/* Расчёт панели над дверью — сразу под её узлами, до добора */}
      {dtype !== null && panelH !== null && (
        <div className="calc-result" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', marginBottom: 10 }}>
          <strong>Расчёт панели над дверью</strong>:{' '}
          <strong>{panelH} × {panelW} мм</strong>
          {' '}· нижняя кромка:{' '}
          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 3, padding: '0 5px', fontSize: '0.8rem', fontWeight: 700 }}>{dtype}</span>
          {' '}(авто)
        </div>
      )}
      {door.mountType === 'В ПОТОЛОК' && (
        <div style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 7, padding: '10px 14px', fontSize: '.87rem', marginBottom: 10 }}>
          Монтаж «В ПОТОЛОК» — панель над дверью не создаётся.
        </div>
      )}

      {/* Добор обрамления */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Добор обрамления
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            <input type="checkbox" checked={door.hasTrim === true}
              onChange={e => onChange({ hasTrim: e.target.checked })} />
            нужен
          </label>
        </div>

        {door.hasTrim === true && <>
        <div style={{ fontSize: '.8rem', color: '#64748b', lineHeight: 1.5, marginBottom: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 12px' }}>
          Размеры доборов подставляются автоматически: ширина боковых и высота верхнего = глубина стены,
          высота боковых = высота проёма, ширина верхнего = ширина проёма. Любое значение можно поправить вручную.
          <br />
          <strong>Узел к стене</strong> — узел внешнего края бокового добора, где он стыкуется со стеновой панелью
          (внутренний край к коробке всегда O — без профиля).
          {' '}<strong>Узел лев. / пр.</strong> — узлы торцов верхнего добора, где он стыкуется с левым и правым доборами.
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
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
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
            <div className="field">
              <label title="Узел внешнего края добора — стык со стеновой панелью">Узел к стене</label>
              <JointSelectCode value={door.trimLeftWallNode ?? 'A'} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
                onChange={code => onChange({ trimLeftWallNode: code })} />
            </div>
            <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>
              К коробке: <span className="badge badge-gray" style={{ fontSize: '.68rem' }}>O</span> авто
            </div>
          </div>

          {/* Правое */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Правое обрамление</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
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
            <div className="field">
              <label title="Узел внешнего края добора — стык со стеновой панелью">Узел к стене</label>
              <JointSelectCode value={door.trimRightWallNode ?? 'A'} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
                onChange={code => onChange({ trimRightWallNode: code })} />
            </div>
            <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>
              К коробке: <span className="badge badge-gray" style={{ fontSize: '.68rem' }}>O</span> авто
            </div>
          </div>

          {/* Верхнее */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Верхнее обрамление</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div className="field">
                <label title="Левый торец верхнего добора — стык с левым добором">Узел лев.</label>
                <JointSelectCode value={door.trimTopLeftNode ?? 'A'} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
                  onChange={code => onChange({ trimTopLeftNode: code })} />
              </div>
              <div className="field">
                <label title="Правый торец верхнего добора — стык с правым добором">Узел пр.</label>
                <JointSelectCode value={door.trimTopRightNode ?? 'A'} codes={EDGE_NODE_CODES} jointTypes={jointTypes}
                  onChange={code => onChange({ trimTopRightNode: code })} />
              </div>
            </div>
          </div>
        </div>
        </>}
      </div>

      {(!phase || phase === 'finish') && <>
      {/* Отделка */}
      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Группа отделки</label>
          <StringSelect
            value={door.finishGroup}
            options={visibleFinishGroups(finishGroups).map(g => g.name)}
            onChange={v => onChange({ finishGroup: v, finishName: '', veneerDirection: '', decor3d: '' })}
            placeholder="— выберите —"
          />
        </div>
        <div className="field">
          <label>Отделка</label>
          {finishOptions.length > 0 ? (
            <StringSelect
              value={door.finishName}
              options={finishOptions}
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
      </>}

    </div>
  )
}

// ─── SchemeHint ───────────────────────────────────────────────────────────────

function SchemeHint({ series }: { series: Series }) {
  const [open, setOpen] = useState(false)
  const suffix = series === '50' ? '-50' : ''

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
        <span>Схемы сборки стеновых панелей NUOVO {series} — справочные листы</span>
        <svg width="14" height="14" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: .5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <img
            src={`${import.meta.env.BASE_URL}scheme1${suffix}.png`}
            alt="Схема сборки — план раскладки"
            style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5', display: 'block' }}
          />
          <img
            src={`${import.meta.env.BASE_URL}scheme2${suffix}.png`}
            alt="Схема сборки — типы узлов"
            style={{ width: '100%', borderRadius: 10, border: '1px solid #e0e8f5', display: 'block' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── LimitsBanner ─────────────────────────────────────────────────────────────

function LimitsBanner() {
  return (
    <div className="no-print" style={{
      marginBottom: 16, padding: '10px 16px', borderRadius: 10,
      background: '#fffbeb', border: '1px solid #fde68a', color: '#78350f', fontSize: '.85rem', lineHeight: 1.55,
    }}>
      <strong>Ограничения по размерам панелей.</strong>{' '}
      Лист — не более <strong>{LIMITS.maxW} × {LIMITS.maxH} мм</strong> (ширина × высота).
      Минимальная панель <strong>{LIMITS.minW} × {LIMITS.minH} мм</strong>, шпон с 3D-фрезеровкой — <strong>{LIMITS.minW3d} × {LIMITS.minH} мм</strong>.
      Стена выше {LIMITS.maxH} мм набирается рядами по высоте, каждая часть не меньше {LIMITS.minRowH} мм (раскрой из цельного листа).
      Панель площадью меньше 0,5 кв.м считается как 0,5 кв.м.
    </div>
  )
}

// ─── LeaveGuard ───────────────────────────────────────────────────────────────

interface LeaveGuardProps {
  panelCount: number
  isEdit: boolean
  onSave: () => void
  onLeave: () => void
  onCancel: () => void
}

function LeaveGuard({ panelCount, isEdit, onSave, onLeave, onCancel }: LeaveGuardProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 460, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', padding: '26px 30px',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.12rem', color: '#1a1a2e' }}>
          {isEdit ? 'Сохранить изменения заказа?' : 'Сохранить набранное как заказ?'}
        </h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#444', lineHeight: 1.5 }}>
          В конфигураторе есть несохранённые данные{panelCount > 0 ? <> — <strong>{panelCount} панел.</strong></> : null}.
          Если уйти, они пропадут.
        </p>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: '#777', lineHeight: 1.5 }}>
          Сохранение локальное — заказ появится в разделе «Заказы» с номером,
          который вы укажете. Выгрузка в cascate.ru при этом не выполняется.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onSave}>
            {isEdit ? 'Сохранить изменения' : 'Сохранить заказ'}
          </button>
          <button className="btn btn-ghost" onClick={onLeave}>Выйти без сохранения</button>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-ghost" onClick={onCancel}>Отмена</button>
          </div>
        </div>
      </div>
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
  series: Series
  onClose: () => void
  onSaved: (orderId: number) => void
}

function SaveOrderModal({
  panels, panelCosts, profiles, walls, doors, itemOrder, wallSeq, doorSeq,
  jointTypes, finishGroups, profileColors, editOrder, series, onClose, onSaved,
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
      // Шпон с 3D-декором стоит по прайсу декора (группы ШПОН 1,5/2,5/5 ММ), а не
      // базовой отделки: иначе бэкенд (и выгрузка в Cascate) считал Walnut Flamed
      // 1,5/2,5/5 мм по одной цене гладкого шпона. Ищем ту же отделку, что и
      // getFinishPrice во фронтовом расчёте.
      const fin = findPricedFinish(finishGroups, p.finishGroup, p.finishName, p.decor3d)
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
    if (!isCascateLoggedIn()) { setError(LOGIN_REQUIRED_MSG); return }
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
        const order = await createOrder({ ...form, series, configurator_state })
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
            <label>Номер заказа</label>
            <input value={form.order_number} placeholder="2025-001" onChange={e => set('order_number', e.target.value)} disabled={saving} />
          </div>
          <div className="field">
            <label>Номер счёта</label>
            <input value={form.invoice_number} placeholder="—" onChange={e => set('invoice_number', e.target.value)} disabled={saving} />
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

const snapshotOf = (walls: WallSeg[], doors: DoorSeg[], itemOrder: ItemOrder) =>
  JSON.stringify({ walls, doors, itemOrder })

export default function Configurator({ series = '60' }: { series?: Series }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editOrderId = searchParams.get('order')

  const [walls, setWalls] = useState<WallSeg[]>([])
  const [doors, setDoors] = useState<DoorSeg[]>([])
  const [wallSeq, setWallSeq] = useState(0)
  const [doorSeq, setDoorSeq] = useState(0)
  const [itemOrder, setItemOrder] = useState<ItemOrder>([])
  const [activeStep, setActiveStep] = useState<number>(1)
  const [sameFinish, setSameFinish] = useState(false)
  // Виды спереди и сверху показываем вместе; кнопкой включаются разрезы дверей.
  const [showSections, setShowSections] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)
  // Слепок набранного на момент последнего сохранения/загрузки заказа —
  // по нему понимаем, есть ли несохранённые изменения.
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [pendingSave, setPendingSave] = useState(false)

  const [jointTypes, setJointTypes] = useState<JointType[]>([])
  const [finishGroups, setFinishGroups] = useState<FinishGroup[]>([])
  const [aluminumProfiles, setAluminumProfiles] = useState<AluminumProfile[]>([])
  const [profileColors, setProfileColors] = useState<ProfileColor[]>([])

  useEffect(() => {
    document.title = `NUOVO ${series} — Конфигуратор стеновых панелей`
    fetchJointTypes(series).then(setJointTypes).catch(() => {})
    fetchFinishGroups(series).then(setFinishGroups).catch(() => {})
    fetchAluminumProfiles().then(setAluminumProfiles).catch(() => {})
    fetchProfileColors().then(setProfileColors).catch(() => {})
  }, [series])

  // Загружаем заказ для редактирования при ?order=ID
  useEffect(() => {
    if (!editOrderId) return
    setLoadingOrder(true)
    fetchOrder(Number(editOrderId)).then(order => {
      setEditOrder(order)
      const cs = order.configurator_state
      if (cs?.walls?.length || cs?.doors?.length) {
        // Синхронизируем _seq чтобы новые ID не коллидировали
        for (const item of [...(cs.walls ?? []), ...(cs.doors ?? [])]) {
          const n = parseInt((item?.id ?? '').replace('id', ''))
          if (!isNaN(n) && n > _seq) _seq = n
        }
        // Заказ мог быть сохранён прежней версией конфигуратора — дополняем
        // недостающие поля дефолтами, иначе схема и формы падают на undefined.
        const walls = migrateWalls(cs.walls)
        const doors = migrateDoors(cs.doors)
        const io = cs.itemOrder?.length ? cs.itemOrder : [
          ...walls.map(w => ({ type: 'wall' as const, id: w.id })),
          ...doors.map(d => ({ type: 'door' as const, id: d.id })),
        ]
        setWalls(walls)
        setDoors(doors)
        setItemOrder(io)
        setWallSeq(cs.wallSeq ?? walls.length)
        setDoorSeq(cs.doorSeq ?? doors.length)
        setSavedSnapshot(snapshotOf(walls, doors, io))
      }
      setLoadingOrder(false)
    }).catch(() => setLoadingOrder(false))
  }, [editOrderId])

  // ── Несохранённое: предупреждаем при уходе из раздела ──
  const snapshot = useMemo(
    () => snapshotOf(walls, doors, itemOrder), [walls, doors, itemOrder],
  )
  const hasItems = walls.length > 0 || doors.length > 0
  const unsaved = hasItems && snapshot !== savedSnapshot

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsaved && currentLocation.pathname !== nextLocation.pathname,
  )

  // Закрытие вкладки / перезагрузка — штатное предупреждение браузера
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of aluminumProfiles) m[p.article] = p.price_per_piece
    return m
  }, [aluminumProfiles])

  const jointOffsets = useMemo(() => offsetsOf(jointTypes), [jointTypes])
  const doorGeom = DOOR_GEOM[series]
  const spec = useMemo(
    () => buildSpec(walls, doors, jointOffsets, doorGeom, priceMap, itemOrder),
    [walls, doors, jointOffsets, doorGeom, priceMap, itemOrder],
  )

  const elevation = useMemo(
    () => buildElevation(walls, doors, itemOrder, jointOffsets, doorGeom),
    [walls, doors, itemOrder, jointOffsets, doorGeom],
  )

  const totalPanels = spec.panels.reduce((s, p) => s + p.quantity, 0)
  const totalAreaSqm = spec.panels.reduce(
    (s, p) => s + Math.max(p.height * p.width / 1_000_000 * p.quantity, 0.5), 0,
  )

  const panelCosts = useMemo(
    () => spec.panels.map(p => calcPanelCosts(p, jointTypes, finishGroups)),
    [spec.panels, jointTypes, finishGroups],
  )

  const panelsWithCosts = useMemo(
    () => spec.panels.map((p, i) => ({ ...p, ...panelCosts[i] })),
    [spec.panels, panelCosts],
  )

  const grandTotal = panelCosts.reduce((s, c) => s + c.total, 0)
  const profilesTotal = spec.profiles.reduce((s, p) => s + p.total_cost, 0)

  const addWall = () => {
    const n = wallSeq + 1; setWallSeq(n)
    const w = makeWall(n)
    // Стена после дверного проёма — продолжение той же стены, а не «Стена 2»:
    // «Стена 1 — за проёмом». В спецификации такие панели попадают под тот же
    // заголовок «СТЕНА 1» (заголовок берётся до « — »).
    const last = itemOrder[itemOrder.length - 1]
    if (last?.type === 'door') {
      const prevWallItem = [...itemOrder].reverse().find(i => i.type === 'wall')
      const prevWall = prevWallItem ? walls.find(x => x.id === prevWallItem.id) : undefined
      if (prevWall) {
        const base = prevWall.name.split(' — ')[0]
        const k = walls.filter(x => x.name.split(' — ')[0] === base).length
        w.name = `${base} — за проёмом${k > 1 ? ` ${k}` : ''}`
        w.wallHeight = prevWall.wallHeight
        w.gapTop = prevWall.gapTop
        w.gapBottom = prevWall.gapBottom
      }
    }
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

  // Галочка «Отделка как на 1-й панели»: отделка первого участка раскладки
  // копируется на все остальные и держится синхронной, пока галочка стоит.
  const firstFinish = (() => {
    const first = itemOrder[0]
    if (!first) return null
    const src = first.type === 'wall'
      ? walls.find(w => w.id === first.id)
      : doors.find(d => d.id === first.id)
    if (!src) return null
    const { finishGroup, finishName, veneerDirection, decor3d } = src
    return { finishGroup, finishName, veneerDirection, decor3d }
  })()

  useEffect(() => {
    if (!sameFinish || !firstFinish) return
    const firstId = itemOrder[0]?.id
    const same = (x: { finishGroup: string; finishName: string; veneerDirection: string; decor3d: string }) =>
      x.finishGroup === firstFinish.finishGroup && x.finishName === firstFinish.finishName &&
      x.veneerDirection === firstFinish.veneerDirection && x.decor3d === firstFinish.decor3d
    setWalls(prev => prev.some(w => w.id !== firstId && !same(w))
      ? prev.map(w => w.id === firstId ? w : { ...w, ...firstFinish }) : prev)
    setDoors(prev => prev.some(d => d.id !== firstId && !same(d))
      ? prev.map(d => d.id === firstId ? d : { ...d, ...firstFinish }) : prev)
  }, [sameFinish, firstFinish?.finishGroup, firstFinish?.finishName,
      firstFinish?.veneerDirection, firstFinish?.decor3d, itemOrder])

  const copySpec = () => {
    let text = `СПЕЦИФИКАЦИЯ СТЕНОВЫХ ПАНЕЛЕЙ NUOVO ${series}\n\n`
    text += '№\tНаименование\tВыс, мм\tУзел лев.\tШир, мм\tУзел пр.\tКол-во\tСт-ть узлов выс.\tУзел верх\tУзел низ\tСт-ть узлов в/н\tГруппа\tОтделка\tНапр. шпона\tДекор 3D\tАл↕\tАл↔\tЦвет ал.\tКв.м\tНаценка\tИтог\tПримечание\n'
    spec.panels.forEach((p, i) => {
      const c = panelCosts[i]
      text += `${p.panelLabel}\t${p.wallName}\t${p.height}\t${p.leftNode}\t${p.width}\t${p.rightNode}\t${p.quantity}\t${Math.round(c.sideCost)}\t${p.topEdge || '—'}\t${p.bottomEdge || '—'}\t${Math.round(c.topBotCost)}\t${p.finishGroup}\t${p.finishName || '—'}\t${p.veneerDirection || '—'}\t${p.decor3d || '—'}\t${p.aluminumVertical || '—'}\t${p.aluminumHorizontal || '—'}\t${p.aluminumColor || '—'}\t${c.areaSqm.toFixed(2)}\t${p.markup}%\t${Math.round(c.total)}\t${p.notes || '—'}\n`
    })
    const byFinish = groupByFinish(panelsWithCosts)
    if (byFinish.length > 1) {
      text += '\nРАЗБИВКА ПО ОТДЕЛКАМ\n'
      text += 'Группа\tОтделка\tДекор 3D\tКол-во, шт\tКв.м\tСумма\n'
      for (const g of byFinish) {
        text += `${g.finishGroup || '—'}\t${g.finishName || '—'}\t${g.decor3d || '—'}\t${g.quantity}\t${g.areaSqm.toFixed(2)}\t${Math.round(g.total)}\n`
      }
    }
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  return (
    <div>
      {blocker.state === 'blocked' && !showSaveModal && (
        <LeaveGuard
          panelCount={totalPanels}
          isEdit={!!editOrder}
          onSave={() => { setPendingSave(true); setShowSaveModal(true) }}
          onLeave={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
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
          series={series}
          onClose={() => { setShowSaveModal(false); setPendingSave(false) }}
          onSaved={id => {
            setSavedSnapshot(snapshot)
            setShowSaveModal(false)
            // Сохраняли из-за ухода из раздела — продолжаем прерванный переход,
            // иначе как раньше открываем сохранённый заказ.
            if (pendingSave && blocker.state === 'blocked') {
              setPendingSave(false)
              blocker.proceed()
            } else {
              navigate(`/orders/${id}`)
            }
          }}
        />
      )}
      <div className="page">
        <div className="container">
          <h1 className="page-title no-print">Конфигуратор стеновых панелей — NUOVO {series}</h1>

          <StepNav step={activeStep} onStep={setActiveStep} />

          {/* ── Шаг 1: Стены и узлы ── */}
          {activeStep === 1 && (
            <>
              <SchemeHint series={series} />
              <LimitsBanner />
              <div className="flex gap-2 no-print" style={{ marginBottom: 20 }}>
                <button className="btn btn-primary" onClick={addWall} title="Участок стены: панели в один ряд между узлами. Стена с дверью посередине = участок + проём + участок">+ Добавить стену</button>
                <button className="btn btn-ghost" onClick={addDoor}>+ Дверной проём</button>
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-primary" onClick={() => setActiveStep(2)}>
                    Далее: Отделки →
                  </button>
                </div>
              </div>

              {itemOrder.map(item => {
                if (item.type === 'wall') {
                  const w = walls.find(w => w.id === item.id)
                  if (!w) return null
                  return (
                    <WallCard key={w.id} wall={w} jointTypes={jointTypes} finishGroups={finishGroups} profileColors={profileColors}
                      panels={spec.panels.filter(p => p.wallName === w.name)}
                      onChange={u => updateWall(w.id, u)}
                      onRemove={() => removeWall(w.id)}
                      canRemove={walls.length > 1}
                      phase="geometry" />
                  )
                } else {
                  const d = doors.find(d => d.id === item.id)
                  if (!d) return null
                  return (
                    <DoorCard key={d.id} door={d} series={series} jointTypes={jointTypes} finishGroups={finishGroups}
                      onChange={u => updateDoor(d.id, u)}
                      onRemove={() => removeDoor(d.id)}
                      phase="geometry" />
                  )
                }
              })}

              <div className="no-print" style={{ textAlign: 'right', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setActiveStep(2)}>
                  Далее: Отделки →
                </button>
              </div>

              {spec.panels.length > 0 && (
                <div className="card" style={{ marginTop: 24 }}>
                  <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                    <h2 style={{ margin: 0 }}>Раскладка</h2>
                    <button type="button"
                      className={`btn btn-sm no-print ${showSections ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ marginLeft: 'auto' }}
                      onClick={() => setShowSections(v => !v)}>Разрез</button>
                  </div>

                  <h3 className="spec-section-title">Вид спереди</h3>
                  <div style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 12 }}>
                    Развёртка стены: участки слева направо, углы развёрнуты в плоскость.
                    Жёлтым — зазоры сверху и снизу и доборы проёма, зелёным — панель над проёмом.
                  </div>
                  <WallElevation items={elevation} jointTypes={jointTypes} sections={showSections} />

                  <h3 className="spec-section-title" style={{ marginTop: 22 }}>Вид сверху</h3>
                  <div style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 12 }}>
                    План: повороты на угловых узлах D (наружный) и DG/DH (внутренний).
                  </div>
                  <WallScheme walls={walls} doors={doors} panels={spec.panels} itemOrder={itemOrder} jointTypes={jointTypes} />

                  <h3 className="spec-section-title" style={{ marginTop: 22 }}>
                    Панели и типы кромок
                  </h3>
                  <div style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 10 }}>
                    Кромки по кругу от верха по часовой стрелке: А — верх, В — правая, С — низ, D — левая.
                    Обозначения панелей сквозные слева направо, как в чертеже развёртки.
                  </div>
                  <ElevationTable items={elevation} />
                </div>
              )}
            </>
          )}

          {/* ── Шаг 2: Отделки ── */}
          {activeStep === 2 && (
            <>
              <div className="flex gap-2 no-print" style={{ marginBottom: 20 }}>
                <button className="btn btn-ghost" onClick={() => setActiveStep(1)}>← Назад</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sameFinish} onChange={e => setSameFinish(e.target.checked)} />
                  Отделка как на 1-й панели
                </label>
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-primary" onClick={() => setActiveStep(3)}>
                    Далее: Спецификация →
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
                      canRemove={walls.length > 1}
                      phase="finish" />
                  )
                } else {
                  const d = doors.find(d => d.id === item.id)
                  if (!d) return null
                  return (
                    <DoorCard key={d.id} door={d} series={series} jointTypes={jointTypes} finishGroups={finishGroups}
                      onChange={u => updateDoor(d.id, u)}
                      onRemove={() => removeDoor(d.id)}
                      phase="finish" />
                  )
                }
              })}

              <div className="no-print" style={{ textAlign: 'right', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setActiveStep(3)}>
                  Далее: Спецификация →
                </button>
              </div>
            </>
          )}

          {/* ── Шаг 3 / 4: Спецификация + Оформление ── */}
          {(activeStep === 3 || activeStep === 4) && (
            <div className="no-print flex gap-2" style={{ marginBottom: 20 }}>
              <button className="btn btn-ghost" onClick={() => setActiveStep(activeStep === 4 ? 3 : 2)}>← Назад</button>
              {activeStep === 3 && (
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-primary" onClick={() => setActiveStep(4)}>
                    Далее: Оформление →
                  </button>
                </div>
              )}
              {activeStep === 4 && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {editOrder && (
                    <span style={{ fontSize: 13, color: '#555' }}>
                      Редактирование: <strong>{editOrder.order_number || `Заказ #${editOrder.id}`}</strong>
                    </span>
                  )}
                  <button className="btn btn-primary" onClick={() => setShowSaveModal(true)} disabled={loadingOrder}>
                    {loadingOrder ? 'Загрузка...' : editOrder ? 'Обновить заказ' : 'Сохранить заказ'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Спецификация (шаги 3 и 4) ── */}
          {activeStep >= 3 && <div className="card print-landscape" style={{ marginTop: 24 }}>
            <div className="flex justify-between flex-center no-print" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Спецификация</h2>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={copySpec}>
                  {copied ? '✓ Скопировано' : 'Копировать'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={printSpec}>Печать</button>
              </div>
            </div>

            {/* Шапка бланка Cascate — печатается первой на листе */}
            <div className="print-only print-header">
              <img src="/logo-footer.png" alt="Cascate Porte e mobile" className="print-header-logo" />
              <div className="print-header-fields">
                <div>
                  <div className="ph-value">{editOrder?.customer_name || ' '}</div>
                  <div className="ph-label">ФИО / ЗАКАЗЧИК</div>
                </div>
                <div>
                  <div className="ph-value">{editOrder?.agent_name || ' '}</div>
                  <div className="ph-label">АГЕНТ</div>
                </div>
                <div>
                  <div className="ph-value">{editOrder?.city || ' '}</div>
                  <div className="ph-label">ГОРОД</div>
                </div>
                <div>
                  <div className="ph-value">&nbsp;</div>
                  <div className="ph-label">ПОДПИСЬ ЗАКАЗЧИКА</div>
                </div>
                <div>
                  <div className="ph-value">&nbsp;</div>
                  <div className="ph-label">ПОДПИСЬ АГЕНТА</div>
                </div>
                <div>
                  <div className="ph-value">{editOrder?.order_date || ' '}</div>
                  <div className="ph-label">ДАТА ПРИНЯТИЯ ЗАКАЗА</div>
                </div>
                <div>
                  <div className="ph-value">{editOrder?.order_number || ' '}</div>
                  <div className="ph-label">НОМЕР ЗАКАЗА</div>
                </div>
              </div>
              <div className="print-header-order">
                <div><span className="ph-chip">№ заказа:</span> {editOrder?.order_number || '—'}</div>
                <div className="ph-cp">{editOrder?.counterparty || ''}</div>
              </div>
            </div>

            <div className="print-only" style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 700 }}>
              СПЕЦИФИКАЦИЯ СТЕНОВЫХ ПАНЕЛЕЙ NUOVO {series}
            </div>

            {spec.panels.length > 0 && (
              <div className="print-only" style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Раскладка спереди</div>
                <WallElevation items={elevation} jointTypes={jointTypes} />
                <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>Панели и типы кромок</div>
                <ElevationTable items={elevation} />
                <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>Схема раскладки — вид сверху</div>
                <WallScheme walls={walls} doors={doors} panels={spec.panels} itemOrder={itemOrder} jointTypes={jointTypes} />
              </div>
            )}

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

                <div className="table-wrap spec-table" style={{ marginBottom: 22 }}>
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
                      {(() => {
                        let lastBase = ''
                        return spec.panels.flatMap((p, i) => {
                          const baseName = p.wallName.split(' — ')[0]
                          const isDoor = p.panelLabel.startsWith('Д')
                          const c = panelCosts[i]
                          const dataRow = (
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
                          if (baseName !== lastBase) {
                            lastBase = baseName
                            return [
                              <tr key={`hdr-${i}`}>
                                <td colSpan={22} style={{
                                  background: isDoor ? '#f0fdf4' : '#eff6ff',
                                  color: isDoor ? '#166534' : '#1e40af',
                                  fontWeight: 700, fontSize: '0.82rem',
                                  padding: '7px 12px', letterSpacing: '.04em',
                                  borderTop: i > 0 ? `2px solid ${isDoor ? '#bbf7d0' : '#bfdbfe'}` : undefined,
                                }}>
                                  {baseName.toUpperCase()}
                                </td>
                              </tr>,
                              dataRow,
                            ]
                          }
                          return [dataRow]
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Разбивка по отделкам */}
                <FinishBreakdown panels={panelsWithCosts} />

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
                    ИТОГО ВСЕГО: <span className="price">{(grandTotal + profilesTotal).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
                  </div>
                )}
              </>
            )}
          </div>}

        </div>
      </div>
    </div>
  )
}
