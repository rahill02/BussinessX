export function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function priceRange(min, max) {
  if (min == null) return '—'
  return min === max ? money(min) : `${money(min)}–${money(max)}`
}

export function qty(n) {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

export function unitLabel(unit) {
  return unit === 'l' ? 'L' : unit
}

// SQLite stores UTC without a zone marker; without the "Z" the browser would read it as local time
function toDate(d) {
  return new Date(typeof d === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d + 'Z' : d)
}

export function shortDate(d) {
  return toDate(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function time(d) {
  return toDate(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return (words[0]?.[0] || '?').toUpperCase() + (words[1]?.[0] || '').toUpperCase()
}
