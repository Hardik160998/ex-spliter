import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrencyRates, SYMBOL_TO_ISO } from '../hooks/useCurrencyRates'

export default function Dashboard({ user, currency, searchQuery, onSelectTrip, onOpenSettings, profile }) {
  const { convert, loading: ratesLoading } = useCurrencyRates()

  const [trips, setTrips] = useState([])
  const [newName, setNewName] = useState('')
  const [view, setView] = useState('active')
  const [createError, setCreateError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [manualMembers, setManualMembers] = useState([])
  const [newMemberName, setNewMemberName] = useState('')

  // Raw financial data per trip (pre-conversion)
  const [tripFinancials, setTripFinancials] = useState([])
  const [rawTransactions, setRawTransactions] = useState([])
  const [rawCategoryBreakdown, setRawCategoryBreakdown] = useState({
    Food: 0, Transport: 0, Lodging: 0, Entertainment: 0, Other: 0
  })

  // Convert all amounts to display currency
  const stats = useMemo(() => {
    let totalSpent = 0, owedToYou = 0, youOwe = 0
    tripFinancials.forEach(tf => {
      totalSpent += convert(tf.paidByMe, tf.baseSymbol, currency)
      owedToYou += convert(tf.owedToYou, tf.baseSymbol, currency)
      youOwe += convert(tf.youOwe, tf.baseSymbol, currency)
    })
    return { totalSpent, owedToYou, youOwe }
  }, [tripFinancials, currency, convert])

  const recentTransactions = useMemo(() => {
    return rawTransactions.map(tx => ({
      ...tx,
      convertedAmount: convert(tx.amount, tx.baseSymbol, currency),
    }))
  }, [rawTransactions, currency, convert])

  const categoryBreakdown = useMemo(() => {
    const cats = { Food: 0, Transport: 0, Lodging: 0, Entertainment: 0, Other: 0 }
    tripFinancials.forEach(tf => {
      Object.entries(tf.cats).forEach(([cat, amt]) => {
        cats[cat] = (cats[cat] || 0) + convert(amt, tf.baseSymbol, currency)
      })
    })
    return cats
  }, [tripFinancials, currency, convert])

  // Mini Calendar Date (removed — decorative only, no product value)

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('trip_id, trips(id, name, status, owner_id, created_at, base_currency, expenses(id, amount, description, category, created_at, member_id))')
        .eq('user_id', user.id)

      if (error) {
        console.error('fetchTrips error:', error)
        setLoading(false)
        return
      }

      const raw = data?.map(r => r.trips).filter(Boolean) ?? []
      const seen = new Set()
      const unique = raw.filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })

      setTrips(unique)

      if (unique.length > 0) {
        const tripIds = unique.map(t => t.id)
        await calculateFinancialsAndRecent(unique, tripIds)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('fetchTrips catch:', err)
      setLoading(false)
    }
  }

  const calculateFinancialsAndRecent = async (allTrips, tripIds) => {
    try {
      const { data: members, error: memErr } = await supabase
        .from('trip_members')
        .select('id, trip_id, user_id, source')
        .in('trip_id', tripIds)
      if (memErr) throw memErr

      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('id, amount, description, category, created_at, member_id, trip_id')
        .in('trip_id', tripIds)
      if (expErr) throw expErr

      const cats = { Food: 0, Transport: 0, Lodging: 0, Entertainment: 0, Other: 0 }
      const perTrip = []

      allTrips.forEach(trip => {
        const tripExpenses = expenses?.filter(e => e.trip_id === trip.id) || []
        const tripMembers = members?.filter(m => m.trip_id === trip.id) || []
        const memberCount = tripMembers.length || 1
        const baseSymbol = trip.base_currency || '₹'

        const myMember = tripMembers.find(m => m.user_id === user.id)
        const myMemberId = myMember ? myMember.id : null

        let tripPaidByMe = 0
        let tripTotal = 0
        const tripCats = {}

        tripExpenses.forEach(exp => {
          const amt = Number(exp.amount) || 0
          tripTotal += amt
          if (myMemberId && exp.member_id === myMemberId) tripPaidByMe += amt

          const cat = exp.category || 'Other'
          const normalizedCat = cats[cat] !== undefined ? cat : 'Other'
          tripCats[normalizedCat] = (tripCats[normalizedCat] || 0) + amt
          cats[normalizedCat] += amt
        })

        const myShare = tripTotal / memberCount
        const myBalance = tripPaidByMe - myShare

        perTrip.push({
          baseSymbol,
          paidByMe: tripPaidByMe,
          tripTotal,
          owedToYou: myBalance > 0 ? myBalance : 0,
          youOwe: myBalance < 0 ? Math.abs(myBalance) : 0,
          cats: tripCats,
        })
      })

      setTripFinancials(perTrip)
      setRawCategoryBreakdown(cats)

      const sortedExpenses = [...(expenses || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(exp => {
          const trip = allTrips.find(t => t.id === exp.trip_id)
          return {
            ...exp,
            trip_name: trip ? trip.name : 'Unknown Trip',
            baseSymbol: (allTrips.find(t => t.id === exp.trip_id)?.base_currency) || '₹',
          }
        })

      setRawTransactions(sortedExpenses)
    } catch (err) {
      console.error('Error calculating financials:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  const createTrip = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({ name: newName.trim(), owner_id: user.id, status: 'active', base_currency: currency })
      .select().single()
    if (tripErr) { setCreateError(tripErr.message); return }
    
    const displayName = profile?.display_name || user.email
    const { error: memberErr } = await supabase.from('trip_members').insert({
      trip_id: trip.id, user_id: user.id, role: 'owner', display_name: displayName,
    })
    if (memberErr) { setCreateError(memberErr.message); return }

    for (const name of manualMembers) {
      if (!name.trim()) continue
      await supabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: null,
        role: 'contributor',
        display_name: name.trim(),
        source: 'manual',
      })
    }

    setNewName('')
    setManualMembers([])
    setNewMemberName('')
    setShowCreate(false)
    fetchTrips()
  }

  const addManualMember = () => {
    if (!newMemberName.trim()) return
    if (manualMembers.includes(newMemberName.trim())) return
    setManualMembers([...manualMembers, newMemberName.trim()])
    setNewMemberName('')
  }

  const removeManualMember = (name) => {
    setManualMembers(manualMembers.filter(m => m !== name))
  }

  const active = trips.filter(t => t.status === 'active')
  const completed = trips.filter(t => t.status === 'completed')
  const filtered = view === 'active' ? active : completed
  
  // Header Search is handled at parent, passed here
  const searched = filtered.filter(t =>
    t.name.toLowerCase().includes((searchQuery || '').toLowerCase())
  )

  const firstName = profile?.display_name?.split(' ')[0] || user.email?.split('@')[0] || 'Traveller'
  const totalExpensesCount = trips.reduce((s, t) => s + (t.expenses?.length || 0), 0)
  const totalTripSpend = trips.reduce((s, t) => s + convert(
    t.expenses?.reduce((es, e) => es + Number(e.amount), 0) || 0,
    t.base_currency || '₹',
    currency
  ), 0)

  const TRIP_ICON_STYLES = [
    'bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
    'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
    'bg-brand-100 text-brand-700 dark:bg-green-950/40 dark:text-brand-400',
  ]

  // Calendar helpers removed — decorative only, no product value

  // Category Icons & Color Mapping
  const getCategoryTheme = (category = '') => {
    const c = category.toLowerCase()
    if (c.includes('food')) return { emoji: '🍔', bg: 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' }
    if (c.includes('transport') || c.includes('cab') || c.includes('flight')) return { emoji: '🚗', bg: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' }
    if (c.includes('lodging') || c.includes('hotel') || c.includes('stay')) return { emoji: '🏨', bg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' }
    if (c.includes('entertainment') || c.includes('fun') || c.includes('ticket')) return { emoji: '🍿', bg: 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' }
    return { emoji: '🛍️', bg: 'bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400' }
  }

  return (
    <div className="space-y-6">
      {/* 3-COLUMN OVERVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: CARDS & STATS */}
        <div className="space-y-5">
          {/* TRAVEL LEDGER SUMMARY */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] overflow-hidden group transition-all duration-300 hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-[#16B843] via-emerald-400 to-[#16B843]" />

            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm shadow-md shadow-[#16B843]/15 shrink-0">
                    🧳
                  </div>
                  <div>
                    <h4 className="typo-h4">Travel Ledger</h4>
                    <p className="typo-label-sm text-surface-300 dark:text-surface-400">Spending Summary</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16B843] animate-pulse" />
                  {active.length} Active
                </span>
              </div>

              <div className="bg-[#F9F9FB] dark:bg-[#121212] rounded-xl px-4 py-3 border border-[#E8ECF0] dark:border-[#2D2D2D]">
                <p className="typo-label mb-1">Total Paid by You</p>
                <div className="typo-finance-xl text-surface-500 dark:text-white flex items-baseline gap-1">
                  <span className="text-base font-bold text-[#16B843]">{currency}</span>
                  {stats.totalSpent.toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Trips', value: trips.length, color: 'text-[#16B843]' },
                  { label: 'Expenses', value: totalExpensesCount, color: 'text-brand-600' },
                  { label: 'Active', value: active.length, color: 'text-emerald-500' },
                  { label: 'Total', value: `${currency}${Math.round(totalTripSpend / (trips.length || 1))}`, color: 'text-surface-400' },
                ].map(stat => (
                  <div key={stat.label} className="text-center bg-[#F9F9FB] dark:bg-[#121212] rounded-xl py-2.5 px-1 border border-[#E8ECF0] dark:border-[#2D2D2D]">
                    <p className={`typo-stat-sm ${stat.color} dark:opacity-90`}>{stat.value}</p>
                    <p className="typo-label-sm text-surface-300 dark:text-surface-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {recentTransactions.length > 0 && (
                <div className="flex items-center gap-2 typo-meta border-t border-[#E8ECF0] dark:border-[#2D2D2D] pt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16B843]" />
                  <span className="truncate">
                    Latest: {recentTransactions[0].description}
                  </span>
                  <span className="ml-auto shrink-0 text-surface-300 dark:text-surface-400">
                    {new Date(recentTransactions[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* NET BALANCE STATS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-4 flex flex-col justify-between min-h-[110px] transition-colors hover:shadow-sm">
              <div className="flex justify-between items-start">
                <span className="typo-label text-[#07521C] dark:text-[#B1EBC1]">Owed to You</span>
                <span className="w-5 h-5 rounded-full bg-[#16B843]/20 flex items-center justify-center text-xs text-[#16B843]">↘</span>
              </div>
              <div className="mt-3">
                <div className="typo-finance-lg text-[#07521C] dark:text-brand-400">
                  {currency} {stats.owedToYou.toFixed(2)}
                </div>
                <p className="typo-badge text-[#07521C]/60 dark:text-[#808080] mt-0.5">Plus settlements</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-4 flex flex-col justify-between min-h-[110px] transition-colors hover:shadow-sm">
              <div className="flex justify-between items-start">
                <span className="typo-label text-[#C21C1C] dark:text-red-300">You Owe</span>
                <span className="w-5 h-5 rounded-full bg-[#F63332]/20 flex items-center justify-center text-xs text-[#F63332]">↗</span>
              </div>
              <div className="mt-3">
                <div className="typo-finance-lg text-[#C21C1C] dark:text-red-400">
                  {currency} {stats.youOwe.toFixed(2)}
                </div>
                <p className="typo-badge text-[#C21C1C]/60 dark:text-[#808080] mt-0.5">Pay off balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: ACTIVITIES CHART & RECENT TRANSACTIONS */}
        <div className="lg:col-span-2 space-y-6">
          {/* ACTIVITIES BAR CHART */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-surface-500 dark:text-white uppercase tracking-wider">Spent Categories</h4>
                  <span className="text-[10px] font-bold text-surface-300">All trips</span>
                </div>

                <div className="flex justify-between items-end h-32 px-2 pt-2 gap-2 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-1">
                  {Object.entries(categoryBreakdown).map(([category, amount]) => {
                    const maxVal = Math.max(...Object.values(categoryBreakdown)) || 1
                    const heightPercent = Math.max(5, Math.min(100, (amount / maxVal) * 100))
                    
                    let barColor = 'bg-[#16B843]'
                    if (category === 'Food') barColor = 'bg-orange-500'
                    if (category === 'Transport') barColor = 'bg-blue-500'
                    if (category === 'Lodging') barColor = 'bg-indigo-500'
                    if (category === 'Entertainment') barColor = 'bg-purple-500'

                    return (
                      <div key={category} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-surface-500 dark:bg-surface-50 text-white dark:text-[#1E1E1E] text-[9px] font-bold py-1 px-1.5 rounded shadow transition-all duration-150 z-20 whitespace-nowrap">
                          {currency}{amount.toFixed(0)}
                        </div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-lg transition-all duration-500 ease-out origin-bottom hover:brightness-95 ${barColor}`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-between text-[8px] font-black text-surface-400 uppercase tracking-widest pt-2.5 px-0.5">
                {Object.keys(categoryBreakdown).map(cat => (
                  <span key={cat} className="truncate w-8 text-center" title={cat}>
                    {cat.substring(0, 3)}
                  </span>
                ))}
              </div>
            </div>

          {/* RECENT TRANSACTIONS LEDGER */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-5 hover:shadow-sm transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-black text-surface-500 dark:text-white uppercase tracking-wider">Recent Expenses</h4>
              <span className="text-[10px] font-bold text-[#16B843] bg-brand-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Live Logs</span>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-surface-400 font-bold">No expenses logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8ECF0] dark:border-[#2D2D2D] text-[9px] font-black text-surface-300 dark:text-surface-400 uppercase tracking-widest pb-2">
                      <th className="py-2.5">Detail</th>
                      <th className="py-2.5">Trip</th>
                      <th className="py-2.5 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8ECF0] dark:divide-[#2D2D2D]">
                    {recentTransactions.map(item => {
                      const theme = getCategoryTheme(item.category)
                      return (
                        <tr key={item.id} className="hover:bg-[#F9F9FB] dark:hover:bg-[#2D2D2D]/35 transition-colors group">
                          <td className="py-3 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm shrink-0 ${theme.bg}`}>
                              {theme.emoji}
                            </div>
                            <div>
                              <p className="text-xs font-black text-surface-500 dark:text-white group-hover:text-[#16B843] transition-colors line-clamp-1 max-w-[130px] md:max-w-none">
                                {item.description}
                              </p>
                              <p className="text-[10px] font-bold text-surface-300 mt-0.5">
                                {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 text-xs font-bold text-surface-400 dark:text-surface-300">
                            {item.trip_name}
                          </td>
                          <td className="py-3 text-right">
                            <div className="text-xs font-black text-surface-500 dark:text-white tabular-nums">
                              {currency}{item.convertedAmount?.toFixed(2) ?? Number(item.amount).toFixed(2)}
                            </div>
                            <span className="text-[8px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                              Success
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TRIP DIRECTORY SECTION */}
      <div className="space-y-4 pt-4">
        {/* Section Header */}
        <div className="flex justify-between items-end border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-3">
          <div>
            <h3 className="typo-h3">Your Trips</h3>
            <p className="typo-meta text-surface-300 dark:text-surface-400 mt-1">Active Travel Ledgers</p>
          </div>
          
          {/* Quick Tabs & Create CTA */}
          <div className="flex items-center gap-3">
            <div className="flex bg-[#F9F9F9] dark:bg-[#1E1E1E] p-1 rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-sm">
              {[
                ['active', 'Active'],
                ['completed', 'History']
              ].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    view === v
                      ? 'bg-[#16B843] text-white shadow-md shadow-[#16B843]/15'
                      : 'text-surface-400 hover:text-surface-500 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="hidden sm:inline-flex btn-primary !py-2.5 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Trip</span>
            </button>
          </div>
        </div>

        {/* Trips Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {loading ? (
            <>
              {[1, 2].map(i => (
                <div key={i} className="card overflow-hidden p-0">
                  <div className="h-1.5 w-full skeleton" />
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl skeleton" />
                        <div className="space-y-2">
                          <div className="w-40 h-4 skeleton rounded" />
                          <div className="w-24 h-3 skeleton rounded" />
                        </div>
                      </div>
                      <div className="w-16 h-5 skeleton rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : searched.length === 0 ? (
            <div className="col-span-2 text-center py-16 card bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] p-10">
              <div className="w-20 h-20 bg-brand-50 dark:bg-green-950/20 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
                {view === 'active' ? '🗺️' : '📦'}
              </div>
              <p className="text-surface-500 dark:text-white font-black text-lg">
                {view === 'active' ? 'No active trips found' : 'No history found'}
              </p>
              <p className="text-surface-400 dark:text-surface-400 text-xs mt-1.5 font-bold uppercase tracking-wider">
                {view === 'active' ? 'Tap "New Trip" to start split-billing!' : 'Your records are clean.'}
              </p>
            </div>
          ) : (
            searched.map((trip, idx) => {
              const iconStyle = TRIP_ICON_STYLES[idx % TRIP_ICON_STYLES.length]
              const isOwner = trip.owner_id === user.id
              const tripTotal = trip.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

              return (
                <button
                  key={trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                  className="w-full text-left bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden group active:scale-[0.99] p-0 border border-[#E8ECF0] dark:border-[#2D2D2D] hover:shadow-sm transition-all"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-[#16B843] via-emerald-400 to-[#16B843]" />
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${iconStyle}`}>
                          {getTripEmoji(trip.name)}
                        </div>
                        <div>
                          <h3 className="font-black text-surface-500 dark:text-white text-base group-hover:text-[#16B843] transition-colors leading-tight tracking-tight">
                            {trip.name}
                          </h3>
                          <p className="text-[10px] text-surface-300 dark:text-surface-400 font-bold mt-1 uppercase tracking-widest">
                            {new Date(trip.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        trip.status === 'active' ? 'bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400' : 'bg-surface-100 text-surface-400 dark:bg-neutral-800'
                      }`}>
                        {trip.status === 'active' ? '● Active' : '✓ Done'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-[#E8ECF0] dark:border-[#2D2D2D]">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                          isOwner ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-brand-50 text-brand-700 dark:bg-green-950/20 dark:text-brand-400'
                        }`}>
                          {isOwner ? '👑 Owner' : '👥 Member'}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-surface-50 text-surface-400 dark:bg-neutral-800 dark:text-surface-300 border border-[#E8ECF0] dark:border-[#2D2D2D] tabular-nums">
                          {currency}{convert(tripTotal, trip.base_currency || '₹', currency).toFixed(2)} spent
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#16B843] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        {trip.status === 'active' ? 'Open' : 'View'}
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* CREATE NEW TRIP MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-2xl relative animate-slideUp">
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-surface-500 dark:text-white text-lg tracking-tight">New Travel Ledger</h3>
                <p className="text-[10px] font-bold text-surface-300 uppercase tracking-widest mt-0.5">Start splitting costs</p>
              </div>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); setManualMembers([]); setNewMemberName('') }}
                className="w-7 h-7 bg-surface-50 dark:bg-[#2D2D2D] border border-[#E8ECF0] dark:border-[#3D3D3D] rounded-full flex items-center justify-center text-surface-400 dark:text-surface-300 hover:text-[#16B843] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createTrip} className="space-y-4">
              <div>
                <label className="input-label">Trip Name</label>
                <input
                  autoFocus
                  required
                  className="input"
                  placeholder="e.g. Goa Beach Trip, London Holiday..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>

              <div className="border-t border-[#E8ECF0] dark:border-[#2D2D2D] pt-4">
                <label className="input-label mb-2">Contributors (manual names)</label>
                
                {manualMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {manualMembers.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 dark:bg-green-950/30 dark:text-brand-400 text-xs px-2.5 py-1 rounded-full font-bold">
                        {name}
                        <button type="button" onClick={() => removeManualMember(name)} className="text-brand-400 hover:text-[#F63332] ml-0.5 transition-colors">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Member name (e.g. Hardik)"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualMember() } }}
                  />
                  <button type="button" onClick={addManualMember}
                    className="btn-secondary whitespace-nowrap !py-2">
                    + Add
                  </button>
                </div>
              </div>

              {createError && <p className="text-[#F63332] text-xs font-bold pl-1">{createError}</p>}
              
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); setManualMembers([]); setNewMemberName('') }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE CREATE FLOATING ACTION BUTTON */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-[#16B843] to-green-700 text-white rounded-[1.25rem] shadow-lg shadow-[#16B843]/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 sm:hidden"
        >
          <svg className="w-6 h-6 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

    </div>
  )
}

function getTripEmoji(name = '') {
  const n = name.toLowerCase()
  if (n.includes('goa') || n.includes('beach')) return '🏖️'
  if (n.includes('europe') || n.includes('paris') || n.includes('london')) return '🗼'
  if (n.includes('ladakh') || n.includes('mountain') || n.includes('trek')) return '🏔️'
  if (n.includes('dubai') || n.includes('uae')) return '🏙️'
  if (n.includes('bali') || n.includes('thailand')) return '🌴'
  if (n.includes('road') || n.includes('drive')) return '🚗'
  if (n.includes('flight') || n.includes('air')) return '✈️'
  return '🧳'
}
