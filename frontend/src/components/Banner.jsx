import Icon from './Icon.jsx'

const TONES = {
  info: { box: 'bg-accent-soft text-[#0a5f8a] ring-[#cfe5f1]', icon: 'layers' },
  warn: { box: 'bg-amber-50 text-amber-800 ring-amber-200', icon: 'alert' },
  error: { box: 'bg-rose-50 text-rose-700 ring-rose-200', icon: 'alert' },
  success: { box: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: 'check' },
}

export default function Banner({ tone = 'info', children, action }) {
  const t = TONES[tone]
  return (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug ring-1 ${t.box}`}>
      <Icon name={t.icon} size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}
