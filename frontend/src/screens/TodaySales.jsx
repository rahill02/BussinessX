import { api } from '../api.js'
import SectionLabel from '../components/SectionLabel.jsx'
import Icon from '../components/Icon.jsx'
import { money, qty as fmtQty, time } from '../utils/format.js'

export default function TodaySales({ sales, onChanged }) {
  async function handleReturn(sale, line) {
    const left = line.qty - line.returned_qty
    if (!window.confirm(`Return ${fmtQty(left)} × ${sale.item_name}? It goes back into stock and the profit is reversed.`)) return
    try {
      await api.returnLine(line.id, left)
      onChanged()
    } catch (e) {
      window.alert(e.message)
    }
  }

  return (
    <section className="mt-2">
      <SectionLabel right={<span className="font-mono text-[12px] text-ink-400">{sales.length}</span>}>Today's sales</SectionLabel>
      {sales.length === 0 ? (
        <p className="rounded-3xl bg-white px-4 py-6 text-center text-[14px] text-ink-400 ring-1 ring-ink-200/80">
          No sales yet today.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sales.map((sale) => (
            <div key={sale.id} className="rounded-3xl bg-white p-4 ring-1 ring-ink-200/80">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{sale.item_name}</p>
                  <p className="text-[12px] text-ink-400">{time(sale.sold_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[15px] font-semibold tabular-nums">{money(sale.total_amount)}</p>
                  <p className="font-mono text-[12px] tabular-nums text-emerald-600">+{money(sale.total_profit)}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-col divide-y divide-ink-100">
                {sale.lines.map((line) => {
                  const fullyReturned = line.returned_qty >= line.qty
                  return (
                    <div key={line.id} className="flex items-center justify-between py-1.5 text-[13px]">
                      <span className={`font-mono tabular-nums ${fullyReturned ? 'text-ink-300 line-through' : 'text-ink-500'}`}>
                        {fmtQty(line.qty)} × {money(line.sell_price)}
                        {line.size ? ` · size ${line.size}` : ''}
                        {line.batch_no ? ` · ${line.batch_no}` : ''}
                      </span>
                      {fullyReturned ? (
                        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-500">Returned</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReturn(sale, line)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Icon name="undo" size={13} /> Return
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
