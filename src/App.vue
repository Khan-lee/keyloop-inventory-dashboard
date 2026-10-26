<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import ActionPanel from './components/ActionPanel.vue'
import AgeChart from './components/AgeChart.vue'
import FilterBar from './components/FilterBar.vue'
import KpiCards from './components/KpiCards.vue'
import VehicleTable from './components/VehicleTable.vue'
import { useInventoryStore } from './stores/inventory'
import type { VehicleView } from './types'

const store = useInventoryStore()
onMounted(store.init)

const dialog = ref<HTMLDialogElement>()
const selected = ref<VehicleView | null>(null)

async function openPanel(v: VehicleView) {
  selected.value = v
  await nextTick()
  dialog.value?.showModal()
}
const closePanel = () => dialog.value?.close()

const range = computed(() => {
  const p = store.vehicles
  if (!p || !p.total) return null
  const from = (p.page - 1) * p.pageSize + 1
  return { from, to: from + p.items.length - 1, total: p.total, last: Math.ceil(p.total / p.pageSize) }
})
const firstLoad = computed(() => store.status === 'loading' && !store.vehicles)
</script>

<template>
  <header class="topbar">
    <div class="container topbar-inner">
      <div>
        <h1>Inventory Dashboard</h1>
        <p v-if="store.dealership" class="muted">{{ store.dealership.name }} · {{ store.dealership.city }}</p>
      </div>
      <label class="dealer-select">
        Dealership
        <select
          :value="store.dealershipId"
          name="dealership"
          :disabled="!store.dealerships.length"
          @change="store.selectDealership(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="d in store.dealerships" :key="d.id" :value="d.id">{{ d.name }} ({{ d.city }})</option>
        </select>
      </label>
    </div>
  </header>

  <main class="container stack">
    <!-- Nothing loaded yet and the first request failed: full-page error. -->
    <section v-if="store.status === 'error' && !store.vehicles" class="state state-error" role="alert">
      <h2>We couldn't load the inventory</h2>
      <p>{{ store.error }}</p>
      <button type="button" class="btn btn-primary" @click="store.dealerships.length ? store.load() : store.init()">
        Try again
      </button>
    </section>

    <div v-else-if="firstLoad" class="stack" aria-busy="true" aria-label="Loading inventory">
      <div class="skeleton" style="height: 6rem" />
      <div class="skeleton" style="height: 18rem" />
    </div>

    <template v-else-if="store.summary && store.vehicles">
      <div class="overview">
        <KpiCards :summary="store.summary" @show-aging="store.setFilters({ agingOnly: true })" />
        <AgeChart :bands="store.summary.bands" :active="store.filters.ageBand" @select="store.setFilters({ ageBand: $event })" />
      </div>

      <div class="tabs" role="tablist" aria-label="Stock view">
        <button type="button" role="tab" :aria-selected="!store.filters.agingOnly" @click="store.setFilters({ agingOnly: false })">
          All stock <span class="tab-count">{{ store.summary.total }}</span>
        </button>
        <button type="button" role="tab" class="tab-aging" :aria-selected="store.filters.agingOnly" @click="store.setFilters({ agingOnly: true })">
          Aging stock <span class="tab-count">{{ store.summary.aging }}</span>
        </button>
      </div>

      <FilterBar />

      <p v-if="store.status === 'error'" class="banner-error" role="alert">
        {{ store.error }} <button type="button" class="btn-link" @click="store.load()">Retry</button>
      </p>

      <div class="results" :aria-busy="store.status === 'loading'">
        <div v-if="!store.vehicles.items.length" class="state">
          <h2>No vehicles match these filters</h2>
          <p class="muted">Try a different make, model or age band.</p>
          <button v-if="store.hasFilters" type="button" class="btn" @click="store.clearFilters()">Clear filters</button>
        </div>
        <VehicleTable v-else :items="store.vehicles.items" :class="{ dimmed: store.status === 'loading' }" @open="openPanel" />
      </div>

      <nav v-if="range" class="pager" aria-label="Pagination">
        <span class="muted" data-test="range">Showing {{ range.from }}–{{ range.to }} of {{ range.total }}</span>
        <div class="pager-buttons">
          <button type="button" class="btn" :disabled="store.page <= 1" @click="store.setPage(store.page - 1)">Previous</button>
          <span class="muted">Page {{ store.page }} of {{ range.last }}</span>
          <button type="button" class="btn" :disabled="store.page >= range.last" @click="store.setPage(store.page + 1)">Next</button>
        </div>
      </nav>
    </template>
  </main>

  <dialog ref="dialog" class="dialog" aria-labelledby="panel-title" @close="selected = null">
    <ActionPanel v-if="selected" :key="selected.id" :vehicle="selected" @saved="store.load()" @close="closePanel" />
  </dialog>
</template>
