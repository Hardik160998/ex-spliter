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

  // Auto-resolve current user's member record
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

  const inputCls = 'w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-0.5">{editExpense ? 'Edit Expense' : 'Add Expense'}</h3>
        <p className="text-xs text-slate-400 font-medium mb-4">
          {editExpense ? 'Editing as ' : 'Adding as '}
          <span className="text-indigo-600 font-semibold">{myMember?.display_name || 'you'}</span>
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2 items-center">
          <span className="text-slate-500 font-bold text-sm shrink-0 tabular-nums">{currency}</span>
            <input className={inputCls + " tabular-nums font-semibold"} placeholder="Amount" type="number" min="0" step="0.01" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <input className={inputCls + " py-3"} placeholder="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select 
            value={form.category}
            onChange={val => setForm(f => ({ ...f, category: val }))}
            options={categoryOptions}
            className="!bg-slate-100 !border-slate-200 !py-3"
          />

          {/* Paid By dropdown */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Paid By</label>
            <Select 
              value={form.paid_by_member_id}
              onChange={val => setForm(f => ({ ...f, paid_by_member_id: val }))}
              placeholder="Select who paid..."
              options={members.map(m => ({
                value: m.id,
                label: m.user_id === userId ? 'You' : m.display_name,
                suffix: !m.user_id ? (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Manual</span>
                ) : null,
                icon: (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                )
              }))}
              className="!bg-slate-100 !border-slate-200 !py-3"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl transition">Cancel</button>
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold tracking-tight transition shadow-md shadow-indigo-200/60">
              {editExpense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
