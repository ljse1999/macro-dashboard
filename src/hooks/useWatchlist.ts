import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'meridian_macro_watchlist_v1';
const DEFAULT_SYMBOLS = ['^GSPC', 'NVDA', 'AAPL', 'GC=F', 'CL=F', 'BTC-USD'];

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYMBOLS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_SYMBOLS;
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(loadWatchlist);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    } catch {
      // Ignore storage write errors
    }
  }, [symbols]);

  const addSymbol = useCallback((symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    if (!clean) return;
    setSymbols((prev) => (prev.includes(clean) ? prev : [clean, ...prev].slice(0, 12)));
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    setSymbols((prev) => prev.filter((s) => s !== clean));
  }, []);

  const toggleSymbol = useCallback((symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    if (!clean) return;
    setSymbols((prev) =>
      prev.includes(clean) ? prev.filter((s) => s !== clean) : [clean, ...prev].slice(0, 12)
    );
  }, []);

  const hasSymbol = useCallback(
    (symbol: string) => symbols.includes(symbol.trim().toUpperCase()),
    [symbols]
  );

  return { symbols, addSymbol, removeSymbol, toggleSymbol, hasSymbol };
}
