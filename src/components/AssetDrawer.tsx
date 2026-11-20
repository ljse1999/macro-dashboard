import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, X } from 'lucide-react';
import type { ChartPayload } from '../lib/types';
import {
  formatCompactNumber,
  formatIndexValue,
  formatRelativeTime,
  formatSignedPercent,
} from '../lib/analytics';
import { PriceChart, type ChartMode } from './charts/PriceChart';

interface AssetDrawerProps {
  symbol: string | null;
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: (symbol: string) => void;
}

const RANGES = [
  { id: '1d', label: '1D' },
  { id: '5d', label: '5D' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
];

export function AssetDrawer({
  symbol,
  onClose,
  inWatchlist,
  onToggleWatchlist,
}: AssetDrawerProps) {
  const [range, setRange] = useState('3mo');
  const [mode, setMode] = useState<ChartMode>('candles');
  const [showSma, setShowSma] = useState(true);
  const [data, setData] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData((prev) => (prev?.symbol.toUpperCase() === symbol.toUpperCase() ? prev : null));

    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || 'Unable to fetch quote data');
        }
        return res.json() as Promise<ChartPayload>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load symbol');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    if (!symbol) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [symbol, onClose]);

  if (!symbol) return null;

  const isPos = (data?.changePercent ?? 0) >= 0;
  const pct52 =
    data && data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
      ? Math.max(
          0,
          Math.min(
            100,
            ((data.price - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100
          )
        )
      : 50;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Asset inspector for ${symbol}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F1522] border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto flex flex-col">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 bg-white/95 dark:bg-[#0F1522]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>{data?.symbol || symbol}</span>
              {data?.exchange && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{data.exchange}</span>
                </>
              )}
              {data?.currency && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{data.currency}</span>
                </>
              )}
            </div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {data?.name || symbol}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleWatchlist(data?.symbol || symbol)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                inWatchlist
                  ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {inWatchlist ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close asset inspector"
              className="p-2 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1">
          {error ? (
            <div className="p-4 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-300">
              {error}
            </div>
          ) : (
            <>
              {/* Headline Price + Controls */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  {loading && !data ? (
                    <div className="h-9 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {data ? formatIndexValue(data.price) : '—'}
                      </span>
                      {data && (
                        <span
                          className={`font-mono text-sm font-medium tabular-nums ${
                            isPos
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {data.change >= 0 ? '+' : ''}
                          {formatIndexValue(data.change)} ({formatSignedPercent(data.changePercent)})
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Period return ({range.toUpperCase()}) · Source: Yahoo Finance live feed
                  </p>
                </div>

                {/* Chart Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {RANGES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRange(r.id)}
                        className={`px-2 py-1 text-xs font-mono rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                          range === r.id
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMode('candles')}
                      className={`px-2 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                        mode === 'candles'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Candles
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('area')}
                      className={`px-2 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                        mode === 'area'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Area
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSma((s) => !s)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      showSma
                        ? 'border-amber-600/50 text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    SMA
                  </button>
                </div>
              </div>

              {/* Main Price Chart */}
              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                {loading && !data ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
                    Loading market history...
                  </div>
                ) : (
                  <PriceChart
                    candles={data?.candles || []}
                    mode={mode}
                    showSma={showSma}
                    height={300}
                    symbol={data?.symbol || symbol}
                  />
                )}
              </div>

              {/* Key Statistics Grid */}
              {data && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Session &amp; 52-Week Structure
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    <div className="bg-white dark:bg-[#0F1522] p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Prev. Close</div>
                      <div className="font-mono text-sm font-semibold tabular-nums mt-1">
                        {formatIndexValue(data.previousClose)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-[#0F1522] p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Day Range</div>
                      <div className="font-mono text-sm font-semibold tabular-nums mt-1">
                        {formatIndexValue(data.dayLow)} – {formatIndexValue(data.dayHigh)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-[#0F1522] p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Volume</div>
                      <div className="font-mono text-sm font-semibold tabular-nums mt-1">
                        {formatCompactNumber(data.volume)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-[#0F1522] p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">52W Position</div>
                      <div className="font-mono text-sm font-semibold tabular-nums mt-1">
                        {pct52.toFixed(0)}% of range
                      </div>
                    </div>
                  </div>

                  {/* 52-Week Range Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <span>52W Low: {formatIndexValue(data.fiftyTwoWeekLow)}</span>
                      <span>52W High: {formatIndexValue(data.fiftyTwoWeekHigh)}</span>
                    </div>
                    <div className="relative h-2 rounded-xs bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-700/25 dark:bg-blue-400/25"
                        style={{ width: `${pct52}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-blue-700 dark:bg-blue-400"
                        style={{ left: `calc(${pct52}% - 2px)` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Related Symbol News */}
              {data && data.news.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Related Coverage
                  </h3>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.news.map((item) => (
                      <li key={item.id} className="py-3 first:pt-0">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block space-y-1"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                              {item.title}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{item.source}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatRelativeTime(item.publishedAt)}
                            </span>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
