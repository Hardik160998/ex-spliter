import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ExpenseForm from './ExpenseForm'
import AddMemberModal from './AddMemberModal'
import ExpenseMenu from './ui/ExpenseMenu'
import ConfirmationModal from './ConfirmationModal'
import { useCurrencyRates } from '../hooks/useCurrencyRates'

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

const CATEGORY_COLORS = {
  'food & drinks': 'bg-orange-50 text-orange-700 border border-orange-100',
  'accommodation': 'bg-blue-50 text-blue-700 border border-blue-100',
  'transport': 'bg-violet-50 text-violet-700 border border-violet-100',
  'flight': 'bg-sky-50 text-sky-700 border border-sky-100',
  'fuel': 'bg-amber-50 text-amber-700 border border-amber-100',
  'shopping': 'bg-pink-50 text-pink-700 border border-pink-100',
  'activities': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'entertainment': 'bg-purple-50 text-purple-700 border border-purple-100',
  'medical': 'bg-rose-50 text-rose-700 border border-rose-100',
  'visa & documents': 'bg-teal-50 text-teal-700 border border-teal-100',
  'communication': 'bg-cyan-50 text-cyan-700 border border-cyan-100',
  'trip booking': 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100',
  'other': 'bg-slate-50 text-slate-700 border border-slate-100',
}

