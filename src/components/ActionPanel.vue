<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '../api/client'
import { formatDateTime, formatDays, formatPrice } from '../format'
import { ACTION_STATUSES, type ActionStatus, type VehicleAction, type VehicleView } from '../types'

const props = defineProps<{ vehicle: VehicleView }>()
const emit = defineEmits<{ saved: [action: VehicleAction]; close: [] }>()

const AUTHOR_KEY = 'inventory-dashboard-author'
const readAuthor = () => {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

const history = ref<VehicleAction[]>([])
const historyState = ref<'loading' | 'ready' | 'error'>('loading')
const status = ref<ActionStatus>(props.vehicle.latestAction ? 'UNDER_REVIEW' : 'PRICE_REDUCTION_PLANNED')
const note = ref('')
const author = ref(readAuthor())
const saving = ref(false)
const formError = ref('')

async function loadHistory() {
  historyState.value = 'loading'
  try {
    history.value = await api.actions(props.vehicle.id)
    historyState.value = 'ready'
  } catch {
    historyState.value = 'error'
  }
}
onMounted(loadHistory)

async function submit() {
  formError.value = ''
  if (!author.value.trim()) {
    formError.value = 'Enter your name so the team knows who logged this.'
    return
  }
  saving.value = true
  try {
    const created = await api.createAction(props.vehicle.id, { status: status.value, note: note.value, author: author.value })
    history.value = [created, ...history.value]
    note.value = ''
    try {
      localStorage.setItem(AUTHOR_KEY, created.author)
    } catch {
      // Remembering the name is a convenience only.
    }
    emit('saved', created)
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : 'Could not save the action.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="panel-title">
    <header class="panel-head">
      <div>
        <h2 id="panel-title">{{ vehicle.year }} {{ vehicle.make }} {{ vehicle.model }}</h2>
        <p class="muted mono">{{ vehicle.vin }}</p>
      </div>
      <button type="button" class="btn btn-ghost" aria-label="Close" @click="emit('close')">✕</button>
    </header>

    <dl class="facts">
      <div><dt>In stock</dt><dd>{{ vehicle.daysInStock === null ? 'Unknown' : formatDays(vehicle.daysInStock) }}</dd></div>
      <div><dt>Price</dt><dd>{{ formatPrice(vehicle.price) }}</dd></div>
      <div v-if="vehicle.suggestedAction"><dt>Suggested</dt><dd>{{ vehicle.suggestedAction }}</dd></div>
    </dl>

    <form class="form" novalidate @submit.prevent="submit">
      <label>
        Status / proposed action
        <select v-model="status" name="status">
          <option v-for="(label, key) in ACTION_STATUSES" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>
        <span>Note <span class="muted">(optional)</span></span>
        <textarea v-model="note" name="note" rows="2" maxlength="500" placeholder="e.g. Reduce by 5% before the weekend" />
      </label>
      <label>
        Your name
        <input v-model="author" name="author" autocomplete="name" maxlength="80" required />
      </label>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save action' }}</button>
    </form>

    <h3>History</h3>
    <p v-if="historyState === 'loading'" class="muted">Loading history…</p>
    <p v-else-if="historyState === 'error'" class="form-error">
      Could not load the history. <button type="button" class="btn-link" @click="loadHistory">Retry</button>
    </p>
    <p v-else-if="!history.length" class="muted">No actions logged yet.</p>
    <ol v-else class="history">
      <li v-for="a in history" :key="a.id" data-test="history-item">
        <div class="history-top">
          <strong>{{ ACTION_STATUSES[a.status] }}</strong>
          <time :datetime="a.createdAt" class="muted">{{ formatDateTime(a.createdAt) }}</time>
        </div>
        <p v-if="a.note" class="history-note">{{ a.note }}</p>
        <p class="muted">by {{ a.author }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 1rem;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}
h2 {
  margin: 0;
  font-size: 1.15rem;
}
h3 {
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
}
.mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  margin: 0.15rem 0 0;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
}
.facts dt {
  font-size: 0.75rem;
  color: var(--muted-fg);
}
.facts dd {
  margin: 0;
  font-weight: 600;
}
.form {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--muted);
}
.form label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.form-error {
  color: var(--danger);
  margin: 0;
  font-size: 0.85rem;
}
.history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.history li {
  border-left: 3px solid var(--primary);
  padding: 0.25rem 0 0.25rem 0.75rem;
}
.history li + li {
  border-left-color: var(--border-strong);
}
.history-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}
.history p {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
}
</style>
