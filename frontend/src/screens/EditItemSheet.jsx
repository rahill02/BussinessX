import { useState } from 'react'
import { api } from '../api.js'
import Sheet from '../components/Sheet.jsx'
import TextField from '../components/TextField.jsx'
import NumberField from '../components/NumberField.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import BarcodeField from '../components/BarcodeField.jsx'

export default function EditItemSheet({ item, onClose, onSaved }) {
  const [name, setName] = useState(item.name)
  const [barcode, setBarcode] = useState(item.barcode || '')
  const [sellingPrice, setSellingPrice] = useState(String(item.next_sell_price ?? item.selling_price))
  const [taxPercent, setTaxPercent] = useState(String(item.tax_percent))
  const [customId, setCustomId] = useState(item.custom_id || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const priceChanged = Number(sellingPrice) !== Number(item.next_sell_price ?? item.selling_price)
  const cleanBarcode = barcode.replace(/\s+/g, '')
  const barcodeChanged = cleanBarcode !== (item.barcode || '')

  async function handleSave() {
    setError(null)
    if (!name.trim()) return setError('Name is required.')
    setSaving(true)
    try {
      await api.editItem(item.id, {
        name: name.trim(),
        // only send a price when it changed, so a name edit never reprices stock
        selling_price: priceChanged ? Number(sellingPrice) || 0 : null,
        tax_percent: Number(taxPercent) || 0,
        custom_id: customId || null,
        // only sent when changed; an empty box sends null, which removes the barcode
        ...(barcodeChanged ? { barcode: cleanBarcode || null } : {}),
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Edit details" subtitle="Quantity changes only through Add stock or Correct stock" onClose={onClose}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Selling price" prefix="₹" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
          <NumberField label="Tax %" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
        </div>
        <BarcodeField value={barcode} onChange={setBarcode} />
        <TextField label="Item code" hint="optional" value={customId} onChange={(e) => setCustomId(e.target.value)} />
        {priceChanged && <Banner tone="info">All stock on the shelf will sell at the new price from now on.</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Sheet>
  )
}
