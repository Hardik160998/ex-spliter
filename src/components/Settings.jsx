const CURRENCIES = [
  { code: '₹', label: 'Indian Rupee', country: 'IN' },
  { code: '$', label: 'US Dollar', country: 'US' },
  { code: '€', label: 'Euro', country: 'EU' },
  { code: '£', label: 'British Pound', country: 'GB' },
  { code: '¥', label: 'Japanese Yen', country: 'JP' },
  { code: 'A$', label: 'Australian Dollar', country: 'AU' },
  { code: 'C$', label: 'Canadian Dollar', country: 'CA' },
  { code: 'S$', label: 'Singapore Dollar', country: 'SG' },
  { code: 'AED', label: 'UAE Dirham', country: 'AE' },
]

export default function Settings({ currency, onCurrencyChange, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Settings</h3>
            <p className="text-slate-400 text-xs mt-0.5">Choose your currency</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">✕</button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => onCurrencyChange(c.code)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition
                ${currency === c.code
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className={`text-sm font-medium ${currency === c.code ? 'text-indigo-700' : 'text-slate-700'}`}>
                {c.label}
              </span>
              <span className={`text-base font-bold ${currency === c.code ? 'text-indigo-600' : 'text-slate-400'}`}>
                {c.code}
              </span>
            </button>
          ))}
        </div>

        <button onClick={onClose}
          className="mt-5 w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-2xl font-bold transition shadow-lg shadow-indigo-100">
          Save & Close
        </button>
      </div>
    </div>
  )
}
