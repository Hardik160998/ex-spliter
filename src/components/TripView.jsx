import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ExpenseForm from './ExpenseForm'
import AddMemberModal from './AddMemberModal'
import ExpenseMenu from './ui/ExpenseMenu'
import ConfirmationModal from './ConfirmationModal'
import { useCurrencyRates } from '../hooks/useCurrencyRates'

function getCategoryEmoji(cat = '') {
  const map = {   
    'food & drinks': '🍔', 'food': '🍔',
    'accommodation': '🏨', 'hotel': '🏨',
    'transport': '🚗', 'flight': '✈️', 'fuel': '⛽',
    'shopping': '🛍️', 'activities': '🎯',
    'entertainment': '🍿', 'medical': '💊',
    'visa & documents': '📄', 'communication': '📱',
    'trip booking': '🎫',
    'general': '📌', 'other': '💰',
  }
  return map[(cat || '').toLowerCase()] ?? '💰'
}

const CATEGORY_STYLES = {
  'food & drinks': { bg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40', bar: 'bg-orange-500' },
  'accommodation': { bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400', badge: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40', bar: 'bg-indigo-500' },
  'transport': { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400', badge: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40', bar: 'bg-blue-500' },
  'flight': { bg: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400', badge: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40', bar: 'bg-sky-500' },
  'fuel': { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40', bar: 'bg-amber-500' },
  'shopping': { bg: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400', badge: 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/40', bar: 'bg-pink-500' },
  'activities': { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40', bar: 'bg-emerald-500' },
  'entertainment': { bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400', badge: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40', bar: 'bg-purple-500' },
  'medical': { bg: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400', badge: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40', bar: 'bg-red-500' },
  'visa & documents': { bg: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400', badge: 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40', bar: 'bg-teal-500' },
  'communication': { bg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400', badge: 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/40', bar: 'bg-cyan-500' },
  'trip booking': { bg: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400', badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 dark:bg-fuchsia-950/20 dark:text-fuchsia-400 dark:border-fuchsia-900/40', bar: 'bg-fuchsia-500' },
  'other': { bg: 'bg-[#DAF7E2] text-[#16B843] dark:bg-green-950/40 dark:text-brand-400', badge: 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-green-950/20 dark:text-brand-400 dark:border-green-900/40', bar: 'bg-[#16B843]' },
}

function getCategoryStyle(cat = '') {
  return CATEGORY_STYLES[(cat || '').toLowerCase()] ?? CATEGORY_STYLES['other']
}

function calcSettlements(members, expenses) {
  if (!members.length || !expenses.length) return []
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const perPerson = total / members.length
  const balance = {}
  members.forEach(m => { balance[m.id] = -perPerson })
  expenses.forEach(e => {
    if (balance[e.member_id] !== undefined) balance[e.member_id] += Number(e.amount)
  })
  const creditors = [], debtors = []
  Object.entries(balance).forEach(([id, bal]) => {
    const r = Math.round(bal * 100) / 100
    if (r > 0.01) creditors.push({ id, amount: r })
    else if (r < -0.01) debtors.push({ id, amount: -r })
  })
  const transactions = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    transactions.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 })
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }
  return transactions
}

function SettleTab({ settlements, members, expenses, user, fmt, total }) {
  const getName = (id) => {
    const m = members.find(m => m.id === id)
    return m?.user_id === user.id ? 'You' : (m?.display_name || 'Unknown')
  }
  const isMe = (id) => members.find(m => m.id === id)?.user_id === user.id
  const perPerson = members.length ? total / members.length : 0
  const MEMBER_COLORS = [
    'from-brand-500 to-emerald-600',
    'from-blue-500 to-indigo-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ]

  return (
    <div className="space-y-6">
      {/* Overview stats inside split tab */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'Total Spent', value: fmt(total) },
          { label: 'Crew Count', value: members.length },
          { label: 'Per Person', value: fmt(perPerson) },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-base sm:text-lg font-black text-surface-500 dark:text-white tabular-nums truncate">{s.value}</p>
            <p className="text-[9px] font-bold text-[#808080] mt-1.5 uppercase tracking-widest truncate">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ledger list of paid balances */}
      <div className="card overflow-hidden p-0 border border-[#E8ECF0] dark:border-[#2D2D2D]">
        <div className="px-5 py-4 border-b border-[#E8ECF0] dark:border-[#2D2D2D] bg-[#F9F9F9] dark:bg-[#1C1C1C]">
          <p className="text-[10px] font-black text-surface-400 dark:text-surface-300 uppercase tracking-widest">Billing Breakdown</p>
        </div>
        {members.map((m, idx) => {
          const paid = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
          const diff = Math.round((paid - perPerson) * 100) / 100
          const isYou = m.user_id === user.id
          const pct = total > 0 ? (paid / total) * 100 : 0
          return (
            <div key={m.id} className="px-5 py-4 border-b border-[#E8ECF0] dark:border-[#2D2D2D] last:border-0 hover:bg-[#F9F9F9]/50 dark:hover:bg-[#2D2D2D]/30 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className={`w-9 h-9 shrink-0 rounded-2xl bg-gradient-to-br ${MEMBER_COLORS[idx % MEMBER_COLORS.length]} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <span className="font-black text-surface-500 dark:text-white text-sm truncate">
                    {isYou ? 'You' : m.display_name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-surface-500 dark:text-white text-sm tabular-nums">{fmt(paid)}</p>
                  <p className={`text-[10px] font-black mt-0.5 tabular-nums ${diff >= 0 ? 'text-[#16B843]' : 'text-[#F63332]'}`}>
                    {diff >= 0 ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`}
                  </p>
                </div>
              </div>
              <div className="w-full bg-[#EEEEEE] dark:bg-[#2D2D2D] rounded-full h-1.5 overflow-hidden">
                <div className={`bg-gradient-to-r ${MEMBER_COLORS[idx % MEMBER_COLORS.length]} h-full rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Settle Up Transfers List */}
      <div className="pt-2">
        <p className="text-[10px] font-black text-[#808080] uppercase tracking-widest mb-3 px-1">Active Transfers Ledger</p>
        {settlements.length === 0 ? (
          <div className="card p-12 text-center border border-[#E8ECF0] dark:border-[#2D2D2D]">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-surface-500 dark:text-white font-black text-lg">All settled up!</p>
            <p className="text-surface-400 dark:text-surface-400 text-xs mt-1.5 font-bold uppercase tracking-wider">No pending dues.</p>
          </div>
        ) : settlements.map((s, i) => {
          const fromMe = isMe(s.from)
          const toMe = isMe(s.to)
          return (
            <div key={i} className={`card p-4 mb-3 flex items-center justify-between border border-[#E8ECF0] dark:border-[#2D2D2D] transition-all hover:-translate-y-0.5 ${
              fromMe ? 'border-red-200/50 bg-[#F63332]/5' : toMe ? 'border-green-200/50 bg-[#16B843]/5' : 'bg-white dark:bg-[#1E1E1E]'
            }`}>
              <div className="flex items-center gap-3.5 min-w-0 pr-3">
                <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md ${fromMe ? 'bg-[#F63332]' : 'bg-[#808080]'}`}>
                  {(members.find(m => m.id === s.from)?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="font-black text-surface-500 dark:text-white text-sm flex items-center gap-2 truncate">
                    <span className={`truncate ${fromMe ? 'text-[#F63332]' : 'text-surface-500 dark:text-white'}`}>{getName(s.from)}</span>
                    <span className="text-surface-300 dark:text-surface-600 shrink-0">→</span>
                    <span className={`truncate ${toMe ? 'text-[#16B843]' : 'text-surface-500 dark:text-white'}`}>{getName(s.to)}</span>
                  </p>
                  <p className="text-[10px] font-bold text-surface-400 dark:text-surface-400 mt-0.5">
                    {fromMe ? 'Dues to pay' : toMe ? 'Dues to receive' : 'Split Transfer'}
                  </p>
                </div>
              </div>
              <span className={`font-black text-lg shrink-0 tabular-nums tracking-tight ${fromMe ? 'text-[#F63332]' : toMe ? 'text-[#16B843]' : 'text-surface-500 dark:text-white'}`}>
                {fmt(s.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TripView({ tripId, user, currency, activeTab, setActiveTab, onBack, onOpenSettings, onTripLoaded }) {
  const [trip, setTrip] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [showDeleteTrip, setShowDeleteTrip] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchAll = async () => {
    try {
      const { data: t, error: tErr } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (!t || tErr) { setLoading(false); return }
      
      const { data: e } = await supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
      const { data: m } = await supabase.rpc('get_trip_members', { p_trip_id: tripId })
      
      setTrip(t)
      if (onTripLoaded) onTripLoaded(t)

      setExpenses(e ?? [])
      setMembers(m ?? [])
      setIsOwner(t?.owner_id === user.id)
      setLoading(false)
    } catch (err) {
      console.error('fetchAll catch error:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [tripId])

  const baseCurrency = trip?.base_currency || '₹'
  const { convert, loading: ratesLoading } = useCurrencyRates()
  const fmt = (n) => `${currency}${convert(n, baseCurrency, currency).toFixed(2)}`

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  
  // Calculate category totals
  const byCategory = expenses.reduce((acc, e) => {
    const c = e.category || 'Other'
    acc[c] = (acc[c] || 0) + Number(e.amount)
    return acc
  }, {})

  const isActive = trip?.status === 'active'
  const settlements = calcSettlements(members, expenses)

  const toggleStatus = async () => {
    await supabase.from('trips').update({ status: isActive ? 'completed' : 'active' }).eq('id', tripId)
    fetchAll()
  }

  const deleteExpense = async (expenseId) => {
    if (!expenseId) return
    setDeleteLoading(true)
    const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId).select()
    if (error || !data?.length) {
      alert(error ? 'Failed to delete expense: ' + error.message : 'Expense not found or permission denied.')
    } else {
      setExpenses(prev => prev.filter(e => e.id !== expenseId))
      setDeletingExpense(null)
      fetchAll() // Reload trip stats
    }
    setDeleteLoading(false)
  }

  const deleteTrip = async () => {
    setDeleteLoading(true)
    const { data, error } = await supabase.from('trips').delete().eq('id', tripId).select()
    if (error || !data?.length) {
      alert(error ? 'Failed to delete trip: ' + error.message : 'Trip not found or permission denied.')
    } else {
      onBack()
    }
    setDeleteLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 skeleton rounded-[2rem] w-full" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* TRIP DETAILS HERO */}
      <div className={`relative overflow-hidden rounded-2xl border ${
        isActive 
          ? 'bg-[#FFFFFF] border-[#E8ECF0] dark:bg-green-950/30 dark:border-green-900/50' 
          : 'bg-[#F5F5F0] border-[#E0E0D8] dark:bg-neutral-900/50 dark:border-neutral-800'
      }`}>
        <div className="h-1 w-full bg-gradient-to-r from-[#16B843] via-emerald-400 to-[#16B843]" />

        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1E1E1E] flex items-center justify-center text-2xl shadow-sm border border-[#E8ECF0] dark:border-[#2D2D2D] shrink-0">
                {trip?.emoji || '✈️'}
              </div>
              <div className="min-w-0 space-y-1">
                <span className={`inline-flex items-center gap-1.5 typo-badge px-2.5 py-1 rounded-full ${
                  isActive ? 'bg-[#16B843] text-white' : 'bg-surface-100 text-surface-400 dark:bg-neutral-800 dark:text-neutral-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-surface-400'}`} />
                  {isActive ? 'Active' : 'Closed'}
                </span>
                <h1 className="typo-h1 truncate">
                  {trip?.name}
                </h1>
                <p className="typo-label-sm text-[#808080]">
                  Created {new Date(trip?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {baseCurrency !== currency && !ratesLoading && (
              <span className="shrink-0 text-[10px] bg-white dark:bg-[#1E1E1E] text-surface-500 dark:text-white px-3 py-1.5 rounded-full font-black border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-sm flex items-center gap-1">
                {baseCurrency}
                <svg className="w-3 h-3 text-[#16B843]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                {currency}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
            <div className="flex-1">
              <span className="typo-label">Total Spent</span>
              <p className="typo-finance-xl text-[#1E1E1E] dark:text-white flex items-baseline gap-1.5 mt-1">
                <span className="typo-currency text-lg sm:text-xl">{currency}</span>
                {convert(total, baseCurrency, currency).toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Costs', value: expenses.length },
                { label: 'Crew', value: members.length },
                { label: 'Categories', value: Object.keys(byCategory).length }
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-[#1E1E1E] rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-center border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-sm">
                  <p className="typo-stat text-[#16B843]">{stat.value}</p>
                  <p className="typo-label-sm text-surface-300 dark:text-surface-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTEXTUAL ACTION STRIP */}
      <div className="flex justify-between items-center gap-3 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-3.5 mt-4">
        <div>
          <h3 className="text-lg font-black text-surface-500 dark:text-white leading-none capitalize">
            {activeTab === 'expenses' && 'Expenses Ledger'}
            {activeTab === 'summary' && 'Analytics Overview'}
            {activeTab === 'members' && 'Crew Directory'}
            {activeTab === 'settle' && 'Debt Settlements'}
          </h3>
          <p className="text-[10px] font-bold text-[#808080] mt-1 uppercase tracking-widest">
            {activeTab === 'expenses' && 'Track and manage travel costs'}
            {activeTab === 'summary' && 'Visual breakdown of spending'}
            {activeTab === 'members' && 'Contributor list and percentages'}
            {activeTab === 'settle' && 'Resolve transfer payments'}
          </p>
        </div>
        
        {/* Action Buttons based on active tab */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && activeTab === 'members' && isActive && (
            <button onClick={() => setShowAddMember(true)} className="btn-secondary !py-2 text-xs">
              + Add Crew
            </button>
          )}
          {isOwner && activeTab === 'settle' && (
            <button onClick={toggleStatus}
              className={`btn-secondary !py-2 text-xs border ${
                isActive ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' : 'bg-brand-50 dark:bg-green-950/20 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-green-900/40'
              }`}>
              {isActive ? '✓ Close Trip' : '↺ Reopen'}
            </button>
          )}
          {isOwner && activeTab === 'settle' && (
            <button onClick={() => setShowDeleteTrip(true)}
              className="btn-ghost !p-2 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-[#F63332] hover:bg-red-100 dark:hover:bg-[#2D2D2D] rounded-xl"
              title="Delete Trip"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9-5.25h-12M4.5 5.25h15" />
              </svg>
            </button>
          )}
          {activeTab === 'expenses' && isActive && (
            <button onClick={() => { setEditingExpense(null); setShowForm(true) }} className="btn-primary !py-2 text-xs">
              + Log Cost
            </button>
          )}
        </div>
      </div>

      {/* MOBILE TABS (only shows when not in desktop layout, for quick mobile changes) */}
      <div className="md:hidden flex bg-[#EEEEEE] dark:bg-[#1E1E1E] p-1 rounded-2xl border border-[#E8ECF0] dark:border-[#2D2D2D] shadow-sm">
        {[
          { id: 'expenses', label: 'Costs' },
          { id: 'summary', label: 'Chart' },
          { id: 'members', label: 'Crew' },
          { id: 'settle', label: 'Pay' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === t.id
                ? 'bg-[#16B843] text-white shadow-md'
                : 'text-surface-400 hover:text-surface-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="relative">
        
        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="text-center py-16 card bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] p-10">
                <div className="w-20 h-20 bg-brand-50 dark:bg-green-950/20 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
                  🧾
                </div>
                <p className="text-surface-500 dark:text-white font-black text-lg">No expenses logged yet</p>
                {isActive && (
                  <p className="text-surface-400 dark:text-surface-400 text-xs mt-1 font-bold uppercase tracking-wider">
                    Tap "+ Log Cost" to log the first one.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenses.map(exp => {
                  const payer = members.find(m => m.id === exp.member_id)
                  const isMe = payer?.user_id === user.id
                  const isManualPayer = !payer?.user_id
                  const style = getCategoryStyle(exp.category)
                  const canEdit = isOwner || isMe
                  const canDelete = isOwner || isMe
                  const paidLabel = isMe ? 'You' : (payer?.display_name || 'Unknown')

                  return (
                    <div key={exp.id} className="card overflow-hidden group active:scale-[0.99] p-0 border border-[#E8ECF0] dark:border-[#2D2D2D] bg-white dark:bg-[#1E1E1E]">
                      <div className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${style.bg}`}>
                            {getCategoryEmoji(exp.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-surface-500 dark:text-white group-hover:text-[#16B843] transition-colors truncate">
                              {exp.description}
                            </h3>
                            <p className="text-[10px] font-bold text-surface-300 dark:text-surface-400 uppercase tracking-widest mt-0.5">
                              {exp.category || 'General'}
                            </p>
                          </div>
                          <ExpenseMenu
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onEdit={() => { setEditingExpense(exp); setShowForm(true) }}
                            onDelete={() => setDeletingExpense(exp)}
                          />
                        </div>

                        <div className="mt-4 flex items-baseline justify-between border-t border-[#E8ECF0] dark:border-[#2D2D2D] pt-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-surface-400 dark:text-surface-300 min-w-0 flex-1">
                            <span className="truncate" title={paidLabel}>
                              Paid by: <strong className="text-surface-500 dark:text-white font-extrabold">{paidLabel}</strong>
                            </span>
                            {isManualPayer && (
                              <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-[#EEEEEE] dark:bg-[#2D2D2D] px-1.5 py-0.5 rounded">Manual</span>
                            )}
                          </div>
                          <span className="shrink-0 text-[#16B843] font-black text-lg tabular-nums tracking-tight">
                            {fmt(exp.amount)}
                          </span>
                        </div>

                        <div className="mt-3 flex justify-between items-center text-[10px] font-bold text-surface-300">
                          <time>
                            {new Date(exp.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </time>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {Object.keys(byCategory).length === 0 ? (
              <div className="text-center py-20 text-surface-400 font-bold uppercase tracking-wider">No analytic data yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Category Progress Bars */}
                <div className="card p-5 space-y-4">
                  <h4 className="text-xs font-black text-[#808080] uppercase tracking-widest mb-2 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-2">Category Spending Breakdown</h4>
                  {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => {
                    const pct = Math.round((sum / total) * 100)
                    const style = getCategoryStyle(cat)
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-surface-500 dark:text-white flex items-center gap-1.5">
                            <span>{getCategoryEmoji(cat)}</span>
                            <span className="capitalize">{cat}</span>
                          </span>
                          <span className="text-[#808080] dark:text-surface-300 tabular-nums">
                            {fmt(sum)} <strong className="text-surface-500 dark:text-white ml-1">({pct}%)</strong>
                          </span>
                        </div>
                        <div className="w-full bg-[#EEEEEE] dark:bg-[#2D2D2D] rounded-full h-2 overflow-hidden">
                          <div className={`${style.bar} h-full rounded-full transition-all duration-700 ease-out`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Visual mini bar charts inside Summary */}
                <div className="card p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-[#808080] uppercase tracking-widest mb-4 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-2">Spending Trends</h4>
                    <div className="flex justify-between items-end h-32 px-1 pt-2 gap-2 border-b border-[#E8ECF0] dark:border-[#2D2D2D] pb-1">
                      {Object.entries(byCategory).map(([cat, sum]) => {
                        const maxVal = Math.max(...Object.values(byCategory)) || 1
                        const pct = Math.max(5, (sum / maxVal) * 100)
                        const style = getCategoryStyle(cat)
                        return (
                          <div key={cat} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-surface-500 dark:bg-surface-50 text-white dark:text-[#1E1E1E] text-[9px] font-bold py-1 px-1.5 rounded shadow z-20 whitespace-nowrap">
                              {fmt(sum)}
                            </div>
                            <div style={{ height: `${pct}%` }} className={`w-full rounded-t-lg transition-all duration-500 ${style.bar}`} />
                            <span className="text-[7px] font-black text-[#808080] mt-1.5 uppercase truncate w-6 text-center">{cat.substring(0, 3)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#16B843] to-green-700 rounded-2xl p-4 flex justify-between items-center shadow-lg shadow-[#16B843]/10 mt-6">
                    <span className="text-white text-xs font-black uppercase tracking-widest">Aggregate Total</span>
                    <span className="text-white font-black text-xl tabular-nums tracking-tight">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((m, idx) => {
              const memberTotal = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
              const isMe = m.user_id === user.id
              const isManual = !m.user_id
              const MEMBER_COLORS = [
                'from-[#16B843] to-green-700',
                'from-blue-500 to-indigo-600',
                'from-amber-500 to-orange-600',
                'from-rose-500 to-pink-600',
              ]
              const pct = total > 0 ? Math.round((memberTotal / total) * 100) : 0
              return (
                <div key={m.id} className="card p-5 border border-[#E8ECF0] dark:border-[#2D2D2D] bg-white dark:bg-[#1E1E1E]">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3.5 min-w-0 pr-3">
                      <div className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${MEMBER_COLORS[idx % MEMBER_COLORS.length]} flex items-center justify-center text-white font-black text-base shadow-md`}>
                        {(m.display_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-black text-surface-500 dark:text-white text-sm truncate tracking-tight">{isMe ? 'You' : m.display_name}</p>
                          {isMe && <span className="text-[8px] font-black uppercase tracking-wider bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">You</span>}
                          {isManual && <span className="text-[8px] font-black uppercase tracking-wider bg-[#EEEEEE] dark:bg-[#2D2D2D] px-1.5 py-0.5 rounded">Manual</span>}
                        </div>
                        <p className="text-[9px] font-bold text-surface-300 dark:text-surface-400 capitalize mt-1 tracking-widest uppercase">{m.role}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-surface-500 dark:text-white text-sm tabular-nums">{fmt(memberTotal)}</p>
                      <p className="text-[9px] font-bold text-surface-300 mt-0.5 uppercase tracking-widest">{pct}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-[#EEEEEE] dark:bg-[#2D2D2D] rounded-full h-1.5 overflow-hidden">
                    <div className={`bg-gradient-to-r ${MEMBER_COLORS[idx % MEMBER_COLORS.length]} h-full rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SETTLE UP TAB */}
        {activeTab === 'settle' && (
          <SettleTab settlements={settlements} members={members} expenses={expenses} user={user} fmt={fmt} total={total} />
        )}

      </div>

      {/* MOBILE LOG EXPENSE FLOATING ACTION BUTTON */}
      {isActive && activeTab === 'expenses' && (
        <button onClick={() => { setEditingExpense(null); setShowForm(true) }}
          className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-[#16B843] to-green-700 text-white rounded-[1.25rem] shadow-lg shadow-[#16B843]/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 sm:hidden">
          <svg className="w-6 h-6 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* MODALS */}
      {showForm && (
        <ExpenseForm
          tripId={tripId}
          userId={user.id}
          members={members}
          currency={currency}
          editExpense={editingExpense}
          onClose={() => { setEditingExpense(null); setShowForm(false) }}
          onSaved={() => { setEditingExpense(null); setShowForm(false); fetchAll() }}
        />
      )}
      {showAddMember && (
        <AddMemberModal
          tripId={tripId}
          onClose={() => setShowAddMember(false)}
          onAdded={() => fetchAll()}
        />
      )}
      <ConfirmationModal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={() => deleteExpense(deletingExpense?.id)}
        title="Delete Expense"
        message={`Remove "${deletingExpense?.description}"? This will permanently delete this expense and update all balances.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />
      <ConfirmationModal
        isOpen={showDeleteTrip}
        onClose={() => setShowDeleteTrip(false)}
        onConfirm={deleteTrip}
        title="Delete Trip"
        message={`Delete "${trip?.name}"? This will permanently remove all expenses, settlements, and members. This action cannot be undone.`}
        confirmText="Delete Trip"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  )
}
