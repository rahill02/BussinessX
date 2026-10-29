// small white tile for numbers inside the header
export default function Stat({ label, value, tone = 'text-ink-950' }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,31,46,0.04)] ring-1 ring-ink-200/90">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      <p className={`mt-1 truncate text-[17px] font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
