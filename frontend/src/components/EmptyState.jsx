import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'box', title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink-400 ring-1 ring-ink-200">
        <Icon name={icon} size={24} />
      </div>
      <p className="text-[16px] font-semibold text-ink-900">{title}</p>
      {subtitle && <p className="max-w-[260px] text-[14px] text-ink-400">{subtitle}</p>}
      {action && <div className="mt-3 w-full max-w-[260px]">{action}</div>}
    </div>
  )
}
