import { useState, useRef, useEffect } from 'react'

export default function Select({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select...', 
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-surface-50 border border-surface-200 text-surface-500 rounded-xl px-4 py-3 outline-none transition-all flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 active:scale-[0.99]'
        } ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-medium">{selectedOption.label}</span>
              {selectedOption.suffix && <span className="shrink-0">{selectedOption.suffix}</span>}
            </>
          ) : (
            <span className="text-surface-300 font-medium">{placeholder}</span>
          )}
        </div>
        <svg 
          className={`w-5 h-5 text-surface-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-500' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-surface-100 rounded-2xl shadow-elevated overflow-hidden animate-fadeIn">
          <ul className="max-h-60 overflow-y-auto overscroll-contain py-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-surface-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors active:bg-brand-50 ${
                      isSelected 
                        ? 'bg-brand-50/80 text-brand-700 font-bold' 
                        : 'text-surface-500 hover:bg-surface-50 font-medium'
                    }`}
                  >
                    {opt.icon && <span className="text-lg shrink-0">{opt.icon}</span>}
                    <span className="truncate flex-1">{opt.label}</span>
                    {opt.suffix && <span className="shrink-0">{opt.suffix}</span>}
                    {isSelected && (
                      <svg className="w-5 h-5 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
            {options.length === 0 && (
              <li className="px-4 py-3 text-sm text-surface-400 text-center">No options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
