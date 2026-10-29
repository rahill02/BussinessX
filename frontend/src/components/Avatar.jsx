import { initials } from '../utils/format.js'

export default function Avatar({ name, muted }) {
  return (
    <div
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[13px] font-bold tracking-wide ${
        muted ? 'bg-ink-100 text-ink-400' : 'bg-accent-soft text-accent'
      }`}
    >
      {initials(name)}
    </div>
  )
}
