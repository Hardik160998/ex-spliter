import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrencyRates } from '../hooks/useCurrencyRates'

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'spending-desc', label: 'Highest Spend' },
  { value: 'spending-asc', label: 'Lowest Spend' },
]

const TRIP_GRADIENTS = [
  'from-brand-500 to-emerald-600',
  'from-neutral-800 to-neutral-900 dark:from-neutral-700 dark:to-neutral-900',
  'from-emerald-500 to-teal-600',
  'from-[#16B843] to-green-700',
  'from-teal-500 to-cyan-600',
]

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

export default function TripList({ user, currency, onSelectTrip, onOpenSettings, profile }) {
  const { convert } = useCurrencyRates()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date-desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [manualMembers, setManualMembers] = useState([])
  const [newMemberName, setNewMemberName] = useState('')

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('trip_id, trips(id, name, status, owner_id, created_at, base_currency, expenses(id, amount, description, category, created_at, member_id))')
        .eq('user_id', user.id)

      if (error) { console.error(error); setLoading(false); return }

      const raw = data?.map(r => r.trips).filter(Boolean) ?? []
      const seen = new Set()
      const unique = raw.filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })

      setTrips(unique)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => { fetchTrips() }, [])

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
    await supabase.from('trip_members').insert({
      trip_id: trip.id, user_id: user.id, role: 'owner', display_name: displayName,
    })

    for (const name of manualMembers) {
      if (!name.trim()) continue
      await supabase.from('trip_members').insert({
        trip_id: trip.id, user_id: null, role: 'contributor', display_name: name.trim(), source: 'manual',
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

  // Filter & sort
  const filtered = trips.filter(t => {
    if (activeTab === 'active' && t.status !== 'active') return false
    if (activeTab === 'completed' && t.status !== 'completed') return false
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const aTotal = convert(
      a.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0,
      a.base_currency || '₹', currency
    )
    const bTotal = convert(
      b.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0,
      b.base_currency || '₹', currency
    )
    switch (sortBy) {
      case 'date-asc': return new Date(a.created_at) - new Date(b.created_at)
      case 'name-asc': return a.name.localeCompare(b.name)
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'spending-desc': return bTotal - aTotal
      case 'spending-asc': return aTotal - bTotal
      default: return new Date(b.created_at) - new Date(a.created_at)
    }
  })

  const activeCount = trips.filter(t => t.status === 'active').length
  const completedCount = trips.filter(t => t.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-4">
        <div>
          <h2 className="text-xl font-black text-surface-500 dark:text-white leading-none">Trip Directory</h2>
          <p className="text-[10px] font-bold text-[#808080] mt-1.5 uppercase tracking-widest">
            {trips.length} trip{trips.length !== 1 ? 's' : ''} · {activeCount} active · {completedCount} completed
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary !py-2.5 text-xs shadow-md shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>New Trip</span>
        </button>
      </div>

      {/* Search + Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search trips..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-surface-500 dark:text-white outline-none focus:border-[#16B843] focus:ring-1 focus:ring-[#16B843] transition-all placeholder-surface-300 dark:placeholder-surface-400"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="h-full flex items-center gap-2 bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] rounded-xl px-4 py-2.5 text-xs font-bold text-surface-500 dark:text-white hover:border-[#16B843] transition-all"
          >
            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6M3 12h12M3 17h18" />
            </svg>
            <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
            <span className="sm:hidden">Sort</span>
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] rounded-xl shadow-xl py-1.5 z-40 animate-fadeIn origin-top-right">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortMenu(false) }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                      sortBy === opt.value
                        ? 'text-[#16B843] bg-brand-50/50 dark:bg-green-950/20'
                        : 'text-surface-500 dark:text-white hover:bg-surface-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex bg-[#F9F9F9] dark:bg-[#1E1E1E] p-1 rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-sm w-fit">
        {[
          { id: 'all', label: 'All Trips', count: trips.length },
          { id: 'active', label: 'Active', count: activeCount },
          { id: 'completed', label: 'History', count: completedCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === tab.id
                ? 'bg-[#16B843] text-white shadow-md shadow-[#16B843]/15'
                : 'text-surface-400 hover:text-surface-500 dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-100 dark:bg-[#2D2D2D] text-surface-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Trip Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] overflow-hidden">
              <div className="h-1.5 w-full skeleton" />
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl skeleton" />
                    <div className="space-y-2">
                      <div className="w-36 h-4 skeleton rounded" />
                      <div className="w-20 h-3 skeleton rounded" />
                    </div>
                  </div>
                  <div className="w-14 h-5 skeleton rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] p-10">
          <div className="w-20 h-20 bg-brand-50 dark:bg-green-950/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
            {activeTab === 'completed' ? '📦' : '🗺️'}
          </div>
          <p className="text-surface-500 dark:text-white font-black text-lg">
            {searchQuery ? 'No trips match your search' : activeTab === 'active' ? 'No active trips yet' : activeTab === 'completed' ? 'No completed trips' : 'No trips found'}
          </p>
          <p className="text-surface-400 dark:text-surface-400 text-xs mt-1.5 font-bold uppercase tracking-wider">
            {searchQuery ? 'Try a different search term' : 'Create a new trip to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {sorted.map((trip, idx) => {
            const gradient = TRIP_GRADIENTS[idx % TRIP_GRADIENTS.length]
            const isOwner = trip.owner_id === user.id
            const tripTotal = convert(
              trip.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0,
              trip.base_currency || '₹', currency
            )
            const expenseCount = trip.expenses?.length || 0

            return (
              <button
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className="w-full text-left bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden group active:scale-[0.99] border border-[#E8ECF0] dark:border-[#2D2D2D] hover:shadow-md transition-all"
              >
                <div className={`bg-gradient-to-r ${gradient} h-1.5 w-full`} />
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0`}>
                        {getTripEmoji(trip.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-surface-500 dark:text-white text-sm group-hover:text-[#16B843] transition-colors leading-tight truncate">
                          {trip.name}
                        </h3>
                        <p className="text-[10px] text-surface-300 dark:text-surface-400 font-bold mt-1 uppercase tracking-widest">
                          {new Date(trip.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      trip.status === 'active' ? 'bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400' : 'bg-surface-100 text-surface-400 dark:bg-neutral-800'
                    }`}>
                      {trip.status === 'active' ? '● Active' : '✓ Done'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 py-3 border-t border-[#E8ECF0] dark:border-[#2D2D2D]">
                    <div className="text-center">
                      <p className="text-sm font-black text-surface-500 dark:text-white tabular-nums">{currency}{tripTotal.toFixed(2)}</p>
                      <p className="text-[8px] font-bold text-surface-300 uppercase tracking-wider mt-0.5">Spent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-surface-500 dark:text-white tabular-nums">{expenseCount}</p>
                      <p className="text-[8px] font-bold text-surface-300 uppercase tracking-wider mt-0.5">Expenses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-surface-500 dark:text-white">{isOwner ? '👑' : '👤'}</p>
                      <p className="text-[8px] font-bold text-surface-300 uppercase tracking-wider mt-0.5">{isOwner ? 'Owner' : 'Member'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isOwner ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-brand-50 text-brand-700 dark:bg-green-950/20 dark:text-brand-400'
                    }`}>
                      {isOwner ? '👑 Owner' : '👥 Member'}
                    </span>
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
          })}
        </div>
      )}

      {/* CREATE TRIP MODAL */}
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
    </div>
  )
}
