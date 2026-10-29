import Icon from './Icon.jsx'

export default function SearchField({ value, onChange, placeholder, onFocus, onSubmit, right }) {
  return (
    <div className="relative">
      <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
        placeholder={placeholder}
        className={`w-full min-h-[50px] rounded-2xl bg-white pl-11 text-[16px] text-ink-950 outline-none ring-1 ring-ink-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-accent ${
          right ? 'pr-24' : 'pr-4'
        }`}
      />
      {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}
