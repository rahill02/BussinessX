import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import BottomNav from './components/BottomNav.jsx'
import AddScreen from './screens/AddScreen.jsx'
import StockScreen from './screens/StockScreen.jsx'
import SalesScreen from './screens/SalesScreen.jsx'
import ReportScreen from './screens/ReportScreen.jsx'
import BuyScreen from './screens/BuyScreen.jsx'

const DEMO_KEY = 'bx_demo_date'

function readDemoDate() {
  try {
    return localStorage.getItem(DEMO_KEY) || ''
  } catch {
    return ''
  }
}

export default function App() {
  const [tab, setTab] = useState('add')
  const [demoDate, setDemoDateState] = useState(readDemoDate) // '' = use the real date
  const [badge, setBadge] = useState(0)

  function setDemoDate(value) {
    setDemoDateState(value)
    try {
      if (value) localStorage.setItem(DEMO_KEY, value)
      else localStorage.removeItem(DEMO_KEY)
    } catch {
      // storage blocked: the date just resets on reload
    }
  }

  // red number on the Buy tab = items to order now
  const refreshBadge = useCallback(() => {
    api
      .buySummary(demoDate || null)
      .then((s) => setBadge(s.now))
      .catch(() => {})
  }, [demoDate])

  useEffect(() => {
    refreshBadge()
  }, [refreshBadge, tab])

  function openTab(key) {
    setTab(key)
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-screen">
      <main className="relative mx-auto min-h-screen w-full max-w-[480px] bg-canvas pb-32 shadow-[0_0_60px_rgba(15,31,46,0.10)]">
        {tab === 'add' && <AddScreen />}
        {tab === 'stock' && <StockScreen />}
        {tab === 'sales' && <SalesScreen />}
        {tab === 'report' && <ReportScreen />}
        {tab === 'buy' && <BuyScreen today={demoDate || null} onChangeDemoDate={setDemoDate} onChanged={refreshBadge} />}
      </main>
      <BottomNav tab={tab} setTab={openTab} badge={badge} />
    </div>
  )
}
