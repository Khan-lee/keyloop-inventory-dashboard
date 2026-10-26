<script setup lang="ts">
import { formatPercent } from '../format'
import type { InventorySummary } from '../types'

defineProps<{ summary: InventorySummary }>()
defineEmits<{ showAging: [] }>()
</script>

<template>
  <div>
  <section class="kpis" aria-label="Key figures">
    <div class="kpi">
      <span class="label">Vehicles in stock</span>
      <span class="value" data-test="kpi-total">{{ summary.total }}</span>
    </div>
    <button type="button" class="kpi kpi-aging" data-test="kpi-aging" @click="$emit('showAging')">
      <span class="label">Aging stock (&gt;90 days)</span>
      <span class="value">{{ summary.aging }}</span>
      <span class="hint">View aging stock →</span>
    </button>
    <div class="kpi">
      <span class="label">Aging rate</span>
      <span class="value">{{ formatPercent(summary.agingRate) }}</span>
    </div>
    <div class="kpi" :class="{ 'kpi-warn': summary.agingWithoutAction > 0 }">
      <span class="label">Aging with no action</span>
      <span class="value" data-test="kpi-no-action">{{ summary.agingWithoutAction }}</span>
    </div>
  </section>
  <p v-if="summary.dataIssues" class="data-note" role="note">
    {{ summary.dataIssues }} vehicle{{ summary.dataIssues === 1 ? ' has' : 's have' }} an invalid stock date and
    {{ summary.dataIssues === 1 ? 'is' : 'are' }} excluded from aging figures.
  </p>
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
  gap: 0.75rem;
}
.kpi {
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  text-align: left;
  font: inherit;
  color: inherit;
}
.label {
  font-size: 0.8rem;
  color: var(--muted-fg);
}
.value {
  font-size: 1.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.kpi-aging {
  cursor: pointer;
  border-color: var(--aging);
  background: var(--aging-bg);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.kpi-aging:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
}
.kpi-aging .value {
  color: var(--aging-fg);
}
.hint {
  font-size: 0.75rem;
  color: var(--aging-fg);
  font-weight: 600;
}
.kpi-warn .value {
  color: var(--danger);
}
.data-note {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--muted-fg);
}
</style>
