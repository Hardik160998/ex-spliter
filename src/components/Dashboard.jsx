import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard({ user, currency, searchQuery, onSelectTrip, onOpenSettings, profile }) {
  const [trips, setTrips] = useState([])
  const [newName, setNewName] = useState('')
  const [view, setView] = useState('active')
  const [createError, setCreateError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [manualMembers, setManualMembers] = useState([])
  const [newMemberName, setNewMemberName] = useState('')

  // Financial Stats
  const [stats, setStats] = useState({ totalSpent: 0, owedToYou: 0, youOwe: 0 })
  const [recentTransactions, setRecentTransactions] = useState([])
  const [categoryBreakdown, setCategoryBreakdown] = useState({
    Food: 0,
    Transport: 0,
    Lodging: 0,
    Entertainment: 0,
    Other: 0
  })

  // Mini Calendar Date
  const [currentDate, setCurrentDate] = useState(new Date())

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
      // 1. Fetch all members of these trips to compute debt splits
      const { data: members, error: memErr } = await supabase
        .from('trip_members')
        .select('id, trip_id, user_id, source')
        .in('trip_id', tripIds)

      if (memErr) throw memErr

      // 2. Fetch all expenses
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('id, amount, description, category, created_at, member_id, trip_id')
        .in('trip_id', tripIds)

      if (expErr) throw expErr

      // Calculate stats
      let totalSpent = 0 // Sum of all expenses paid by me
      let owedToYou = 0
      let youOwe = 0

      const cats = { Food: 0, Transport: 0, Lodging: 0, Entertainment: 0, Other: 0 }

      // Process trip by trip
      allTrips.forEach(trip => {
        const tripExpenses = expenses?.filter(e => e.trip_id === trip.id) || []
        const tripMembers = members?.filter(m => m.trip_id === trip.id) || []
        const memberCount = tripMembers.length || 1

        const myMember = tripMembers.find(m => m.user_id === user.id)
        const myMemberId = myMember ? myMember.id : null

        let tripPaidByMe = 0
        let tripTotalSpent = 0

        tripExpenses.forEach(exp => {
          const amt = Number(exp.amount) || 0
          tripTotalSpent += amt

          // Payer is me
          if (myMemberId && exp.member_id === myMemberId) {
            tripPaidByMe += amt
            totalSpent += amt
          }

          // Category distribution
          const cat = exp.category || 'Other'
          const normalizedCat = cats[cat] !== undefined ? cat : 'Other'
          cats[normalizedCat] += amt
        })

        // Simple split calculation for dashboard overview
        const myShare = tripTotalSpent / memberCount
        const myTripBalance = tripPaidByMe - myShare

        if (myTripBalance > 0) {
          owedToYou += myTripBalance
        } else if (myTripBalance < 0) {
          youOwe += Math.abs(myTripBalance)
        }
      })

      setStats({
        totalSpent,
        owedToYou,
        youOwe
      })

      setCategoryBreakdown(cats)

      // Get 5 most recent transactions with trip names
      const sortedExpenses = [...(expenses || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(exp => {
          const trip = allTrips.find(t => t.id === exp.trip_id)
          return {
            ...exp,
            trip_name: trip ? trip.name : 'Unknown Trip'
          }
        })

      setRecentTransactions(sortedExpenses)
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

  const TRIP_GRADIENTS = [
    'from-brand-500 to-emerald-600',
    'from-neutral-800 to-neutral-900 dark:from-neutral-700 dark:to-neutral-900',
    'from-emerald-500 to-teal-600',
    'from-[#16B843] to-green-700',
    'from-teal-500 to-cyan-600'
  ]

  // Mini Calendar Generation
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const days = new Date(year, month + 1, 0).getDate()
    
    const arr = []
    // Add empty padding slots for days of week before first day of month
    for (let i = 0; i < firstDay; i++) {
      arr.push(null)
    }
    for (let d = 1; d <= days; d++) {
      arr.push(d)
    }
    return arr
  }

  const daysArr = getDaysInMonth(currentDate)
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
          {/* PREMIUM CREDIT CARD */}
          <div className="relative overflow-hidden rounded-[1.5rem] p-6 bg-gradient-to-br from-[#1E1E1E] via-[#2A2A2A] to-[#121212] border border-[#2D2D2D] shadow-2xl text-white aspect-[1.6/1] flex flex-col justify-between group transition-all duration-300 hover:shadow-brand-500/5">
            {/* Glowing accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#16B843]/15 rounded-full blur-2xl group-hover:bg-[#16B843]/25 transition-all" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            
            {/* Card Top */}
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-widest text-[#808080] uppercase">Trip Card</span>
                <h4 className="text-sm font-bold tracking-tight text-white/90">Premium Pass</h4>
              </div>
              <div className="w-10 h-7 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-xs">⚡</span>
              </div>
            </div>

            {/* Card Middle (Balance) */}
            <div className="space-y-1.5 relative z-10">
              <span className="text-[10px] font-bold text-[#808080] uppercase tracking-wider">Total Spent (Paid by You)</span>
              <div className="text-3xl font-black tracking-tight flex items-baseline gap-1 tabular-nums text-white">
                <span className="text-lg font-bold text-[#16B843]">{currency}</span>
                {stats.totalSpent.toFixed(2)}
              </div>
            </div>

            {/* Card Bottom */}
            <div className="flex justify-between items-end relative z-10 border-t border-white/[0.06] pt-3.5">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-[#808080] uppercase tracking-wider">Card Holder</span>
                <p className="text-xs font-black tracking-tight text-white/90 max-w-[120px] truncate uppercase">
                  {profile?.display_name || user.email?.split('@')[0]}
                </p>
              </div>
              <span className="text-xs font-mono tracking-widest text-white/40">•••• 9876</span>
            </div>
          </div>

          {/* NET BALANCE STATS */}
          <div className="grid grid-cols-2 gap-4">
            {/* Owed to You */}
            <div className="card p-4 flex flex-col justify-between min-h-[110px] bg-[#DAF7E2] dark:bg-[#1E1E1E]/50 dark:border-[#2D2D2D]/60 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-[#07521C] dark:text-[#B1EBC1] uppercase tracking-wider">Owed to You</span>
                <span className="w-5 h-5 rounded-full bg-[#16B843]/20 flex items-center justify-center text-xs text-[#16B843]">↘</span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-[#07521C] dark:text-brand-400 tabular-nums">
                  {currency} {stats.owedToYou.toFixed(2)}
                </div>
                <p className="text-[9px] font-bold text-[#07521C]/60 dark:text-[#808080] mt-0.5">Plus settlements</p>
              </div>
            </div>

            {/* You Owe */}
            <div className="card p-4 flex flex-col justify-between min-h-[110px] bg-red-50 dark:bg-[#1E1E1E]/50 dark:border-[#2D2D2D]/60 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-[#C21C1C] dark:text-red-300 uppercase tracking-wider">You Owe</span>
                <span className="w-5 h-5 rounded-full bg-[#F63332]/20 flex items-center justify-center text-xs text-[#F63332]">↗</span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-[#C21C1C] dark:text-red-400 tabular-nums">
                  {currency} {stats.youOwe.toFixed(2)}
                </div>
                <p className="text-[9px] font-bold text-[#C21C1C]/60 dark:text-[#808080] mt-0.5">Pay off balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: ACTIVITIES CHART & RECENT TRANSACTIONS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* ACTIVITIES BAR CHART */}
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-surface-500 dark:text-white uppercase tracking-wider">Spent Categories</h4>
                  <span className="text-[10px] font-bold text-surface-300">All trips</span>
                </div>

                {/* Animated CSS Bars */}
                <div className="flex justify-between items-end h-32 px-2 pt-2 gap-2 border-b border-[#EEEEEE] dark:border-[#2D2D2D] pb-1">
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
                        {/* Tooltip */}
                        <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-surface-500 dark:bg-surface-50 text-white dark:text-[#1E1E1E] text-[9px] font-bold py-1 px-1.5 rounded shadow transition-all duration-150 z-20 whitespace-nowrap">
                          {currency}{amount.toFixed(0)}
                        </div>
                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-lg transition-all duration-500 ease-out origin-bottom hover:brightness-95 ${barColor}`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chart labels */}
              <div className="flex justify-between text-[8px] font-black text-surface-400 uppercase tracking-widest pt-2.5 px-0.5">
                {Object.keys(categoryBreakdown).map(cat => (
                  <span key={cat} className="truncate w-8 text-center" title={cat}>
                    {cat.substring(0, 3)}
                  </span>
                ))}
              </div>
            </div>

            {/* MINI INTERACTIVE CALENDAR */}
            <div className="card p-5">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-black text-surface-500 dark:text-white uppercase tracking-wider">
                  {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                    className="p-1 rounded bg-[#F9F9F9] dark:bg-[#2D2D2D] hover:bg-brand-50 border border-[#EEEEEE] dark:border-[#3D3D3D] text-xs transition-all active:scale-90"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                    className="p-1 rounded bg-[#F9F9F9] dark:bg-[#2D2D2D] hover:bg-brand-50 border border-[#EEEEEE] dark:border-[#3D3D3D] text-xs transition-all active:scale-90"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {weekDays.map((wd, i) => (
                  <span key={i} className="text-[9px] font-black text-surface-300 dark:text-surface-400">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {daysArr.map((day, idx) => {
                  const today = new Date()
                  const isToday =
                    day &&
                    today.getDate() === day &&
                    today.getMonth() === currentDate.getMonth() &&
                    today.getFullYear() === currentDate.getFullYear()

                  return (
                    <div
                      key={idx}
                      className={`text-xs h-6 w-full flex items-center justify-center rounded-lg font-bold ${
                        day ? 'cursor-pointer' : 'pointer-events-none'
                      } ${
                        isToday
                          ? 'bg-[#16B843] text-white shadow-md shadow-[#16B843]/20 scale-105'
                          : day
                          ? 'hover:bg-brand-50 dark:hover:bg-[#2D2D2D] text-surface-500 dark:text-white'
                          : 'opacity-0'
                      }`}
                    >
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* RECENT TRANSACTIONS LEDGER */}
          <div className="card p-5">
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
                    <tr className="border-b border-[#EEEEEE] dark:border-[#2D2D2D] text-[9px] font-black text-surface-300 dark:text-surface-400 uppercase tracking-widest pb-2">
                      <th className="py-2.5">Detail</th>
                      <th className="py-2.5">Trip</th>
                      <th className="py-2.5 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#2D2D2D]">
                    {recentTransactions.map(item => {
                      const theme = getCategoryTheme(item.category)
                      return (
                        <tr key={item.id} className="hover:bg-surface-50/50 dark:hover:bg-[#2D2D2D]/35 transition-colors group">
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
                              {currency}{Number(item.amount).toFixed(2)}
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
        <div className="flex justify-between items-end border-b border-[#EEEEEE] dark:border-[#2D2D2D] pb-3">
          <div>
            <h3 className="text-lg font-black tracking-tight text-surface-500 dark:text-white leading-none">Your Trips</h3>
            <p className="text-xs font-bold text-surface-300 mt-1 uppercase tracking-widest">Active Travel Ledgers</p>
          </div>
          
          {/* Quick Tabs & Create CTA */}
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-[#F9F9F9] dark:bg-[#1E1E1E] p-1 rounded-2xl border border-[#EEEEEE] dark:border-[#2D2D2D] shadow-sm">
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

            {/* Create CTA Button (Desktop) */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            <div className="col-span-2 text-center py-16 card bg-white dark:bg-[#1E1E1E] border border-[#EEEEEE] dark:border-[#2D2D2D] p-10">
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
              const gradient = TRIP_GRADIENTS[idx % TRIP_GRADIENTS.length]
              const isOwner = trip.owner_id === user.id
              const tripTotal = trip.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

              return (
                <button
                  key={trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                  className="w-full text-left card overflow-hidden group active:scale-[0.99] p-0 border border-[#EEEEEE] dark:border-[#2D2D2D] bg-white dark:bg-[#1E1E1E]"
                >
                  <div className={`bg-gradient-to-r ${gradient} h-1.5 w-full`} />
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-[1.25rem] bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl shadow-lg shadow-black/10 group-hover:scale-105 transition-transform duration-200`}>
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

                    <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-[#EEEEEE] dark:border-[#2D2D2D]">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                          isOwner ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-brand-50 text-brand-700 dark:bg-green-950/20 dark:text-brand-400'
                        }`}>
                          {isOwner ? '👑 Owner' : '👥 Member'}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-surface-50 text-surface-400 dark:bg-neutral-800 dark:text-surface-300 border border-[#EEEEEE] dark:border-[#2D2D2D] tabular-nums">
                          {trip.base_currency || '₹'}{tripTotal.toFixed(2)} spent
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
          <div className="w-full max-w-md bg-white dark:bg-[#1E1E1E] p-6 rounded-[2rem] border border-[#EEEEEE] dark:border-[#2D2D2D] shadow-2xl relative animate-slideUp">
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-surface-500 dark:text-white text-lg tracking-tight">New Travel Ledger</h3>
                <p className="text-[10px] font-bold text-surface-300 uppercase tracking-widest mt-0.5">Start splitting costs</p>
              </div>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); setManualMembers([]); setNewMemberName('') }}
                className="w-7 h-7 bg-surface-50 dark:bg-[#2D2D2D] border border-[#EEEEEE] dark:border-[#3D3D3D] rounded-full flex items-center justify-center text-surface-400 dark:text-surface-300 hover:text-[#16B843] transition-colors"
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

              <div className="border-t border-[#EEEEEE] dark:border-[#2D2D2D] pt-4">
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
          className="fixed bottom-6 right-6 mb-[env(safe-area-inset-bottom)] w-14 h-14 bg-gradient-to-br from-[#16B843] to-green-700 text-white rounded-[1.25rem] shadow-lg shadow-[#16B843]/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 sm:hidden"
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
