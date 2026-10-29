import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Avatar from '../components/Avatar.jsx'
import Button from '../components/Button.jsx'
import Chip from '../components/Chip.jsx'
import Icon from '../components/Icon.jsx'
import NumberField from '../components/NumberField.jsx'
import { money, qty as fmtQty, shortDate, unitLabel } from '../utils/format.js'

function lineLabel(i, count) {
  if (count === 1) return 'From stock'
  if (i === 0) return 'Old stock'
  if (i === count - 1) return 'New stock'
  return 'Next stock'
}

export default function SellPanel({ item, onCancel, onSold }) {
  // per-size stock, for shoes and clothes
  const sizeStock = {}
  for (const b of item.batches) if (b.size && b.qty_left > 0) sizeStock[b.size] = (sizeStock[b.size] || 0) + b.qty_left
  const sizes = Object.keys(sizeStock)

  const [size, setSize] = useState(sizes[0] || null)
  const [qty, setQty] = useState('1')
  const [onePrice, setOnePrice] = useState(false)
  const [price, setPrice] = useState(String(item.next_sell_price ?? ''))
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const qtyNum = Number(qty)
  const priceNum = onePrice && price !== '' ? Number(price) : null
  const available = size ? sizeStock[size] || 0 : item.qty

  // ask the backend for the FIFO split before selling, so the bill is shown up front
  useEffect(() => {
    if (!qtyNum || qtyNum <= 0) {
      setPreview(null)
      return
    }
    let ignore = false
    const t = setTimeout(() => {
      api
        .previewSale({ item_id: item.id, qty: qtyNum, size, sell_price: priceNum })
        .then((p) => !ignore && setPreview(p))
        .catch((e) => !ignore && setError(e.message))
    }, 150)
    return () => {
      ignore = true
      clearTimeout(t)
    }
  }, [item.id, qtyNum, size, priceNum])

  function step(delta) {
    setQty(String(Math.max(1, (Number(qty) || 0) + delta)))
  }

  async function handleSell() {
    setError(null)
    setSaving(true)
    try {
      onSold(await api.sell({ item_id: item.id, qty: qtyNum, size, sell_price: priceNum }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ready = preview && !preview.error && preview.lines.length > 0
  const split = ready && preview.lines.length > 1
  const priceSpread =
    item.sell_min !== item.sell_max ? `${money(item.sell_min)} / ${money(item.sell_max)}` : money(item.sell_min)

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="animate-rise flex flex-col gap-4 rounded-[28px] bg-white p-4 ring-1 ring-ink-200/80 shadow-[0_20px_40px_-28px_rgba(10,11,16,0.5)]"
    >
      <div className="flex items-center gap-3">
        <Avatar name={item.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold tracking-tight">{item.name}</p>
          <p className="text-[13px] text-ink-400">
            {fmtQty(available)} {unitLabel(item.unit)} available
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft">
          Change
        </button>
      </div>

      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <Chip key={s} active={size === s} onClick={() => setSize(s)}>
              {s}
              <span className={`font-mono text-[12px] ${size === s ? 'text-white/70' : 'text-ink-400'}`}>{fmtQty(sizeStock[s])}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="One less"
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-900 transition hover:bg-ink-200"
        >
          <Icon name="minus" />
        </button>
        <div className="flex-1">
          <NumberField label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} className="text-center text-[20px]" autoFocus />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="One more"
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-900 transition hover:bg-ink-200"
        >
          <Icon name="plus" />
        </button>
      </div>

      {preview?.error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
          <p className="text-[14px] font-medium text-rose-700">{preview.error}</p>
          {preview.available > 0 && (
            <button
              type="button"
              onClick={() => setQty(String(preview.available))}
              className="shrink-0 rounded-full bg-rose-600 px-3 py-1.5 text-[13px] font-semibold text-white"
            >
              Sell all {fmtQty(preview.available)}
            </button>
          )}
        </div>
      )}

      {ready && (
        <div className="rounded-[22px] bg-[#f1f7fb] p-4 text-ink-950 ring-1 ring-[#d6e8f3]">
          {split && !onePrice && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-[12.5px] leading-snug text-ink-700 ring-1 ring-[#d6e8f3]">
              <Icon name="layers" size={15} className="mt-px shrink-0 text-accent" />
              This sale uses old and new stock. Each part is charged at its own price.
            </p>
          )}
          {preview.lines.map((l, i) => (
            <div key={l.batch_id} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{lineLabel(i, preview.lines.length)}</p>
                <p className="text-[12px] text-ink-500">
                  {l.batch_no ? `${l.batch_no} · ` : ''}bought {shortDate(l.batch_date)} · cost {money(l.cost_per_unit)}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[14px] tabular-nums">
                {fmtQty(l.qty)} × {money(l.sell_price)}
              </p>
            </div>
          ))}
          <div className="my-2.5 h-px bg-[#d6e8f3]" />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-ink-500">Total</span>
            <span className="font-mono text-[24px] font-bold tabular-nums">{money(preview.total_amount)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-ink-500">Your profit</span>
            <span className={`font-mono text-[14px] font-semibold tabular-nums ${preview.total_profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {money(preview.total_profit)}
            </span>
          </div>
          {preview.warning && <p className="mt-2 text-[12.5px] font-medium text-amber-700">{preview.warning}</p>}
        </div>
      )}

      {onePrice ? (
        <div className="flex flex-col gap-2">
          <NumberField
            label="One price for all"
            hint={`stock prices: ${priceSpread}`}
            prefix="₹"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button type="button" onClick={() => setOnePrice(false)} className="self-start text-[13px] font-semibold text-accent">
            Use stock prices instead
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOnePrice(true)} className="self-start text-[13px] font-semibold text-accent">
          Charge a different price
        </button>
      )}

      {error && <p className="text-[14px] text-rose-600">{error}</p>}

      <Button variant="success" onClick={handleSell} disabled={!ready || saving}>
        <Icon name="check" size={20} />
        {saving ? 'Saving…' : ready ? `Sold · ${money(preview.total_amount)}` : 'Sold'}
      </Button>
    </form>
  )
}
