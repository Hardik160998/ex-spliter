import { useState, useEffect, useRef } from 'react'

export default function ExpenseMenu({ canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!canEdit && !canDelete) return null

  const showSeparator = canEdit && canDelete

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="shrink-0 p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all active:scale-90"
        aria-label="Expense actions"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-surface-100 shadow-elevated py-1.5 min-w-[180px] animate-fadeIn origin-top-right"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && (
              <button
                onClick={() => { setOpen(false); onEdit() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-surface-500 hover:bg-brand-50 hover:text-brand-700 transition-colors active:bg-brand-100"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Edit Expense</span>
              </button>
            )}
            {showSeparator && <div className="mx-3 h-px bg-surface-100" />}
            {canDelete && (
              <button
                onClick={() => { setOpen(false); onDelete() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-accent-red hover:bg-red-50 transition-colors active:bg-red-100"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9-5.25h-12M4.5 5.25h15" />
                </svg>
                <span>Delete Expense</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
