import { useState } from 'react'
import { api } from '../api.js'
import Sheet from '../components/Sheet.jsx'
import NumberField from '../components/NumberField.jsx'
import TextField from '../components/TextField.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Chip from '../components/Chip.jsx'
import { qty as fmtQty } from '../utils/format.js'

const REASONS = {
  remove: ['Damaged', 'Expired', 'Lost', 'Miscount'],
  add: ['Found extra', 'Miscount'],
}

// two plain choices instead of typing a minus sign, which most phone number pads don't have
export default function CorrectStockSheet({ item, onClose, onSaved }) {
  const sizes = item.type === 'shoes' ? [...new Set(item.batches.map((b) => b.size).filter(Boolean))] : []
  const [size, setSize] = useState(sizes[0] || null)
  const [direction, setDirection] = useState('remove')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const current = (size ? item.batches.filter((b) => b.size === size) : item.batches).reduce((s, b) => s + b.qty_left, 0)
  const n = Number(amount)
  const change = direction === 'remove' ? -n : n

  async function handleSave() {
    setError(null)
    if (!n || n <= 0) return setError('Enter how many.')
    if (!reason.trim()) return setError('Pick or type a reason.')
    setSaving(true)
    try {
      await api.correctStock(item.id, { qty_change: change, reason: reason.trim(), size })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Correct stock" subtitle="Logged as an adjustment, not a sale" onClose={onClose}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <Chip key={s} active={size === s} onClick={() => setSize(s)}>
                Size {s}
              </Chip>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
          {[
            ['remove', 'Remove'],
            ['add', 'Add back'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setDirection(key)
                setReason('')
              }}
              className={`rounded-xl py-2.5 text-[14px] font-semibold transition ${
                direction === key ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <NumberField label="How many?" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />

        {n > 0 && (
          <p className="text-center font-mono text-[15px] tabular-nums text-ink-500">
            {fmtQty(current)} → <span className="font-semibold text-ink-950">{fmtQty(Math.max(0, current + change))}</span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink-500">Reason</span>
          <div className="flex flex-wrap gap-2">
            {REASONS[direction].map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <TextField value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason" />
        </div>

        {error && <Banner tone="error">{error}</Banner>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save correction'}
        </Button>
      </form>
    </Sheet>
  )
}
