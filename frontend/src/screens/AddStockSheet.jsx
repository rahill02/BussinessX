import { useState } from 'react'
import { api } from '../api.js'
import Sheet from '../components/Sheet.jsx'
import NumberField from '../components/NumberField.jsx'
import TextField from '../components/TextField.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Chip from '../components/Chip.jsx'
import Switch from '../components/Switch.jsx'
import { money, qty as fmtQty } from '../utils/format.js'

function oldValues(batch, item) {
  return {
    cost: batch?.cost_price ?? '',
    sell: batch?.selling_price ?? item.selling_price ?? '',
    mrp: batch?.mrp ?? '',
  }
}

export default function AddStockSheet({ item, onClose, onSaved, initialQty }) {
  const sizes = item.type === 'shoes' ? [...new Set(item.batches.map((b) => b.size).filter(Boolean))] : []
  const [size, setSize] = useState(sizes[0] || null)

  const batchesForSize = size ? item.batches.filter((b) => b.size === size) : item.batches
  const latest = batchesForSize[batchesForSize.length - 1]
  const old = oldValues(latest, item)
  const currentQty = batchesForSize.reduce((s, b) => s + b.qty_left, 0)

  const [qty, setQty] = useState(initialQty ? String(initialQty) : '') // market trip passes what was bought
  const [samePrice, setSamePrice] = useState(true)
  const [cost, setCost] = useState(String(old.cost))
  const [sell, setSell] = useState(String(old.sell))
  const [mrp, setMrp] = useState(String(old.mrp))
  const [batchNo, setBatchNo] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function resetPrices(values) {
    setCost(String(values.cost))
    setSell(String(values.sell))
    setMrp(String(values.mrp))
  }

  function chooseSize(s) {
    setSize(s)
    const b = item.batches.filter((x) => x.size === s).slice(-1)[0]
    resetPrices(oldValues(b, item))
  }

  function toggleSamePrice(on) {
    setSamePrice(on)
    if (on) resetPrices(old)
  }

  // tapping a greyed price means "this lot costs something else": unlock and select it for typing
  function unlock(e) {
    if (!samePrice) return
    setSamePrice(false)
    const el = e.target
    requestAnimationFrame(() => el.select())
  }

  const qtyNum = Number(qty)
  const validQty = qtyNum > 0

  async function handleSave() {
    setError(null)
    if (!validQty) return setError('Enter how many you are adding.')
    setSaving(true)
    try {
      await api.addStock(item.id, {
        qty: qtyNum,
        same_price: samePrice,
        cost_price: samePrice ? null : Number(cost) || 0,
        selling_price: samePrice || sell === '' ? null : Number(sell),
        mrp: samePrice || mrp === '' ? null : Number(mrp),
        size,
        batch_no: samePrice ? null : batchNo.replace(/\s+/g, '') || null, // only a NEW batch gets a number
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Add more stock" subtitle={item.name} onClose={onClose}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <Chip key={s} active={size === s} onClick={() => chooseSize(s)}>
                Size {s}
              </Chip>
            ))}
          </div>
        )}

        <NumberField label="How many are you adding?" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />

        <div className="flex items-center justify-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] tabular-nums text-ink-950 ring-1 ring-[#cfe5f1]">
          <span>{fmtQty(currentQty)}</span>
          <span className="text-ink-400">in stock +</span>
          <span className="font-semibold text-accent">{validQty ? fmtQty(qtyNum) : 0}</span>
          <span className="text-ink-400">=</span>
          <span className="text-[18px] font-semibold">{fmtQty(currentQty + (validQty ? qtyNum : 0))}</span>
        </div>

        <Switch
          checked={samePrice}
          onChange={toggleSamePrice}
          label="Same price as old"
          hint={samePrice ? 'Tap a price below to change it' : 'This lot gets its own cost and price'}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Cost price"
            hint={!samePrice && `was ${money(old.cost)}`}
            prefix="₹"
            muted={samePrice}
            readOnly={samePrice}
            onFocus={unlock}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <NumberField
            label="Selling price"
            hint={!samePrice && `was ${money(old.sell)}`}
            prefix="₹"
            muted={samePrice}
            readOnly={samePrice}
            onFocus={unlock}
            value={sell}
            onChange={(e) => setSell(e.target.value)}
          />
        </div>
        {item.type !== 'loose' && (
          <NumberField
            label="MRP"
            hint={!samePrice && (old.mrp !== '' ? `was ${money(old.mrp)}` : 'optional')}
            prefix="₹"
            muted={samePrice}
            readOnly={samePrice}
            onFocus={unlock}
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
          />
        )}

        {samePrice ? (
          latest?.batch_no && (
            <p className="px-1 text-[13px] text-ink-400">
              Adds to batch <span className="font-semibold text-ink-700">{latest.batch_no}</span>. Turn off “Same price as old” to start a new batch.
            </p>
          )
        ) : (
          <TextField
            label="Batch number"
            hint="empty = numbered for you"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder="e.g. your supplier's lot number"
          />
        )}

        {!samePrice && currentQty > 0 && sell !== '' && Number(sell) !== Number(old.sell) && (
          <Banner tone="info">
            The {fmtQty(currentQty)} already on the shelf keep selling at <b>{money(old.sell)}</b>. This new lot sells at{' '}
            <b>{money(sell)}</b> once they run out.
          </Banner>
        )}

        {error && <Banner tone="error">{error}</Banner>}
        <Button variant="accent" onClick={handleSave} disabled={saving || !validQty}>
          {saving ? 'Saving…' : `Add ${validQty ? fmtQty(qtyNum) : ''} to stock`}
        </Button>
      </form>
    </Sheet>
  )
}
