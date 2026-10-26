// Contract tests: the mock backend must behave as docs/openapi.yaml describes.
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { daysInStock, isAging, todayIso } from '../domain/aging'
import { createDb, type Db } from './db'
import { createHandlers } from './handlers'

const BASE = 'http://localhost/api'
let db: Db
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  localStorage.clear()
  db = createDb(localStorage, todayIso())
  server.resetHandlers(...createHandlers(db, { latencyMs: 0 }))
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const post = (vehicleId: string, body: unknown) =>
  fetch(`${BASE}/vehicles/${vehicleId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const days = (stockedAt: string) => daysInStock(stockedAt, todayIso())
const agingVehicle = () => db.vehicles('d1').find((v) => isAging(days(v.stockedAt)))!
const freshVehicle = () => db.vehicles('d1').find((v) => days(v.stockedAt) !== null && !isAging(days(v.stockedAt)))!

describe('GET /dealerships', () => {
  it('lists dealerships', async () => {
    const body = await (await fetch(`${BASE}/dealerships`)).json()
    expect(body.map((d: { id: string }) => d.id)).toEqual(['d1', 'd2', 'd3'])
  })
})

describe('GET /dealerships/:id/vehicles', () => {
  it('returns a page with filters applied on the server', async () => {
    const res = await fetch(`${BASE}/dealerships/d1/vehicles?agingOnly=true&pageSize=5`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.items.length).toBeLessThanOrEqual(5)
    expect(body.items.every((v: { isAging: boolean }) => v.isAging)).toBe(true)
    expect(body.total).toBeGreaterThan(5)
  })

  it('404s for an unknown dealership', async () => {
    expect((await fetch(`${BASE}/dealerships/nope/vehicles`)).status).toBe(404)
  })

  it('400s for an unknown age band', async () => {
    expect((await fetch(`${BASE}/dealerships/d1/vehicles?ageBand=old`)).status).toBe(400)
  })
})

describe('GET /dealerships/:id/summary', () => {
  it('returns KPI counts', async () => {
    const body = await (await fetch(`${BASE}/dealerships/d1/summary`)).json()
    expect(body.total).toBe(db.vehicles('d1').length)
    expect(body.aging).toBeGreaterThan(0)
  })
})

describe('POST /vehicles/:id/actions', () => {
  it('appends an action and returns it with 201', async () => {
    const v = agingVehicle()
    const res = await post(v.id, { status: 'PRICE_REDUCTION_PLANNED', note: ' -5% ', author: ' Sam ' })
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({ vehicleId: v.id, status: 'PRICE_REDUCTION_PLANNED', note: '-5%', author: 'Sam' })

    const history = await (await fetch(`${BASE}/vehicles/${v.id}/actions`)).json()
    expect(history[0].id).toBe(created.id)
  })

  it('returns history newest first', async () => {
    const v = agingVehicle()
    await post(v.id, { status: 'UNDER_REVIEW', author: 'Sam' })
    await post(v.id, { status: 'SOLD', author: 'Sam' })
    const history = await (await fetch(`${BASE}/vehicles/${v.id}/actions`)).json()
    expect(history.map((a: { status: string }) => a.status).slice(0, 2)).toEqual(['SOLD', 'UNDER_REVIEW'])
  })

  it.each([
    [{ status: 'MADE_UP', author: 'Sam' }, 'unknown status'],
    [{ status: 'SOLD', author: '   ' }, 'blank author'],
    [{ status: 'SOLD', author: 'Sam', note: 'x'.repeat(501) }, 'note too long'],
    ['not an object', 'wrong body type'],
  ])('rejects %j with 422 (%s)', async (body) => {
    const res = await post(agingVehicle().id, body)
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects actions on vehicles that are not aging', async () => {
    const res = await post(freshVehicle().id, { status: 'SOLD', author: 'Sam' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('NOT_AGING')
  })

  it('404s for an unknown vehicle', async () => {
    expect((await post('nope', { status: 'SOLD', author: 'Sam' })).status).toBe(404)
  })
})

describe('fault injection', () => {
  it('returns 500 for every endpoint in error mode', async () => {
    server.resetHandlers(...createHandlers(db, { latencyMs: 0, mode: 'error' }))
    expect((await fetch(`${BASE}/dealerships`)).status).toBe(500)
  })
})