function getCategoryColor(cat = '') {
  return CATEGORY_COLORS[(cat || '').toLowerCase()] ?? 'bg-slate-50 text-slate-700 border border-slate-100'
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

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1">
        {[
          { label: 'Total Spent', value: fmt(total), color: 'text-slate-800' },
          { label: 'Members', value: members.length, color: 'text-indigo-600' },
          { label: 'Per Person', value: fmt(perPerson), color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-[1rem] sm:rounded-[1.25rem] p-2.5 sm:p-4 border border-slate-100 shadow-md shadow-slate-100/50 text-center flex flex-col justify-center min-w-0">
            <p className={`text-[0.9rem] sm:text-[1.1rem] leading-tight font-black tabular-nums truncate ${s.color}`}>{s.value}</p>
            <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 mt-1 uppercase tracking-wider truncate">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Who paid */}
      <div className="bg-white rounded-[1.25rem] border border-slate-100 shadow-md shadow-slate-100/50 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-50 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Who Paid What</p>
        </div>
        {members.map((m, idx) => {
          const paid = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
          const diff = Math.round((paid - perPerson) * 100) / 100
          const isYou = m.user_id === user.id
          const pct = total > 0 ? (paid / total) * 100 : 0
          const colors = ['from-indigo-400 to-violet-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500']
          return (
            <div key={m.id} className="px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className={`w-9 h-9 shrink-0 rounded-full bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <span className="font-bold text-slate-700 text-sm truncate">
                    {isYou ? 'You' : m.display_name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800 text-sm tabular-nums">{fmt(paid)}</p>
                  <p className={`text-[0.7rem] font-bold mt-0.5 tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {diff >= 0 ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`bg-gradient-to-r ${colors[idx % colors.length]} h-full rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Transactions */}
      <div className="pt-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Transactions to Settle</p>
        {settlements.length === 0 ? (
          <div className="bg-white rounded-[1.25rem] border border-slate-100 shadow-sm text-center py-10">
            <div className="text-4xl mb-3 drop-shadow-sm">🎉</div>
            <p className="text-slate-700 font-black text-lg">All settled up!</p>
            <p className="text-slate-400 text-sm mt-1 font-medium">No payments needed.</p>
          </div>
        ) : settlements.map((s, i) => {
          const fromMe = isMe(s.from)
          const toMe = isMe(s.to)
          return (
            <div key={i} className={`rounded-[1.25rem] px-5 py-4 mb-3 border flex items-center justify-between shadow-sm transition-transform hover:-translate-y-0.5 ${
              fromMe ? 'bg-rose-50/50 border-rose-100' : toMe ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${fromMe ? 'bg-rose-400' : 'bg-slate-300'}`}>
                  {(members.find(m => m.id === s.from)?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2 truncate">
                    <span className={`truncate ${fromMe ? 'text-rose-600' : 'text-slate-700'}`}>{getName(s.from)}</span>
                    <span className="text-slate-300 shrink-0">→</span>
                    <span className={`truncate ${toMe ? 'text-emerald-600' : 'text-slate-700'}`}>{getName(s.to)}</span>
                  </p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    {fromMe ? '💸 You need to pay' : toMe ? '💰 You will receive' : 'Transfer'}
                  </p>
                </div>
              </div>
              <span className={`font-black text-lg shrink-0 tabular-nums tracking-tight ${fromMe ? 'text-rose-600' : toMe ? 'text-emerald-600' : 'text-slate-700'}`}>
                {fmt(s.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TripView({ tripId, user, currency, onBack, onOpenSettings }) {
  const [trip, setTrip] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('expenses')
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [showDeleteTrip, setShowDeleteTrip] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchAll = async () => {
    const { data: t, error: tErr } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!t || tErr) { setLoading(false); return }
    const { data: e } = await supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
    const { data: m } = await supabase.rpc('get_trip_members', { p_trip_id: tripId })
    setTrip(t)
    setExpenses(e ?? [])
    setMembers(m ?? [])
    setIsOwner(t?.owner_id === user.id)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [tripId])

  const baseCurrency = trip?.base_currency || '₹'
  const { convert, loading: ratesLoading } = useCurrencyRates(baseCurrency)
  const fmt = (n) => `${currency}${convert(n, currency).toFixed(2)}`

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
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

  if (loading) return (
    <div className="min-h-screen bg-[#f5f6fa]">

      {/* ── Header Skeleton ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />
            <div className="w-16 h-4 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="w-20 h-7 bg-slate-200 rounded-xl animate-pulse" />
            <div className="w-16 h-7 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </header>

      {/* ── Hero Banner Skeleton ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="w-16 h-5 bg-white/20 rounded-full animate-pulse mb-2" />
              <div className="w-48 h-7 bg-white/20 rounded animate-pulse mb-1" />
              <div className="w-32 h-3 bg-white/20 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-16 h-3 bg-white/20 rounded animate-pulse mb-1" />
            <div className="w-32 h-10 bg-white/20 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/15 rounded-2xl px-3 py-3">
                <div className="w-8 h-6 bg-white/20 rounded animate-pulse mb-1" />
                <div className="w-12 h-3 bg-white/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Bar Skeleton ── */}
      <div className="bg-white border-b border-slate-100 sticky top-[57px] z-10">
        <div className="max-w-4xl mx-auto px-5 flex">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 py-3.5">
              <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Content Skeleton ── */}
      <main className="max-w-4xl mx-auto px-5 py-5 pb-24 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-200 animate-pulse" />
              <div className="flex-1">
                <div className="w-3/4 h-4 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="w-1/2 h-3 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="w-16 h-5 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </main>
    </div>
  )

  const TABS = [
    { id: 'expenses', label: 'Expenses', emoji: '💳' },
    { id: 'summary', label: 'Summary', emoji: '📊' },
    { id: 'members', label: 'Members', emoji: '👥' },
    { id: 'settle', label: 'Settle Up', emoji: '💸' },
  ]

  return (
    <div className="min-h-screen bg-[#f5f6fa]">

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors font-semibold text-sm active:scale-95">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex gap-2 items-center">
            {typeof onOpenSettings === 'function' && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Settings"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.37.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            {isOwner && isActive && (
              <button onClick={() => setShowAddMember(true)}
                className="flex h-9 min-w-[72px] items-center justify-center text-xs px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition active:scale-95">
                + Member
              </button>
            )}
{isOwner && (
               <button onClick={toggleStatus}
                 className={`flex h-9 min-w-[72px] items-center justify-center text-xs px-3 rounded-xl font-bold transition active:scale-95 border ${
                   isActive ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                          : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                 }`}>
                 {isActive ? '✓ Done' : '↺ Reopen'}
               </button>
             )}
             {isOwner && (
               <button onClick={() => setShowDeleteTrip(true)}
                 className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 active:scale-95"
                 title="Delete trip"
               >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9-5.25h-12M4.5 5.25h15" />
                 </svg>
               </button>
             )}
            {isActive && (
              <button onClick={() => { setEditingExpense(null); setShowForm(true) }}
                className="flex h-9 min-w-[72px] items-center justify-center text-xs px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] active:scale-95">
                + Add
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div className={`relative overflow-hidden ${isActive ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-violet-600 to-purple-800' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-600 via-slate-700 to-slate-900'}`}>
        <div className="absolute top-0 right-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-30" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-400/30 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -left-12 w-80 h-80 bg-purple-500/20 rounded-full blur-[80px]" />
        <div className="max-w-4xl mx-auto px-6 py-10 relative z-10">
          <div className="flex items-start justify-between mb-8">
            <div className="space-y-3">
              <span className={`inline-flex items-center gap-2 text-[0.7rem] font-black px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border ${isActive ? 'bg-white/20 text-white border-white/30' : 'bg-black/20 text-slate-200 border-white/10'}`}>
                <span className={`w-2 h-2 rounded-full shadow-sm ${isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></span>
                {isActive ? 'Active Trip' : 'Completed Trip'}
              </span>
              <div>
                <h1 className="text-2xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm">{trip?.name}</h1>
                <p className="text-indigo-100 text-sm mt-1.5 font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(trip?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {baseCurrency !== currency && !ratesLoading && (
              <span className="text-xs bg-black/20 text-white px-3 py-1.5 rounded-full font-bold backdrop-blur-md border border-white/20 shadow-sm flex items-center gap-1">
                {baseCurrency}
                <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                {currency}
              </span>
            )}
          </div>

          {/* Total + quick stats */}
          <div className="mt-4 flex flex-col">
            <p className="text-indigo-200/90 text-[0.7rem] font-bold mb-1.5 uppercase tracking-[0.2em]">Total Spent</p>
            <p className="text-4xl sm:text-6xl font-black text-white tracking-tighter drop-shadow-md flex items-baseline gap-1.5">
              <span className="text-xl sm:text-4xl opacity-80 font-bold">{fmt(total).replace(/[0-9.,]/g, '')}</span>
              <span className="tabular-nums">{fmt(total).replace(/[^0-9.,]/g, '')}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              { label: 'Expenses', value: expenses.length},
              { label: 'Members', value: members.length},
              { label: 'Categories', value: Object.keys(byCategory).length}
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 hover:bg-white/15 backdrop-blur-xl rounded-[1.25rem] px-4 py-5 text-center border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col items-center">
                  <p className="text-3xl font-black text-white tabular-nums leading-none tracking-tight">{stat.value}</p>
                  <p className="text-indigo-100 text-[0.75rem] font-bold mt-2 uppercase tracking-widest opacity-90">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="bg-white border-b border-slate-100 sticky top-[61px] z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 gap-2 flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[90px] flex justify-center items-center gap-1.5 px-3 py-4 text-sm font-bold border-b-[3px] transition-all whitespace-nowrap outline-none ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}>
              <span className={activeTab === tab.id ? 'scale-110 transition-transform' : 'transition-transform'}>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <main className="max-w-4xl mx-auto px-5 py-5 pb-24">

        {/* Expenses */}
{activeTab === 'expenses' && (
           <div className="space-y-3.5">
             {expenses.length === 0 ? (
               <div className="text-center py-16 sm:py-20">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-[1.5rem] flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-4 shadow-inner shadow-indigo-100/50">🧾</div>
                 <p className="text-slate-900 font-bold text-base sm:text-lg">No expenses yet</p>
                 {isActive && <p className="text-slate-400 text-sm mt-1 font-medium">Tap "+ Add" to log the first one.</p>}
               </div>
             ) : expenses.map(exp => {
               const payer = members.find(m => m.id === exp.member_id)
               const isMe = payer?.user_id === user.id
               const isManualPayer = !payer?.user_id
               const catColor = getCategoryColor(exp.category)
               const canEdit = isOwner || isMe
               const canDelete = isOwner || isMe
               const paidLabel = isMe ? 'You' : (payer?.display_name || 'Unknown')
               return (
                 <div
                   key={exp.id}
                   className="group relative bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.10)] active:scale-[0.985] transition-all duration-200 overflow-hidden"
                 >
                   <div className="p-4 sm:p-5">
                     {/* Top: Icon + Title + Actions */}
                     <div className="flex items-center gap-3">
                       <div
                         className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${catColor} shadow-sm`}
                       >
                         {getCategoryEmoji(exp.category)}
                       </div>

                       <h3 className="flex-1 text-[1rem] sm:text-[1.05rem] font-extrabold text-slate-950 leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                         {exp.description}
                       </h3>

                      <ExpenseMenu
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={() => { setEditingExpense(exp); setShowForm(true) }}
                        onDelete={() => setDeletingExpense(exp)}
                      />
                     </div>

                    {/* Middle: Category + Amount */}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide ${catColor} shadow-sm`}
                      >
                        {exp.category}
                      </span>

                      <span className="text-indigo-600 font-black text-[1.35rem] sm:text-2xl tabular-nums tracking-tight whitespace-nowrap">
                        {fmt(exp.amount)}
                      </span>
                    </div>

                    {/* Bottom: Name + Date */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[12px] sm:text-sm">
                      <span
                        className="font-bold text-slate-600 truncate"
                        title={paidLabel}
                      >
                        {paidLabel}
                      </span>

                      {isManualPayer && (
                        <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          Manual
                        </span>
                      )}

                      <span className="text-slate-300 font-bold">•</span>

                      <time className="text-slate-400 font-semibold whitespace-nowrap">
                        {new Date(exp.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-3.5">
            {Object.keys(byCategory).length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-medium">No data yet.</div>
            ) : (
              <>
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => {
                  const pct = Math.round((sum / total) * 100)
                  const catColor = getCategoryColor(cat)
                  return (
                    <div key={cat} className="bg-white rounded-[1.25rem] p-5 border border-slate-100 shadow-sm shadow-slate-100/50">
                      <div className="flex justify-between items-center mb-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center text-xl shadow-sm ${catColor}`}>
                            {getCategoryEmoji(cat)}
                          </div>
                          <span className="font-bold text-slate-900 capitalize tracking-tight">{cat}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-800 tabular-nums tracking-tight">{fmt(sum)}</p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5 tabular-nums">{pct}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[1.25rem] p-5 flex justify-between items-center shadow-lg shadow-indigo-200 mt-2">
                  <span className="text-white font-bold tracking-wider uppercase text-sm">Total</span>
                  <span className="text-white font-black text-2xl tabular-nums tracking-tight">{fmt(total)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Members */}
        {activeTab === 'members' && (
          <div className="space-y-3.5">
            {members.map((m, idx) => {
              const memberTotal = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
              const isMe = m.user_id === user.id
              const isManual = !m.user_id
              const colors = ['from-indigo-400 to-violet-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500']
              const pct = total > 0 ? Math.round((memberTotal / total) * 100) : 0
              return (
                <div key={m.id} className="bg-white rounded-[1.25rem] px-5 py-4 border border-slate-100 shadow-sm shadow-slate-100/50 transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3.5 min-w-0 pr-3">
                      <div className={`w-12 h-12 shrink-0 rounded-[1.1rem] bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-white font-black text-lg shadow-md`}>
                        {(m.display_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm break-words tracking-tight">{isMe ? 'You' : m.display_name}</p>
                          {isMe && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">You</span>}
                          {isManual && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Manual</span>}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 capitalize mt-1 tracking-widest uppercase">{m.role}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800 tabular-nums tracking-tight">{fmt(memberTotal)}</p>
                      <p className="text-[0.7rem] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{pct}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`bg-gradient-to-r ${colors[idx % colors.length]} h-full rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Settle Up */}
        {activeTab === 'settle' && (
          <SettleTab settlements={settlements} members={members} expenses={expenses} user={user} fmt={fmt} total={total} />
        )}

      </main>

      {/* Floating Add Button */}
      {isActive && (
        <button onClick={() => { setEditingExpense(null); setShowForm(true) }}
          className="fixed bottom-6 right-6 mb-[env(safe-area-inset-bottom)] w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-[1.25rem] shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-10 sm:hidden">
          <svg className="w-6 h-6 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

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
