// ─────────────────────────────────────────────────────────────────────────────
// Обрамление проёма (Cascate Porte) — типы, справочник (из БД) и формулы.
// Данные приходят с API GET /api/framing/config/ (сид — panels/framing_seed.json,
// источник правды — Excel «Обрамление_проема_КАЛЬКУЛЯТОР_v3.xlsx»).
// Цены редактируются в Django-админке.
// ─────────────────────────────────────────────────────────────────────────────

export interface FramingModel {
  name: string
  subtitle: string
  nH: number; nL: number; dH: number; dL: number
  depth_mode: 'luna' | 'cas' | 'fixed'
  depth_delta: number
  profile_count: number
  has_glass: boolean
  price_category: string   // mini | passo | triangle | default
}

export interface FramingDobor { group: string; name: string; price: number }
export interface FramingDoborGroup {
  name: string; is_dobor: boolean; is_glass: boolean; glass_price_per_m: number
}

// Ответ API как есть
export interface FramingConfig {
  models: FramingModel[]
  colors: { name: string }[]
  profile_prices: Record<string, number>
  dobor_groups: FramingDoborGroup[]
  dobors: FramingDobor[]
}

// Производный, удобный для расчёта справочник
export interface FramingCatalog {
  models: FramingModel[]
  colors: string[]
  profilePrices: Record<string, number>
  groups: FramingDoborGroup[]
  dobors: FramingDobor[]            // все отделки (добор + вставки)
  doborItems: FramingDobor[]        // только доборы (is_dobor группы), для выбора добора
  doborGroupNames: string[]         // названия групп-доборов
  glassGroupNames: string[]         // названия групп-вставок
}

export function buildCatalog(cfg: FramingConfig): FramingCatalog {
  const groupByName = new Map(cfg.dobor_groups.map(g => [g.name, g]))
  const doborGroupNames = cfg.dobor_groups.filter(g => g.is_dobor).map(g => g.name)
  const glassGroupNames = cfg.dobor_groups.filter(g => g.is_glass).map(g => g.name)
  const doborItems = cfg.dobors.filter(d => groupByName.get(d.group)?.is_dobor)
  return {
    models: cfg.models,
    colors: cfg.colors.map(c => c.name),
    profilePrices: cfg.profile_prices,
    groups: cfg.dobor_groups,
    dobors: cfg.dobors,
    doborItems,
    doborGroupNames,
    glassGroupNames,
  }
}

// Схемы сборки (2 картинки на модель) — статические файлы в /public/schemes
export const SCHEMES: Record<string, [string, string]> = {
  'Luna': ['/schemes/Luna-1.jpg', '/schemes/Luna-2.jpg'],
  'Luna-Glass': ['/schemes/Luna-Glass-1.jpg', '/schemes/Luna-Glass-2.jpg'],
  'Dune': ['/schemes/Dune-1.jpg', '/schemes/Dune-2.jpg'],
  'Cascade': ['/schemes/Cascade-1.jpg', '/schemes/Cascade-2.jpg'],
  'MINI': ['/schemes/MINI-1.jpg', '/schemes/MINI-2.jpg'],
  'TRIANGLE': ['/schemes/TRIANGLE-1.jpg', '/schemes/TRIANGLE-2.jpg'],
  'PASSO': ['/schemes/PASSO-1.jpg', '/schemes/PASSO-2.jpg'],
  'PORTALE': ['/schemes/PORTALE-1.jpg', '/schemes/PORTALE-2.jpg'],
  'TERZO': ['/schemes/TERZO-1.jpg', '/schemes/TERZO-2.jpg'],
  'WAVE': ['/schemes/WAVE-1.jpg', '/schemes/WAVE-2.jpg'],
  'DORA': ['/schemes/DORA-1.jpg', '/schemes/DORA-2.jpg'],
  'BAMBOO': ['/schemes/BAMBOO-1.jpg', '/schemes/BAMBOO-2.jpg'],
}

// ─── Расчёт ──────────────────────────────────────────────────────────────────

export type KitType = 'both' | 'nal' | 'dob'
export type InstType = 'с двух сторон' | 'с одной стороны'

export interface FramingState {
  mi: number         // индекс модели в cat.models
  H: number; L: number; C: number
  inst: InstType
  ci: number         // индекс цвета в cat.colors
  di: number         // индекс добора в cat.doborItems
  kit: KitType
  glassGroup: string // группа вставки ('' = без вставки)
  glassInsert: string
  glassColor: string
}

export const defaultState = (): FramingState => ({
  mi: 0, H: 2000, L: 900, C: 200, inst: 'с двух сторон', ci: 0, di: 0, kit: 'both',
  glassGroup: '', glassInsert: '', glassColor: '',
})

