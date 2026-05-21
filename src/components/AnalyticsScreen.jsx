import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrencyRates } from '../hooks/useCurrencyRates'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const DATE_RANGES = [
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
]


const PIE_COLORS = ['#16B843', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280']

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getCategoryEmoji(cat = '') {
  const map = {
    food: '🍔', transport: '🚗', lodging: '🏨', hotel: '🏨', shopping: '🛍️',
    activities: '🎯', entertainment: '🍿', fuel: '⛽', flight: '✈️',
    medical: '💊', communication: '📱', 'visa': '📄', other: '📦',
  }
  const key = Object.keys(map).find(k => cat.toLowerCase().includes(k))
  return map[key] || '📦'
}

function getMonthLabel(d) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function groupByMonth(expenses) {
  const map = {}
  expenses.forEach(e => {
    const key = getMonthLabel(e.created_at)
    map[key] = (map[key] || 0) + Number(e.amount)
  })
  return Object.entries(map).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
}

function groupByCategory(expenses) {
  const map = {}
  expenses.forEach(e => {
    const cat = e.category || 'Other'
    map[cat] = (map[cat] || 0) + Number(e.amount)
  })
  return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
}

function buildMemberLookup(members) {
  const map = {}
  members.forEach(m => { map[m.id] = m.display_name })
  return map
}

function groupByMember(expenses, allMembers) {
  const lookup = buildMemberLookup(allMembers)
  const map = {}
  const seen = new Set()
  expenses.forEach(e => {
    const name = lookup[e.member_id] || 'Unknown'
    seen.add(e.member_id)
    map[name] = (map[name] || 0) + Number(e.amount)
  })
  allMembers.forEach(m => {
    if (!seen.has(m.id)) map[m.display_name] = map[m.display_name] || 0
  })
  return Object.entries(map).map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount)
}

