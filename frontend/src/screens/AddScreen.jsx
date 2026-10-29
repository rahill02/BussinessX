import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import TextField from '../components/TextField.jsx'
import NumberField from '../components/NumberField.jsx'
import Button from '../components/Button.jsx'
import Chip from '../components/Chip.jsx'
import Banner from '../components/Banner.jsx'
import BarcodeField from '../components/BarcodeField.jsx'
import Icon from '../components/Icon.jsx'
import SizeSelector from '../components/SizeSelector.jsx'
import AddStockSheet from './AddStockSheet.jsx'
import CsvImportSheet from './CsvImportSheet.jsx'
import { ITEM_TYPES, typeLabel } from '../utils/itemTypes.js'
import { money, qty as fmtQty, unitLabel } from '../utils/format.js'

const UNITS = [
  { key: 'kg', label: 'kg' },
  { key: 'g', label: 'g' },
  { key: 'l', label: 'litre' },
]

const emptyForm = {
  name: '', costPrice: '', sellingPrice: '', taxPercent: '', mrp: '', customId: '', barcode: '', batchNo: '',
  qty: '', unit: 'kg', sizes: [], sizeQty: {},
}

const cleanCode = (text) => text.replace(/\s+/g, '')

export default function AddScreen() {
  const [type, setType] = useState('normal')
  const [form, setForm] = useState(emptyForm)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [batch, setBatch] = useState(null) // { type, count } | null
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  // what the last barcode lookup found: { kind: 'looking' | 'shop' | 'catalog' | 'none', code, ... }
  const [scan, setScan] = useState(null)
  const [stockFor, setStockFor] = useState(null) // an item already in the shop, for the Add more stock sheet
  const formRef = useRef(form)
  formRef.current = form
  const lookupId = useRef(0)

  function changeBarcode(text) {
    setForm((f) => ({ ...f, barcode: text }))
    if (scan && cleanCode(text) !== scan.code) setScan(null) // the number changed, so the old answer no longer applies
  }

  async function lookUp(raw) {
    const code = cleanCode(raw)
    if (code.length < 3 || scan?.code === code) return
    const id = ++lookupId.current
    setScan({ kind: 'looking', code })
    try {
      const found = await api.lookupBarcode(code)
      if (id !== lookupId.current) return // the user has moved on to another number
      if (found.source === 'shop') return setScan({ kind: 'shop', code, item: found.item })
      if (found.source === 'catalog') {
        // only fill the name if the user has not typed one already
        const empty = !formRef.current.name.trim()
        if (empty) setForm((f) => ({ ...f, name: found.name }))
        return setScan({ kind: 'catalog', code, name: found.name, filled: empty })
      }
      setScan({ kind: 'none', code, offline: !!found.catalog_error })
    } catch (e) {
      if (id !== lookupId.current) return
      setScan({ kind: 'none', code, offline: !!e.offline })
    }
  }

  useEffect(() => {
    const q = form.name.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      api.searchNames(q).then(setSuggestions).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [form.name])

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  const costNum = Number(form.costPrice)
  const sellNum = Number(form.sellingPrice)
  const mrpNum = Number(form.mrp)

  function marginPrice(pct) {
    return Math.round(costNum * (1 + pct / 100))
  }

  const duplicate = suggestions.some((s) => s.toLowerCase() === form.name.trim().toLowerCase())
  const otherSuggestions = suggestions.filter((s) => s.toLowerCase() !== form.name.trim().toLowerCase())
  const belowCost = form.sellingPrice !== '' && costNum > 0 && sellNum < costNum
  const aboveMrp = form.mrp !== '' && mrpNum > 0 && sellNum > mrpNum
  const marginPct = costNum > 0 && sellNum > 0 ? ((sellNum - costNum) / costNum) * 100 : null

  function buildPayload() {
    const payload = {
      name: form.name.trim(),
      type,
      tax_percent: Number(form.taxPercent) || 0,
      custom_id: form.customId || null,
      batch_no: cleanCode(form.batchNo) || null, // empty: the server numbers the batch B-0001, B-0002...
      barcode: cleanCode(form.barcode) || null, // optional: items without a barcode work as before
      cost_price: costNum || 0,
      selling_price: sellNum || 0,
    }
    if (type === 'shoes') {
      payload.mrp = form.mrp ? mrpNum : null
      payload.sizes = form.sizes
        .map((s) => ({ size: s, qty: Number(form.sizeQty[s]) || 0 }))
        .filter((s) => s.qty > 0)
    } else {
      payload.unit = type === 'loose' ? form.unit : 'pcs'
      payload.mrp = type === 'loose' ? null : form.mrp ? mrpNum : null
      payload.qty = Number(form.qty) || 0
    }
    return payload
  }

  async function handleSave(andNext) {
    setError(null)
    const payload = buildPayload()
    if (!payload.name) return setError('Give the item a name.')
    if (type === 'shoes' && payload.sizes.length === 0) return setError('Pick a size and enter how many you have.')
    if (scan?.kind === 'shop' && scan.code === payload.barcode) {
      return setError(`This barcode is already on "${scan.item.name}". Use Add stock for it, or clear the barcode.`)
    }

    setSaving(true)
    try {
      const created = await api.createItem(payload)
      const nos = created.batches.map((b) => b.batch_no).filter(Boolean)
      setSaved(`Saved “${payload.name}”${nos.length ? ` as batch ${nos.join(', ')}` : ''}. Next item is ready.`)
      setShowSuggestions(false)
      setScan(null)
      if (andNext) {
        setBatch((b) => ({ type, count: (b?.count || 0) + 1 }))
        // keep the layout (type, unit, size columns), clear every value
        setForm((f) => ({ ...emptyForm, unit: f.unit, sizes: f.sizes }))
      } else {
        setBatch(null)
        setForm(emptyForm)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function finishBatch() {
    setBatch(null)
    setSaved(null)
    setScan(null)
    setForm(emptyForm)
  }

  const priceFields = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={type === 'loose' ? `Cost / ${form.unit === 'l' ? 'litre' : form.unit}` : type === 'shoes' ? 'Cost / pair' : 'Cost price'}
          prefix="₹"
          value={form.costPrice}
          onChange={set('costPrice')}
          placeholder="0"
        />
        <NumberField
          label={type === 'loose' ? `Sell / ${form.unit === 'l' ? 'litre' : form.unit}` : 'Selling price'}
          hint={
            marginPct != null && (
              <span className={marginPct < 0 ? 'text-rose-500' : 'text-emerald-600'}>{marginPct.toFixed(0)}%</span>
            )
          }
          prefix="₹"
          value={form.sellingPrice}
          onChange={set('sellingPrice')}
          placeholder="0"
        />
      </div>
      {costNum > 0 && (
        <div className="-mt-1 flex gap-2">
          {[20, 30].map((pct) => (
            <Chip key={pct} onClick={() => setForm((f) => ({ ...f, sellingPrice: String(marginPrice(pct)) }))}>
              +{pct}%<span className="font-mono text-[12px] text-ink-400">{money(marginPrice(pct))}</span>
            </Chip>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div>
      <TopBar
        eyebrow="New item"
        title="Add to stock"
        right={
          <button
            type="button"
            onClick={() => setShowCsvImport(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200 transition hover:bg-ink-100"
          >
            <Icon name="upload" size={15} /> Import
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {ITEM_TYPES.map((t) => {
            const active = type === t.key
            const locked = batch && !active
            return (
              <button
                key={t.key}
                type="button"
                disabled={locked}
                onClick={() => setType(t.key)}
                className={`flex flex-col items-start justify-start rounded-2xl p-3 text-left ring-1 transition disabled:opacity-35 ${
                  active
                    ? 'bg-ink-950 text-white shadow-[0_12px_24px_-14px_rgba(15,31,46,0.8)] ring-ink-950'
                    : 'bg-white text-ink-950 ring-ink-200 hover:ring-ink-400'
                }`}
              >
                <Icon name={t.icon} size={20} className={active ? 'text-sky-300' : 'text-accent'} />
                <p className="mt-2 text-[15px] font-semibold tracking-tight">{t.label}</p>
                <p className={`text-[11.5px] ${active ? 'text-white/60' : 'text-ink-400'}`}>{t.hint}</p>
              </button>
            )
          })}
        </div>

        {batch && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-2.5 ring-1 ring-[#cfe5f1]">
            <p className="text-[13.5px] text-ink-950">
              <span className="font-semibold">Batch · {typeLabel(batch.type)}</span>
              <span className="text-ink-500"> — {batch.count} added</span>
            </p>
            <button type="button" onClick={finishBatch} className="rounded-full bg-ink-950 px-3 py-1 text-[12.5px] font-semibold text-white">
              Finish
            </button>
          </div>
        )}
      </TopBar>

      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 px-5 pt-5">
        {saved && !error && <Banner tone="success">{saved}</Banner>}

        <div className="flex flex-col gap-2.5">
          <BarcodeField value={form.barcode} onChange={changeBarcode} onLookup={lookUp} />

          {scan?.kind === 'looking' && <p className="px-1 text-[13px] text-ink-400">Looking up the name…</p>}

          {scan?.kind === 'shop' && (
            <Banner
              tone="info"
              action={
                <button
                  type="button"
                  onClick={() => setStockFor(scan.item)}
                  className="shrink-0 rounded-full bg-ink-950 px-3 py-1.5 text-[12.5px] font-semibold text-white"
                >
                  Add stock
                </button>
              }
            >
              Already in your shop: <span className="font-semibold">{scan.item.name}</span>
              <span className="block text-[13px]">
                {money(scan.item.next_sell_price)} · {fmtQty(scan.item.qty)} {unitLabel(scan.item.unit)} in stock
              </span>
            </Banner>
          )}

          {scan?.kind === 'catalog' &&
            (scan.filled ? (
              <Banner tone="success">
                Found the name: <span className="font-semibold">{scan.name}</span>. Check it, then enter your prices.
              </Banner>
            ) : (
              <Banner
                tone="info"
                action={
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, name: scan.name }))}
                    className="shrink-0 rounded-full bg-ink-950 px-3 py-1.5 text-[12.5px] font-semibold text-white"
                  >
                    Use it
                  </button>
                }
              >
                The product list says: <span className="font-semibold">{scan.name}</span>
              </Banner>
            ))}

          {scan?.kind === 'none' && (
            <Banner tone="warn">
              {scan.offline
                ? "Couldn't look up a name (no internet). Type it yourself."
                : 'No name found for this barcode. Type it yourself; it is saved with the item for next time.'}
            </Banner>
          )}
        </div>

        <div className="relative">
          <TextField
            label="Item name"
            value={form.name}
            onChange={(e) => {
              set('name')(e)
              setShowSuggestions(true)
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. Fortune Oil 1L"
            autoFocus
          />
          {showSuggestions && otherSuggestions.length > 0 && (
            <div className="absolute inset-x-0 z-10 mt-1.5 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-16px_rgba(10,11,16,0.35)] ring-1 ring-ink-200">
              <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Copy from your items</p>
              {otherSuggestions.slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setForm((f) => ({ ...f, name: s }))
                    setShowSuggestions(false)
                  }}
                  className="block w-full px-4 py-2.5 text-left text-[15px] text-ink-700 hover:bg-ink-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {duplicate && <p className="mt-1.5 text-[13px] text-amber-600">You already have an item with this name.</p>}
        </div>

        {type === 'shoes' && (
          <>
            <SizeSelector
              selected={form.sizes}
              setSelected={(u) => setForm((f) => ({ ...f, sizes: typeof u === 'function' ? u(f.sizes) : u }))}
              qtyBySize={form.sizeQty}
              setQtyBySize={(u) => setForm((f) => ({ ...f, sizeQty: typeof u === 'function' ? u(f.sizeQty) : u }))}
            />
            {priceFields}
            <NumberField label="MRP" hint="optional" prefix="₹" value={form.mrp} onChange={set('mrp')} placeholder="0" />
          </>
        )}

        {type === 'loose' && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink-500">Sold by</span>
              <div className="flex gap-2">
                {UNITS.map((u) => (
                  <Chip key={u.key} active={form.unit === u.key} onClick={() => setForm((f) => ({ ...f, unit: u.key }))}>
                    {u.label}
                  </Chip>
                ))}
              </div>
            </div>
            <NumberField
              label={`How much in stock (${form.unit === 'l' ? 'litre' : form.unit})`}
              value={form.qty}
              onChange={set('qty')}
              placeholder="0"
            />
            {priceFields}
          </>
        )}

        {type === 'normal' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Quantity" value={form.qty} onChange={set('qty')} placeholder="0" />
              <NumberField label="MRP" hint="optional" prefix="₹" value={form.mrp} onChange={set('mrp')} placeholder="0" />
            </div>
            {priceFields}
          </>
        )}

        <details className="group rounded-2xl bg-white px-4 py-3 ring-1 ring-ink-200">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between text-[14px] font-medium text-ink-500">
            Tax, item code and batch number
            <span className="text-[12px] text-ink-300 group-open:hidden">optional</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Tax %" value={form.taxPercent} onChange={set('taxPercent')} placeholder="0" />
              <TextField label="Item code" value={form.customId} onChange={set('customId')} placeholder="optional" />
            </div>
            <TextField
              label="Batch number"
              hint="empty = numbered for you"
              value={form.batchNo}
              onChange={set('batchNo')}
              placeholder="e.g. B-0012 or your supplier's lot"
            />
          </div>
        </details>

        {belowCost && <Banner tone="warn">Selling price is below cost — you'll lose money on each one.</Banner>}
        {aboveMrp && <Banner tone="warn">Selling price is above MRP.</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? 'Saving…' : 'Save & add next'}
            {!saving && <Icon name="plus" size={18} />}
          </Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
            Save
          </Button>
        </div>
      </form>

      {showCsvImport && <CsvImportSheet onClose={() => setShowCsvImport(false)} onImported={() => {}} />}

      {stockFor && (
        <AddStockSheet
          item={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={() => {
            setSaved(`Stock added to “${stockFor.name}”.`)
            setStockFor(null)
            setScan(null)
            setForm((f) => ({ ...f, barcode: '' }))
          }}
        />
      )}
    </div>
  )
}
