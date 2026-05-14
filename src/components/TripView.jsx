import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ExpenseForm from './ExpenseForm'
import AddMemberModal from './AddMemberModal'
import { useCurrencyRates } from '../hooks/useCurrencyRates'

function getCategoryEmoji(cat = '') {
  const map = {
    'food & drinks': '🍽️', 'food': '🍽️',
    'accommodation': '🏨', 'hotel': '🏨',
    'transport': '🚗', 'flight': '✈️', 'fuel': '⛽',
    'shopping': '🛍️', 'activities': '🎯',
    'entertainment': '🎬', 'medical': '💊',
    'visa & documents': '📄', 'communication': '📱',
    'general': '📌', 'other': '💰',
  }
  return map[(cat || '').toLowerCase()] ?? '💰'
}

const CATEGORY_COLORS = {
  'food & drinks': 'bg-orange-100 text-orange-600',
  'accommodation': 'bg-blue-100 text-blue-600',
  'transport': 'bg-violet-100 text-violet-600',
  'flight': 'bg-sky-100 text-sky-600',
  'fuel': 'bg-yellow-100 text-yellow-600',
  'shopping': 'bg-pink-100 text-pink-600',
  'activities': 'bg-green-100 text-green-600',
  'entertainment': 'bg-purple-100 text-purple-600',
  'medical': 'bg-red-100 text-red-600',
  'visa & documents': 'bg-teal-100 text-teal-600',
  'communication': 'bg-cyan-100 text-cyan-600',
  'other': 'bg-slate-100 text-slate-600',
}

