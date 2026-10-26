<script setup lang="ts">
import { computed } from 'vue'
import { AGE_BANDS, type AgeBand } from '../domain/aging'
import type { InventorySummary } from '../types'

const props = defineProps<{ bands: InventorySummary['bands']; active: AgeBand | '' }>()
defineEmits<{ select: [band: AgeBand | ''] }>()

const max = computed(() => Math.max(1, ...AGE_BANDS.map((b) => props.bands[b])))
</script>

<template>
  <section class="chart" aria-labelledby="age-chart-title">
    <h2 id="age-chart-title">Stock by age <span class="muted">(click a band to filter)</span></h2>
    <ul>
      <li v-for="band in AGE_BANDS" :key="band">
        <button
          type="button"
          class="bar-row"
          :class="{ active: active === band, aging: band === '90+' }"
          :aria-pressed="active === band"
          @click="$emit('select', active === band ? '' : band)"
        >
          <span class="band">{{ band }} days</span>
          <span class="track"><span class="bar" :style="{ width: `${(bands[band] / max) * 100}%` }" /></span>
          <span class="count">{{ bands[band] }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.chart {
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}
h2 {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.3rem;
}
.bar-row {
  width: 100%;
  display: grid;
  grid-template-columns: 6.5rem 1fr 2.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  min-height: 2.25rem;
}
.bar-row:hover {
  background: var(--row-hover);
}
.bar-row.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.band {
  font-size: 0.85rem;
  text-align: left;
}
.track {
  height: 0.7rem;
  background: var(--muted);
  border-radius: 999px;
  overflow: hidden;
}
.bar {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: 999px;
  transition: width 250ms ease;
}
.aging .bar {
  background: var(--aging);
}
.count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
