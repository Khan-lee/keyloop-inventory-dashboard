// Uses the real mock backend (MSW handlers + db) rather than stubbing the API client.
import { flushPromises, mount } from '@vue/test-utils'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { todayIso } from '../domain/aging'
import { enrich } from '../domain/query'
import { createDb, type Db } from '../mocks/db'
import { createHandlers } from '../mocks/handlers'
import ActionPanel from './ActionPanel.vue'

let db: Db
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  localStorage.clear()
  db = createDb(localStorage, todayIso())
  server.resetHandlers(...createHandlers(db, { latencyMs: 0 }))
})

/** The seeded vehicle that already has two history entries. */
function seededVehicle() {
  const id = db.actions()[0].vehicleId
  return enrich(db.vehicle(id)!, db.actions(), todayIso())
}

async function mountPanel() {
  const wrapper = mount(ActionPanel, { props: { vehicle: seededVehicle() } })
  await flushPromises()
  return wrapper
}

describe('ActionPanel', () => {
  it('shows the full history, newest first', async () => {
    const items = (await mountPanel()).findAll('[data-test="history-item"]')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Price reduction planned')
    expect(items[1].text()).toContain('Under review')
  })

  it('appends a new entry, keeps the old ones and emits saved', async () => {
    const wrapper = await mountPanel()
    await wrapper.get('select[name="status"]').setValue('SENT_TO_AUCTION')
    await wrapper.get('textarea[name="note"]').setValue('Auction on Friday')
    await wrapper.get('input[name="author"]').setValue('Jordan Lee')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const items = wrapper.findAll('[data-test="history-item"]')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('Sent to auction')
    expect(items[0].text()).toContain('Auction on Friday')
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('asks for a name before sending anything', async () => {
    const wrapper = await mountPanel()
    await wrapper.get('input[name="author"]').setValue('  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter your name')
    expect(wrapper.findAll('[data-test="history-item"]')).toHaveLength(2)
  })

  it('shows the server error when saving fails', async () => {
    server.resetHandlers(...createHandlers(db, { latencyMs: 0 }))
    const wrapper = await mountPanel()
    server.resetHandlers(...createHandlers(db, { latencyMs: 0, mode: 'error' }))
    await wrapper.get('input[name="author"]').setValue('Jordan Lee')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Simulated server error')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
