import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TopBar from '../components/TopBar.jsx'
import Stat from '../components/Stat.jsx'
import Spinner from '../components/Spinner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Icon from '../components/Icon.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { money, qty as fmtQty, shortDate } from '../utils/format.js'

function monthRange(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${monthStr}-01`, to: `${monthStr}-${String(lastDay).padStart(2, '0')}` }
}

export default function ReportScreen() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [seeding, setSeeding] = useState(false)

  function load() {
    const { from, to } = monthRange(month)
    api
      .report(from, to)
      .then((r) => {
        setReport(r)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  async function loadOilDemo() {
    setSeeding(true)
    try {
      await api.seedOilScenario()
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSeeding(false)
    }
  }

  const margin = report && report.total_sales > 0 ? (report.total_profit / report.total_sales) * 100 : null

  return (
    <div>
      <TopBar
        eyebrow="Insights"
        title="Report"
        right={
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-ink-950 shadow-sm outline-none ring-1 ring-ink-200 focus:ring-2 focus:ring-accent"
          />
        }
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-400">Profit this month</p>
        <div className="mt-1 flex items-baseline gap-3">
          <p className="font-mono text-[40px] font-semibold leading-none tabular-nums">{report ? money(report.total_profit) : '—'}</p>
          {margin != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Icon name="trend" size={13} />
              {margin.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Stat label="Sales" value={report ? money(report.total_sales) : '—'} />
          <Stat label="Stock value"value={report ? money(report.stock_value) : '—'} />
        </div>
      </TopBar>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {error && <Banner tone="error">{error}</Banner>}
        {!report ? (
          !error && <Spinner />
        ) : (
          <section>
            <SectionLabel right={<span className="font-mono text-[12px] text-ink-400">{report.sales.length}</span>}>
              Sales this month
            </SectionLabel>
            {report.sales.length === 0 ? (
              <div className="rounded-3xl bg-white ring-1 ring-ink-200/80">
                <EmptyState icon="chart" title="No sales in this month" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/80">
                {report.sales.map((sale, i) => {
                  const units = sale.lines.reduce((s, l) => s + l.qty - l.returned_qty, 0)
                  return (
                    <div key={sale.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-ink-100' : ''}`}>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{sale.item_name}</p>
                        <p className="text-[12.5px] text-ink-400">
                          {shortDate(sale.sold_at)} · <span className="font-mono">{fmtQty(units)}</span> sold
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[15px] font-semibold tabular-nums">{money(sale.total_amount)}</p>
                        <p className="font-mono text-[12px] tabular-nums text-emerald-600">+{money(sale.total_profit)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-dashed border-ink-300 p-4">
          <p className="text-[15px] font-semibold">Demo walkthrough</p>
          <p className="mb-3 mt-1 text-[13px] leading-relaxed text-ink-500">
            Replays Sunil's oil: 20 bottles bought, sold, restocked at a new cost, sold again. Ends at ₹676 profit and ₹1,824
            stock value.
          </p>
          <Button variant="secondary" onClick={loadOilDemo} disabled={seeding}>
            {seeding ? 'Loading…' : "Load Sunil's oil demo"}
          </Button>
        </section>
      </div>
    </div>
  )
}
