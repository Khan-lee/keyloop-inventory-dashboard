import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { startMockBackend } from './mocks/browser'
import { installErrorReporting, log } from './observability/logger'
import './style.css'

// The mock backend is the only backend in this exercise, so it also runs in production.
// Delete this block to point the app at a real API that implements docs/openapi.yaml.
try {
  await startMockBackend()
} catch (err) {
  // No Service Worker (e.g. some private windows): the UI still mounts and shows its error state.
  log('error', 'mock.start_failed', { message: err instanceof Error ? err.message : String(err) })
}

const app = createApp(App)
installErrorReporting(app)
app.use(createPinia())
app.mount('#app')
log('info', 'app.start', { mode: import.meta.env.MODE })
