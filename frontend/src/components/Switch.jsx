export default function Switch({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3.5 text-left ring-1 ring-ink-200"
    >
      <span>
        <span className="block text-[15px] font-medium text-ink-950">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-400">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-ink-200'}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  )
}
