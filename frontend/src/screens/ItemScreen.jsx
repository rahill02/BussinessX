import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Stat from '../components/Stat.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Icon from '../components/Icon.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import Spinner from '../components/Spinner.jsx'
import AddStockSheet from './AddStockSheet.jsx'
import CorrectStockSheet from './CorrectStockSheet.jsx'
import EditItemSheet from './EditItemSheet.jsx'
import DeliverySheet from './DeliverySheet.jsx'
import { money, qty as fmtQty, shortDate, unitLabel } from '../utils/format.js'
import { typeLabel } from '../utils/itemTypes.js'
import { plural } from '../utils/buyFormat.js'

function deliveryText(item) {
  const days = plural(item.lead_days, 'day')
  if (item.lead_source === 'market') return `Delivery: you buy it at the market (${item.supplier_name})`
  if (item.lead_source === 'supplier') return `Delivery: ${days} (from ${item.supplier_name})`
  if (item.lead_source === 'item') return `Delivery: ${days} (set for this item)`
  return `Delivery: ${days} (assumed, no supplier)`
}

export default function ItemScreen({ itemId, onBack }) {
  const [item, setItem] = useState(null)
  const [sheet, setSheet] = useState(null) // 'add' | 'correct' | 'edit' | 'delivery'
  const [error, setError] = useState(null)

  async function load() {
    try {
      setItem(await api.getItem(itemId))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  function closeAndReload() {
    setSheet(null)
    load()
  }

  if (!item) return error ? <div className="p-5"><Banner tone="error">{error}</Banner></div> : <Spinner />

  const active = item.batches.filter((b) => b.qty_left > 0)

  return (
    <div>
      <TopBar eyebrow={item.barcode ? `${typeLabel(item.type)} · ${item.barcode}` : typeLabel(item.type)} title={item.name} onBack={onBack}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-400">In stock</p>
        <p className="mt-1 font-mono text-[40px] font-semibold leading-none tabular-nums">
          {fmtQty(item.qty)}
          <span className="ml-2 font-sans text-[18px] font-medium text-ink-400">{unitLabel(item.unit)}</span>
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Price now" value={money(item.next_sell_price)} />
          <Stat label="Value" value={money(item.stock_value)} />
          <Stat label="Tax" value={`${item.tax_percent}%`} />
        </div>
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {error && <Banner tone="error">{error}</Banner>}

        <section className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 ring-1 ring-ink-200/80">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name="truck" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug">{deliveryText(item)}</p>
            <p className="text-[12.5px] text-ink-400">
              {item.carton_size > 1 ? `Sold in cartons of ${item.carton_size}` : 'Sold one at a time'}
            </p>
          </div>
          <button type="button" onClick={() => setSheet('delivery')} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft">
            Change
          </button>
        </section>

        <section>
          <SectionLabel>Batches · oldest sells first</SectionLabel>
          {active.length === 0 ? (
            <p className="rounded-3xl bg-white px-4 py-6 text-center text-[14px] text-ink-400 ring-1 ring-ink-200/80">
              No stock left. Add more stock to start selling again.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {active.map((b, i) => {
                const pct = b.qty_received > 0 ? Math.min(100, (b.qty_left / b.qty_received) * 100) : 0
                const margin = b.selling_price - b.cost_incl_tax
                return (
                  <div key={b.id} className={`rounded-3xl bg-white p-4 ring-1 ${i === 0 ? 'ring-accent/50' : 'ring-ink-200/80'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {b.batch_no && (
                            <span className="rounded-md bg-ink-950 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold tracking-wide text-white">
                              {b.batch_no}
                            </span>
                          )}
                          <p className="text-[15px] font-semibold">
                            {b.size ? `Size ${b.size} · ` : ''}bought {shortDate(b.created_at)}
                          </p>
                          {i === 0 && (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Selling now</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[13px] text-ink-400">
                          <span className="font-mono tabular-nums">{fmtQty(b.qty_left)}</span> of{' '}
                          <span className="font-mono tabular-nums">{fmtQty(b.qty_received)}</span> left
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[15px] font-semibold tabular-nums">{money(b.selling_price)}</p>
                        <p className="font-mono text-[12px] tabular-nums text-ink-400">cost {money(b.cost_incl_tax)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-accent' : 'bg-ink-300'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`font-mono text-[12px] tabular-nums ${margin < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {margin >= 0 ? '+' : ''}
                        {money(margin)}/unit
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-2 pt-1">
          <Button variant="accent" onClick={() => setSheet('add')}>
            <Icon name="plus" size={18} /> Add more stock
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheet('edit')}>
              Edit details
            </Button>
            <Button variant="secondary" onClick={() => setSheet('correct')}>
              Correct stock
            </Button>
          </div>
        </div>
      </div>

      {sheet === 'add' && <AddStockSheet item={item} onClose={() => setSheet(null)} onSaved={closeAndReload} />}
      {sheet === 'correct' && <CorrectStockSheet item={item} onClose={() => setSheet(null)} onSaved={closeAndReload} />}
      {sheet === 'edit' && <EditItemSheet item={item} onClose={() => setSheet(null)} onSaved={closeAndReload} />}
      {sheet === 'delivery' && <DeliverySheet item={item} onClose={() => setSheet(null)} onSaved={closeAndReload} />}
    </div>
  )
}
