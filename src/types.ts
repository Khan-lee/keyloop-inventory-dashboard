// Mirrors the schemas in docs/openapi.yaml.
import type { AgeBand } from './domain/aging'

export type { AgeBand }

export interface Dealership {
  id: string
  name: string
  city: string
}

export interface Vehicle {
  id: string
  dealershipId: string
  vin: string
  make: string
  model: string
  year: number
  mileage: number
  price: number
  /** Date the vehicle arrived at the dealership, `YYYY-MM-DD`. */
  stockedAt: string
}

export const ACTION_STATUSES = {
  PRICE_REDUCTION_PLANNED: 'Price reduction planned',
  PROMOTION_PLANNED: 'Promotion planned',
  TRANSFER_REQUESTED: 'Transfer requested',
  SENT_TO_AUCTION: 'Sent to auction',
  UNDER_REVIEW: 'Under review',
  SOLD: 'Sold',
} as const
export type ActionStatus = keyof typeof ACTION_STATUSES

export interface VehicleAction {
  id: string
  vehicleId: string
  status: ActionStatus
  note: string
  author: string
  createdAt: string
}

export interface NewVehicleAction {
  status: ActionStatus
  note?: string
  author: string
}

export interface VehicleView extends Vehicle {
  daysInStock: number | null
  isAging: boolean
  ageBand: AgeBand | null
  dataIssue: boolean
  latestAction: VehicleAction | null
  suggestedAction: string | null
}

export interface VehicleQuery {
  make?: string
  model?: string
  ageBand?: AgeBand
  agingOnly?: boolean
  q?: string
  page?: number
  pageSize?: number
}

export interface VehiclePage {
  items: VehicleView[]
  page: number
  pageSize: number
  total: number
  facets: { makes: string[]; models: string[] }
}

export interface InventorySummary {
  total: number
  aging: number
  agingRate: number
  agingWithoutAction: number
  dataIssues: number
  bands: Record<AgeBand, number>
}
