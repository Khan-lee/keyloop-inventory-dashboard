import { daysInStock, isAging } from '../domain/aging'
import type { Dealership, Vehicle, VehicleAction } from '../types'

/** Small seeded PRNG (mulberry32) so every fresh install sees the same stock. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATALOG: Record<string, string[]> = {
  Ford: ['Fiesta', 'Focus', 'Puma', 'Kuga'],
  Volkswagen: ['Polo', 'Golf', 'Tiguan'],
  BMW: ['1 Series', '3 Series', 'X1'],
  Toyota: ['Yaris', 'Corolla', 'RAV4'],
  Kia: ['Ceed', 'Niro', 'Sportage'],
  Nissan: ['Juke', 'Qashqai'],
}
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'

export const DEALERSHIPS: Dealership[] = [
  { id: 'd1', name: 'Northgate Motors', city: 'Manchester' },
  { id: 'd2', name: 'Riverside Auto', city: 'Leeds' },
  { id: 'd3', name: 'Harbour Cars', city: 'Bristol' },
]

function shiftDays(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Stock dates are relative to `today`, so the demo always has fresh and aging vehicles. */
export function seed(today: string): { vehicles: Vehicle[]; actions: VehicleAction[] } {
  const rand = rng(20261026)
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const vehicles: Vehicle[] = []

  DEALERSHIPS.forEach((dealer, di) => {
    const count = 48 + di * 12
    for (let i = 0; i < count; i++) {
      const make = pick(Object.keys(CATALOG))
      // ~30% aging stock (91-260 days), the rest 0-90 days.
      const age = rand() < 0.3 ? 91 + Math.floor(rand() * 170) : Math.floor(rand() * 91)
      vehicles.push({
        id: `${dealer.id}-v${String(i + 1).padStart(3, '0')}`,
        dealershipId: dealer.id,
        vin: Array.from({ length: 17 }, () => pick([...VIN_CHARS])).join(''),
        make,
        model: pick(CATALOG[make]),
        year: 2019 + Math.floor(rand() * 8),
        mileage: Math.round(rand() * 60_000),
        price: 12_000 + Math.round((rand() * 36_000) / 50) * 50,
        stockedAt: shiftDays(today, age),
      })
    }
  })

  // Two data-quality problems, shown as "Data issue" instead of breaking the page.
  vehicles[3].stockedAt = shiftDays(today, -5)
  vehicles[7].stockedAt = '2026-02-30'

  const agingIn = (dealerId: string) =>
    vehicles.filter((v) => v.dealershipId === dealerId && isAging(daysInStock(v.stockedAt, today)))
  const [first, second] = agingIn('d1')
  const actions: VehicleAction[] = [
    { id: 'seed-1', vehicleId: first.id, status: 'UNDER_REVIEW', note: 'Checking market price', author: 'Alex Morgan', createdAt: `${shiftDays(today, 6)}T09:15:00.000Z` },
    { id: 'seed-2', vehicleId: first.id, status: 'PRICE_REDUCTION_PLANNED', note: 'Drop by 5% this weekend', author: 'Alex Morgan', createdAt: `${shiftDays(today, 2)}T14:40:00.000Z` },
    { id: 'seed-3', vehicleId: second.id, status: 'PROMOTION_PLANNED', note: 'Feature in the monthly newsletter', author: 'Priya Shah', createdAt: `${shiftDays(today, 3)}T11:05:00.000Z` },
  ]
  return { vehicles, actions }
}
