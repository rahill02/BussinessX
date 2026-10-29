import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Sheet from '../components/Sheet.jsx'
import NumberField from '../components/NumberField.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Chip from '../components/Chip.jsx'
import Stepper from '../components/Stepper.jsx'
import Switch from '../components/Switch.jsx'
import { plural } from '../utils/buyFormat.js'

// three fields: who supplies it, how long delivery takes, and the carton size
export default function DeliverySheet({ item, onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState(item.supplier_id)
  const [own, setOwn] = useState(item.lead_time_override != null)
  const [days, setDays] = useState(item.lead_time_override ?? item.lead_days)
  const [carton, setCarton] = useState(String(item.carton_size))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listSuppliers().then(setSuppliers).catch((e) => setError(e.message))
  }, [])

  const supplier = suppliers.find((s) => s.id === supplierId)
  const supplierDays = supplier ? supplier.lead_time_days : 2

  async function handleSave() {
    setError(null)
    const size = Number(carton)
    if (!Number.isInteger(size) || size < 1) return setError('Carton size must be a whole number, 1 or more.')
    setSaving(true)
    try {
      await api.editItem(item.id, {
        supplier_id: supplierId,
        lead_time_override: own && !supplier?.is_market ? days : null, // null clears it, so the supplier's number applies
        carton_size: size,
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Delivery and cartons" subtitle={item.name} onClose={onClose}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-500">Supplier</span>
          <div className="flex flex-wrap gap-2">
            <Chip active={supplierId == null} onClick={() => setSupplierId(null)}>
              No supplier
            </Chip>
            {suppliers.map((s) => (
              <Chip key={s.id} active={supplierId === s.id} onClick={() => setSupplierId(s.id)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </div>

        {supplier?.is_market ? (
          <Banner tone="info">Market items are bought on trip days, so delivery time does not apply.</Banner>
        ) : (
          <div className="flex flex-col gap-3">
            <Switch
              checked={own}
              onChange={setOwn}
              label="This item has its own delivery time"
              hint={own ? 'Used instead of the supplier time' : supplier ? `Uses the time set for ${supplier.name}: ${plural(supplierDays, 'day')}` : `Uses the assumed ${plural(supplierDays, 'day')}`}
            />
            {own && <Stepper value={days} onChange={setDays} min={0} max={30} />}
          </div>
        )}

        <NumberField
          label="Carton size"
          hint="1 = sold one at a time"
          value={carton}
          onChange={(e) => setCarton(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="1"
        />

        {error && <Banner tone="error">{error}</Banner>}
        <Button variant="accent" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Sheet>
  )
}
