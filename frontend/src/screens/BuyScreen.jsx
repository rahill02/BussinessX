import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Banner from '../components/Banner.jsx'
import Chip from '../components/Chip.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import Spinner from '../components/Spinner.jsx'
import Switch from '../components/Switch.jsx'
import BuyCard from './BuyCard.jsx'
import DemoSheet from './DemoSheet.jsx'
import MarketTripScreen from './MarketTripScreen.jsx'
import SupplierScreen from './SupplierScreen.jsx'
import { dayLabel } from '../utils/buyFormat.js'
import { qty as fmtQty } from '../utils/format.js'

const URGENT = ['now', 'soon', 'plan']

function groupBySupplier(list) {
  const groups = []
  for (const s of list) {
    const name = s.supplier_name || 'No supplier set'
    const group = groups.find((g) => g.name === name)
    if (group) group.items.push(s)
    else groups.push({ name, items: [s] })
  }
  return groups
}

export default function BuyScreen({ today, onChangeDemoDate, onChanged }) {
  const [view, setView] = useState('home') // home | market | suppliers
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [grouped, setGrouped] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [showOk, setShowOk] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [demoOpen, setDemoOpen] = useState(false)

  async function load() {
    try {
      setList(await api.buySuggestions(today))
      setError(null)
    } catch (e) {
      setError(e.message)
      setList((prev) => prev || [])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  async function toggleOrdered(s) {
    setBusy(s.item_id)
    setNotice(null)
    try {
      if (s.ordered_qty != null) {
        await api.undoOrdered(s.item_id)
        setNotice(`Order removed for ${s.name}.`)
      } else {
        await api.markOrdered(s.item_id, s.qty, today)
        setNotice(`Marked as ordered: ${fmtQty(s.qty)} × ${s.name}. It now counts as stock on its way, so it moves down the list.`)
      }
      await load()
      onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  function leave() {
    setView('home')
    load()
    onChanged()
  }

  if (view === 'market') return <MarketTripScreen today={today} onBack={leave} />
  if (view === 'suppliers') return <SupplierScreen onBack={leave} />

  const all = list || []
  const urgent = all.filter((s) => URGENT.includes(s.priority))
  const skip = all.filter((s) => s.priority === 'skip')
  const notNeeded = all.filter((s) => s.priority === 'ok')
  const market = urgent.filter((s) => s.is_market)
  const needAction = all.filter((s) => s.priority === 'now' || s.priority === 'soon').length

  const chips = [
    { key: 'all', label: 'All', n: urgent.length },
    { key: 'now', label: 'Now', n: all.filter((s) => s.priority === 'now').length },
    { key: 'soon', label: 'Soon', n: all.filter((s) => s.priority === 'soon').length },
    { key: 'plan', label: 'Plan', n: all.filter((s) => s.priority === 'plan').length },
    { key: 'market', label: 'Market', n: market.length },
    { key: 'skip', label: 'Skip', n: skip.length },
  ]

  let shown = urgent
  if (filter === 'market') shown = market
  else if (filter === 'skip') shown = skip
  else if (filter !== 'all') shown = all.filter((s) => s.priority === filter)

  const cards = (items) =>
    items.map((s) => <BuyCard key={s.item_id} s={s} busy={busy === s.item_id} onToggle={toggleOrdered} />)

  const renderList = (items) =>
    grouped ? (
      groupBySupplier(items).map((g) => (
        <section key={g.name}>
          <SectionLabel right={<span className="text-[12px] text-ink-400">{g.items.length}</span>}>{g.name}</SectionLabel>
          <div className="flex flex-col gap-3">{cards(g.items)}</div>
        </section>
      ))
    ) : (
      <div className="flex flex-col gap-3">{cards(items)}</div>
    )

  function collapsible(title, items, open, setOpen) {
    if (items.length === 0) return null
    return (
      <section>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-left ring-1 ring-ink-200/80"
        >
          <span className="text-[14.5px] font-semibold">
            {title} <span className="font-normal text-ink-400">({items.length})</span>
          </span>
          <Icon name="chev" size={18} className={`text-ink-400 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        {open && <div className="mt-3">{renderList(items)}</div>}
      </section>
    )
  }

  const pill =
    'inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200 transition hover:bg-ink-100'

  return (
    <div>
      <TopBar
        eyebrow="Restock planner"
        title="What to buy"
        right={
          <button type="button" onClick={() => setDemoOpen(true)} className={pill}>
            Demo
          </button>
        }
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[36px] font-extrabold leading-none tabular-nums">{list ? needAction : '–'}</p>
            <p className="mt-1.5 text-[13px] text-ink-500">need action</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setView('market')} className={pill}>
              <Icon name="store" size={16} /> Market trip
            </button>
            <button type="button" onClick={() => setView('suppliers')} className={pill}>
              <Icon name="truck" size={16} /> Suppliers
            </button>
          </div>
        </div>
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {today && (
          <Banner
            tone="info"
            action={
              <button type="button" onClick={() => onChangeDemoDate('')} className="text-[13px] font-semibold underline">
                Use real date
              </button>
            }
          >
            Demo date: <span className="font-semibold">{dayLabel(today)}</span>
          </Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        {notice && (
          <Banner tone="success" action={<button type="button" onClick={() => setNotice(null)} className="text-[13px] font-semibold underline">OK</button>}>
            {notice}
          </Banner>
        )}

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)} className="shrink-0">
              {c.label}
              <span className={`text-[12px] ${filter === c.key ? 'text-white/70' : 'text-ink-400'}`}>{c.n}</span>
            </Chip>
          ))}
        </div>

        <Switch checked={grouped} onChange={setGrouped} label="Group by supplier" />

        {list === null ? (
          <Spinner />
        ) : (
          <>
            {shown.length === 0 ? (
              <div className="rounded-3xl bg-white ring-1 ring-ink-200/80">
                <EmptyState
                  icon="check"
                  title={filter === 'all' ? 'All stocked up. Nothing to order today.' : 'Nothing here right now.'}
                />
              </div>
            ) : (
              renderList(shown)
            )}
            {filter === 'all' && collapsible("Don't buy yet", skip, showSkip, setShowSkip)}
            {filter === 'all' && collapsible('Not needed', notNeeded, showOk, setShowOk)}
          </>
        )}
      </div>

      {demoOpen && <DemoSheet value={today || ''} onChange={onChangeDemoDate} onClose={() => setDemoOpen(false)} />}
    </div>
  )
}
