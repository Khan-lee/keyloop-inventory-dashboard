import { setupWorker } from 'msw/browser'
import { todayIso } from '../domain/aging'
import { createDb } from './db'
import { createHandlers, type MockMode } from './handlers'

/**
 * Starts the mock backend in a Service Worker. Remove this call (main.ts) to
 * talk to a real API that implements docs/openapi.yaml.
 * `?mock=error` or `?mock=slow` in the page URL simulates an outage or a slow network.
 */
export async function startMockBackend() {
  const mode = new URLSearchParams(location.search).get('mock') as MockMode
  const worker = setupWorker(...createHandlers(createDb(localStorage, todayIso()), { mode }))
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
