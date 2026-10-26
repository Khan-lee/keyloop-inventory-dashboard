<script setup lang="ts">
import { formatDate, formatDays, formatMiles, formatPrice } from '../format'
import { ACTION_STATUSES, type VehicleView } from '../types'

defineProps<{ items: VehicleView[] }>()
defineEmits<{ open: [vehicle: VehicleView] }>()
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">Vehicle</th>
          <th scope="col">VIN</th>
          <th scope="col">Stocked</th>
          <th scope="col" class="num">In stock</th>
          <th scope="col" class="num">Price</th>
          <th scope="col">Status</th>
          <th scope="col">Suggested</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in items" :key="v.id" :data-vehicle-id="v.id" :class="{ aging: v.isAging }">
          <td>
            <div class="vehicle">{{ v.year }} {{ v.make }} {{ v.model }}</div>
            <div class="muted">{{ formatMiles(v.mileage) }}</div>
          </td>
          <td class="mono">{{ v.vin }}</td>
          <td>{{ formatDate(v.stockedAt) }}</td>
          <td class="num">
            <span v-if="v.dataIssue" class="badge badge-issue" title="Stock date is missing, invalid or in the future">Data issue</span>
            <template v-else>
              {{ formatDays(v.daysInStock!) }}
              <span v-if="v.isAging" class="badge badge-aging">Aging</span>
            </template>
          </td>
          <td class="num">{{ formatPrice(v.price) }}</td>
          <td>
            <span v-if="v.latestAction" class="status">{{ ACTION_STATUSES[v.latestAction.status] }}</span>
            <span v-else-if="v.isAging" class="status status-none">No action yet</span>
            <span v-else class="muted">—</span>
          </td>
          <td>
            <span v-if="v.suggestedAction" class="suggestion">{{ v.suggestedAction }}</span>
            <span v-else class="muted">—</span>
          </td>
          <td class="cell-action">
            <button v-if="v.isAging" type="button" class="btn btn-small" @click="$emit('open', v)">
              {{ v.latestAction ? 'Update' : 'Log action' }}<span class="sr-only"> for {{ v.make }} {{ v.model }} {{ v.vin }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  position: relative; /* contains the absolutely positioned .sr-only labels, which otherwise widen the page */
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
th,
td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-fg);
  background: var(--muted);
  position: sticky;
  top: 0;
}
tbody tr:last-child td {
  border-bottom: 0;
}
tbody tr:hover {
  background: var(--row-hover);
}
tr.aging td:first-child {
  box-shadow: inset 3px 0 0 var(--aging);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.vehicle {
  font-weight: 600;
}
.mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
.status-none {
  color: var(--aging-fg);
  font-weight: 600;
}
.suggestion {
  color: var(--fg);
}
.cell-action {
  text-align: right;
}
</style>
