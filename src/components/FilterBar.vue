<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { AGE_BANDS, type AgeBand } from '../domain/aging'
import { useInventoryStore } from '../stores/inventory'

const store = useInventoryStore()
const search = ref(store.filters.q)
let timer: ReturnType<typeof setTimeout> | undefined

// Debounce typing so each keystroke doesn't hit the API.
watch(search, (q) => {
  clearTimeout(timer)
  if (q !== store.filters.q) timer = setTimeout(() => store.setFilters({ q }), 300)
})
watch(() => store.filters.q, (q) => (search.value = q))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <form class="filters" role="search" @submit.prevent>
    <label>
      Make
      <select :value="store.filters.make" name="make" @change="store.setFilters({ make: ($event.target as HTMLSelectElement).value })">
        <option value="">All makes</option>
        <option v-for="m in store.vehicles?.facets.makes ?? []" :key="m" :value="m">{{ m }}</option>
      </select>
    </label>
    <label>
      Model
      <select
        :value="store.filters.model"
        name="model"
        :disabled="!store.filters.make"
        @change="store.setFilters({ model: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">{{ store.filters.make ? 'All models' : 'Choose a make first' }}</option>
        <option v-for="m in store.vehicles?.facets.models ?? []" :key="m" :value="m">{{ m }}</option>
      </select>
    </label>
    <label>
      Age
      <select
        :value="store.filters.ageBand"
        name="age"
        @change="store.setFilters({ ageBand: ($event.target as HTMLSelectElement).value as AgeBand | '' })"
      >
        <option value="">Any age</option>
        <option v-for="b in AGE_BANDS" :key="b" :value="b">{{ b }} days</option>
      </select>
    </label>
    <label class="grow">
      Search
      <input v-model="search" type="search" name="q" placeholder="VIN or model" autocomplete="off" />
    </label>
    <button v-if="store.hasFilters" type="button" class="btn btn-ghost" @click="store.clearFilters()">Clear filters</button>
  </form>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
}
label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted-fg);
  min-width: 9rem;
}
.grow {
  flex: 1 1 12rem;
}
</style>
