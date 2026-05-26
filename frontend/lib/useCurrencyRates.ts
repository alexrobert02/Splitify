import { useState, useEffect, useCallback } from 'react';

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL = 3600 * 1000;
const memCache = new Map<string, RatesCache>();

export function useCurrencyRates(baseCurrency: string | undefined) {
  const [rates, setRates] = useState<Record<string, number>>({});
  // Start as true so the stats screen never renders with empty rates
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baseCurrency) {
      setLoading(false);
      return;
    }

    const cached = memCache.get(baseCurrency);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setRates(cached.rates);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`)
      .then(r => r.json())
      .then(data => {
        const fetchedRates: Record<string, number> = { [baseCurrency]: 1 };
        if (data.rates && typeof data.rates === 'object') {
          Object.entries(data.rates as Record<string, number>).forEach(([k, v]) => {
            fetchedRates[k] = Number(v);
          });
        }
        memCache.set(baseCurrency, { rates: fetchedRates, fetchedAt: Date.now() });
        setRates(fetchedRates);
      })
      .catch(() => setRates({ [baseCurrency]: 1 }))
      .finally(() => setLoading(false));
  }, [baseCurrency]);

  // Stable reference — only recreated when rates or baseCurrency actually change
  const convert = useCallback((amount: number, fromCurrency: string): number => {
    if (!baseCurrency || fromCurrency === baseCurrency) return amount;
    const rate = rates[fromCurrency];
    if (!rate) return amount;
    return amount / rate;
  }, [rates, baseCurrency]);

  return { rates, loading, convert };
}