function calcSettlements(members, expenses) {
  if (!members.length || !expenses.length) return { totalOwed: 0, totalPaid: 0, balance: 0 }
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const perPerson = total / members.length
  let positive = 0, negative = 0
  members.forEach(m => {
    const paid = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
    const bal = paid - perPerson
    if (bal > 0) positive += bal
    if (bal < 0) negative -= bal
  })
  return { totalOwed: Math.round(negative * 100) / 100, totalPaid: Math.round(positive * 100) / 100, balance: Math.round((positive - negative) * 100) / 100 }
}

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsScreen({ user, currency, profile }) {
  const [trips, setTrips] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef(null)
  const { convert } = useCurrencyRates()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('trip_members')
          .select('trip_id, trips(id, name, status, owner_id, created_at, base_currency, expenses(id, amount, description, category, created_at, member_id))')
          .eq('user_id', user.id)
        if (!error && data) {
          const allTrips = data.map(tm => tm.trips).filter(Boolean)
          setTrips(allTrips)

          const tripIds = allTrips.map(t => t.id)
          if (tripIds.length) {
            const { data: members } = await supabase
              .from('trip_members')
              .select('id, display_name, trip_id, user_id')
              .in('trip_id', tripIds)
            if (members) setAllMembers(members)
          }
        }
      } catch {}
      setLoading(false)
    }
    fetchData()

    function handleClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [user.id])

  const displayCurrency = currency || '₹'

  const { filteredTrips, allExpenses } = useMemo(() => {
    let filtered = [...trips]
    let allE = trips.flatMap(t => (t.expenses || []).map(e => ({ ...e, base_currency: t.base_currency || '₹', trip_name: t.name, trip_id: t.id, trip_status: t.status }))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const now = Date.now()
    if (dateRange === '1m') {
      const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000)
      allE = allE.filter(e => new Date(e.created_at) >= cutoff)
      filtered = filtered.filter(t => t.expenses?.some(e => new Date(e.created_at) >= cutoff))
    } else if (dateRange === '3m') {
      const cutoff = new Date(now - 90 * 24 * 60 * 60 * 1000)
      allE = allE.filter(e => new Date(e.created_at) >= cutoff)
      filtered = filtered.filter(t => t.expenses?.some(e => new Date(e.created_at) >= cutoff))
    } else if (dateRange === '6m') {
      const cutoff = new Date(now - 180 * 24 * 60 * 60 * 1000)
      allE = allE.filter(e => new Date(e.created_at) >= cutoff)
      filtered = filtered.filter(t => t.expenses?.some(e => new Date(e.created_at) >= cutoff))
    } else if (dateRange === '1y') {
      const cutoff = new Date(now - 365 * 24 * 60 * 60 * 1000)
      allE = allE.filter(e => new Date(e.created_at) >= cutoff)
      filtered = filtered.filter(t => t.expenses?.some(e => new Date(e.created_at) >= cutoff))
    } else if (dateRange === 'custom' && customStart && customEnd) {
      const start = new Date(customStart)
      const end = new Date(customEnd)
      end.setHours(23, 59, 59)
      allE = allE.filter(e => { const d = new Date(e.created_at); return d >= start && d <= end })
      filtered = filtered.filter(t => t.expenses?.some(e => { const d = new Date(e.created_at); return d >= start && d <= end }))
    }

    return { filteredTrips: filtered, allExpenses: allE }
  }, [trips, dateRange, customStart, customEnd])

  const stats = useMemo(() => {
    if (!filteredTrips.length) return null
    const convertedExpenses = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))

    const totalSpending = convertedExpenses.reduce((s, e) => s + e.convertedAmount, 0)
    const totalTrips = filteredTrips.length
    const totalExpenses = convertedExpenses.length
    const totalMembers = allMembers.length
    const avgTripCost = totalTrips ? totalSpending / totalTrips : 0
    const mostExpensiveTrip = filteredTrips.length ? filteredTrips.reduce((a, b) => {
      const aTotal = (a.expenses || []).reduce((s, e) => s + convert(Number(e.amount), a.base_currency || '₹', displayCurrency), 0)
      const bTotal = (b.expenses || []).reduce((s, e) => s + convert(Number(e.amount), b.base_currency || '₹', displayCurrency), 0)
      return aTotal > bTotal ? a : b
    }) : null
    const mostExpensiveAmount = mostExpensiveTrip ? (mostExpensiveTrip.expenses || []).reduce((s, e) => s + convert(Number(e.amount), mostExpensiveTrip.base_currency || '₹', displayCurrency), 0) : 0

    const cats = groupByCategory(convertedExpenses)
    const highestCategory = cats.length ? cats.reduce((a, b) => a.value > b.value ? a : b) : null
    const avgDailySpend = (() => {
      if (!convertedExpenses.length) return 0
      const dates = convertedExpenses.map(e => new Date(e.created_at).getTime()).sort((a, b) => a - b)
      const days = Math.max(1, Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + 1)
      return totalSpending / days
    })()

    return {
      totalSpending,
      totalTrips,
      totalExpenses,
      totalMembers,
      avgTripCost,
      mostExpensiveTrip,
      mostExpensiveAmount,
      highestCategory: highestCategory || null,
      avgDailySpend,
    }
  }, [filteredTrips, allExpenses, displayCurrency, convert])

  const trendData = useMemo(() => {
    const converted = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))
    return groupByMonth(converted)
  }, [allExpenses, displayCurrency, convert])

  const categoryData = useMemo(() => {
    const converted = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))
    return groupByCategory(converted)
  }, [allExpenses, displayCurrency, convert])

  const memberLookup = useMemo(() => {
    const map = {}
    allMembers.forEach(m => { map[m.id] = m.display_name })
    return map
  }, [allMembers])

  const memberData = useMemo(() => {
    const converted = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))
    return groupByMember(converted, allMembers)
  }, [allMembers, allExpenses, displayCurrency, convert])

  const settlementInfo = useMemo(() => {
    const converted = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))
    return calcSettlements(allMembers, converted)
  }, [allMembers, allExpenses, displayCurrency, convert])

  const insights = useMemo(() => {
    const list = []
    if (!stats || !categoryData.length) return list
    if (stats.totalSpending > 0) list.push({ icon: '💰', text: `Total spending across ${stats.totalTrips} trip${stats.totalTrips > 1 ? 's' : ''} is ${displayCurrency}${stats.totalSpending.toFixed(2)}` })
    if (stats.highestCategory) list.push({ icon: '📊', text: `${stats.highestCategory.name} is your highest expense category at ${displayCurrency}${stats.highestCategory.value.toFixed(2)}` })
    if (memberData.length) {
      const topPayer = memberData[0]
      const pct = stats.totalSpending ? ((topPayer.amount / stats.totalSpending) * 100).toFixed(0) : 0
      list.push({ icon: '👤', text: `${topPayer.name} paid ${pct}% of total expenses` })
    }
    if (stats.avgDailySpend > 0) list.push({ icon: '📅', text: `Average daily spend is ${displayCurrency}${stats.avgDailySpend.toFixed(2)}` })
    if (settlementInfo.totalOwed > 0) list.push({ icon: '🔄', text: `${displayCurrency}${settlementInfo.totalOwed.toFixed(2)} needs to be settled among members` })
    if (filteredTrips.length > 1 && stats.mostExpensiveTrip) list.push({ icon: '🏆', text: `"${stats.mostExpensiveTrip.name}" is your most expensive trip at ${displayCurrency}${stats.mostExpensiveAmount.toFixed(2)}` })
    if (trendData.length > 1) {
      const last = trendData[trendData.length - 1]
      const prev = trendData[trendData.length - 2]
      if (last && prev && prev.amount > 0) {
        const change = ((last.amount - prev.amount) / prev.amount * 100).toFixed(0)
        if (Math.abs(Number(change)) >= 5) list.push({ icon: Number(change) > 0 ? '📈' : '📉', text: `Spending ${Number(change) > 0 ? 'increased' : 'decreased'} ${Math.abs(Number(change))}% compared to previous month` })
      }
    }
    return list
  }, [stats, categoryData, memberData, settlementInfo, trendData, filteredTrips, displayCurrency])

  const recentActivity = useMemo(() => {
    return allExpenses.slice(0, 10).map(e => ({
      id: e.id,
      type: 'expense',
      desc: e.description || 'Expense',
      amount: convert(Number(e.amount), e.base_currency, displayCurrency),
      trip: e.trip_name,
      date: e.created_at,
      category: e.category || 'Other',
    }))
  }, [allExpenses, displayCurrency, convert])

  function applyCustomRange() { setDateRange('custom') }

  function handleExport(type) {
    const converted = allExpenses.map(e => ({ ...e, convertedAmount: convert(Number(e.amount), e.base_currency, displayCurrency) }))
    setShowExport(false)
    if (type === 'expenses') {
      exportCSV(converted.map(e => ({ Description: e.description, Amount: e.convertedAmount.toFixed(2), Currency: displayCurrency, Category: e.category, Trip: e.trip_name, Date: formatDate(e.created_at) })), 'expenses')
    } else if (type === 'trips') {
      exportCSV(filteredTrips.map(t => ({ Name: t.name, Status: t.status, Expenses: (t.expenses || []).length, Total: convert((t.expenses || []).reduce((s, e) => s + Number(e.amount), 0), t.base_currency || '₹', displayCurrency).toFixed(2), Currency: displayCurrency })), 'trips')
    } else if (type === 'categories') {
      exportCSV(categoryData.map(c => ({ Category: c.name, Amount: c.value.toFixed(2), Currency: displayCurrency })), 'categories')
    } else if (type === 'members') {
      exportCSV(memberData.map(m => ({ Name: m.name, Amount: m.amount.toFixed(2), Currency: displayCurrency })), 'members')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 skeleton rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
        <div className="h-64 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="typo-h2 text-surface-500 dark:text-white">Financial Analytics</h2>
          <p className="typo-label-sm text-[#808080] mt-1">Deep insights into your travel spending</p>
        </div>
        <div className="relative" ref={exportRef}>
          <button onClick={() => setShowExport(!showExport)}
            className="btn-secondary !py-2 text-xs flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#1E1E1E] rounded-2xl border border-surface-100 dark:border-[#2D2D2D] shadow-elevated py-1.5 min-w-[180px] animate-fadeIn origin-top-right">
              {['expenses', 'trips', 'categories', 'members'].map(type => (
                <button key={type} onClick={() => handleExport(type)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-surface-500 dark:text-white hover:bg-brand-50 dark:hover:bg-white/5 transition-colors capitalize">
                  Export {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_RANGES.map(r => (
          <button key={r.value} onClick={() => r.value === 'custom' ? null : setDateRange(r.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateRange === r.value
                ? 'bg-[#16B843] text-white shadow-sm'
                : 'bg-white dark:bg-[#1E1E1E] text-surface-400 dark:text-surface-300 border border-[#E8ECF0] dark:border-[#2D2D2D] hover:border-[#16B843]'
            }`}>
            {r.label}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E8ECF0] dark:border-[#2D2D2D] bg-white dark:bg-[#1E1E1E] text-xs font-bold text-surface-500 dark:text-white outline-none" />
            <span className="text-surface-300 text-xs">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E8ECF0] dark:border-[#2D2D2D] bg-white dark:bg-[#1E1E1E] text-xs font-bold text-surface-500 dark:text-white outline-none" />
          </div>
        )}
      </div>

      {!stats ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-brand-50 dark:bg-green-950/20 rounded-[2rem] flex items-center justify-center text-4xl mb-4 shadow-inner">
            📊
          </div>
          <h3 className="text-lg font-black text-surface-500 dark:text-white">No data yet</h3>
          <p className="text-sm font-bold text-surface-300 mt-1">Add expenses to see analytics</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Spending', value: `${displayCurrency}${stats.totalSpending.toFixed(2)}`, color: 'text-[#16B843]', icon: '💰' },
              { label: 'Total Trips', value: stats.totalTrips.toString(), color: 'text-[#16B843]', icon: '🧳' },
              { label: 'Total Expenses', value: stats.totalExpenses.toString(), color: 'text-[#16B843]', icon: '📋' },
              { label: 'Total Members', value: stats.totalMembers.toString(), color: 'text-[#16B843]', icon: '👥' },
              { label: 'Avg Trip Cost', value: `${displayCurrency}${stats.avgTripCost.toFixed(2)}`, color: 'text-surface-500 dark:text-white', icon: '📊' },
              { label: 'Avg Daily Spend', value: `${displayCurrency}${stats.avgDailySpend.toFixed(2)}`, color: 'text-surface-500 dark:text-white', icon: '📅' },
              { label: 'Pending Settlements', value: `${displayCurrency}${settlementInfo.totalOwed.toFixed(2)}`, color: settlementInfo.totalOwed > 0 ? 'text-amber-600' : 'text-[#16B843]', icon: '🔄' },
              { label: 'Top Category', value: stats.highestCategory ? stats.highestCategory.name : '-', color: 'text-surface-500 dark:text-white', icon: '🏷️' },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <p className="text-[9px] font-black text-surface-300 uppercase tracking-widest">{stat.label}</p>
                </div>
                <p className={`text-lg font-black tabular-nums ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-surface-500 dark:text-white">Spending Trend</h3>
            </div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={v => `${displayCurrency}${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E8ECF0', fontSize: 12, fontWeight: 700 }}
                    formatter={v => [`${displayCurrency}${v}`, 'Spending']}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#16B843" strokeWidth={2.5} dot={{ fill: '#16B843', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-sm font-bold text-surface-300">No spending data in this period</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-4">Category Breakdown</h3>
              {categoryData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #E8ECF0', fontSize: 12, fontWeight: 700 }}
                        formatter={v => [`${displayCurrency}${v}`, 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-3">
                    {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[10px] font-bold text-surface-400">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-sm font-bold text-surface-300">No category data</div>
              )}
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-4">Member Contributions</h3>
              {memberData.length > 0 && stats.totalSpending > 0 ? (
                <div className="space-y-4">
                  {memberData.map((m, i) => {
                    const pct = (m.amount / stats.totalSpending) * 100
                    const maxAmount = memberData[0].amount
                    const barPct = maxAmount ? (m.amount / maxAmount) * 100 : 0
                    const initials = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    const memberColors = ['bg-[#16B843]', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500']
                    return (
                      <div key={m.name}>
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className={`w-8 h-8 rounded-xl ${memberColors[i % memberColors.length]} flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-surface-500 dark:text-white truncate">{m.name}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-xs font-black text-surface-500 dark:text-white tabular-nums">{displayCurrency}{m.amount.toFixed(2)}</span>
                                <span className="text-[9px] font-black text-surface-300 tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="h-2 bg-surface-50 dark:bg-[#2D2D2D] rounded-full overflow-hidden ml-11">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${memberColors[i % memberColors.length]}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-sm font-bold text-surface-300">No member data</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-4">Trip Comparison</h3>
              {filteredTrips.length > 0 ? (
                <div className="space-y-3">
                  {filteredTrips.slice(0, 6).map(t => {
                    const total = (t.expenses || []).reduce((s, e) => s + convert(Number(e.amount), t.base_currency || '₹', displayCurrency), 0)
                    const count = (t.expenses || []).length
                    const maxTotal = filteredTrips.slice(0, 6).reduce((max, tt) => {
                      const ttTotal = (tt.expenses || []).reduce((s, e) => s + convert(Number(e.amount), tt.base_currency || '₹', displayCurrency), 0)
                      return Math.max(max, ttTotal)
                    }, 0)
                    const pct = maxTotal ? (total / maxTotal) * 100 : 0
                    return (
                      <div key={t.id}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-surface-500 dark:text-white truncate max-w-[160px]">{t.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-surface-300">{count} items</span>
                            <span className="text-xs font-black text-surface-500 dark:text-white tabular-nums">{displayCurrency}{total.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-surface-50 dark:bg-[#2D2D2D] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#16B843] to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm font-bold text-surface-300">No trips to compare</div>
              )}
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-4">Settlement Overview</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-green-950/20 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-surface-300 uppercase tracking-widest">Owed</p>
                    <p className="text-sm font-black text-[#F63332] tabular-nums mt-1">{displayCurrency}{settlementInfo.totalOwed.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-green-950/20 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-surface-300 uppercase tracking-widest">Collect</p>
                    <p className="text-sm font-black text-[#16B843] tabular-nums mt-1">{displayCurrency}{settlementInfo.totalPaid.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-green-950/20 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-surface-300 uppercase tracking-widest">Net</p>
                    <p className={`text-sm font-black tabular-nums mt-1 ${settlementInfo.balance >= 0 ? 'text-[#16B843]' : 'text-[#F63332]'}`}>
                      {displayCurrency}{Math.abs(settlementInfo.balance).toFixed(2)}
                    </p>
                  </div>
                </div>
                {settlementInfo.totalOwed > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-surface-300 mb-1">
                      <span>Settlement Progress</span>
                      <span>{settlementInfo.totalPaid > 0 ? Math.round((settlementInfo.totalPaid / (settlementInfo.totalPaid + settlementInfo.totalOwed)) * 100) : 0}%</span>
                    </div>
                    <div className="h-2.5 bg-surface-50 dark:bg-[#2D2D2D] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#16B843] to-emerald-400 transition-all duration-500"
                        style={{ width: `${settlementInfo.totalPaid > 0 ? Math.min(100, (settlementInfo.totalPaid / (settlementInfo.totalPaid + settlementInfo.totalOwed)) * 100) : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-3">Smart Insights</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#F9F9F9] dark:bg-[#2D2D2D]/50 rounded-xl p-3.5">
                    <span className="text-lg shrink-0 mt-0.5">{insight.icon}</span>
                    <p className="text-xs font-bold text-surface-400 dark:text-surface-300 leading-relaxed">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5">
              <h3 className="text-sm font-black text-surface-500 dark:text-white mb-3">Recent Activity</h3>
              <div className="divide-y divide-[#E8ECF0] dark:divide-[#2D2D2D]">
                {recentActivity.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-green-950/20 flex items-center justify-center text-sm shrink-0">
                      {getCategoryEmoji(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-surface-500 dark:text-white truncate">{item.desc}</p>
                      <p className="text-[9px] font-bold text-surface-300">{item.trip} · {formatDate(item.date)}</p>
                    </div>
                    <span className="text-xs font-black text-[#16B843] tabular-nums shrink-0">{displayCurrency}{item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
