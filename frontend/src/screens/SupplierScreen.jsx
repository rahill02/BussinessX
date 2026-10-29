import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Banner from '../components/Banner.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import Spinner from '../components/Spinner.jsx'
import SupplierForm from './SupplierForm.jsx'
import { WEEKDAYS_SHORT, plural } from '../utils/buyFormat.js'

export default function SupplierScreen({ onBack }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // a supplier, 'new', or null

  async function load() {
    try {
      setList(await api.listSuppliers())
    } catch (e) {
      setError(e.message)
      setList((prev) => prev || [])
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (editing) {
    return (
      <SupplierForm
        supplier={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    )
  }

  return (
    <div>
      <TopBar eyebrow="Delivery" title="Suppliers" onBack={onBack} />
      <div className="flex flex-col gap-3 px-5 pt-5">
        {error && <Banner tone="error">{error}</Banner>}
        {list === null ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState icon="truck" title="No suppliers yet" subtitle="Add one so the app knows how long delivery takes." />
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/80">
            {list.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditing(s)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink-100/60 ${i > 0 ? 'border-t border-ink-100' : ''}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-accent-soft text-accent">
                  <Icon name={s.is_market ? 'store' : 'truck'} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="block text-[13px] text-ink-400">
                    {s.is_market
                      ? `Market trips: ${s.market_weekdays.map((d) => WEEKDAYS_SHORT[d]).join(', ') || 'none set'}`
                      : `Delivery takes ${plural(s.lead_time_days, 'day')}`}
                    {' · '}
                    {plural(s.items_count, 'item')}
                  </span>
                </span>
                <Icon name="chev" size={18} className="text-ink-300" />
              </button>
            ))}
          </div>
        )}
        <Button onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> Add a supplier
        </Button>
      </div>
    </div>
  )
}
