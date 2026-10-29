import { useState } from 'react'
import Icon from './Icon.jsx'
import ScannerSheet from './ScannerSheet.jsx'

// Optional barcode box with a Scan button. A USB/Bluetooth scanner types into the box and presses Enter.
// onLookup(code) is called after a scan, on Enter, and when the user leaves the box.
export default function BarcodeField({ value, onChange, onLookup, label = 'Barcode', hint = 'optional' }) {
  const [scanning, setScanning] = useState(false)

  function picked(code) {
    setScanning(false)
    onChange(code)
    onLookup?.(code)
  }

  return (
    <div>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
      </span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // a scanner ends with Enter; do not submit or jump to the next box
              onLookup?.(value)
            }
          }}
          onBlur={() => value.trim() && onLookup?.(value)}
          autoComplete="off"
          placeholder="Scan or type the number"
          className="min-h-[52px] min-w-0 flex-1 rounded-2xl bg-white px-4 text-[17px] text-ink-950 outline-none ring-1 ring-ink-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label="Scan a barcode"
          className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-ink-950 px-4 text-[14px] font-semibold text-white transition active:scale-[0.97]"
        >
          <Icon name="barcode" size={20} /> Scan
        </button>
      </div>
      {scanning && <ScannerSheet onCode={picked} onClose={() => setScanning(false)} />}
    </div>
  )
}
