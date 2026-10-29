export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// every priority has a word AND a colour, never colour alone
export const PRIORITY = {
  now: { label: 'Order now', tone: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  soon: { label: 'Order soon', tone: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  plan: { label: 'Plan ahead', tone: 'bg-accent-soft text-[#0a5f8a] ring-[#cfe5f1]', dot: 'bg-accent' },
  skip: { label: "Don't buy yet", tone: 'bg-ink-100 text-ink-700 ring-ink-200', dot: 'bg-ink-400' },
  ok: { label: 'Not needed', tone: 'bg-ink-100 text-ink-700 ring-ink-200', dot: 'bg-ink-300' },
}

export function dayLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// the browser's local date as YYYY-MM-DD (toISOString would give the UTC date)
export function isoDate(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}
