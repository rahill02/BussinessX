import { focusNextOnEnter } from '../utils/focusNext.js'

export default function TextField({ label, hint, className = '', ...props }) {
  return (
    <label className="block">
      {(label || hint) && (
        <span className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-ink-500">{label}</span>
          {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
        </span>
      )}
      <input
        autoComplete="off"
        onKeyDown={focusNextOnEnter}
        className={`w-full min-h-[52px] rounded-2xl bg-white px-4 text-[17px] text-ink-950 outline-none ring-1 ring-ink-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-accent disabled:bg-ink-100 disabled:text-ink-400 ${className}`}
        {...props}
      />
    </label>
  )
}
