import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AddMemberModal({ tripId, onClose, onAdded, mode = 'email' }) {
  const [tab, setTab] = useState(mode)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Custom Invite Link States
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [showInvitePrompt, setShowInvitePrompt] = useState(false)

  // Manual Member Merge States
  const [manualMembers, setManualMembers] = useState([])
  const [selectedManualMemberId, setSelectedManualMemberId] = useState('')

  // Fetch unlinked manual members of this trip
  useEffect(() => {
    const fetchManualMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('trip_members')
          .select('id, display_name')
          .eq('trip_id', tripId)
          .eq('source', 'manual')
          .is('user_id', null)
        
        if (!error && data) {
          setManualMembers(data)
        }
      } catch (err) {
        console.error('Error fetching manual members:', err)
      }
    }
    fetchManualMembers()
  }, [tripId])

  const submitByEmail = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowInvitePrompt(false)
    try {
      const { data, error: err } = await supabase.rpc('add_trip_member_by_email', {
        p_trip_id: tripId,
        p_email: email.trim(),
        p_manual_member_id: selectedManualMemberId || null,
      })

      if (err) {
        const errMsg = err.message || ''
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('sign up')) {
          setShowInvitePrompt(true)
        }
        setError(errMsg || 'Failed to add member')
        return
      }
      
      if (data && data.ok === false) {
        const errMsg = typeof data.error === 'string' ? data.error : ''
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('sign up')) {
          setShowInvitePrompt(true)
        }
        setError(errMsg || 'Failed to add member')
        return
      }
      
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const generateInvite = async () => {
    setLoading(true)
    setError('')
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // expires in 7 days

      const { data, error: err } = await supabase
        .from('trip_invites')
        .insert({
          trip_id: tripId,
          email: email.trim().toLowerCase(),
          expires_at: expiresAt.toISOString(),
          manual_member_id: selectedManualMemberId || null,
        })
        .select()
        .single()

      if (err) {
        setError(err.message || 'Failed to create invite')
        return
      }

      if (data) {
        const url = `${window.location.origin}/join?token=${data.token}`
        setInviteUrl(url)
      }
    } catch (err) {
      setError(err?.message || 'Failed to create invite')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addManualMember = () => {
    setLoading(true)
    setError('')

    if (!name.trim()) {
      setError('Please enter a name')
      setLoading(false)
      return
    }

    supabase.from('trip_members').insert({
      trip_id: tripId,
      user_id: null,
      role: 'contributor',
      display_name: name.trim(),
      source: 'manual',
    }).then(({ error: err }) => {
      setLoading(false)
      if (err) { setError(err.message); return }
      onAdded?.()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Add Member</h3>
        <p className="text-slate-500 text-sm mb-4">Add someone to this trip.</p>

        {/* Tab Switcher */}
        {!inviteUrl && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
            <button
              onClick={() => setTab('email')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === 'email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              By Email
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              By Name
            </button>
          </div>
        )}

        {tab === 'email' ? (
          inviteUrl ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500 text-xl mx-auto mb-1 shadow-sm">
                🎫
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Invite Link Created!</h4>
                <p className="text-xs text-slate-400 mt-0.5">Share this link with your friend to join the trip.</p>
              </div>
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-2.5 items-center justify-center select-all overflow-x-auto text-xs text-slate-600 font-mono max-w-full truncate">
                {inviteUrl}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInviteUrl('')
                    setEmail('')
                    setSelectedManualMemberId('')
                    setShowInvitePrompt(false)
                    setError('')
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm transition font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm transition font-bold shadow-md shadow-indigo-150 flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitByEmail} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Email Address</label>
                <input
                  className="w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400"
                  type="email"
                  placeholder="friend@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setShowInvitePrompt(false)
                    setError('')
                  }}
                  required
                  disabled={loading}
                />
              </div>
              
              {manualMembers.length > 0 && (
                <div className="space-y-1 mt-2">
                  <label className="text-xs font-semibold text-slate-500 block">
                    Link with existing manual member:
                  </label>
                  <select
                    className="w-full bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    value={selectedManualMemberId}
                    onChange={(e) => setSelectedManualMemberId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Do not merge</option>
                    {manualMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {showInvitePrompt ? (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 mt-2 space-y-2.5">
                  <p className="font-medium leading-relaxed">
                    💡 <strong>User Not Registered:</strong> This email doesn't have a TripSplit account yet. Generate an invite link so they can register and automatically join your trip!
                  </p>
                  <button
                    type="button"
                    onClick={generateInvite}
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                  >
                    🎫 {loading ? 'Generating…' : 'Generate Invite Link'}
                  </button>
                </div>
              ) : (
                error && <p className="text-red-500 text-sm">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition" disabled={loading}>Cancel</button>
                <button disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50">
                  {loading ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="space-y-3">
            <input
              className="w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400"
              type="text"
              placeholder="Name (e.g. Hardik, Raj…)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addManualMember() }}
              required
              disabled={loading}
            />
            <p className="text-xs text-slate-400">No account needed. They can be added to the trip later as a registered member too.</p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition" disabled={loading}>Cancel</button>
              <button onClick={addManualMember} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50">
                {loading ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
