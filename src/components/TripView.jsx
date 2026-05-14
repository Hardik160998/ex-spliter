import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ExpenseForm from './ExpenseForm'
import InviteModal from './InviteModal'
import { useCurrencyRates } from '../hooks/useCurrencyRates'

function getCategoryEmoji(cat = '') {
  const map = {
    food: '🍽️', hotel: '🏨', accommodation: '🏨', transport: '🚗',
    fuel: '⛽', flight: '✈️', shopping: '🛍️', activities: '🎯',
    entertainment: '🎬', medical: '💊', general: '📌',
  }
  return map[(cat || '').toLowerCase()] ?? '💰'
}

function calcSettlements(members, expenses) {
  if (!members.length || !expenses.length) return []

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const perPerson = total / members.length

  const balance = {}
  members.forEach(m => { balance[m.id] = -perPerson })
  expenses.forEach(e => {
    if (balance[e.member_id] !== undefined) {
      balance[e.member_id] += Number(e.amount)
    }
  })

  const creditors = []
  const debtors = []
  Object.entries(balance).forEach(([id, bal]) => {
    const rounded = Math.round(bal * 100) / 100
    if (rounded > 0.01) creditors.push({ id, amount: rounded })
    else if (rounded < -0.01) debtors.push({ id, amount: -rounded })
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
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
          <div className="px-3">
            <p className="text-xs text-slate-400 mb-1">Total Spent</p>
            <p className="font-bold text-slate-800">{fmt(total)}</p>
          </div>
          <div className="px-3">
            <p className="text-xs text-slate-400 mb-1">Members</p>
            <p className="font-bold text-slate-800">{members.length}</p>
          </div>
          <div className="px-3">
            <p className="text-xs text-slate-400 mb-1">Per Person</p>
            <p className="font-bold text-indigo-600">{fmt(perPerson)}</p>
          </div>
        </div>
      </div>

      {/* Who paid what */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Who Paid What</p>
        </div>
        {members.map(m => {
          const paid = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
          const diff = Math.round((paid - perPerson) * 100) / 100
          const isYou = m.user_id === user.id
          return (
            <div key={m.id} className="px-5 py-3.5 flex justify-between items-center border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs">
                  {(m.display_name || '?')[0].toUpperCase()}
                </div>
                <span className="font-medium text-slate-700">{isYou ? 'You' : m.display_name}</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">{fmt(paid)}</p>
                <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {diff >= 0 ? `+${fmt(diff)} overpaid` : `-${fmt(Math.abs(diff))} underpaid`}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Transactions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Transactions to Settle</p>
        {settlements.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-slate-600 font-medium">All settled up!</p>
            <p className="text-slate-400 text-sm mt-1">No payments needed.</p>
          </div>
        ) : settlements.map((s, i) => {
          const fromMe = isMe(s.from)
          const toMe = isMe(s.to)
          return (
            <div key={i} className={`rounded-2xl px-5 py-4 mb-3 border shadow-sm flex items-center justify-between ${
              fromMe ? 'bg-red-50 border-red-200' : toMe ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  fromMe ? 'bg-red-400' : 'bg-slate-400'
                }`}>
                  {(members.find(m => m.id === s.from)?.display_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    <span className={fromMe ? 'text-red-600' : 'text-slate-700'}>{getName(s.from)}</span>
                    <span className="text-slate-400 mx-2">→</span>
                    <span className={toMe ? 'text-green-600' : 'text-slate-700'}>{getName(s.to)}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fromMe ? '💸 You need to pay' : toMe ? '💰 You will receive' : 'Transfer'}
                  </p>
                </div>
              </div>
              <span className={`font-bold text-lg ${fromMe ? 'text-red-600' : toMe ? 'text-green-600' : 'text-slate-800'}`}>
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
  const [showInvite, setShowInvite] = useState(false)
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

  // base_currency is the currency used when trip was created (stored amounts are in this currency)
  const baseCurrency = trip?.base_currency || '₹'
  const { convert, loading: ratesLoading } = useCurrencyRates(baseCurrency)

  // Convert from base to display currency, then format
  const fmt = (n) => {
    const converted = convert(n, currency)
    return `${currency}${converted.toFixed(2)}`
  }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
      <p className="text-slate-400">Loading trip...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">

      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition text-sm font-medium">
              ← Back
            </button>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">{trip?.name}</h2>
              <span className={`text-xs font-semibold ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
                {isActive ? '● Active' : '✓ Completed'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isOwner && isActive && (
              <button onClick={() => setShowInvite(true)}
                className="text-sm px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium">
                📧 Invite
              </button>
            )}
            {isOwner && (
              <button onClick={toggleStatus}
                className={`text-sm px-4 py-2 rounded-xl transition font-medium ${
                  isActive
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                }`}>
                {isActive ? '✓ Mark Done' : '↺ Reopen'}
              </button>
            )}
            {isActive && (
              <button onClick={() => setShowForm(true)}
                className="text-sm px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition font-semibold shadow-sm shadow-indigo-200">
                + Add Expense
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={`${isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'} text-white`}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-indigo-200 text-sm mb-1">Total Spent</p>
          <p className="text-5xl font-bold tracking-tight">{fmt(total)}</p>
          <p className="text-indigo-200 text-sm mt-2">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · {members.length} member{members.length !== 1 ? 's' : ''}</p>
          {baseCurrency !== currency && !ratesLoading && (
            <p className="text-indigo-300 text-xs mt-1">Converted from {baseCurrency} → {currency} (live rates)</p>
          )}
          {ratesLoading && baseCurrency !== currency && (
            <p className="text-indigo-300 text-xs mt-1">Loading exchange rates...</p>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 sticky top-[73px] z-10">
        <div className="max-w-4xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {[['expenses', '💳 Expenses'], ['summary', '📊 Summary'], ['members', '👥 Members'], ['settle', '💸 Settle Up']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6">

        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🧾</div>
                <p className="text-slate-500 font-medium">No expenses yet</p>
                {isActive && <p className="text-slate-400 text-sm mt-1">Tap "+ Add Expense" to log the first one.</p>}
              </div>
            ) : expenses.map(exp => {
              const payer = members.find(m => m.id === exp.member_id)
              const isMe = payer?.user_id === user.id
              return (
                <div key={exp.id} className="bg-white rounded-2xl px-5 py-4 flex justify-between items-center border border-slate-200 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
                      {getCategoryEmoji(exp.category)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{exp.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {exp.category} · <span className={isMe ? 'text-indigo-500 font-medium' : 'text-slate-500'}>
                          {isMe ? 'You' : payer?.display_name || 'Unknown'}
                        </span> · {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-indigo-600 font-bold text-base">{fmt(exp.amount)}</span>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-4">
            {Object.keys(byCategory).length === 0 ? (
              <div className="text-center py-20 text-slate-400">No data yet.</div>
            ) : (
              <>
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => {
                  const pct = Math.round((sum / total) * 100)
                  return (
                    <div key={cat} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getCategoryEmoji(cat)}</span>
                          <span className="font-semibold text-slate-700">{cat}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">{fmt(sum)}</span>
                          <span className="text-xs text-slate-400 ml-2">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="bg-indigo-600 rounded-2xl p-5 text-white flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold">{fmt(total)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-3">
            {members.map(m => {
              const memberTotal = expenses.filter(e => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0)
              const isMe = m.user_id === user.id
              return (
                <div key={m.id} className="bg-white rounded-2xl px-5 py-4 flex justify-between items-center border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {m.display_name || m.user_id.slice(0, 8)}
                        {isMe && <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">You</span>}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{fmt(memberTotal)}</p>
                    <p className="text-xs text-slate-400">paid</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'settle' && (
          <SettleTab settlements={settlements} members={members} expenses={expenses} user={user} fmt={fmt} total={total} />
        )}

      </main>

      {showForm && (
        <ExpenseForm tripId={tripId} userId={user.id} members={members} currency={currency}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll() }} />
      )}
      {showInvite && (
        <InviteModal tripId={tripId} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}
