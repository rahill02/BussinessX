import Chip from './Chip.jsx'
import { WEEKDAYS_SHORT } from '../utils/buyFormat.js'

// value is a list of weekday numbers: 0 = Monday ... 6 = Sunday
export default function WeekdayChips({ value, onChange }) {
  function toggle(day) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort())
  }
  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAYS_SHORT.map((name, day) => (
        <Chip key={name} active={value.includes(day)} onClick={() => toggle(day)} className="min-w-[48px] justify-center">
          {name}
        </Chip>
      ))}
    </div>
  )
}
