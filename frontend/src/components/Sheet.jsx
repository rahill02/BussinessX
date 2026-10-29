import Icon from './Icon.jsx'

export default function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-950/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-rise max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[30px] bg-canvas px-5 pb-8 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-200" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-ink-950">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[14px] text-ink-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink-500 ring-1 ring-ink-200"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
