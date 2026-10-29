import { useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import TextField from '../components/TextField.jsx'
import Banner from '../components/Banner.jsx'
import Button from '../components/Button.jsx'
import Stepper from '../components/Stepper.jsx'
import Switch from '../components/Switch.jsx'
import WeekdayChips from '../components/WeekdayChips.jsx'
import { plural } from '../utils/buyFormat.js'

function Label({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-ink-500">{children}</span>
      {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
    </div>
  )
}

// delivery time is set once here; an item can still override it
export default function SupplierForm({ supplier, onBack, onSaved }) {
  const [name, setName] = useState(supplier?.name || '')
  const [lead, setLead] = useState(supplier?.lead_time_days ?? 2)
  const [deliveryDays, setDeliveryDays] = useState(supplier?.delivery_weekdays || [])
  const [isMarket, setIsMarket] = useState(supplier?.is_market || false)
  const [marketDays, setMarketDays] = useState(supplier?.market_weekdays || [])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    if (!name.trim()) return setError('Give the supplier a name.')
    if (isMarket && marketDays.length === 0) return setError('Pick the days you go to the market.')
    const data = {
      name: name.trim(),
      lead_time_days: isMarket ? 0 : lead,
      delivery_weekdays: isMarket ? [] : deliveryDays,
      is_market: isMarket,
      market_weekdays: isMarket ? marketDays : [],
    }
    setSaving(true)
    try {
      if (supplier) await api.updateSupplier(supplier.id, data)
      else await api.createSupplier(data)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar eyebrow="Supplier" title={supplier ? supplier.name : 'New supplier'} onBack={onBack} />
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5 px-5 pt-5">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Traders" autoFocus={!supplier} />

        {isMarket ? (
          <div>
            <Label>Market trip days</Label>
            <WeekdayChips value={marketDays} onChange={setMarketDays} />
            <p className="mt-2 text-[13px] text-ink-400">You carry things home yourself, so delivery time is 0 days.</p>
          </div>
        ) : (
          <>
            <div>
              <Label>Delivery takes</Label>
              <Stepper value={lead} onChange={setLead} min={0} max={30} />
            </div>
            <div>
              <Label hint="optional">Delivers on</Label>
              <WeekdayChips value={deliveryDays} onChange={setDeliveryDays} />
            </div>
          </>
        )}

        <Switch
          checked={isMarket}
          onChange={setIsMarket}
          label="Market"
          hint="You buy from them in person on market trips"
        />

        {supplier && (
          <div className="rounded-2xl bg-white px-4 py-3.5 ring-1 ring-ink-200/80">
            <p className="text-[14.5px] font-semibold">{plural(supplier.items_count, 'item')} use this</p>
            <p className="mt-1 text-[13px] text-ink-400">
              One item is different? Open it and change its delivery time.
            </p>
          </div>
        )}

        {error && <Banner tone="error">{error}</Banner>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save supplier'}
        </Button>
      </form>
    </div>
  )
}
