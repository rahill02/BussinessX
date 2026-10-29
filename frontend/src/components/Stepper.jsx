import Icon from './Icon.jsx'

// big minus / plus buttons around a number, for "days" without a keyboard
export default function Stepper({ value, onChange, min = 0, max = 60, unit = 'day', disabled }) {
  const word = value === 1 ? unit : `${unit}s`
  const btn =
    'grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-900 transition hover:bg-ink-200 disabled:opacity-40'
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="One less" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className={btn}>
        <Icon name="minus" />
      </button>
      <div className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-white text-[17px] font-semibold ring-1 ring-ink-200">
        {value} {word}
      </div>
      <button type="button" aria-label="One more" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className={btn}>
        <Icon name="plus" />
      </button>
    </div>
  )
}
