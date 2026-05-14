import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('info')
  const [hasInvite, setHasInvite] = useState(false)

  useEffect(() => {
    try { setHasInvite(!!localStorage.getItem('invite_token')) } catch {}
  }, [])

  const handle = async (e) => {
    e.preventDefault()
    setMsg('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setMsg(error.message); setMsgType('error'); return }

      // Save display name to profiles table
      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim(),
          updated_at: new Date().toISOString(),
        })
      }

      setMsg('Account created! You can now sign in.')
      setMsgType('info')
      setIsSignUp(false)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsg(error.message); setMsgType('error') }
    }
  }

  const inputCls = 'mt-1 w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✈️</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            TripSplit
          </h1>
          <p className="text-slate-500 text-sm mt-1">Split expenses with your travel crew</p>
        </div>

        {hasInvite && (
          <div className="bg-indigo-600 text-white rounded-2xl px-5 py-4 mb-5 text-center shadow-lg shadow-indigo-200">
            <p className="font-semibold">🎉 You've been invited to a trip!</p>
            <p className="text-indigo-200 text-xs mt-1">Sign in or create an account to join.</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>

          <form onSubmit={handle} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Name</label>
                <input className={inputCls} type="text" placeholder="John Doe"
                  value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
              <input className={inputCls} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
              <input className={inputCls} type="password" placeholder="Min. 6 characters"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-200 mt-2">
              {isSignUp ? (hasInvite ? 'Sign Up & Join Trip' : 'Create Account') : (hasInvite ? 'Sign In & Join Trip' : 'Sign In')}
            </button>
          </form>

          {msg && (
            <p className={`text-sm mt-4 text-center font-medium ${msgType === 'error' ? 'text-red-500' : 'text-indigo-600'}`}>
              {msg}
            </p>
          )}

          <p className="text-slate-400 text-sm text-center mt-5">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button className="text-indigo-600 font-semibold ml-1 hover:underline"
              onClick={() => { setIsSignUp(!isSignUp); setMsg(''); setDisplayName('') }}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
