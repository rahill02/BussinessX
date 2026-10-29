import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Banner from '../components/Banner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import Spinner from '../components/Spinner.jsx'
import Stat from '../components/Stat.jsx'
import AddStockSheet from './AddStockSheet.jsx'
import { isoDate } from '../utils/buyFormat.js'
import { money, qty as fmtQty, unitLabel } from '../utils/format.js'

// Poor signal at the market: the last good list is saved on the phone, and ticks wait in a queue
// until the browser says it is online again. No service worker needed for this.
const LIST_KEY = 'bx_market_list'
const QUEUE_KEY = 'bx_tick_queue'

function read(key, fallback) {
  try {
    const text = localStorage.getItem(key)
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked (private window): everything still works while online
  }
}

export default function MarketTripScreen({ today, onBack }) {
  const [data, setData] = useState(null)
  const [offline, setOffline] = useState(false)
  const [queue, setQueue] = useState(() => read(QUEUE_KEY, []))
  const [error, setError] = useState(null)
  const [stocking, setStocking] = useState(null) // { item, qty } for the Add more stock sheet

  function showSaved() {
    const saved = read(LIST_KEY, null)
    if (saved) {
      setData(saved.data)
      setOffline(true)
    } else {
      setError('No signal and no saved list yet. Open this screen once while you have signal.')
    }
  }

  async function load() {
    try {
      const fresh = await api.marketList(today)
      write(LIST_KEY, { data: fresh, savedAt: Date.now() })
      setData(fresh)
      setOffline(false)
      setError(null)
    } catch (e) {
      if (e.offline) showSaved()
      else setError(e.message)
    }
  }

  // send queued ticks in order; stop at the first one that fails for lack of signal
  async function flush() {
    const waiting = read(QUEUE_KEY, [])
    const left = []
    let offline = false
    for (let i = 0; i < waiting.length; i++) {
      const op = waiting[i]
      try {
        if (op.type === 'ordered') await api.markOrdered(op.item_id, op.qty, op.today)
        else await api.undoOrdered(op.item_id)
      } catch (e) {
        if (e.offline) {
          offline = true
          left.push(...waiting.slice(i))
          break
        } // anything else is a refusal that would never succeed, so it is dropped
      }
    }
    write(QUEUE_KEY, left)
    setQueue(left)
    return { sent: left.length < waiting.length, offline }
  }

  useEffect(() => {
    // if the first request already failed for lack of signal, do not wait for a second one to fail too
    const sync = () => flush().then((r) => (r.offline ? showSaved() : load()))
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // what the screen shows = the server's answer, then the ticks still waiting on top of it
  function isBought(item) {
    const last = [...queue].reverse().find((op) => op.item_id === item.item_id)
    return last ? last.type === 'ordered' : item.bought
  }

  function toggle(item) {
    let next = read(QUEUE_KEY, [])
    const mine = (type) => (op) => op.item_id === item.item_id && op.type === type
    if (isBought(item)) {
      // un-tick: cancel a tick that was never sent, or queue an undo for one the server already has
      next = next.some(mine('ordered')) ? next.filter((op) => !mine('ordered')(op)) : [...next, { type: 'undo', item_id: item.item_id }]
    } else if (next.some(mine('undo'))) {
      next = next.filter((op) => !mine('undo')(op)) // back to what the server already has
    } else {
      next = [...next, { type: 'ordered', item_id: item.item_id, qty: item.qty, today: today || isoDate(new Date()) }]
    }
    write(QUEUE_KEY, next)
    setQueue(next)
    flush().then((r) => r.sent && load())
  }

  async function openAddStock(item) {
    try {
      setStocking({ item: await api.getItem(item.item_id), qty: item.qty })
    } catch (e) {
      setError(e.message)
    }
  }

  const items = data?.items || []
  const bought = items.filter(isBought)
  const boughtCost = bought.reduce((sum, i) => sum + i.cost_estimate, 0)
  const groups = []
  for (const item of items) {
    const group = groups.find((g) => g.name === item.supplier_name)
    if (group) group.items.push(item)
    else groups.push({ name: item.supplier_name, items: [item] })
  }

  return (
    <div>
      <TopBar eyebrow="Shopping list" title={data?.weekday ? `Market trip, ${data.weekday}` : 'Market trip'} onBack={onBack}>
        {data?.trip_date && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Estimated total" value={money(data.total_cost)} />
              <Stat label="Items" value={items.length} />
            </div>
            <p className="mt-3.5 text-[15px] font-semibold">
              Bought {bought.length} of {items.length}, about {money(boughtCost)}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: items.length ? `${(bought.length / items.length) * 100}%` : 0 }}
              />
            </div>
          </>
        )}
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {offline && <Banner tone="warn">Offline: showing your saved list. Ticks will sync later.</Banner>}
        {queue.length > 0 && !offline && <Banner tone="info">{queue.length} tick{queue.length === 1 ? '' : 's'} waiting to sync.</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        {data === null && !error ? (
          <Spinner />
        ) : !data?.trip_date ? (
          <div className="rounded-3xl bg-white ring-1 ring-ink-200/80">
            <EmptyState
              icon="store"
              title="No market trips set up"
              subtitle="Open Suppliers and turn on Market for the supplier you visit in person."
            />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white ring-1 ring-ink-200/80">
            <EmptyState icon="check" title="Nothing to buy on this trip." />
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.name}>
              <SectionLabel>{g.name}</SectionLabel>
              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/80">
                {g.items.map((item, i) => {
                  const done = isBought(item)
                  return (
                    <div key={item.item_id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-ink-100' : ''}`}>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        aria-pressed={done}
                        aria-label={done ? `${item.name}: bought. Tap to undo` : `Mark ${item.name} as bought`}
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-2 transition ${
                          done ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white text-transparent ring-ink-300'
                        }`}
                      >
                        <Icon name="check" size={26} strokeWidth={3} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[15.5px] font-semibold ${done ? 'text-ink-400 line-through' : ''}`}>{item.name}</p>
                        <p className="text-[13px] text-ink-500">
                          <span className="font-semibold tabular-nums text-ink-900">
                            {fmtQty(item.qty)} {unitLabel(item.unit)}
                          </span>{' '}
                          · about {money(item.cost_estimate)}
                        </p>
                        {item.will_run_out_before_trip && !done && (
                          <p className="mt-0.5 text-[12px] font-semibold text-rose-600">Will run out before the next trip</p>
                        )}
                      </div>
                      {done &&
                        (item.stocked ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            In stock
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAddStock(item)}
                            className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-white"
                          >
                            Add to stock
                          </button>
                        ))}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {stocking && (
        <AddStockSheet
          item={stocking.item}
          initialQty={stocking.qty}
          onClose={() => setStocking(null)}
          onSaved={() => {
            setStocking(null)
            load()
          }}
        />
      )}
    </div>
  )
}
