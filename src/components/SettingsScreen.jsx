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

const SECTIONS = ['profile', 'currency', 'account']

export default function SettingsScreen({ user, currency, onCurrencyChange, onClose }) {
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
  const inputCls = 'mt-1 w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-sm'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <p className="text-indigo-200 text-xs mt-0.5">Manage your preferences</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
            ✕
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
          {[['profile', '👤 Profile'], ['currency', '💱 Currency'], ['account', '🔐 Account']].map(([s, label]) => (
            <button key={s} onClick={() => { setSection(s); setMsg({ text: '', type: '' }) }}
              className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
                section === s ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">

          {/* ── Profile Section ── */}
          {section === 'profile' && (
            <div className="p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-indigo-100 shadow-md overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      : <span className="text-white text-3xl font-bold">{initials}</span>
                    }
                  </div>
                  <button onClick={() => fileRef.current.click()} disabled={uploading}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-md transition border-2 border-white text-sm">
                    {uploading ? '⏳' : '📷'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                </div>
                <p className="text-xs text-slate-400 mt-2">Tap 📷 to change photo · Max 2MB</p>
              </div>

              {loading ? <div className="text-center py-4 text-slate-400">Loading...</div> : (
                <form onSubmit={saveProfile} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                    <div className="mt-1 w-full bg-slate-50 border border-slate-200 text-slate-400 rounded-xl px-4 py-3 text-sm">
                      {user.email}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Display Name</label>
                    <input className={inputCls} placeholder="Your name"
                      value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile Number</label>
                    <input className={inputCls} placeholder="+91 98765 43210" type="tel"
                      value={profile.mobile} onChange={e => setProfile(p => ({ ...p, mobile: e.target.value }))} />
                  </div>
                  {msg.text && (
                    <p className={`text-sm font-medium text-center ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                      {msg.type === 'success' ? '✅ ' : '❌ '}{msg.text}
                    </p>
                  )}
                  <button type="submit" disabled={saving}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-2xl font-bold transition shadow-lg shadow-indigo-100 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── Currency Section ── */}
          {section === 'currency' && (
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-500 mb-4">Choose your display currency. Amounts are converted live using real exchange rates. The original currency is set per trip when it's created.</p>
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => onCurrencyChange(c.code)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition ${
                    currency === c.code ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                  <span className={`text-sm font-medium ${currency === c.code ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {c.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold ${currency === c.code ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {c.code}
                    </span>
                    {currency === c.code && (
                      <span className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Account Section ── */}
          {section === 'account' && (
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Info</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-800 font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">User ID</span>
                  <span className="text-slate-400 font-mono text-xs">{user.id.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Currency</span>
                  <span className="text-indigo-600 font-bold">{currency}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">App Info</p>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Version</span>
                    <span className="text-slate-700">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Built with</span>
                    <span className="text-slate-700">React + Supabase</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3 rounded-2xl font-semibold transition">
                🚪 Sign Out
              </button>

              <p className="text-xs text-slate-400 text-center">
                Signing out will clear your local session.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