function getCategoryColor(cat = '') {
  return CATEGORY_COLORS[(cat || '').toLowerCase()] ?? 'bg-slate-100 text-slate-600'
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
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Spent', value: fmt(total), color: 'text-slate-800' },
          { label: 'Members', value: members.length, color: 'text-indigo-600' },
          { label: 'Per Person', value: fmt(perPerson), color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Who paid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Who Paid What</p>
        </div>
        {members.map((m, idx) => {
          const paid = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
          const diff = Math.round((paid - perPerson) * 100) / 100
          const isYou = m.user_id === user.id
          const pct = total > 0 ? (paid / total) * 100 : 0
          const colors = ['from-indigo-400 to-violet-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500']
          return (
            <div key={m.id} className="px-5 py-4 border-b border-slate-50 last:border-0">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-white font-bold text-xs`}>
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-700 text-sm">
                    {isYou ? 'You' : m.display_name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-sm">{fmt(paid)}</p>
                  <p className={`text-xs font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {diff >= 0 ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className={`bg-gradient-to-r ${colors[idx % colors.length]} h-1.5 rounded-full transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Transactions */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Transactions to Settle</p>
        {settlements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-10">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-slate-700 font-bold">All settled up!</p>
            <p className="text-slate-400 text-sm mt-1">No payments needed.</p>
          </div>
        ) : settlements.map((s, i) => {
          const fromMe = isMe(s.from)
          const toMe = isMe(s.to)
          return (
            <div key={i} className={`rounded-2xl px-5 py-4 mb-3 border flex items-center justify-between shadow-sm ${
              fromMe ? 'bg-red-50 border-red-100' : toMe ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm ${fromMe ? 'bg-red-400' : 'bg-slate-300'}`}>
                  {(members.find(m => m.id === s.from)?.display_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    <span className={fromMe ? 'text-red-600' : 'text-slate-700'}>{getName(s.from)}</span>
                    <span className="text-slate-300 mx-2">→</span>
                    <span className={toMe ? 'text-green-600' : 'text-slate-700'}>{getName(s.to)}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fromMe ? '💸 You need to pay' : toMe ? '💰 You will receive' : 'Transfer'}
                  </p>
                </div>
              </div>
              <span className={`font-black text-lg ${fromMe ? 'text-red-600' : toMe ? 'text-green-600' : 'text-slate-700'}`}>
                {fmt(s.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TripView({ tripId, user, currency, onBack }) {
  const [trip, setTrip] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('expenses')

  const fetchAll = async () => {
    const [{ data: t }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.rpc('get_trip_members', { p_trip_id: tripId }),
    ])
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
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition font-semibold text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <div className="flex gap-2">
            {isOwner && isActive && (
              <button onClick={() => setShowAddMember(true)}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition">
                + Member
              </button>
            )}
            {isOwner && (
              <button onClick={toggleStatus}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition border ${
                  isActive ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                           : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                }`}>
                {isActive ? '✓ Mark Done' : '↺ Reopen'}
              </button>
            )}
            {isActive && (
              <button onClick={() => setShowForm(true)}
                className="text-xs px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm shadow-indigo-200">
                + Add
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div className={`relative overflow-hidden ${isActive ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-10 -left-6 w-48 h-48 bg-white/5 rounded-full" />
        <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                {isActive ? '● Active' : '✓ Completed'}
              </span>
              <h1 className="text-2xl font-black text-white mt-2">{trip?.name}</h1>
              <p className="text-white/60 text-xs mt-1">
                Created {new Date(trip?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {baseCurrency !== currency && !ratesLoading && (
              <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">
                {baseCurrency} → {currency}
              </span>
            )}
          </div>

          {/* Total + quick stats */}
          <div className="mt-4">
            <p className="text-white/60 text-xs mb-1">Total Spent</p>
            <p className="text-4xl font-black text-white tracking-tight">{fmt(total)}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-black text-white">{expenses.length}</p>
              <p className="text-white/60 text-xs mt-0.5">Expenses</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-black text-white">{members.length}</p>
              <p className="text-white/60 text-xs mt-0.5">Members</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-black text-white">{Object.keys(byCategory).length}</p>
              <p className="text-white/60 text-xs mt-0.5">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="bg-white border-b border-slate-100 sticky top-[57px] z-10">
        <div className="max-w-4xl mx-auto px-5 flex overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <main className="max-w-4xl mx-auto px-5 py-5 pb-24">

        {/* Expenses */}
        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4">🧾</div>
                <p className="text-slate-700 font-bold text-lg">No expenses yet</p>
                {isActive && <p className="text-slate-400 text-sm mt-1">Tap "+ Add" to log the first one.</p>}
              </div>
            ) : expenses.map(exp => {
              const payer = members.find(m => m.id === exp.member_id)
              const isMe = payer?.user_id === user.id
              const catColor = getCategoryColor(exp.category)
              return (
                <div key={exp.id} className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition group">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${catColor}`}>
                      {getCategoryEmoji(exp.category)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{exp.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                          {exp.category}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className={`text-xs font-semibold ${isMe ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {isMe ? 'You' : payer?.display_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">
                          {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-indigo-600 font-black text-base">{fmt(exp.amount)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-3">
            {Object.keys(byCategory).length === 0 ? (
              <div className="text-center py-20 text-slate-400">No data yet.</div>
            ) : (
              <>
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => {
                  const pct = Math.round((sum / total) * 100)
                  const catColor = getCategoryColor(cat)
                  return (
                    <div key={cat} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${catColor}`}>
                            {getCategoryEmoji(cat)}
                          </div>
                          <span className="font-bold text-slate-700">{cat}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-800">{fmt(sum)}</p>
                          <p className="text-xs text-slate-400">{pct}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 flex justify-between items-center shadow-lg shadow-indigo-100">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-white font-black text-2xl">{fmt(total)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Members */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {members.map((m, idx) => {
              const memberTotal = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
              const isMe = m.user_id === user.id
              const colors = ['from-indigo-400 to-violet-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500']
              const pct = total > 0 ? Math.round((memberTotal / total) * 100) : 0
              return (
                <div key={m.id} className="bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                        {(m.display_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm">{isMe ? 'You' : m.display_name}</p>
                          {isMe && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">You</span>}
                        </div>
                        <p className="text-xs text-slate-400 capitalize mt-0.5">{m.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-800">{fmt(memberTotal)}</p>
                      <p className="text-xs text-slate-400">{pct}% of total</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`bg-gradient-to-r ${colors[idx % colors.length]} h-1.5 rounded-full transition-all`}
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
        <button onClick={() => setShowForm(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center text-2xl hover:scale-105 transition-transform z-10 sm:hidden">
          +
        </button>
      )}

      {showForm && (
        <ExpenseForm tripId={tripId} userId={user.id} members={members} currency={currency}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll() }} />
      )}
      {showAddMember && (
        <AddMemberModal
          tripId={tripId}
          onClose={() => setShowAddMember(false)}
          onAdded={() => fetchAll()}
        />
      )}
    </div>
  )
}
