import { useState, useEffect } from 'react'

// Maps currency symbol to ISO code for the API
const SYMBOL_TO_ISO = {
  '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP',
  '¥': 'JPY', 'A$': 'AUD', 'C$': 'CAD', 'S$': 'SGD', 'AED': 'AED',
}

const CACHE_KEY = 'fx_rates'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export function useCurrencyRates(baseCurrencySymbol) {
  const [rates, setRates] = useState(null) // { USD: 0.012, EUR: 0.011, ... }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isoBase = SYMBOL_TO_ISO[baseCurrencySymbol] || 'INR'

    // Check cache
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      if (cached[isoBase] && Date.now() - cached[isoBase].ts < CACHE_TTL) {
        setRates(cached[isoBase].rates)
        setLoading(false)
        return
      }
    } catch {}

    // Fetch from free API (no key needed)
    fetch(`https://open.er-api.com/v6/latest/${isoBase}`)
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setRates(data.rates)
          // Cache it
          try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
            cached[isoBase] = { rates: data.rates, ts: Date.now() }
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
          } catch {}
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [baseCurrencySymbol])

  // Convert amount from base currency to target currency
  const convert = (amount, targetSymbol) => {
    if (!rates || targetSymbol === baseCurrencySymbol) return Number(amount)
    const isoTarget = SYMBOL_TO_ISO[targetSymbol]
    if (!isoTarget || !rates[isoTarget]) return Number(amount)
    return Number(amount) * rates[isoTarget]
  }

  return { convert, loading, rates }
}

export { SYMBOL_TO_ISO }
