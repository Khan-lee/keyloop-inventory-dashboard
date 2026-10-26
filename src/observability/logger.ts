import type { App } from 'vue'

type Level = 'debug' | 'info' | 'warn' | 'error'
export interface LogEvent {
  ts: string
  level: Level
  event: string
  [context: string]: unknown
}

const MAX_EVENTS = 200
const buffer: LogEvent[] = []

/**
 * Central structured logger. Events go to a ring buffer (inspect with `window.__appLogs`)
 * and to the console in development; errors always reach the console.
 * Production: forward `entry` to an OpenTelemetry/Sentry exporter here (SYSTEM_DESIGN §6).
 */
export function log(level: Level, event: string, context: Record<string, unknown> = {}) {
  const entry: LogEvent = { ts: new Date().toISOString(), level, event, ...context }
  buffer.push(entry)
  if (buffer.length > MAX_EVENTS) buffer.shift()
  if (import.meta.env.DEV || level === 'error') console[level === 'debug' ? 'log' : level](`[${event}]`, entry)
}

export const recentLogs = (): readonly LogEvent[] => buffer

export function installErrorReporting(app: App) {
  app.config.errorHandler = (err, _instance, info) =>
    log('error', 'vue.error', { message: err instanceof Error ? err.message : String(err), info })
  window.addEventListener('error', (e) => log('error', 'window.error', { message: e.message }))
  window.addEventListener('unhandledrejection', (e) => log('error', 'unhandled.rejection', { message: String(e.reason) }))
  ;(window as unknown as { __appLogs: readonly LogEvent[] }).__appLogs = buffer
}
