import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('info')

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsg(error.message); setMsgType('error'); return }

      // Ensure profile exists for existing users
      if (data?.user) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
        if (!profile) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: email.split('@')[0],
            updated_at: new Date().toISOString(),
          })
        }
      }
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
              <div className="relative">
                <input className={inputCls + " pr-12"} type={showPassword ? "text" : "password"} placeholder="Min. 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-4 mt-1 flex items-center text-slate-400 hover:text-indigo-500 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-200 mt-2">
              {isSignUp ? 'Create Account' : 'Sign In'}
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
