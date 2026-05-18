import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard({ user, currency, onCurrencyChange, onSelectTrip, onOpenSettings }) {
  const [trips, setTrips] = useState([])
  const [newName, setNewName] = useState('')
  const [view, setView] = useState('active')
  const [createError, setCreateError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [manualMembers, setManualMembers] = useState([])
  const [newMemberName, setNewMemberName] = useState('')

  const fetchTrips = async () => {
    const { data, error } = await supabase
      .from('trip_members')
      .select('trip_id, trips(id, name, status, owner_id, created_at, base_currency, expenses(amount))')
      .eq('user_id', user.id)
    if (error) console.error('fetchTrips error:', error)
    const raw = data?.map(r => r.trips).filter(Boolean) ?? []
    // deduplicate by id
    const seen = new Set()
    const unique = raw.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    setTrips(unique)
    setLoading(false)
  }

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(data)
  }

  useEffect(() => { fetchTrips(); fetchProfile() }, [])

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

    // Add manual members
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
    setManualMembers([...manualMembers, newMemberName.trim()])
    setNewMemberName('')
  }

  const removeManualMember = (name) => {
    setManualMembers(manualMembers.filter(m => m !== name))
  }

  const active = trips.filter(t => t.status === 'active')
  const completed = trips.filter(t => t.status === 'completed')
  const filtered = view === 'active' ? active : completed
  const initials = (profile?.display_name || user.email || '?')[0].toUpperCase()
  const firstName = profile?.display_name?.split(' ')[0] || 'Traveller'

  const TRIP_GRADIENTS = [
    'from-violet-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-sky-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
  ]

  return (
    <div className="min-h-screen bg-[#f5f6fa]">

      {/* ── Top Nav ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">✈️</span>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              TripSplit
            </span>
          </div>
          <button type="button" onClick={() => onOpenSettings?.()}
            className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-2xl transition">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <span className="text-sm font-semibold text-slate-700 hidden sm:block max-w-[100px] truncate">
              {profile?.display_name || user.email}
            </span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 pb-24">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl mt-6 px-7 pt-8 pb-10 shadow-2xl shadow-indigo-200">
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-14 -left-8 w-56 h-56 bg-white/5 rounded-full" />
          <div className="absolute top-6 right-24 w-20 h-20 bg-white/10 rounded-full" />

          <div className="relative z-10">
            <p className="text-indigo-200 text-sm font-medium mb-1">Good {getGreeting()},</p>
            <h1 className="text-3xl font-black text-white mb-1">{firstName} 👋</h1>
            <p className="text-indigo-200 text-sm mb-8">
              {active.length > 0
                ? `You have ${active.length} active trip${active.length > 1 ? 's' : ''} in progress`
                : 'Ready to plan your next adventure?'}
            </p>

            {/* Stats pills */}
            <div className="flex gap-3 mb-8">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-black text-white">{active.length}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Active</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-black text-white">{completed.length}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Completed</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-black text-white">{trips.length}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Total</p>
              </div>
            </div>

            {/* Create button */}
            <button onClick={() => setShowCreate(true)}
              className="w-full bg-white text-indigo-700 font-bold py-3.5 rounded-2xl hover:bg-indigo-50 transition shadow-lg flex items-center justify-center gap-2 text-sm">
              <span className="text-lg">+</span> Create New Trip
            </button>
          </div>
        </div>

        {/* ── Create Trip Inline Form (slides in) ── */}
        {showCreate && (
          <div className="mt-4 bg-white rounded-3xl border border-slate-200 shadow-lg p-5">
            <h3 className="font-bold text-slate-800 mb-3">New Trip</h3>
            <form onSubmit={createTrip} className="space-y-3">
              <input
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm"
                placeholder="Trip name (e.g. Goa 2025, Ladakh Road Trip...)"
                value={newName} onChange={e => setNewName(e.target.value)}
              />

              {/* Manual Members */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Members (no account needed)</p>
                
                {manualMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {manualMembers.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-full font-medium">
                        {name}
                        <button type="button" onClick={() => removeManualMember(name)} className="text-slate-400 hover:text-red-500 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    placeholder="Add member name (e.g. Hardik)"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualMember() } }}
                  />
                  <button type="button" onClick={addManualMember}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition">
                    + Add
                  </button>
                </div>
              </div>

              {createError && <p className="text-red-500 text-xs pl-1">{createError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); setManualMembers([]); setNewMemberName('') }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-2xl text-sm font-semibold transition">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-2xl text-sm font-bold transition shadow-md shadow-indigo-200">
                  Create Trip
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-2xl mt-6 shadow-sm">
          {[['active', '🟢 Active Trips'], ['history', '📁 History']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                view === v
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

{/* ── Trip List ── */}
        <div className="mt-5 space-y-4">
          {loading ? (
            <>
              {[1, 2].map(i => (
                <div key={i} className="w-full text-left bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Colored top strip */}
                  <div className="h-1.5 w-full bg-slate-200 animate-pulse" />
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-200 animate-pulse" />
                        <div>
                          <div className="w-40 h-4 bg-slate-200 rounded animate-pulse mb-1.5" />
                          <div className="w-24 h-3 bg-slate-200 rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="w-16 h-5 bg-slate-200 rounded-full animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                        <div className="w-10 h-4 bg-slate-200 rounded animate-pulse" />
                      </div>
                      <div className="w-12 h-3 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4">
                {view === 'active' ? '🗺️' : '📦'}
              </div>
              <p className="text-slate-700 font-bold text-lg">
                {view === 'active' ? 'No active trips' : 'No completed trips'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {view === 'active' ? 'Tap "Create New Trip" to get started!' : 'Completed trips will appear here.'}
              </p>
            </div>
          ) : (
            filtered.map((trip, idx) => {
              const gradient = TRIP_GRADIENTS[idx % TRIP_GRADIENTS.length]
              const isOwner = trip.owner_id === user.id
              return (
                <button key={trip.id} onClick={() => onSelectTrip(trip.id)}
                  className="w-full text-left bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden group">
                  {/* Colored top strip */}
                  <div className={`bg-gradient-to-r ${gradient} h-1.5 w-full`} />
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        {/* Icon circle */}
                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg shadow-md`}>
                          {getTripEmoji(trip.name)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition leading-tight">
                            {trip.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(trip.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          trip.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {trip.status === 'active' ? '● Active' : '✓ Done'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                          isOwner ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {isOwner ? '👑 Owner' : '👥 Member'}
                        </span>
                        <span className="text-xs font-bold bg-slate-50 border border-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">
                          {trip.base_currency || '₹'} {(trip.expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0).toFixed(2)} Spent
                        </span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0">
                        {trip.status === 'active' ? 'Open →' : 'View →'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </main>

      {/* ── Floating Create Button (mobile) ── */}
      {!showCreate && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 mb-[env(safe-area-inset-bottom)] w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-[1.25rem] shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-10 sm:hidden">
          <svg className="w-6 h-6 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
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
