import Icon from '../components/Icon.jsx'
import PriorityTag from '../components/PriorityTag.jsx'
import { dayLabel, plural } from '../utils/buyFormat.js'
import { money, qty as fmtQty, unitLabel } from '../utils/format.js'

function Tag({ tone, children }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${tone}`}>{children}</span>
}

export default function BuyCard({ s, busy, onToggle }) {
  const ordered = s.ordered_qty != null
  const canTick = s.priority !== 'skip' && (s.qty > 0 || ordered)
  const unit = s.unit === 'pcs' ? '' : ` ${unitLabel(s.unit)}`

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-ink-200/80">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityTag priority={s.priority} />
            {s.order_by && s.priority !== 'skip' && (
              <span className="text-[12px] font-medium text-ink-500">
                {s.priority === 'now' ? 'order today' : `order by ${dayLabel(s.order_by)}`}
              </span>
            )}
          </div>
          <p className="mt-2 text-[16px] font-bold leading-snug">{s.name}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-ink-500">{s.reason}</p>
        </div>

        {canTick && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(s)}
            aria-pressed={ordered}
            aria-label={ordered ? `${s.name}: ordered. Tap to undo` : `Mark ${s.name} as ordered`}
            className="flex shrink-0 flex-col items-center gap-1 disabled:opacity-50"
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-full ring-2 transition ${
                ordered ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white text-transparent ring-ink-300 hover:ring-accent'
              }`}
            >
              <Icon name="check" size={22} strokeWidth={3} />
            </span>
            <span className={`text-[10.5px] font-semibold ${ordered ? 'text-emerald-600' : 'text-ink-400'}`}>Ordered</span>
          </button>
        )}
      </div>

      {(s.low_data || s.assumed_lead || s.will_run_out_before_trip) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.low_data && <Tag tone="bg-amber-50 text-amber-800 ring-amber-200">Low data</Tag>}
          {s.assumed_lead && <Tag tone="bg-ink-100 text-ink-700 ring-ink-200">Assumed delivery time</Tag>}
          {s.will_run_out_before_trip && (
            <Tag tone="bg-rose-50 text-rose-700 ring-rose-200">Will run out before the next trip</Tag>
          )}
        </div>
      )}

      {s.qty > 0 && (
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-ink-100 pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Buy</p>
            <p className="text-[19px] font-bold tabular-nums">
              {fmtQty(s.qty)}
              {unit}
            </p>
            {s.carton_size > 1 && (
              <p className="text-[12.5px] text-ink-500">
                {plural(s.cartons, 'carton')} of {s.carton_size}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Cost</p>
            <p className="text-[16px] font-semibold tabular-nums">about {money(s.cost_estimate)}</p>
          </div>
        </div>
      )}

      {ordered && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-medium text-emerald-800">
          Ordered {fmtQty(s.ordered_qty)}
          {unit} on {dayLabel(s.ordered_at)}. Counted as stock on its way.
        </p>
      )}
    </div>
  )
}
