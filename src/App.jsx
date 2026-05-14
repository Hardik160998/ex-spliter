import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import TripView from './components/TripView'

async function redeemInvite(token, user) {
  const { data: invite, error: invErr } = await supabase
    .from('trip_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (invErr || !invite) return 'Invalid or expired invite link.'
  if (invite.used_at) return 'This invite link has already been used.'
  if (new Date(invite.expires_at) < new Date()) return 'This invite link has expired.'

  const { data: existing } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', invite.trip_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    const { error: memberErr } = await supabase.from('trip_members').insert({
      trip_id: invite.trip_id,
      user_id: user.id,
      role: 'contributor',
      display_name: profile?.display_name || user.email,
    })
    if (memberErr) return memberErr.message
  }

  await supabase.from('trip_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  return null
}

// Clean URL router using History API
function getRoute() {
  const path = window.location.pathname
  const match = path.match(/^\/trip\/([a-f0-9-]+)$/)
  if (match) return { page: 'trip', tripId: match[1] }
  return { page: 'dashboard' }
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [route, setRoute] = useState(getRoute)
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || '₹')
  const [inviteStatus, setInviteStatus] = useState(null)

  // Listen to popstate (back/forward browser buttons)
  useEffect(() => {
    const onPop = () => setRoute(getRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // Save invite token before URL gets cleared
    const token = new URLSearchParams(window.location.search).get('token')
    if (token) {
      localStorage.setItem('invite_token', token)
      window.history.replaceState({}, '', '/')
    }

    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const token = localStorage.getItem('invite_token')
    if (!token) return
    setInviteStatus('redeeming')
    redeemInvite(token, session.user).then((err) => {
      localStorage.removeItem('invite_token')
      setInviteStatus(err ?? 'success')
    })
  }, [session])

  const navigate = (tripId) => {
    const path = tripId ? `/trip/${tripId}` : '/'
    window.history.pushState({}, '', path)
    setRoute(getRoute())
  }

  const handleCurrencyChange = (c) => {
    setCurrency(c)
    localStorage.setItem('currency', c)
  }

  // Loading
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">✈️</div>
          <p className="text-slate-400 text-sm">Loading TripSplit...</p>
        </div>
      </div>
    )
  }

  if (!session) return <Auth />

  // Invite overlays
  if (inviteStatus === 'redeeming') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 text-center space-y-3">
          <div className="text-5xl animate-pulse">⏳</div>
          <p className="text-slate-700 font-semibold text-lg">Joining trip...</p>
        </div>
      </div>
    )
  }

  if (inviteStatus && inviteStatus !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 text-center space-y-4 max-w-sm w-full">
          <div className="text-5xl">❌</div>
          <p className="text-slate-700 font-semibold text-lg">Could not join trip</p>
          <p className="text-red-500 text-sm">{inviteStatus}</p>
          <button onClick={() => { setInviteStatus(null); navigate(null) }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold transition">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (inviteStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 text-center space-y-4 max-w-sm w-full">
          <div className="text-5xl">🎉</div>
          <p className="text-slate-700 font-semibold text-lg">You've joined the trip!</p>
          <p className="text-slate-400 text-sm">You can now view and add expenses.</p>
          <button onClick={() => { setInviteStatus(null); navigate(null) }}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-2xl font-bold transition shadow-lg shadow-indigo-200">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Routed pages
  if (route.page === 'trip' && route.tripId) {
    return (
      <TripView
        tripId={route.tripId}
        user={session.user}
        currency={currency}
        onBack={() => navigate(null)}
      />
    )
  }

  return (
    <Dashboard
      user={session.user}
      currency={currency}
      onCurrencyChange={handleCurrencyChange}
      onSelectTrip={(id) => navigate(id)}
    />
  )
}
