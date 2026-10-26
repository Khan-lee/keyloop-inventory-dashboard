import { describe, expect, it } from 'vitest'
import { ageBand, daysInStock, isAging, suggestAction } from './aging'

const TODAY = '2026-10-26'

describe('daysInStock', () => {
  it('is 0 for a vehicle stocked today', () => {
    expect(daysInStock('2026-10-26', TODAY)).toBe(0)
  })

  it('counts whole calendar days', () => {
    expect(daysInStock('2026-10-25', TODAY)).toBe(1)
    expect(daysInStock('2026-07-28', TODAY)).toBe(90)
    expect(daysInStock('2026-07-27', TODAY)).toBe(91)
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(daysInStock('2023-12-31', '2024-01-01')).toBe(1)
    expect(daysInStock('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('is not shifted by a daylight-saving change', () => {
    // EU clocks go back on 2026-10-25; a naive local-time diff gives 0.958 days
    expect(daysInStock('2026-10-24', '2026-10-25')).toBe(1)
  })

  it('returns null for a date in the future', () => {
    expect(daysInStock('2026-10-27', TODAY)).toBeNull()
  })

  it.each(['', 'not-a-date', '2026-13-01', '2026-02-30', '26-10-2026', '2026-10-26T10:00:00Z'])(
    'returns null for invalid date %j',
    (value) => {
      expect(daysInStock(value, TODAY)).toBeNull()
    },
  )
})

describe('isAging', () => {
  it('treats day 90 as not aging and day 91 as aging', () => {
    expect(isAging(90)).toBe(false)
    expect(isAging(91)).toBe(true)
  })

  it('is false when days are unknown', () => {
    expect(isAging(null)).toBe(false)
  })
})

describe('ageBand', () => {
  it.each([
    [0, '0-30'],
    [30, '0-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '90+'],
    [400, '90+'],
  ] as const)('puts %i days in band %s', (days, band) => {
    expect(ageBand(days)).toBe(band)
  })

  it('is null when days are unknown', () => {
    expect(ageBand(null)).toBeNull()
  })
})

describe('suggestAction', () => {
  it('suggests nothing for stock that is not aging', () => {
    expect(suggestAction(90)).toBeNull()
    expect(suggestAction(null)).toBeNull()
  })

  it('escalates with age', () => {
    expect(suggestAction(91)).toBe('Consider a price reduction')
    expect(suggestAction(120)).toBe('Consider a price reduction')
    expect(suggestAction(121)).toBe('Promote or transfer to another dealership')
    expect(suggestAction(180)).toBe('Promote or transfer to another dealership')
    expect(suggestAction(181)).toBe('Send to auction')
  })
})
