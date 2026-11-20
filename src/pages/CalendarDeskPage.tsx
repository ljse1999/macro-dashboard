import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CalendarEvent, CorrelationPayload, MarketQuote } from '../lib/types';
import { formatIndexValue, formatSignedPercent } from '../lib/analytics';
import { Sparkline } from '../components/charts/Sparkline';
import { CorrelationHeatmap } from '../components/charts/CorrelationHeatmap';

interface CalendarDeskPageProps {
  refreshKey: number;
  watchlist: string[];
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  onSelectSymbol: (symbol: string) => void;
}

const REGIONS = ['All', 'US', 'EU', 'UK', 'JP', 'CN'] as const;

export function CalendarDeskPage({
  refreshKey,
  watchlist,
  onAddSymbol,
  onRemoveSymbol,
  onSelectSymbol,
}: CalendarDeskPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [highOnly, setHighOnly] = useState(false);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationPayload | null>(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const watchlistKey = watchlist.join(',');

  // Load Economic Calendar
  useEffect(() => {
    let cancelled = false;
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && Array.isArray(res.events)) setEvents(res.events);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Load Live Quotes & Correlation Matrix for Watchlist
  useEffect(() => {
    if (watchlist.length === 0) {
      setQuotes([]);
      setCorrelation(null);
      return;
    }

    let cancelled = false;
    setCorrLoading(true);

    fetch(`/api/quotes?symbols=${encodeURIComponent(watchlistKey)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && Array.isArray(res.quotes)) setQuotes(res.quotes);
      })
      .catch(() => {});

    fetch('/api/correlation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: watchlist }),
    })
      .then((r) => r.json())
      .then((payload: CorrelationPayload) => {
        if (!cancelled) setCorrelation(payload);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCorrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [watchlistKey, refreshKey]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTicker.trim().toUpperCase();
    if (!cleaned) {
      setFormError('Enter a valid ticker symbol such as MSFT, TLT, or EURUSD=X.');
      return;
    }
    if (!/^[A-Z0-9^.\-=]{1,14}$/.test(cleaned)) {
      setFormError('Ticker symbols may only contain letters, numbers, ^, -, ., or =.');
      return;
    }
    if (watchlist.includes(cleaned)) {
      setFormError(`${cleaned} is already in your watchlist.`);
      return;
    }
    setFormError(null);
    onAddSymbol(cleaned);
    setNewTicker('');
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (regionFilter !== 'All' && ev.country !== regionFilter) return false;
      if (highOnly && ev.impact !== 'High') return false;
      return true;
    });
  }, [events, regionFilter, highOnly]);

  const quoteMap = useMemo(() => new Map(quotes.map((q) => [q.symbol.toUpperCase(), q])), [quotes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Macro Calendar &amp; Personal Desk
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track your persistent cross-asset watchlist, analyze live 3-month return correlations, and prepare for upcoming central bank and macro releases.
        </p>
      </div>

      {/* Top Grid: Watchlist (5 cols) + Live Correlation Matrix (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-5 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Personal Watchlist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saved in your browser · Powers the live return correlation matrix
              </p>
            </div>

            {/* Add Symbol Form */}
            <form onSubmit={handleAddSubmit} className="space-y-1.5" noValidate>
              <div className="flex items-center gap-2">
                <label htmlFor="watchlist-add-input" className="sr-only">
                  Add ticker symbol to watchlist
                </label>
                <input
                  id="watchlist-add-input"
                  type="text"
                  value={newTicker}
                  onChange={(e) => {
                    setNewTicker(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Add ticker (e.g. MSFT, TLT, ^N225)..."
                  className="flex-1 h-9 px-3 text-xs font-mono uppercase rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-md bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              {formError && (
                <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                  {formError}
                </p>
              )}
            </form>

            {/* Watchlist Table */}
            {watchlist.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                Your watchlist is empty. Add tickers above or bookmark assets from the Markets screener.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {watchlist.map((sym) => {
                  const q = quoteMap.get(sym);
                  const pos = (q?.changePercent ?? 0) >= 0;
                  return (
                    <li key={sym} className="py-2.5 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectSymbol(sym)}
                        className="min-w-0 text-left group cursor-pointer"
                      >
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                          {sym}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                          {q?.name || 'Loading quote...'}
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        {q && <Sparkline data={q.sparkline} positive={pos} width={52} height={18} />}
                        <div className="text-right font-mono tabular-nums min-w-[74px]">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {q ? formatIndexValue(q.price) : '—'}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              pos
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {q ? formatSignedPercent(q.changePercent) : '—'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSymbol(sym)}
                          aria-label={`Remove ${sym} from watchlist`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Live 3M Correlation Matrix */}
        <section className="xl:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Watchlist 3-Month Return Correlation Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Computed live from aligned Yahoo Finance daily closes to evaluate cross-asset diversification and realized volatility
            </p>
          </div>

          {corrLoading && !correlation ? (
            <div className="h-[240px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
          ) : correlation ? (
            <CorrelationHeatmap data={correlation} onSelectSymbol={onSelectSymbol} />
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Add at least two symbols to compute correlations.
            </div>
          )}
        </section>
      </div>

      {/* Upcoming Macro & Central Bank Calendar */}
      <section className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upcoming Macro &amp; Central Bank Releases
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Prior actuals anchored to latest Federal Reserve (FRED) observations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              role="tablist"
              aria-label="Calendar region filter"
            >
              {REGIONS.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  role="tab"
                  aria-selected={regionFilter === reg}
                  onClick={() => setRegionFilter(reg)}
                  className={`px-2.5 py-1 rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                    regionFilter === reg
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={highOnly}
                onChange={(e) => setHighOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>High impact only</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 text-left font-medium">Date / Time</th>
                <th className="py-2.5 px-3 text-left font-medium">Region</th>
                <th className="py-2.5 px-3 text-left font-medium">Release</th>
                <th className="py-2.5 px-3 text-left font-medium">Impact</th>
                <th className="py-2.5 px-3 text-right font-medium">Prior</th>
                <th className="py-2.5 px-3 text-right font-medium">Consensus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No scheduled releases match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{ev.date}</div>
                      <div>{ev.time}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {ev.country}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{ev.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                        {ev.notes}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap">
                      <span
                        className={
                          ev.impact === 'High'
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {ev.impact} · {ev.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {ev.previous || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {ev.consensus || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
