const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-GB')
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' })

export const formatPrice = (n: number) => gbp.format(n)
export const formatMiles = (n: number) => `${number.format(n)} mi`
export const formatDays = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : date.format(d)
}
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`
