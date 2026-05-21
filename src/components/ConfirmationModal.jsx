import { useEffect } from 'react'

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Delete', 
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false 
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-modal border border-surface-100 transform transition-all duration-300 animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${
              isDanger ? 'bg-red-50 text-accent-red' : 'bg-brand-50 text-brand-600'
            }`}>
              {isDanger ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9 7.5h18A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12A2.25 2.25 0 003.75 21z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.857l-.708 2.836a2.25 2.25 0 001.963 2.184l.02.006a2.25 2.25 0 002.184-1.963l.708-2.836a.75.75 0 011.063-.857l-.02.041V8.25a2.25 2.25 0 01-2.25-2.25h-6.5a2.25 2.25 0 012.25 2.25v3z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-surface-500 tracking-tight">{title}</h3>
              <p className="text-sm text-surface-400 mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-xl font-bold py-3 text-sm transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.97] ${
                isDanger 
                  ? 'bg-accent-red hover:bg-red-500 text-white shadow-lg' 
                  : 'bg-brand-500 hover:bg-brand-600 text-white shadow-green-glow'
              }`}
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
