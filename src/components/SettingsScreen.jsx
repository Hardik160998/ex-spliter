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
  { id: 'profile', label: 'Profile Settings', desc: 'Manage your identity', icon: '👤' },
  { id: 'currency', label: 'Currency Prefs', desc: 'Choose display symbol', icon: '💱' },
  { id: 'account', label: 'Security & App', desc: 'Developer diagnostics', icon: '🔐' },
]

function ProfileLoadingSkeleton() {
  const bar = 'animate-pulse rounded-lg bg-[#EEEEEE] dark:bg-[#2D2D2D]'
  const field = 'animate-pulse rounded-2xl bg-[#F9F9F9] dark:bg-[#1E1E1E]'
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5">
        <div className="relative shrink-0">
          <div className="h-24 w-24 rounded-3xl bg-surface-100 dark:bg-neutral-800 animate-pulse" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left w-full max-w-md">
          <div className={`h-5 w-40 ${bar}`} />
          <div className={`h-4 w-56 max-w-full ${bar}`} />
        </div>
      </div>
      <div className="space-y-4 max-w-lg">
        {[1, 2].map(i => (
          <div key={i}>
            <div className={`h-3 w-14 mb-2 ${bar}`} />
            <div className={`h-11 w-full ${field}`} />
          </div>
        ))}
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

  return (
    <div className="space-y-6">
      
      {/* Settings Overview Header */}
      <div className="flex justify-between items-end border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-3.5">
        <div>
          <h2 className="text-xl font-black text-surface-500 dark:text-white leading-none">Settings Console</h2>
          <p className="text-[10px] font-bold text-[#808080] mt-1.5 uppercase tracking-widest">Tune profile, currencies, and safety parameters</p>
        </div>
        <button
          onClick={onBack}
          className="btn-secondary !py-2 text-xs hidden sm:inline-flex"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        
        {/* Navigation Sidebar Panel */}
        <nav className="w-full lg:w-64 shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSection(item.id); setMsg({ text: '', type: '' }) }}
              className={`flex-1 text-left p-4 rounded-[1.25rem] border transition-all active:scale-[0.99] ${
                section === item.id
                  ? 'bg-white dark:bg-[#1E1E1E] border-[#16B843]/60 shadow-md shadow-brand-500/5'
                  : 'bg-white dark:bg-[#1E1E1E]/40 border-[#E8ECF0] dark:border-[#2D2D2D]/60 hover:bg-white/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl bg-brand-50 dark:bg-green-950/20 p-2 rounded-xl shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-black tracking-tight ${section === item.id ? 'text-[#16B843]' : 'text-surface-500 dark:text-white'}`}>
                    {item.label}
                  </p>
                  <p className="text-[9px] text-[#808080] mt-0.5 truncate">{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </nav>

        {/* Dynamic Detail Console */}
        <div className="flex-1 rounded-[1.5rem] bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] overflow-hidden shadow-sm">
          
          {/* Header Strip */}
          <div className="bg-gradient-to-r from-[#1E1E1E] to-[#121212] border-b border-[#2D2D2D] px-6 py-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#808080]">
              {NAV.find((n) => n.id === section)?.label}
            </p>
            <p className="text-sm font-bold text-white/90 mt-1">
              {section === 'profile' && 'Update your identity details on trips'}
              {section === 'currency' && 'Update display rates for travel bills'}
              {section === 'account' && 'Security logs & developer info'}
            </p>
          </div>

          <div className="p-6">
            
            {/* PROFILE SECTION */}
            {section === 'profile' && (
              <div className="space-y-6">
                {loading ? (
                  <ProfileLoadingSkeleton />
                ) : (
                  <>
                    {/* Avatar Upload block */}
                    <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5 pb-5 border-b border-[#E8ECF0] dark:border-[#2D2D2D]">
                      <div className="relative shrink-0">
                        <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-[#16B843] to-green-700 overflow-hidden flex items-center justify-center ring-4 ring-[#DAF7E2] dark:ring-green-950/20 shadow-md">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-3xl font-black text-white">{initials}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl bg-surface-500 text-white shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-60 ring-2 ring-white dark:ring-[#1E1E1E] text-xs"
                        >
                          {uploading ? '⏳' : '📷'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                      </div>
                      <div className="text-center sm:text-left flex-1 space-y-1">
                        <h4 className="text-sm font-black text-surface-500 dark:text-white">{profile.display_name || 'Traveller Profile'}</h4>
                        <p className="text-xs text-surface-300 dark:text-[#808080]">{user.email}</p>
                        <p className="text-[10px] font-bold text-[#808080] max-w-sm leading-normal pt-1.5">
                          Profile photos are hosted securely. Limit file sizes to 2MB.
                        </p>
                      </div>
                    </div>

                    {/* Inputs form */}
                    <form onSubmit={saveProfile} className="space-y-4 max-w-md">
                      <div>
                        <label className="input-label">Login Account</label>
                        <input
                          className="input bg-[#F9F9F9] dark:bg-[#1C1C1C] border border-[#E8ECF0] dark:border-[#2D2D2D]/60 text-surface-300 dark:text-[#808080] cursor-not-allowed"
                          disabled
                          value={user.email}
                        />
                      </div>
                      <div>
                        <label className="input-label">Display Name</label>
                        <input
                          className="input"
                          placeholder="e.g. Hardik Patel"
                          required
                          value={profile.display_name}
                          onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="input-label">Mobile Contact</label>
                        <input
                          className="input"
                          placeholder="e.g. +91 98765 43210"
                          type="tel"
                          value={profile.mobile}
                          onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))}
                        />
                      </div>

                      {msg.text && (
                        <p className={`text-xs font-black pl-1 ${msg.type === 'error' ? 'text-[#F63332]' : 'text-[#16B843]'}`}>
                          {msg.type === 'success' ? '✓ ' : '✕ '}{msg.text}
                        </p>
                      )}

                      <button type="submit" disabled={saving} className="btn-primary w-full shadow-md">
                        {saving ? 'Saving...' : 'Save Profile Details'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            {/* CURRENCY PREFERENCE */}
            {section === 'currency' && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-[#808080] uppercase tracking-wider leading-relaxed">
                  Select your active base currency preference:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => onCurrencyChange(c.code)}
                      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                        currency === c.code
                          ? 'border-[#16B843] bg-brand-50/20 dark:bg-green-950/20 shadow-sm'
                          : 'border-[#E8ECF0] dark:border-[#2D2D2D]/60 hover:bg-[#F9F9F9]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`text-xs font-black truncate ${currency === c.code ? 'text-[#16B843]' : 'text-surface-500 dark:text-white'}`}>
                          {c.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-lg font-black ${currency === c.code ? 'text-[#16B843]' : 'text-surface-300'}`}>
                          {c.code}
                        </span>
                        {currency === c.code && (
                          <span className="w-5 h-5 rounded-full bg-[#16B843] text-white flex items-center justify-center text-[10px] font-black shadow-sm">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SECURITY & SECURITY */}
            {section === 'account' && (
              <div className="space-y-6 max-w-md">
                
                {/* Diagnostics Summary Card */}
                <div className="card p-5 space-y-3 bg-[#F9F9F9] dark:bg-[#1C1C1C] border border-[#E8ECF0] dark:border-[#2D2D2D]/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#808080]">Security Identifiers</p>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#808080] font-bold">User UID</span>
                    <span className="font-mono text-[10px] text-surface-400 dark:text-[#808080] bg-white dark:bg-[#2D2D2D] px-2 py-0.5 rounded border border-[#E8ECF0] dark:border-[#3D3D3D]">
                      {user.id.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#808080] font-bold">Active currency</span>
                    <span className="font-black text-[#16B843] bg-brand-50 dark:bg-green-950/20 px-2 py-0.5 rounded">{currency}</span>
                  </div>
                </div>

                {/* Developer details */}
                <div className="card p-5 space-y-2 text-xs bg-[#F9F9F9] dark:bg-[#1C1C1C] border border-[#E8ECF0] dark:border-[#2D2D2D]/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#808080] mb-2">Build Environment</p>
                  <div className="flex justify-between">
                    <span className="text-[#808080] font-bold">Version</span>
                    <span className="font-black text-surface-500 dark:text-white">v1.2.0 (Stable)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#808080] font-bold">Engine Stack</span>
                    <span className="font-black text-surface-500 dark:text-white">Vite · TailwindCSS · PostgreSQL</span>
                  </div>
                </div>

                {/* Sign out btn */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSignOut?.()}
                    className="w-full rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/25 py-3.5 text-xs font-black text-[#F63332] transition hover:bg-red-100 dark:hover:bg-red-950/40 active:scale-[0.98] uppercase tracking-wider"
                  >
                    Logout Session
                  </button>
                  <p className="text-center text-[10px] font-bold text-[#808080] mt-2.5">
                    Requires logging in with authentication credentials again.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  )
}
