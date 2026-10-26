import { delay, http, HttpResponse } from 'msw'
import { AGE_BANDS, todayIso, type AgeBand } from '../domain/aging'
import { enrich, queryVehicles, summarize } from '../domain/query'
import { ACTION_STATUSES, type ActionStatus, type VehicleAction } from '../types'
import type { Db } from './db'

export type MockMode = 'error' | 'slow' | null

interface Options {
  /** Simulated network latency; 0 in tests. */
  latencyMs?: number
  /** `error` = every call fails with 500, `slow` = 2.5 s latency. */
  mode?: MockMode
}

const fail = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status })

/** REST handlers implementing docs/openapi.yaml on top of the mock db. */
export function createHandlers(db: Db, { latencyMs = 250, mode = null }: Options = {}) {
  const views = (dealershipId: string) => {
    const actions = db.actions()
    const today = todayIso()
    return db.vehicles(dealershipId).map((v) => enrich(v, actions, today))
  }
  const knownDealer = (id: string) => db.dealerships().some((d) => d.id === id)

  return [
    // Runs first for every API call: latency + fault injection, then falls through.
    http.all('*/api/*', async () => {
      const ms = mode === 'slow' ? 2500 : latencyMs
      if (ms) await delay(ms)
      if (mode === 'error') return fail(500, 'INTERNAL', 'Simulated server error')
    }),

    http.get('*/api/dealerships', () => HttpResponse.json(db.dealerships())),

    http.get('*/api/dealerships/:id/vehicles', ({ params, request }) => {
      const id = params.id as string
      if (!knownDealer(id)) return fail(404, 'NOT_FOUND', `Dealership ${id} not found`)
      const sp = new URL(request.url).searchParams
      const band = sp.get('ageBand')
      if (band && !AGE_BANDS.includes(band as AgeBand)) return fail(400, 'BAD_REQUEST', `Unknown ageBand ${band}`)
      return HttpResponse.json(
        queryVehicles(views(id), {
          make: sp.get('make') ?? undefined,
          model: sp.get('model') ?? undefined,
          ageBand: (band as AgeBand) ?? undefined,
          agingOnly: sp.get('agingOnly') === 'true',
          q: sp.get('q') ?? undefined,
          page: Number(sp.get('page') ?? 1) || 1,
          pageSize: Number(sp.get('pageSize') ?? 25) || 25,
        }),
      )
    }),

    http.get('*/api/dealerships/:id/summary', ({ params }) => {
      const id = params.id as string
      if (!knownDealer(id)) return fail(404, 'NOT_FOUND', `Dealership ${id} not found`)
      return HttpResponse.json(summarize(views(id)))
    }),

    http.get('*/api/vehicles/:id/actions', ({ params }) => {
      const id = params.id as string
      if (!db.vehicle(id)) return fail(404, 'NOT_FOUND', `Vehicle ${id} not found`)
      const history = db
        .actions()
        .filter((a) => a.vehicleId === id)
        .reverse() // log is append-only, so equal timestamps keep newest-first after the stable sort
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return HttpResponse.json(history)
    }),

    http.post('*/api/vehicles/:id/actions', async ({ params, request }) => {
      const id = params.id as string
      const vehicle = db.vehicle(id)
      if (!vehicle) return fail(404, 'NOT_FOUND', `Vehicle ${id} not found`)

      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
      const status = body?.status
      const author = typeof body?.author === 'string' ? body.author.trim() : ''
      const note = typeof body?.note === 'string' ? body.note.trim() : ''
      if (typeof body !== 'object' || body === null) return fail(422, 'VALIDATION_ERROR', 'Body must be a JSON object')
      if (typeof status !== 'string' || !(status in ACTION_STATUSES))
        return fail(422, 'VALIDATION_ERROR', 'status must be one of ' + Object.keys(ACTION_STATUSES).join(', '))
      if (!author || author.length > 80) return fail(422, 'VALIDATION_ERROR', 'author is required (max 80 characters)')
      if (note.length > 500) return fail(422, 'VALIDATION_ERROR', 'note must be at most 500 characters')
      if (!enrich(vehicle, [], todayIso()).isAging)
        return fail(422, 'NOT_AGING', 'Actions can only be logged for aging stock (over 90 days)')

      const action: VehicleAction = {
        id: crypto.randomUUID(),
        vehicleId: id,
        status: status as ActionStatus,
        note,
        author,
        createdAt: new Date().toISOString(),
      }
      db.addAction(action)
      return HttpResponse.json(action, { status: 201 })
    }),
  ]
}
