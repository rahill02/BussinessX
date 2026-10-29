import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Stat from '../components/Stat.jsx'
import SearchField from '../components/SearchField.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import Avatar from '../components/Avatar.jsx'
import Banner from '../components/Banner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import ScannerSheet from '../components/ScannerSheet.jsx'
import Spinner from '../components/Spinner.jsx'
import SellPanel from './SellPanel.jsx'
import TodaySales from './TodaySales.jsx'
import { money, qty as fmtQty, unitLabel } from '../utils/format.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstLetter(name) {
  const c = (name || '').trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

export default function SalesScreen() {
  const [items, setItems] = useState(null)
  const [sales, setSales] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false) // the A–Z list shows only after the search box is clicked
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)

  async function loadAll() {
    try {
      const [itemList, saleList] = await Promise.all([api.listItems(), api.listSales(today())])
      setItems(itemList)
      setSales(saleList)
    } catch (e) {
      setError(e.message)
      setItems((prev) => prev || [])
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // A–Z so a shopkeeper can find an item by scrolling, without typing
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = (items || [])
      .filter((i) => i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    const byLetter = []
    for (const item of sorted) {
      const letter = firstLetter(item.name)
      const last = byLetter[byLetter.length - 1]
      if (last && last.letter === letter) last.items.push(item)
      else byLetter.push({ letter, items: [item] })
    }
    return byLetter
  }, [items, query])

  const todayAmount = sales.reduce((s, x) => s + x.total_amount, 0)
  const todayProfit = sales.reduce((s, x) => s + x.total_profit, 0)

  function closeList() {
    setOpen(false)
    setQuery('')
  }

  function pick(item) {
    setSelected(item)
    closeList()
    setDone(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // a scanned barcode opens the item straight into the sell panel; its selling price can still be changed there
  async function scanned(raw) {
    const code = raw.replace(/\s+/g, '')
    setScanOpen(false)
    setError(null)
    try {
      const found = await api.lookupBarcode(code, false) // only your own items matter at the counter
      if (found.source !== 'shop') return setError(`No item has the barcode ${code}. Add it on the Add tab, or search by name.`)
      if (found.item.qty <= 0) return setError(`${found.item.name} is out of stock.`)
      pick(found.item)
    } catch (e) {
      setError(e.message)
    }
  }

  // a USB/Bluetooth scanner types the number into the search box and presses Enter
  function searchSubmitted() {
    const q = query.replace(/\s+/g, '')
    if (/^\d{6,}$/.test(q) || (q.length >= 6 && groups.length === 0)) scanned(q)
  }

  async function handleSold(result) {
    setSelected(null)
    setDone(result)
    closeList()
    await loadAll()
  }

  return (
    <div>
      <TopBar eyebrow="Counter · today" title="Sell">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sales" value={money(todayAmount)} />
          <Stat label="Profit" value={money(todayProfit)} tone="text-emerald-600" />
          <Stat label="Bills" value={sales.length} />
        </div>
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {error && <Banner tone="error">{error}</Banner>}
        {done && (
          <Banner tone="success" action={<button type="button" onClick={() => setDone(null)} className="text-[13px] font-semibold underline">OK</button>}>
            <span className="font-semibold">Sold {fmtQty(done.lines.reduce((s, l) => s + l.qty, 0))} × {done.item_name}</span>
            <span className="block font-mono text-[13px]">
              {money(done.total_amount)} · profit {money(done.total_profit)}
              {done.warning ? ` · ${done.warning}` : ''}
            </span>
          </Banner>
        )}

        {items === null ? (
          <Spinner />
        ) : selected ? (
          <SellPanel
            item={selected}
            onCancel={() => {
              setSelected(null)
              setOpen(true)
            }}
            onSold={handleSold}
          />
        ) : items.length === 0 ? (
          <EmptyState icon="cart" title="Nothing to sell yet" subtitle="Add items from the Add tab first." />
        ) : (
          <>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchField
                  value={query}
                  onChange={(v) => {
                    setQuery(v)
                    setOpen(true)
                  }}
                  onFocus={() => setOpen(true)}
                  onSubmit={searchSubmitted}
                  placeholder="Search item to sell"
                  right={
                    open && (
                      <button
                        type="button"
                        onClick={closeList}
                        className="rounded-full bg-ink-100 px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition hover:bg-ink-200"
                      >
                        Close
                      </button>
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                aria-label="Scan a barcode"
                className="grid min-h-[50px] w-[54px] shrink-0 place-items-center rounded-2xl bg-ink-950 text-white transition active:scale-[0.97]"
              >
                <Icon name="barcode" size={22} />
              </button>
            </div>
            {!open && <p className="-mt-1 text-center text-[13px] text-ink-400">Tap the search box to see your items A–Z</p>}
            {open && groups.length === 0 && <EmptyState icon="search" title="No matching items" />}
            {open && groups.map((g) => (
              <section key={g.letter}>
                <SectionLabel>{g.letter}</SectionLabel>
                <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/80">
                  {g.items.map((item, i) => {
                    const out = item.qty <= 0
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={out}
                        onClick={() => pick(item)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-100/60 disabled:hover:bg-transparent ${
                          i > 0 ? 'border-t border-ink-100' : ''
                        }`}
                      >
                        <Avatar name={item.name} muted={out} />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[15px] font-semibold ${out ? 'text-ink-400' : 'text-ink-950'}`}>
                            {item.name}
                          </p>
                          <p className="text-[13px] text-ink-400">
                            {out ? 'Out of stock' : `${fmtQty(item.qty)} ${unitLabel(item.unit)} left`}
                          </p>
                        </div>
                        <p className={`font-mono text-[15px] font-semibold tabular-nums ${out ? 'text-ink-300' : 'text-ink-950'}`}>
                          {money(item.next_sell_price)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        )}

        <TodaySales sales={sales} onChanged={loadAll} />
      </div>

      {scanOpen && <ScannerSheet onCode={scanned} onClose={() => setScanOpen(false)} />}
    </div>
  )
}
