import { describe, expect, it } from 'vitest'
import type { Vehicle, VehicleAction } from '../types'
import { enrich, queryVehicles, summarize } from './query'

const TODAY = '2026-10-26'

function vehicle(id: string, make: string, model: string, stockedAt: string): Vehicle {
  return { id, dealershipId: 'd1', vin: `VIN${id}`, make, model, year: 2024, mileage: 1000, price: 20000, stockedAt }
}

function action(vehicleId: string, createdAt: string, status: VehicleAction['status'] = 'UNDER_REVIEW'): VehicleAction {
  return { id: `${vehicleId}-${createdAt}`, vehicleId, status, note: '', author: 'Sam', createdAt }
}

const fleet = [
  vehicle('1', 'Ford', 'Focus', '2026-10-20'), // 6 days
  vehicle('2', 'Ford', 'Puma', '2026-07-28'), // 90 days
  vehicle('3', 'BMW', 'X1', '2026-07-27'), // 91 days
  vehicle('4', 'BMW', '320i', '2026-01-01'), // 298 days
  vehicle('5', 'Kia', 'Ceed', 'bad-date'),
]
const views = fleet.map((v) => enrich(v, [], TODAY))

describe('enrich', () => {
  it('adds the computed aging fields', () => {
    expect(views[2]).toMatchObject({
      daysInStock: 91,
      isAging: true,
      ageBand: '90+',
      dataIssue: false,
      latestAction: null,
      suggestedAction: 'Consider a price reduction',
    })
  })

  it('flags an invalid stock date as a data issue, not aging', () => {
    expect(views[4]).toMatchObject({ daysInStock: null, isAging: false, ageBand: null, dataIssue: true })
  })

  it('uses the most recent action for this vehicle as latestAction', () => {
    const history = [
      action('3', '2026-10-01T09:00:00Z', 'UNDER_REVIEW'),
      action('3', '2026-10-05T09:00:00Z', 'PRICE_REDUCTION_PLANNED'),
      action('4', '2026-10-09T09:00:00Z', 'SOLD'),
    ]
    expect(enrich(fleet[2], history, TODAY).latestAction?.status).toBe('PRICE_REDUCTION_PLANNED')
  })
})

describe('queryVehicles', () => {
  const ids = (q: Parameters<typeof queryVehicles>[1]) => queryVehicles(views, q).items.map((v) => v.id)

  it('sorts oldest stock first and puts unknown ages last', () => {
    expect(ids({})).toEqual(['4', '3', '2', '1', '5'])
  })

  it('filters by make, case-insensitively', () => {
    expect(ids({ make: 'ford' })).toEqual(['2', '1'])
  })

  it('filters by model', () => {
    expect(ids({ make: 'BMW', model: 'X1' })).toEqual(['3'])
  })

  it('filters by age band', () => {
    expect(ids({ ageBand: '61-90' })).toEqual(['2'])
    expect(ids({ ageBand: '90+' })).toEqual(['4', '3'])
  })

  it('returns only aging stock when agingOnly is set', () => {
    expect(ids({ agingOnly: true })).toEqual(['4', '3'])
  })

  it('searches VIN and model text', () => {
    expect(ids({ q: 'puma' })).toEqual(['2'])
    expect(ids({ q: 'vin4' })).toEqual(['4'])
  })

  it('combines filters', () => {
    expect(ids({ make: 'Ford', agingOnly: true })).toEqual([])
  })

  it('pages results and reports the filtered total', () => {
    const page = queryVehicles(views, { page: 2, pageSize: 2 })
    expect(page.items.map((v) => v.id)).toEqual(['2', '1'])
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 5 })
  })

  it('clamps out-of-range page and pageSize values', () => {
    expect(queryVehicles(views, { page: 0, pageSize: 1000 })).toMatchObject({ page: 1, pageSize: 100 })
    expect(queryVehicles(views, { page: -3, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 1 })
  })

  it('lists all makes, and models only for the selected make', () => {
    expect(queryVehicles(views, {}).facets.makes).toEqual(['BMW', 'Ford', 'Kia'])
    expect(queryVehicles(views, { make: 'Ford' }).facets.models).toEqual(['Focus', 'Puma'])
  })
})

describe('summarize', () => {
  it('counts totals, aging stock and age bands', () => {
    expect(summarize(views)).toEqual({
      total: 5,
      aging: 2,
      agingRate: 0.4,
      agingWithoutAction: 2,
      dataIssues: 1,
      bands: { '0-30': 1, '31-60': 0, '61-90': 1, '90+': 2 },
    })
  })

  it('does not count aging vehicles that already have an action', () => {
    const withAction = fleet.map((v) => enrich(v, [action('4', '2026-10-09T09:00:00Z')], TODAY))
    expect(summarize(withAction).agingWithoutAction).toBe(1)
  })

  it('returns a zero rate for an empty dealership', () => {
    expect(summarize([]).agingRate).toBe(0)
  })
})
