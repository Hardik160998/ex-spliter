import { useState, useEffect, useCallback, useRef } from 'react'

const SYMBOL_TO_ISO = {
  '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP',
  '¥': 'JPY', 'A$': 'AUD', 'C$': 'CAD', 'S$': 'SGD',
  'AED': 'AED', 'CHF': 'CHF', 'CN¥': 'CNY', 'HK$': 'HKD',
  'MX$': 'MXN', 'NZ$': 'NZD', 'R$': 'BRL', 'R': 'ZAR',
  '₩': 'KRW', '₺': 'TRY', '₽': 'RUB', '฿': 'THB',
  '₫': 'VND', '₱': 'PHP', 'Rp': 'IDR', 'RM': 'MYR',
}

const CACHE_KEY = 'fx_rates_unified'
const CACHE_TTL = 60 * 60 * 1000

// Global state so all components share one rate fetch
let globalRates = null
let globalLoading = true
let globalListeners = []
let globalFetchStarted = false

function notifyListeners() {
  globalListeners.forEach(fn => fn())
}

export function useCurrencyRates() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    globalListeners.push(listener)
    return () => { globalListeners = globalListeners.filter(l => l !== listener) }
  }, [])

  // Fetch once
  useEffect(() => {
    if (globalFetchStarted) return
    globalFetchStarted = true

    // Check cache
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      if (cached.rates && Date.now() - cached.ts < CACHE_TTL) {
        globalRates = cached.rates
        globalLoading = false
        notifyListeners()
        return
      }
    } catch {}

    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          globalRates = data.rates
          globalRates['USD'] = 1
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: globalRates, ts: Date.now() }))
          } catch {}
        }
        globalLoading = false
        notifyListeners()
      })
      .catch(() => { globalLoading = false; notifyListeners() })
  }, [])

  const convert = useCallback((amount, fromSymbol, toSymbol) => {
    if (!fromSymbol || !toSymbol) return Number(amount)
    if (fromSymbol === toSymbol) return Number(amount)
    if (!globalRates) return Number(amount)

    const fromISO = SYMBOL_TO_ISO[fromSymbol]
    const toISO = SYMBOL_TO_ISO[toSymbol]
    if (!fromISO || !toISO) return Number(amount)

    const rateFrom = globalRates[fromISO]
    const rateTo = globalRates[toISO]
    if (!rateFrom || !rateTo) return Number(amount)

    // Convert: amount_in_usd = amount / rateFrom; amount_in_target = amount_in_usd * rateTo
    return Number(amount) / rateFrom * rateTo
  }, [])

  return { convert, loading: globalLoading, rates: globalRates }
}

export { SYMBOL_TO_ISO }
