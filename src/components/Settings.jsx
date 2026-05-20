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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="card-elevated p-6 w-full max-w-sm animate-scaleIn">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-surface-500">Settings</h3>
            <p className="text-surface-400 text-xs mt-0.5 font-medium">Choose your currency</p>
          </div>
          <button onClick={onClose} className="btn-ghost w-8 h-8 flex items-center justify-center p-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => onCurrencyChange(c.code)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all active:scale-[0.99]
                ${currency === c.code
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-surface-200 hover:bg-surface-50'}`}>
              <span className={`text-sm font-semibold ${currency === c.code ? 'text-brand-700' : 'text-surface-500'}`}>
                {c.label}
              </span>
              <span className={`text-base font-bold ${currency === c.code ? 'text-brand-600' : 'text-surface-400'}`}>
                {c.code}
              </span>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="btn-primary w-full mt-5">
          Save & Close
        </button>
      </div>
    </div>
  )
}
