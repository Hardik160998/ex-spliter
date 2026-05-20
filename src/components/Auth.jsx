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
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setMsg('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setMsg(error.message); setMsgType('error'); setLoading(false); return }

        if (data?.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: displayName.trim(),
            updated_at: new Date().toISOString(),
          })
        }

        setMsg('Account created successfully! You can now sign in.')
        setMsgType('success')
        setIsSignUp(false)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setMsg(error.message); setMsgType('error'); setLoading(false); return }

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
    } catch (err) {
      console.error(err)
      setMsg('Something went wrong. Please try again.')
      setMsgType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9F9F9] via-[#EEEEEE] to-[#F9F9F9] dark:from-[#121212] dark:via-[#1C1C1C] dark:to-[#121212] flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-300">
      
      {/* Dynamic Background Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#16B843]/10 dark:bg-[#16B843]/15 blur-3xl animate-pulse duration-4000" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#B1EBC1]/10 dark:bg-[#B1EBC1]/5 blur-3xl animate-pulse duration-6000" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Logo/Branding Block */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-[#16B843] to-green-700 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-[#16B843]/20">
            <span className="text-2xl drop-shadow">✈️</span>
          </div>
          <h1 className="text-3xl font-black text-surface-500 dark:text-white tracking-tight leading-none">
            TripSplit
          </h1>
          <p className="text-xs font-bold text-[#808080] mt-1.5 uppercase tracking-widest">
            Travel ledgers & expense sharing
          </p>
        </div>

        {/* Auth Credentials Card */}
        <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[2.25rem] border border-[#EEEEEE] dark:border-[#2D2D2D] shadow-2xl relative">
          
          <div className="mb-6">
            <h2 className="text-lg font-black text-surface-500 dark:text-white tracking-tight">
              {isSignUp ? 'Create your profile' : 'Sign in to dashboard'}
            </h2>
            <p className="text-[10px] font-bold text-[#808080] uppercase tracking-widest mt-0.5">
              {isSignUp ? 'Join your travel buddies' : 'Welcome back, traveller'}
            </p>
          </div>

          <form onSubmit={handle} className="space-y-4">
            
            {isSignUp && (
              <div>
                <label className="input-label">Display Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div>
              <label className="input-label">Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-surface-300 hover:text-[#16B843] transition-colors"
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
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 shadow-lg shadow-[#16B843]/15 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isSignUp ? 'Create Profile' : 'Access Account'}</span>
              )}
            </button>
          </form>

          {msg && (
            <p className={`text-xs mt-4 text-center font-black ${msgType === 'error' ? 'text-[#F63332]' : 'text-[#16B843]'}`}>
              {msg}
            </p>
          )}

          <p className="text-surface-300 dark:text-[#808080] text-xs text-center mt-5 font-bold">
            {isSignUp ? 'Already have an account?' : "First time using TripSplit?"}
            <button
              type="button"
              className="text-[#16B843] font-black ml-1 hover:text-green-700 transition-colors uppercase tracking-wider text-[10px]"
              onClick={() => { setIsSignUp(!isSignUp); setMsg(''); setDisplayName('') }}
            >
              {isSignUp ? 'Sign In' : 'Register Now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
