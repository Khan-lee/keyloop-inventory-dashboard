import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { enrich } from '../domain/query'
import type { Vehicle, VehicleAction } from '../types'
import VehicleTable from './VehicleTable.vue'

const TODAY = '2026-10-26'
const base: Vehicle = { id: 'a', dealershipId: 'd1', vin: 'WF0AAAAAAAAAAAAA1', make: 'Ford', model: 'Puma', year: 2023, mileage: 12345, price: 21450, stockedAt: '2026-10-01' }
const history: VehicleAction[] = [
  { id: 'h1', vehicleId: 'b', status: 'PRICE_REDUCTION_PLANNED', note: '', author: 'Sam', createdAt: '2026-10-20T10:00:00Z' },
]
const fresh = enrich(base, [], TODAY)
const agingWithAction = enrich({ ...base, id: 'b', stockedAt: '2026-06-01' }, history, TODAY)
const agingNoAction = enrich({ ...base, id: 'c', stockedAt: '2026-03-01' }, [], TODAY)
const broken = enrich({ ...base, id: 'd', stockedAt: '2026-02-30' }, [], TODAY)

const rowOf = (wrapper: ReturnType<typeof mount>, id: string) => wrapper.get(`[data-vehicle-id="${id}"]`)

describe('VehicleTable', () => {
  const wrapper = mount(VehicleTable, { props: { items: [agingNoAction, agingWithAction, fresh, broken] } })

  it('marks aging rows with a text badge, not colour alone', () => {
    expect(rowOf(wrapper, 'c').text()).toContain('Aging')
    expect(rowOf(wrapper, 'a').text()).not.toContain('Aging')
  })

  it('shows days in stock', () => {
    expect(rowOf(wrapper, 'a').text()).toContain('25 days')
  })

  it('shows the latest action, or a prompt when an aging vehicle has none', () => {
    expect(rowOf(wrapper, 'b').text()).toContain('Price reduction planned')
    expect(rowOf(wrapper, 'c').text()).toContain('No action yet')
  })

  it('shows the suggested next step for aging stock', () => {
    expect(rowOf(wrapper, 'c').text()).toContain('Send to auction')
  })

  it('flags vehicles with an invalid stock date', () => {
    expect(rowOf(wrapper, 'd').text()).toContain('Data issue')
  })

  it('offers the action log only for aging vehicles', () => {
    expect(rowOf(wrapper, 'c').find('button').exists()).toBe(true)
    expect(rowOf(wrapper, 'a').find('button').exists()).toBe(false)
  })

  it('emits open with the vehicle when the action button is clicked', async () => {
    await rowOf(wrapper, 'c').get('button').trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([agingNoAction])
  })
})
