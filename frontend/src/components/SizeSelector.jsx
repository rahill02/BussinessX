import { useState } from 'react'
import Chip from './Chip.jsx'
import Icon from './Icon.jsx'
import NumberField from './NumberField.jsx'

const DEFAULT_SIZES = ['6', '7', '8', '9', '10', '11']

export default function SizeSelector({ selected, setSelected, qtyBySize, setQtyBySize }) {
  const [customSizes, setCustomSizes] = useState([])
  const allSizes = [...DEFAULT_SIZES, ...customSizes]

  function toggle(size) {
    setSelected((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]))
  }

  function addCustomSize() {
    const size = window.prompt('Size (e.g. 42, XL)')?.trim()
    if (!size) return
    if (!allSizes.includes(size)) setCustomSizes((prev) => [...prev, size])
    setSelected((prev) => (prev.includes(size) ? prev : [...prev, size]))
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-ink-500">Sizes in this lot</span>
      <div className="flex flex-wrap gap-2">
        {allSizes.map((size) => (
          <Chip key={size} active={selected.includes(size)} onClick={() => toggle(size)} className="min-w-[46px] justify-center">
            {size}
          </Chip>
        ))}
        <Chip onClick={addCustomSize}>
          <Icon name="plus" size={14} /> Size
        </Chip>
      </div>
      {selected.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {selected.map((size) => (
            <NumberField
              key={size}
              label={`Size ${size}`}
              value={qtyBySize[size] || ''}
              onChange={(e) => setQtyBySize((prev) => ({ ...prev, [size]: e.target.value }))}
              placeholder="0"
            />
          ))}
        </div>
      )}
    </div>
  )
}
