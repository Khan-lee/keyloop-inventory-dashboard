import { log } from '../observability/logger'
import type {
  Dealership,
  InventorySummary,
  NewVehicleAction,
  VehicleAction,
  VehiclePage,
  VehicleQuery,
} from '../types'

const BASE_URL = '/api'
const TIMEOUT_MS = 10_000

/** The only error type the UI has to handle. `status` 0 = network failure or timeout. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestId = crypto.randomUUID()
  const method = init.method ?? 'GET'
  const started = performance.now()
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout

  let res: Response
  try {
    res = await fetch(BASE_URL + path, {
      ...init,
      signal,
      headers: { 'content-type': 'application/json', 'x-request-id': requestId, ...init.headers },
    })
  } catch (err) {
    if (init.signal?.aborted) throw err // superseded by a newer request: not a failure
    const timedOut = timeout.aborted
    log('error', 'api.request', { requestId, method, path, status: 0, error: timedOut ? 'timeout' : 'network' })
    throw new ApiError(
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK',
      timedOut ? 'The server took too long to respond.' : 'Could not reach the server. Check your connection.',
    )
  }

  const body = await res.json().catch(() => null)
  const durationMs = Math.round(performance.now() - started)
  log(res.ok ? 'info' : 'warn', 'api.request', { requestId, method, path, status: res.status, durationMs })
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? `Request failed (${res.status}).`)
  }
  return body as T
}

function toSearch(query: VehicleQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== false) params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const api = {
  dealerships: () => request<Dealership[]>('/dealerships'),
  vehicles: (dealershipId: string, query: VehicleQuery, signal?: AbortSignal) =>
    request<VehiclePage>(`/dealerships/${encodeURIComponent(dealershipId)}/vehicles${toSearch(query)}`, { signal }),
  summary: (dealershipId: string, signal?: AbortSignal) =>
    request<InventorySummary>(`/dealerships/${encodeURIComponent(dealershipId)}/summary`, { signal }),
  actions: (vehicleId: string) => request<VehicleAction[]>(`/vehicles/${encodeURIComponent(vehicleId)}/actions`),
  createAction: (vehicleId: string, input: NewVehicleAction) =>
    request<VehicleAction>(`/vehicles/${encodeURIComponent(vehicleId)}/actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
