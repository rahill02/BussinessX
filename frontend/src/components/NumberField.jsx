import { focusNextOnEnter } from '../utils/focusNext.js'

// muted = shown greyed (e.g. locked old price) but still focusable, so the parent can unlock it on tap
export default function NumberField({ label, hint, prefix, muted, className = '', ...props }) {
  return (
    <label className="block">
      {(label || hint) && (
        <span className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-ink-500">{label}</span>
          {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
        </span>
      )}
      <span className="relative block">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[16px] text-ink-400">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          onKeyDown={focusNextOnEnter}
          className={`w-full min-h-[52px] rounded-2xl px-4 font-mono text-[17px] tabular-nums outline-none ring-1 transition placeholder:text-ink-300 focus:ring-2 focus:ring-accent disabled:bg-ink-100 disabled:text-ink-400 ${
            prefix ? 'pl-9' : ''
          } ${muted ? 'bg-ink-100 text-ink-400 ring-ink-100' : 'bg-white text-ink-950 ring-ink-200'} ${className}`}
          {...props}
        />
      </span>
    </label>
  )
}
