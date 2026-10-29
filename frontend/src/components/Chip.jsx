export default function Chip({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium ring-1 transition active:scale-95 ${
        active ? 'bg-ink-950 text-white ring-ink-950' : 'bg-white text-ink-700 ring-ink-200 hover:ring-ink-400'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
