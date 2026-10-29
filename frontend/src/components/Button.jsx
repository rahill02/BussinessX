const VARIANTS = {
  primary: 'bg-ink-950 text-white hover:bg-ink-800 shadow-[0_10px_24px_-12px_rgba(10,11,16,0.7)]',
  accent: 'bg-accent text-white hover:brightness-110 shadow-[0_12px_28px_-12px_rgba(11,127,176,0.7)]',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_12px_28px_-12px_rgba(16,185,129,0.9)]',
  secondary: 'bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
}

export default function Button({ children, variant = 'primary', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex w-full min-h-[54px] items-center justify-center gap-2 rounded-2xl px-5 text-[16px] font-semibold tracking-tight transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
