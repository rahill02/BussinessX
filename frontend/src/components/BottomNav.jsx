import Icon from './Icon.jsx'

const TABS = [
  { key: 'add', label: 'Add', icon: 'plus' },
  { key: 'sales', label: 'Sell', icon: 'cart' },
  { key: 'stock', label: 'Stock', icon: 'box' },
  { key: 'report', label: 'Report', icon: 'chart' },
  { key: 'buy', label: 'Buy', icon: 'clipboard' },
]

// badge = number of items to order now, shown on the Buy tab
export default function BottomNav({ tab, setTab, badge = 0 }) {
  return (
    <nav className="fixed inset-x-0 bottom-3 z-20 px-3">
      <div className="mx-auto grid max-w-[456px] grid-cols-5 gap-1 rounded-[24px] bg-white/95 p-1.5 shadow-[0_14px_36px_-10px_rgba(15,31,46,0.28)] ring-1 ring-ink-200 backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 rounded-[18px] py-2.5 text-[11px] font-semibold tracking-wide transition ${
                active ? 'bg-accent-soft text-accent' : 'text-ink-400 hover:text-ink-700'
              }`}
            >
              <span className="relative">
                <Icon name={t.icon} size={20} />
                {t.key === 'buy' && badge > 0 && (
                  <span
                    aria-label={`${badge} to order now`}
                    className="absolute -right-2.5 -top-2 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                  >
                    {badge}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
