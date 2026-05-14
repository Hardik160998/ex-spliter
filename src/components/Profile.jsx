import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

export default function Profile({ user, onClose }) {
  const [profile, setProfile] = useState({ display_name: '', mobile: '', avatar_url: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setProfile({ display_name: data.display_name || '', mobile: data.mobile || '', avatar_url: data.avatar_url || '' })
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

  const save = async (e) => {
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
    if (error) setMsg({ text: error.message, type: 'error' })
    else setMsg({ text: 'Profile saved!', type: 'success' })
  }

  const initials = (profile.display_name || user.email || '?')[0].toUpperCase()

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 pt-8 pb-16 text-white relative">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">My Profile</h2>
              <p className="text-indigo-200 text-sm mt-0.5">Manage your account details</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition text-sm">
              ✕
            </button>
          </div>
        </div>

        {/* Avatar — overlaps header */}
        <div className="flex justify-center -mt-12 mb-4 relative z-10">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-bold">{initials}</span>
              )}
            </div>
            <button onClick={() => fileRef.current.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-md transition border-2 border-white">
              {uploading ? '⏳' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : (
          <form onSubmit={save} className="px-6 pb-6 space-y-4">

            {/* Email — read only */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
              <div className="mt-1 w-full bg-slate-50 border border-slate-200 text-slate-400 rounded-xl px-4 py-3 text-sm">
                {user.email}
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Display Name</label>
              <input
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-sm"
                placeholder="Your name"
                value={profile.display_name}
                onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile Number</label>
              <input
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-sm"
                placeholder="+91 98765 43210"
                type="tel"
                value={profile.mobile}
                onChange={e => setProfile(p => ({ ...p, mobile: e.target.value }))}
              />
            </div>

            {msg.text && (
              <p className={`text-sm font-medium text-center ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {msg.type === 'success' ? '✅ ' : '❌ '}{msg.text}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl font-semibold transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-2xl font-bold transition shadow-lg shadow-indigo-100 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
