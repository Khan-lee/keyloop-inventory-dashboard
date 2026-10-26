import { beforeEach, describe, expect, it } from 'vitest'
import { daysInStock, isAging } from '../domain/aging'
import { STORAGE_KEY, createDb } from './db'

const TODAY = '2026-10-26'

beforeEach(() => localStorage.clear())

describe('mock db', () => {
  it('seeds three dealerships with deterministic stock', () => {
    const a = createDb(localStorage, TODAY)
    localStorage.clear()
    const b = createDb(localStorage, TODAY)
    expect(a.dealerships()).toHaveLength(3)
    expect(a.vehicles('d1').length).toBeGreaterThan(40)
    expect(a.vehicles('d1')).toEqual(b.vehicles('d1'))
  })

  it('seeds actions only on valid aging vehicles', () => {
    const db = createDb(localStorage, TODAY)
    for (const a of db.actions()) {
      expect(isAging(daysInStock(db.vehicle(a.vehicleId)!.stockedAt, TODAY))).toBe(true)
    }
  })

  it('persists appended actions across a reload', () => {
    const db = createDb(localStorage, TODAY)
    const vehicleId = db.vehicles('d1')[0].id
    db.addAction({ id: 'x1', vehicleId, status: 'UNDER_REVIEW', note: 'check', author: 'Sam', createdAt: '2026-10-26T10:00:00Z' })

    const reloaded = createDb(localStorage, TODAY)
    expect(reloaded.actions().filter((a) => a.id === 'x1')).toHaveLength(1)
  })

  it('keeps every action as history instead of overwriting', () => {
    const db = createDb(localStorage, TODAY)
    const before = db.actions().length
    const vehicleId = db.vehicles('d1')[0].id
    db.addAction({ id: 'a', vehicleId, status: 'UNDER_REVIEW', note: '', author: 'Sam', createdAt: '2026-10-26T10:00:00Z' })
    db.addAction({ id: 'b', vehicleId, status: 'SOLD', note: '', author: 'Sam', createdAt: '2026-10-26T11:00:00Z' })
    expect(db.actions().length).toBe(before + 2)
  })

  it('reseeds instead of crashing when stored data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(createDb(localStorage, TODAY).dealerships()).toHaveLength(3)
  })

  it('still works in memory when storage throws (private mode, quota)', () => {
    const broken = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    } as unknown as Storage
    const db = createDb(broken, TODAY)
    const vehicleId = db.vehicles('d1')[0].id
    db.addAction({ id: 'm', vehicleId, status: 'UNDER_REVIEW', note: '', author: 'Sam', createdAt: '2026-10-26T10:00:00Z' })
    expect(db.actions().some((a) => a.id === 'm')).toBe(true)
  })
})
