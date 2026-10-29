import Icon from './Icon.jsx'

// light header panel at the top of every screen; children render inside it (stats, pickers)
export default function TopBar({ eyebrow, title, onBack, right, children }) {
  return (
    <header className="hero relative rounded-b-[28px] px-5 pb-6 pt-7 text-ink-950">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink-700 shadow-sm ring-1 ring-ink-200 transition hover:bg-ink-100"
          >
            <Icon name="back" size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>}
          <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          <span className="mt-1 block h-[3px] w-11 rounded-full bg-[#f28c28]" />
        </div>
        {right}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  )
}
