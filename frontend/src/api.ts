import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000/api/' })

export interface JointType {
  id: number
  code: string
  name: string
  offset_mm: number
  price_per_meter: number
  profile_article: string
  profile_count: number
  image_url: string | null
}

export interface Finish {
  id: number
  name: string
  price_sqm: number
  decor_name?: string
}

export interface FinishGroup {
  id: number
  name: string
  sort_order: number
  finishes: Finish[]
}

export interface ProfileColor {
  id: number
  name: string
}

export interface AluminumProfile {
  id: number
  article: string
  name: string
  length_mm: number
  price_per_piece: number
  joint_type_code: string
  count_per_joint: number
  note: string
}

export interface Panel {
  id?: number
  order?: number
  position: number
  wall_number: string
  quantity: number
  height_mm: number
  width_mm: number
  joint_left: number | null
  joint_left_code?: string
  joint_right: number | null
  joint_right_code?: string
  joint_top: number | null
  joint_top_code?: string
  joint_bottom: number | null
  joint_bottom_code?: string
  finish_group: number | null
  finish_group_name?: string
  finish: number | null
  finish_name?: string
  veneer_direction: string
  decor_name: string
  aluminum_vertical_count: number
  aluminum_horizontal_count: number
  aluminum_color: number | null
  aluminum_color_name?: string
  markup_percent: number
  notes: string
  area_sqm?: number
  finish_cost?: number
  joint_side_cost?: number
  joint_top_bottom_cost?: number
  total_cost?: number
}

export interface DoorPanel {
  id?: number
  order?: number
  position: number
  wall_number: string
  door_order_number: string
  opening_width: number
  opening_height: number
  ceiling_height: number
  mount_type: 'ceiling' | 'opening'
  opening_direction: 'in' | 'out'
  joint_top_left: number | null
  joint_top_right: number | null
  joint_bottom: number | null
  edge_left: number | null
  edge_right: number | null
  edge_top: number | null
  edge_bottom: number | null
  quantity: number
  panel_height: number
  panel_width: number
  finish_group: number | null
  finish_group_name?: string
  finish: number | null
  finish_name?: string
  veneer_direction: string
  decor_name: string
  markup_percent: number
  notes: string
  area_sqm?: number
  edge_side_cost?: number
  edge_top_bottom_cost?: number
  finish_cost?: number
  total_cost?: number
}

export interface Order {
  id?: number
  customer_name: string
  agent_name: string
  counterparty: string
  order_number: string
  invoice_number: string
  order_date: string | null
  city: string
  notes: string
  configurator_state?: any
  panels?: Panel[]
  door_panels?: DoorPanel[]
  total_panels_cost?: number
  total_door_panels_cost?: number
  total_cost?: number
}

export interface WallCalcResult {
  wall_length: number
  total_panel_length: number
  panel_count: number
  panel_width: number
  joint_left: string
  joint_right: string
}

export interface OrderSummary {
  order_id: number
  customer_name: string
  order_number: string
  panels_count: number
  panels_total: number
  door_panels_total: number
  profiles: {
    article: string
    name: string
    length_mm: number
    quantity: number
    price_per_piece: number
    total_cost: number
    note: string
  }[]
  profiles_total: number
  grand_total: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const fetchJointTypes = () =>
  api.get<JointType[]>('joint-types/').then(r => r.data)

export const uploadJointImage = (id: number, file: File) => {
  const form = new FormData()
  form.append('image', file)
  return api.post<JointType>(`joint-types/${id}/upload-image/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const deleteJointImage = (id: number) =>
  api.delete<{ ok: boolean }>(`joint-types/${id}/delete-image/`).then(r => r.data)

export const fetchFinishGroups = () =>
  api.get<FinishGroup[]>('finish-groups/').then(r => r.data)

export const fetchProfileColors = () =>
  api.get<ProfileColor[]>('profile-colors/').then(r => r.data)

export const fetchAluminumProfiles = () =>
  api.get<AluminumProfile[]>('aluminum-profiles/').then(r => r.data)

export const fetchOrders = () =>
  api.get<Order[]>('orders/').then(r => r.data)

export const fetchOrder = (id: number) =>
  api.get<Order>(`orders/${id}/`).then(r => r.data)

export const createOrder = (data: Partial<Order>) =>
  api.post<Order>('orders/', data).then(r => r.data)

export const updateOrder = (id: number, data: Partial<Order>) =>
  api.patch<Order>(`orders/${id}/`, data).then(r => r.data)

export const deleteOrder = (id: number) =>
  api.delete(`orders/${id}/`)

export const createPanel = (data: Partial<Panel>) =>
  api.post<Panel>('panels/', data).then(r => r.data)

export const updatePanel = (id: number, data: Partial<Panel>) =>
  api.patch<Panel>(`panels/${id}/`, data).then(r => r.data)

export const deletePanel = (id: number) =>
  api.delete(`panels/${id}/`)

export const createDoorPanel = (data: Partial<DoorPanel>) =>
  api.post<DoorPanel>('door-panels/', data).then(r => r.data)

export const updateDoorPanel = (id: number, data: Partial<DoorPanel>) =>
  api.patch<DoorPanel>(`door-panels/${id}/`, data).then(r => r.data)

export const deleteDoorPanel = (id: number) =>
  api.delete(`door-panels/${id}/`)

export const calculateWall = (data: {
  wall_length: number
  panel_count: number
  joint_left_code: string
  joint_right_code: string
  connection_type_code: string
}) => api.post<WallCalcResult>('orders/calculate_wall/', data).then(r => r.data)

export const fetchOrderSummary = (id: number) =>
  api.get<OrderSummary>(`orders/${id}/summary/`).then(r => r.data)

export const importExcel = (orderId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ panels_imported: number; order_updated: boolean }>(
    `orders/${orderId}/import_excel/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ).then(r => r.data)
}
