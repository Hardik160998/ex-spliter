import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function InviteModal({ tripId, onClose }) {
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const generateInvite = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: err } = await supabase
      .from('trip_invites')
      .insert({ trip_id: tripId, email, token, expires_at })

    setLoading(false)
    if (err) { setError(err.message); return }
    setLink(`${window.location.origin}?token=${token}`)
  }

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openMailApp = () => {
    const subject = encodeURIComponent('You are invited to join a trip on TripSplit')
    const body = encodeURIComponent(
      `Hi,\n\nYou have been invited to collaborate on a trip using TripSplit.\n\nClick the link below to join:\n${link}\n\nThis link expires in 7 days.`
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Invite a Friend</h3>
        <p className="text-slate-500 text-sm mb-4">Generate a link and share it via email or any app.</p>

        {!link ? (
          <form onSubmit={generateInvite} className="space-y-3">
            <input
              className="w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
              type="email" placeholder="friend@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition">
                Cancel
              </button>
              <button disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50">
                {loading ? 'Generating...' : 'Generate Link'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Link box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Invite Link</p>
              <p className="text-xs text-slate-600 break-all">{link}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition border
                  ${copied ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}>
                {copied ? '✅ Copied!' : '📋 Copy Link'}
              </button>
              <button onClick={openMailApp}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition">
                📧 Open Mail App
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Opens your default mail app (Gmail, Outlook, etc.) with the invite pre-filled.
            </p>

            <button onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
