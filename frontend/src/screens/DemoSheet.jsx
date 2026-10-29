import Sheet from '../components/Sheet.jsx'
import TextField from '../components/TextField.jsx'
import Button from '../components/Button.jsx'
import { addDays, isoDate } from '../utils/buyFormat.js'

// the Buy tab works out everything from "today", so moving it shows the list changing day by day
export default function DemoSheet({ value, onChange, onClose }) {
  const current = value || isoDate(new Date())

  return (
    <Sheet title="Demo" subtitle="Pretend it is another day" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField
          label="Demo date"
          type="date"
          value={current}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onChange(addDays(current, -1))}>
            Previous day
          </Button>
          <Button variant="secondary" onClick={() => onChange(addDays(current, 1))}>
            Next day
          </Button>
        </div>
        <Button variant="ghost" onClick={() => onChange('')} disabled={!value}>
          Use today's real date
        </Button>
        <p className="text-[13px] leading-relaxed text-ink-400">
          Only the Buy tab uses this date. For a day in the past, stock is rebuilt from your records. For a day in the
          future, stock stays as it is now.
        </p>
      </div>
    </Sheet>
  )
}
