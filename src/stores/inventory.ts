import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ApiError } from '../api/client'
import type { AgeBand } from '../domain/aging'
import type { Dealership, InventorySummary, VehiclePage } from '../types'

export interface Filters {
  make: string
  model: string
  ageBand: AgeBand | ''
  agingOnly: boolean
  q: string
}

const emptyFilters = (): Filters => ({ make: '', model: '', ageBand: '', agingOnly: false, q: '' })
const PAGE_SIZE = 25

export const useInventoryStore = defineStore('inventory', () => {
  const dealerships = ref<Dealership[]>([])
  const dealershipId = ref('')
  const filters = ref<Filters>(emptyFilters())
  const page = ref(1)
  const vehicles = ref<VehiclePage | null>(null)
  const summary = ref<InventorySummary | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  let inFlight: AbortController | null = null

  const dealership = computed(() => dealerships.value.find((d) => d.id === dealershipId.value))
  const hasFilters = computed(() => {
    const f = filters.value
    return Boolean(f.make || f.model || f.ageBand || f.q)
  })

  function fail(err: unknown) {
    status.value = 'error'
    error.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }

  async function init() {
    status.value = 'loading'
    try {
      dealerships.value = await api.dealerships()
      dealershipId.value = dealerships.value[0]?.id ?? ''
      await load()
    } catch (err) {
      fail(err)
    }
  }

  /** Loads the current page and KPIs in parallel; a newer call cancels an older one. */
  async function load() {
    if (!dealershipId.value) return
    inFlight?.abort()
    const controller = (inFlight = new AbortController())
    status.value = 'loading'
    const { make, model, ageBand, agingOnly, q } = filters.value
    try {
      const [page_, summary_] = await Promise.all([
        api.vehicles(
          dealershipId.value,
          { make, model, ageBand: ageBand || undefined, agingOnly, q: q.trim(), page: page.value, pageSize: PAGE_SIZE },
          controller.signal,
        ),
        api.summary(dealershipId.value, controller.signal),
      ])
      vehicles.value = page_
      summary.value = summary_
      status.value = 'ready'
    } catch (err) {
      if (controller.signal.aborted) return
      fail(err)
    }
  }

  function selectDealership(id: string) {
    dealershipId.value = id
    filters.value = emptyFilters()
    page.value = 1
    void load()
  }

  function setFilters(patch: Partial<Filters>) {
    const next = { ...filters.value, ...patch }
    if (patch.make !== undefined && patch.make !== filters.value.make) next.model = ''
    filters.value = next
    page.value = 1
    void load()
  }

  function clearFilters() {
    setFilters({ ...emptyFilters(), agingOnly: filters.value.agingOnly })
  }

  function setPage(n: number) {
    page.value = n
    void load()
  }

  return {
    dealerships, dealershipId, dealership, filters, hasFilters, page, vehicles, summary, status, error,
    init, load, selectDealership, setFilters, clearFilters, setPage,
  }
})
