import type { InventorySummary, Vehicle, VehicleAction, VehiclePage, VehicleQuery, VehicleView } from '../types'
import { AGE_BANDS, ageBand, daysInStock, isAging, suggestAction } from './aging'

export const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

/** Adds the server-computed fields. `actions` may hold other vehicles' entries. */
export function enrich(vehicle: Vehicle, actions: VehicleAction[], today: string): VehicleView {
  const days = daysInStock(vehicle.stockedAt, today)
  let latestAction: VehicleAction | null = null
  for (const a of actions) {
    if (a.vehicleId === vehicle.id && (!latestAction || a.createdAt > latestAction.createdAt)) latestAction = a
  }
  return {
    ...vehicle,
    daysInStock: days,
    isAging: isAging(days),
    ageBand: ageBand(days),
    dataIssue: days === null,
    latestAction,
    suggestedAction: suggestAction(days),
  }
}

const sameText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b))

export function queryVehicles(views: VehicleView[], query: VehicleQuery): VehiclePage {
  const { make, model, ageBand: band, agingOnly, q } = query
  const needle = q?.trim().toLowerCase()
  const items = views
    .filter(
      (v) =>
        (!make || sameText(v.make, make)) &&
        (!model || sameText(v.model, model)) &&
        (!band || v.ageBand === band) &&
        (!agingOnly || v.isAging) &&
        (!needle || v.vin.toLowerCase().includes(needle) || v.model.toLowerCase().includes(needle)),
    )
    // Oldest stock first; unknown ages (data issues) last; id keeps paging stable.
    .sort((a, b) => (b.daysInStock ?? -1) - (a.daysInStock ?? -1) || a.id.localeCompare(b.id))

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)))
  const page = Math.max(1, Math.trunc(query.page ?? 1))
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
    facets: {
      makes: uniqueSorted(views.map((v) => v.make)),
      models: uniqueSorted(views.filter((v) => !make || sameText(v.make, make)).map((v) => v.model)),
    },
  }
}

export function summarize(views: VehicleView[]): InventorySummary {
  const bands = Object.fromEntries(AGE_BANDS.map((b) => [b, 0])) as InventorySummary['bands']
  let aging = 0
  let agingWithoutAction = 0
  let dataIssues = 0
  for (const v of views) {
    if (v.ageBand) bands[v.ageBand]++
    if (v.dataIssue) dataIssues++
    if (v.isAging) {
      aging++
      if (!v.latestAction) agingWithoutAction++
    }
  }
  return {
    total: views.length,
    aging,
    agingRate: views.length ? aging / views.length : 0,
    agingWithoutAction,
    dataIssues,
    bands,
  }
}
