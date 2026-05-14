import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import TripView from './components/TripView'

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

  // Listen to popstate (back/forward browser buttons)
  useEffect(() => {
    const onPop = () => setRoute(getRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    try {
      localStorage.removeItem('invite_token')
    } catch {
      /* ignore */
    }
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

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
