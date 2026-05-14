import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const CURRENCIES = [
  { code: '₹', label: 'Indian Rupee' },
  { code: '$', label: 'US Dollar' },
  { code: '€', label: 'Euro' },
  { code: '£', label: 'British Pound' },
  { code: '¥', label: 'Japanese Yen' },
  { code: 'A$', label: 'Australian Dollar' },
  { code: 'C$', label: 'Canadian Dollar' },
  { code: 'S$', label: 'Singapore Dollar' },
  { code: 'AED', label: 'UAE Dirham' },
]

const NAV = [
  { id: 'profile', label: 'Profile', desc: 'Name, photo & contact', icon: '👤' },
  { id: 'currency', label: 'Currency', desc: 'Display amounts in', icon: '💱' },
  { id: 'account', label: 'Account', desc: 'Session & app info', icon: '🔐' },
]

function ProfileLoadingSkeleton() {
  const bar = 'animate-pulse rounded-lg bg-slate-200/80'
  const field = 'animate-pulse rounded-2xl bg-slate-100'
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
        <div className="relative shrink-0">
          <div className="h-28 w-28 rounded-3xl border-4 border-white bg-slate-100 ring-2 ring-indigo-100 shadow-lg shadow-indigo-100/40 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-2xl bg-slate-200/90 ring-2 ring-white shadow-md animate-pulse" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2.5 text-center sm:items-start sm:text-left w-full max-w-md">
          <div className={`h-5 w-36 sm:w-40 ${bar}`} />
          <div className={`h-4 w-52 sm:w-56 max-w-full ${bar}`} />
          <div className="mt-2 space-y-2 w-full max-w-md">
            <div className={`h-3 w-full ${bar}`} />
            <div className={`h-3 w-[88%] max-w-[280px] ${bar}`} />
          </div>
        </div>
      </div>

      <div className="space-y-5 max-w-lg">
        <div>
          <div className={`h-3.5 w-14 mb-2 ${bar}`} />
          <div className={`h-[46px] w-full ${field} border border-slate-200/60`} />
        </div>
        <div>
          <div className={`h-3.5 w-28 mb-2 ${bar}`} />
          <div className={`h-[46px] w-full ${field} border border-slate-200/60`} />
        </div>
        <div>
          <div className={`h-3.5 w-16 mb-2 ${bar}`} />
          <div className={`h-[46px] w-full ${field} border border-slate-200/60`} />
        </div>
        <div className={`h-[46px] w-full rounded-2xl bg-gradient-to-r from-indigo-200/80 to-violet-200/80 animate-pulse`} />
      </div>
    </div>
  )
}