// Глубина добора в зависимости от модели и установки
export function getDepth(m: FramingModel, C: number, inst: InstType): number {
  if (m.depth_mode === 'luna') return inst === 'с двух сторон' ? C + 10 : C + 5
  if (m.depth_mode === 'cas') return C
  return C + m.depth_delta
}

// Цена профиля наличника за 3000 мм по категории модели
export function getPpu(m: FramingModel, cat: FramingCatalog): number {
  return cat.profilePrices[m.price_category] ?? cat.profilePrices['default'] ?? 0
}

// Цена вставки, руб/м: из группы, «без вставки» → 360
export function glassPrice(group: string, cat: FramingCatalog): number {
  if (!group) return 360
  return cat.groups.find(g => g.name === group)?.glass_price_per_m ?? 620
}

// Опции вставки для выбранной группы (по названиям отделок этой группы)
export function glassInsertOptions(group: string, cat: FramingCatalog): string[] {
  if (!group) return []
  return cat.dobors.filter(d => d.group === group).map(d => d.name)
}

export interface SpecRow {
  nm: string; dm: string; qt: number | string; pr: number; cl?: 'glass' | 'sur'
}

export interface SpecResult {
  rows: SpecRow[]; total: number; dep: number; warn: string | null
}

export function computeSpec(st: FramingState, cat: FramingCatalog): SpecResult {
  const m = cat.models[st.mi]
  if (!m) return { rows: [], total: 0, dep: 0, warn: null }
  const { H, L, C } = st
  const qv = st.inst === 'с двух сторон' ? 4 : 2
  const qh = st.inst === 'с двух сторон' ? 2 : 1
  const nV = Math.round(H + m.nH), nH2 = Math.round(L + m.nL)
  const dV = Math.round(H + m.dH), dH2 = Math.round(L + m.dL)
  const dep = getDepth(m, C, st.inst)
  const showNal = st.kit !== 'dob', showDob = st.kit !== 'nal'
  const pN = getPpu(m, cat)
  const dob = cat.doborItems[st.di]
  const pD = dob ? dob.price : 0

  const rNV = showNal ? Math.round(pN * nV / 1000 * qv) : 0
  const rNH = showNal ? Math.round(pN * nH2 / 1000 * qh) : 0
  const rDV = showDob ? Math.round(pD * dV * dep / 1e6 * 2) : 0
  const rDH = showDob ? Math.round(pD * dH2 * dep / 1e6) : 0
  const sur = (showDob && dep > 500) ? Math.round((rDV + rDH) * 0.15) : 0

  const hasGlass = m.has_glass && showNal
  const gV = hasGlass ? Math.round(H + 43) : 0
  const gH2 = hasGlass ? Math.round(L - 46) : 0
  const pG = glassPrice(st.glassGroup, cat)
  const rGV = hasGlass ? Math.round(pG * gV / 1000 * qv) : 0
  const rGH = hasGlass ? Math.round(pG * gH2 / 1000 * qh) : 0

  const total = rNV + rNH + rDV + rDH + sur + rGV + rGH

  const cN = cat.colors[st.ci] || '—'
  const dN = dob ? dob.name : '—'
  const rows: SpecRow[] = []
  if (showNal) {
    rows.push({ nm: `Наличник вертикальный, ${m.name} · ${cN}`, dm: `${nV} мм`, qt: qv, pr: rNV })
    rows.push({ nm: `Наличник горизонтальный, ${m.name} · ${cN}`, dm: `${nH2} мм`, qt: qh, pr: rNH })
  }
  if (hasGlass) {
    const glassName = [st.glassGroup || '—', st.glassInsert, st.glassColor.trim()]
      .filter(Boolean).join(' · ')
    rows.push({ nm: `Вставка наличника верт., ${glassName}`, dm: `${gV} мм`, qt: qv, pr: rGV, cl: 'glass' })
    rows.push({ nm: `Вставка наличника гориз., ${glassName}`, dm: `${gH2} мм`, qt: qh, pr: rGH, cl: 'glass' })
  }
  if (showDob) {
    rows.push({ nm: `Добор вертикальный, ${dN}`, dm: `${dV}×${Math.round(dep)} мм`, qt: 2, pr: rDV })
    rows.push({ nm: `Добор горизонтальный, ${dN}`, dm: `${dH2}×${Math.round(dep)} мм`, qt: 1, pr: rDH })
  }
  if (sur > 0) {
    rows.push({ nm: 'Надбавка: нестандартная ширина добора +15%', dm: '—', qt: '—', pr: sur, cl: 'sur' })
  }

  let warn: string | null = null
  if (dep > 750 || H + m.dH > 3000 || L + m.dL > 3000) {
    warn = 'Невозможные размеры добора — проверьте параметры проёма.'
  }
  return { rows, total, dep, warn }
}
