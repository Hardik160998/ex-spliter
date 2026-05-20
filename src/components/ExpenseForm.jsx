import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Select from './ui/Select'

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
  'Trip Booking',
  'Other',
]

function getCategoryEmoji(cat = '') {
  const map = {
    'food & drinks': '🍽️', 'food': '🍽️',
    'accommodation': '🏨', 'hotel': '🏨',
    'transport': '🚗', 'flight': '✈️', 'fuel': '⛽',
    'shopping': '🛍️', 'activities': '🎯',
    'entertainment': '🎬', 'medical': '💊',
    'visa & documents': '📄', 'communication': '📱',
    'trip booking': '🎫',
    'general': '📌', 'other': '💰',
  }
  return map[(cat || '').toLowerCase()] ?? '💰'
}

const categoryOptions = CATEGORIES.map(c => ({
  value: c,
  label: c,
  icon: getCategoryEmoji(c)
}))

export default function ExpenseForm({ tripId, userId, members, currency, onClose, onSaved, editExpense = null }) {
  const [form, setForm] = useState({ 
    description: editExpense?.description || '', 
    amount: editExpense?.amount || '', 
    category: editExpense?.category || 'Food & Drinks', 
    paid_by_member_id: editExpense?.member_id || '' 
  })
  const [error, setError] = useState('')

  const myMember = members.find(m => m.user_id === userId)

  useEffect(() => {
    if (myMember && !form.paid_by_member_id) {
      setForm(f => ({ ...f, paid_by_member_id: myMember.id }))
    }
  }, [myMember])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || !form.description) {
      setError('Amount and description are required.')
      return
    }
    if (!form.paid_by_member_id) {
      setError('Please select who paid.')
      return
    }
    if (editExpense) {
      const { error: err } = await supabase.from('expenses').update({
        member_id: form.paid_by_member_id,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
      }).eq('id', editExpense.id)
      if (err) setError(err.message)
      else onSaved()
    } else {
      const { error: err } = await supabase.from('expenses').insert({
        trip_id: tripId,
        member_id: form.paid_by_member_id,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
      })
      if (err) setError(err.message)
      else onSaved()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="card-elevated p-6 w-full max-w-md animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-surface-500 tracking-tight">{editExpense ? 'Edit Expense' : 'Add Expense'}</h3>
            <p className="text-xs text-surface-400 font-medium mt-0.5">
              {editExpense ? 'Editing as ' : 'Adding as '}
              <span className="text-brand-600 font-bold">{myMember?.display_name || 'you'}</span>
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost w-8 h-8 flex items-center justify-center p-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-surface-400 font-bold text-sm shrink-0 tabular-nums">{currency}</span>
            <input className="input tabular-nums font-semibold" placeholder="Amount" type="number" min="0" step="0.01" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <input className="input" placeholder="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select 
            value={form.category}
            onChange={val => setForm(f => ({ ...f, category: val }))}
            options={categoryOptions}
          />

          <div>
            <label className="input-label">Paid By</label>
            <Select 
              value={form.paid_by_member_id}
              onChange={val => setForm(f => ({ ...f, paid_by_member_id: val }))}
              placeholder="Select who paid..."
              options={members.map(m => ({
                value: m.id,
                label: m.user_id === userId ? 'You' : m.display_name,
                suffix: !m.user_id ? (
                  <span className="badge-slate text-[9px]">Manual</span>
                ) : null,
                icon: (
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                )
              }))}
            />
          </div>

          {error && <p className="text-accent-red text-sm font-medium">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">
              {editExpense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