export default function SettingsScreen({ user, currency, onCurrencyChange, onBack, onSignOut }) {
  const [section, setSection] = useState('profile')
  const [profile, setProfile] = useState({ display_name: '', mobile: '', avatar_url: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setProfile({
          display_name: data.display_name || '',
          mobile: data.mobile || '',
          avatar_url: data.avatar_url || '',
        })
        setLoading(false)
      })
  }, [user.id])

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setMsg({ text: 'Image must be under 2MB', type: 'error' }); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setMsg({ text: upErr.message, type: 'error' }); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setProfile(p => ({ ...p, avatar_url: publicUrl + '?t=' + Date.now() }))
    setUploading(false)
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: '' })
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: profile.display_name.trim(),
      mobile: profile.mobile.trim(),
      avatar_url: profile.avatar_url,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMsg(error ? { text: error.message, type: 'error' } : { text: 'Profile saved!', type: 'success' })
  }

  const initials = (profile.display_name || user.email || '?')[0].toUpperCase()
  const inputCls =
    'mt-1 w-full bg-slate-50/90 border border-slate-200/90 text-slate-800 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition text-sm shadow-sm'

  return (
    <div className="min-h-screen bg-[#eef0f7] text-slate-800">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 pt-4 sm:pt-8">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
          <button
            type="button"
            onClick={onBack}
            className="group flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/60 backdrop-blur-md transition hover:bg-white hover:text-indigo-600 hover:ring-indigo-200"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </span>
            Back
          </button>
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">TripSplit</p>
            <p className="text-sm font-medium text-slate-500 truncate max-w-[220px]">{user.email}</p>
          </div>
        </header>

        {/* Title block */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="mt-2 max-w-xl text-sm sm:text-base text-slate-500 leading-relaxed">
            Tune your profile, how amounts are shown, and your account. Changes apply across your trips.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Side navigation — desktop */}
          <nav className="hidden lg:flex w-64 shrink-0 flex-col gap-2">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSection(item.id); setMsg({ text: '', type: '' }) }}
                className={`rounded-2xl px-4 py-3.5 text-left transition ring-1 ${
                  section === item.id
                    ? 'bg-white shadow-lg shadow-indigo-100/80 ring-indigo-200/80'
                    : 'bg-white/50 ring-slate-200/60 hover:bg-white/90 hover:ring-slate-300/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className={`text-sm font-bold ${section === item.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Mobile segment */}
          <div className="flex gap-1 rounded-2xl bg-slate-900/[0.04] p-1 ring-1 ring-slate-200/80 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSection(item.id); setMsg({ text: '', type: '' }) }}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                  section === item.id
                    ? 'bg-white text-indigo-700 shadow-md shadow-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Main panel */}
          <div className="min-w-0 flex-1 rounded-[1.75rem] bg-white/90 shadow-xl shadow-slate-300/40 ring-1 ring-white/80 backdrop-blur-md">
            <div className="border-b border-slate-100/90 bg-gradient-to-r from-indigo-600/95 to-violet-600/95 px-6 py-5 sm:px-8 sm:py-6 rounded-t-[1.75rem]">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200/90">
                {NAV.find((n) => n.id === section)?.label}
              </p>
              <p className="mt-1 text-lg font-bold text-white sm:text-xl">
                {section === 'profile' && 'Your identity on trips'}
                {section === 'currency' && 'How you see amounts'}
                {section === 'account' && 'Session & diagnostics'}
              </p>
            </div>

            <div className="p-5 sm:p-8">
              {section === 'profile' && (
                <div className="space-y-8">
                  {loading ? (
                    <ProfileLoadingSkeleton />
                  ) : (
                    <>
                      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                        <div className="relative shrink-0">
                          <div className="h-28 w-28 rounded-3xl border-4 border-white bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-indigo-200/50 overflow-hidden flex items-center justify-center ring-2 ring-indigo-100">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-4xl font-black text-white">{initials}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60 ring-2 ring-white"
                          >
                            {uploading ? '⏳' : '📷'}
                          </button>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                        </div>
                        <div className="text-center sm:text-left flex-1">
                          <p className="text-base font-bold text-slate-800">{profile.display_name || 'Your name'}</p>
                          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
                          <p className="text-xs text-slate-400 mt-3 max-w-md">
                            Avatar is stored in Supabase Storage (bucket <code className="rounded bg-slate-100 px-1">avatars</code>). Max 2MB.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={saveProfile} className="space-y-5 max-w-lg">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
                          <div className="mt-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-500">
                            {user.email}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Display name</label>
                          <input
                            className={inputCls}
                            placeholder="Your name"
                            value={profile.display_name}
                            onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mobile</label>
                          <input
                            className={inputCls}
                            placeholder="+91 98765 43210"
                            type="tel"
                            value={profile.mobile}
                            onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))}
                          />
                        </div>
                        {msg.text && (
                          <p
                            className={`text-sm font-medium ${
                              msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {msg.type === 'success' ? '✓ ' : ''}{msg.text}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={saving}
                          className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-300/40 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save profile'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}

              {section === 'currency' && (
                <div className="space-y-4 max-w-lg">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Choose how trip totals and expenses are shown. Rates update live; each trip still keeps its own base currency when created.
                  </p>
                  <div className="grid gap-2.5">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => onCurrencyChange(c.code)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                          currency === c.code
                            ? 'border-indigo-400 bg-gradient-to-r from-indigo-50 to-violet-50 ring-2 ring-indigo-200/60'
                            : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${currency === c.code ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {c.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`text-lg font-black ${currency === c.code ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {c.code}
                          </span>
                          {currency === c.code && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">✓</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {section === 'account' && (
                <div className="space-y-6 max-w-lg">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Account</p>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-slate-500 shrink-0">Email</span>
                      <span className="font-medium text-slate-800 text-right break-all">{user.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">User ID</span>
                      <span className="font-mono text-xs text-slate-400">{user.id.slice(0, 12)}…</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Display currency</span>
                      <span className="font-bold text-indigo-600">{currency}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-2 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">App</p>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Version</span>
                      <span className="font-medium text-slate-800">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stack</span>
                      <span className="font-medium text-slate-800">React · Supabase</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSignOut?.()}
                    className="w-full rounded-2xl border border-red-200 bg-red-50/90 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  >
                    Sign out
                  </button>
                  <p className="text-center text-xs text-slate-400">You will need to sign in again to view your trips.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
