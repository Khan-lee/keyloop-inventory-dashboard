export const AGING_THRESHOLD_DAYS = 90

export const AGE_BANDS = ['0-30', '31-60', '61-90', '90+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

const DAY_MS = 86_400_000

/** Parses a strict `YYYY-MM-DD` date to UTC midnight epoch ms, or null. */
function parseDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(y, mo - 1, d)
  const back = new Date(ms)
  // Date.UTC rolls 2026-02-30 over to March; reject anything that does not round-trip.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return ms
}

/** Whole days between stocking and `today` (both `YYYY-MM-DD`). Null when invalid or in the future. */
export function daysInStock(stockedAt: string, today: string): number | null {
  const start = parseDate(stockedAt)
  const end = parseDate(today)
  if (start === null || end === null || start > end) return null
  return (end - start) / DAY_MS
}

export function isAging(days: number | null): boolean {
  return days !== null && days > AGING_THRESHOLD_DAYS
}

export function ageBand(days: number | null): AgeBand | null {
  if (days === null) return null
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export function suggestAction(days: number | null): string | null {
  if (days === null || !isAging(days)) return null
  if (days <= 120) return 'Consider a price reduction'
  if (days <= 180) return 'Promote or transfer to another dealership'
  return 'Send to auction'
}

/** Today's date as `YYYY-MM-DD` in UTC. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
