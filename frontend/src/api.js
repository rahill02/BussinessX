// empty in production (same address as the page); the .env file points dev at the local backend
const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const SLOW_MS = 6000 // at the market a request can hang for minutes; give up and use the saved list

async function send(path, options = {}, timeoutMs) {
  let res
  try {
    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
    res = await fetch(`${BASE}${path}`, { ...options, signal })
  } catch {
    const err = new Error("Can't reach the server. Is the backend running?")
    err.offline = true // the market screen uses this to fall back to its saved list
    throw err
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // FastAPI validation errors come back as a list of {msg}
    const detail = Array.isArray(body.detail) ? body.detail.map((d) => d.msg).join(', ') : body.detail
    throw new Error(detail || 'Something went wrong')
  }
  return res.json()
}

function json(path, method, data, timeoutMs) {
  return send(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
    timeoutMs,
  )
}

// "today" is only sent when the demo date is set; otherwise the server uses the real date
const day = (today) => (today ? `?today=${today}` : '')

export const api = {
  createItem: (data) => json('/items', 'POST', data),
  listItems: () => send('/items'),
  getItem: (id) => send(`/items/${id}`),
  editItem: (id, data) => json(`/items/${id}`, 'PATCH', data),
  searchNames: (q) => send(`/items/names?q=${encodeURIComponent(q)}`),
  addStock: (id, data) => json(`/items/${id}/add-stock`, 'POST', data),
  correctStock: (id, data) => json(`/items/${id}/correct-stock`, 'POST', data),
  previewSale: (data) => json('/sales/preview', 'POST', data),
  sell: (data) => json('/sales', 'POST', data),
  listSales: (date) => send(`/sales${date ? `?date=${date}` : ''}`),
  returnLine: (lineId, qty) => json(`/sales/lines/${lineId}/return`, 'POST', { qty }),
  report: (from, to) => send(`/reports?from=${from}&to=${to}`),
  seed: () => json('/seed', 'POST'),
  seedOilScenario: () => json('/seed/oil-scenario', 'POST'),
  csvTemplateUrl: `${BASE}/items/import-csv/template`,
  importCsv: (file) => {
    const form = new FormData()
    form.append('file', file)
    return send('/items/import-csv', { method: 'POST', body: form })
  },

  // catalog=false: only look in your own items (the Sell screen). true also asks the public product list for a name.
  lookupBarcode: (code, catalog = true) =>
    send(`/items/barcode/${encodeURIComponent(code)}?catalog=${catalog}`, {}, catalog ? 12000 : undefined),

  listSuppliers: () => send('/suppliers'),
  createSupplier: (data) => json('/suppliers', 'POST', data),
  updateSupplier: (id, data) => json(`/suppliers/${id}`, 'PATCH', data),
  buySuggestions: (today) => send(`/buy/suggestions${day(today)}`),
  buySummary: (today) => send(`/buy/summary${day(today)}`),
  marketList: (today) => send(`/buy/market-list${day(today)}`, {}, SLOW_MS),
  markOrdered: (itemId, qty, today) => json(`/buy/${itemId}/ordered${day(today)}`, 'POST', { qty }, SLOW_MS),
  undoOrdered: (itemId) => json(`/buy/${itemId}/undo`, 'POST', undefined, SLOW_MS),
}
