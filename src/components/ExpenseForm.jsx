import { useState } from 'react'
import { supabase } from '../supabaseClient'

const CATEGORIES = [
  'Food & Drinks',
  'Accommodation',
  'Transport',
  'Flight',
  'Fuel',
  'Shopping',
  'Activities',
  'Entertainment',
  'Medical',
  'Visa & Documents',
  'Communication',
  'Other',
]

export default function ExpenseForm({ tripId, userId, members, currency, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', category: 'Food & Drinks' })
  const [error, setError] = useState('')

  // Auto-resolve current user's member record
  const myMember = members.find(m => m.user_id === userId)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || !form.description) {
      setError('Amount and description are required.')
      return
    }
    if (!myMember) {
      setError('You are not a member of this trip.')
      return
    }
    const { error: err } = await supabase.from('expenses').insert({
      trip_id: tripId,
      member_id: myMember.id,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
    })
    if (err) setError(err.message)
    else onSaved()
  }

  const inputCls = 'w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Add Expense</h3>
        <p className="text-xs text-slate-400 mb-4">
          Adding as <span className="text-indigo-600 font-medium">{myMember?.display_name || 'you'}</span>
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 font-medium text-sm shrink-0">{currency}</span>
            <input className={inputCls} placeholder="Amount" type="number" min="0" step="0.01" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <input className={inputCls} placeholder="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <select className={inputCls} value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg transition">Cancel</button>
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
