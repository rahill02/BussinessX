import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Stat from '../components/Stat.jsx'
import SearchField from '../components/SearchField.jsx'
import Avatar from '../components/Avatar.jsx'
import Banner from '../components/Banner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Button from '../components/Button.jsx'
import Spinner from '../components/Spinner.jsx'
import ItemScreen from './ItemScreen.jsx'
import { money, priceRange, qty as fmtQty, unitLabel } from '../utils/format.js'

const LOW_STOCK = 5

function StockBadge({ qty }) {
  if (qty <= 0) return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200">Out</span>
  if (qty <= LOW_STOCK) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Low</span>
  return null
}

export default function StockScreen() {
  const [items, setItems] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState(null)
  const [seeding, setSeeding] = useState(false)

  async function load() {
    try {
      setItems(await api.listItems())
    } catch (e) {
      setError(e.message)
      setItems((prev) => prev || [])
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function loadDemoData() {
    setSeeding(true)
    try {
      await api.seed()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSeeding(false)
    }
  }

  if (selectedId) {
    return (
      <ItemScreen
        itemId={selectedId}
        onBack={() => {
          setSelectedId(null)
          load()
        }}
      />
    )
  }

  const list = (items || [])
    .filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const totalValue = (items || []).reduce((s, i) => s + (i.stock_value || 0), 0)
  const needsRestock = (items || []).filter((i) => i.qty <= LOW_STOCK).length

  return (
    <div>
      <TopBar eyebrow="Inventory" title="Stock">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Items" value={items ? items.length : '—'} />
          <Stat label="Value" value={money(totalValue)} />
          <Stat label="Low / out" value={needsRestock} tone={needsRestock ? 'text-amber-600' : 'text-ink-950'} />
        </div>
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {error && <Banner tone="error">{error}</Banner>}
        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState
            title="No items yet"
            subtitle="Add your first item from the Add tab, or load demo data to look around."
            action={
              <Button onClick={loadDemoData} disabled={seeding}>
                {seeding ? 'Loading…' : 'Load 6 demo items'}
              </Button>
            }
          />
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search items" />
            {list.length === 0 ? (
              <EmptyState icon="search" title="No items match your search" />
            ) : (
              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/80">
                {list.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink-100/60 ${
                      i > 0 ? 'border-t border-ink-100' : ''
                    }`}
                  >
                    <Avatar name={item.name} muted={item.qty <= 0} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold">{item.name}</p>
                        <StockBadge qty={item.qty} />
                      </div>
                      <p className="truncate text-[13px] text-ink-400">
                        <span className="font-mono tabular-nums">{fmtQty(item.qty)}</span> {unitLabel(item.unit)} · cost{' '}
                        <span className="font-mono tabular-nums">{priceRange(item.cost_min, item.cost_max)}</span>
                      </p>
                    </div>
                    <p className="font-mono text-[15px] font-semibold tabular-nums">{priceRange(item.sell_min, item.sell_max)}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
