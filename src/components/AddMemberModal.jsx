import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AddMemberModal({ tripId, onClose, onAdded }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: err } = await supabase.rpc('add_trip_member_by_email', {
        p_trip_id: tripId,
        p_email: email.trim(),
      })

      if (err) {
        setError(err.message || 'Failed to add member')
        return
      }
      if (data && data.ok === false) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to add member')
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

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Add member</h3>
        <p className="text-slate-500 text-sm mb-4">
          Enter the email they use for their TripSplit account. They must already have signed up.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
            type="email"
            placeholder="friend@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
