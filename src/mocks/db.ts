import type { Vehicle, VehicleAction } from '../types'
import { DEALERSHIPS, seed } from './seed'

export const STORAGE_KEY = 'keyloop-inventory-db-v1'

interface State {
  vehicles: Vehicle[]
  actions: VehicleAction[]
}

/**
 * The mock backend's "database": seeded vehicles plus an append-only action log,
 * kept in localStorage so logged actions survive a reload.
 * ponytail: whole-document read/write per change; fine for a few hundred rows, a real backend owns this.
 */
export function createDb(storage: Storage, today: string) {
  let state: State
  try {
    const raw = storage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as State) : null
    state = parsed && Array.isArray(parsed.vehicles) && Array.isArray(parsed.actions) ? parsed : seed(today)
  } catch {
    state = seed(today)
  }

  const save = () => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private mode or quota exceeded: keep working in memory for this session.
    }
  }
  save()

  return {
    dealerships: () => DEALERSHIPS,
    vehicles: (dealershipId: string) => state.vehicles.filter((v) => v.dealershipId === dealershipId),
    vehicle: (id: string) => state.vehicles.find((v) => v.id === id),
    actions: () => state.actions,
    addAction(action: VehicleAction) {
      state.actions.push(action)
      save()
    },
  }
}

export type Db = ReturnType<typeof createDb>
