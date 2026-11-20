import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import type { FactorMetric, MarketQuote, MarketStructurePayload } from '../lib/types';
import {
  formatCompactNumber,
  formatIndexValue,
  formatSignedPercent,
} from '../lib/analytics';
import { FactorScatterChart } from '../components/charts/FactorScatterChart';
import { RegimeRatioCard } from '../components/charts/RegimeRatioCard';
import { Sparkline } from '../components/charts/Sparkline';

interface MarketsPageProps {
  refreshKey: number;
  onSelectSymbol: (symbol: string) => void;
  hasSymbol: (symbol: string) => boolean;
  onToggleWatchlist: (symbol: string) => void;
}

type FactorHorizon = 'return1d' | 'return1m' | 'return3m' | 'alpha3mVsSpy';
type DispersionGroup = 'indices' | 'sectors' | 'equities' | 'commodities' | 'crypto';
type SortField = 'symbol' | 'price' | 'changePercent' | 'volume';

const FACTOR_HORIZONS: Array<{ id: FactorHorizon; label: string; subtitle: string }> = [
  { id: 'return3m', label: '3M Return', subtitle: 'Trailing 3-month total price return' },
  { id: 'alpha3mVsSpy', label: '3M Alpha vs SPY', subtitle: 'Excess 3-month return relative to S&P 500 (SPY)' },
  { id: 'return1m', label: '1M Return', subtitle: 'Trailing 1-month factor momentum' },
  { id: 'return1d', label: '1D Session', subtitle: 'Latest trading session performance' },
];

const DISPERSION_GROUPS: Array<{ id: DispersionGroup; label: string }> = [
  { id: 'indices', label: 'Global Indices' },
  { id: 'sectors', label: 'US Sectors' },
  { id: 'equities', label: 'Mega-Caps' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'crypto', label: 'Digital Assets' },
];

export function MarketsPage({
  refreshKey,
  onSelectSymbol,
  hasSymbol,
  onToggleWatchlist,
}: MarketsPageProps) {
  const [data, setData] = useState<MarketStructurePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [factorHorizon, setFactorHorizon] = useState<FactorHorizon>('return3m');
  const [dispersionGroup, setDispersionGroup] = useState<DispersionGroup>('indices');

  // Optional compact directory state (collapsed by default so Markets stays visualization-first)
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryCategory, setDirectoryCategory] = useState<'all' | DispersionGroup>('all');
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/market-structure')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load market structure'))))
      .then((payload: MarketStructurePayload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load market structure');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const sortedFactors = useMemo(() => {
    if (!data?.factors) return [] as FactorMetric[];
    return [...data.factors].sort((a, b) => b[factorHorizon] - a[factorHorizon]);
  }, [data, factorHorizon]);

  const maxFactorAbs = useMemo(() => {
    if (sortedFactors.length === 0) return 5;
    return Math.max(1, ...sortedFactors.map((f) => Math.abs(f[factorHorizon])));
  }, [sortedFactors, factorHorizon]);

  const regimeTally = useMemo(() => {
    const ratios = data?.ratios || [];
    let riskOn = 0;
    let neutral = 0;
    let riskOff = 0;
    for (const r of ratios) {
      if (r.signal === 'Risk-On') riskOn += 1;
      else if (r.signal === 'Risk-Off') riskOff += 1;
      else neutral += 1;
    }
    return { riskOn, neutral, riskOff };
  }, [data]);

  const activeDispersionQuotes = useMemo(() => {
    if (!data) return [] as MarketQuote[];
    return [...(data[dispersionGroup] || [])].sort((a, b) => b.changePercent - a.changePercent);
  }, [data, dispersionGroup]);

  const maxDispersionAbs = useMemo(() => {
    if (activeDispersionQuotes.length === 0) return 2;
    return Math.max(0.5, ...activeDispersionQuotes.map((q) => Math.abs(q.changePercent)));
  }, [activeDispersionQuotes]);

  // 52-Week Range Positioning highlights (indices + leading equities with valid 52W range)
  const rangeLeaders = useMemo(() => {
    if (!data) return [] as Array<MarketQuote & { rangePct: number; distFromHighPct: number }>;
    const pool = [...(data.indices || []), ...(data.equities || []).slice(0, 6)];
    return pool
      .filter(
        (q) =>
          q.fiftyTwoWeekLow != null &&
          q.fiftyTwoWeekHigh != null &&
          q.fiftyTwoWeekLow > 0 &&
          q.fiftyTwoWeekHigh > q.fiftyTwoWeekLow
      )
      .slice(0, 10)
      .map((q) => {
        const lo = q.fiftyTwoWeekLow!;
        const hi = q.fiftyTwoWeekHigh!;
        const rangePct = Math.max(0, Math.min(100, Math.round(((q.price - lo) / (hi - lo)) * 100)));
        const distFromHighPct = ((q.price - hi) / hi) * 100;
        return { ...q, rangePct, distFromHighPct };
      })
      .sort((a, b) => b.rangePct - a.rangePct);
  }, [data]);

  const allDirectoryQuotes = useMemo(() => {
    if (!data) return [] as MarketQuote[];
    if (directoryCategory !== 'all') return data[directoryCategory] || [];
    return [
      ...(data.indices || []),
      ...(data.sectors || []),
      ...(data.equities || []),
      ...(data.commodities || []),
      ...(data.crypto || []),
    ];
  }, [data, directoryCategory]);

  const filteredDirectory = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = q
      ? allDirectoryQuotes.filter(
          (item) =>
            item.symbol.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            (item.region && item.region.toLowerCase().includes(q))
        )
      : allDirectoryQuotes;

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortField === 'price') cmp = a.price - b.price;
      else if (sortField === 'changePercent') cmp = a.changePercent - b.changePercent;
      else if (sortField === 'volume') cmp = (a.volume || 0) - (b.volume || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allDirectoryQuotes, filterText, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' ? 'asc' : 'desc');
    }
  };

  const activeHorizonMeta =
    FACTOR_HORIZONS.find((h) => h.id === factorHorizon) || FACTOR_HORIZONS[0];

  const topFactor = sortedFactors[0];
  const laggingFactor = sortedFactors[sortedFactors.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Markets, Equity Factors &amp; Regime Structure
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visual market diagnostics: live US style &amp; factor leadership, cross-asset risk ratios, dispersion spectra, and 52-week positioning.
          </p>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              SPY 3M:{' '}
              <strong
                className={
                  data.spyReturn3m >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }
              >
                {formatSignedPercent(data.spyReturn3m)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Realized Vol: <strong className="text-slate-900 dark:text-slate-100">{data.spyVol.toFixed(1)}%</strong>
            </span>
          </div>
        )}
      </div>

      {error && !data ? (
        <div className="p-8 rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#0F1522] text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : (
        <>
          {/* Section 1: Equity Factors & Style Performance Studio */}
          <section className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  US Equity Factors &amp; Style Leadership
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeHorizonMeta.subtitle} · Live factor ETFs benchmarked against S&amp;P 500 (SPY)
                </p>
              </div>

              <div
                className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                role="tablist"
                aria-label="Factor return horizon"
              >
                {FACTOR_HORIZONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    role="tab"
                    aria-selected={factorHorizon === h.id}
                    onClick={() => setFactorHorizon(h.id)}
                    className={`px-2.5 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      factorHorizon === h.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && !data ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-6 h-[320px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                <div className="xl:col-span-6 h-[320px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left: Diverging Factor Performance Bars */}
                <div className="xl:col-span-6 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 pb-1">
                    <span>Factor · ETF Proxy</span>
                    {topFactor && laggingFactor && (
                      <span>
                        Spread: {(topFactor[factorHorizon] - laggingFactor[factorHorizon]).toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {sortedFactors.map((f) => {
                      const val = f[factorHorizon];
                      const pos = val >= 0;
                      const barPct = Math.min(100, (Math.abs(val) / maxFactorAbs) * 100);
                      const saved = hasSymbol(f.symbol);

                      return (
                        <div
                          key={f.symbol}
                          className="py-2 flex items-center gap-3 group hover:bg-slate-50/70 dark:hover:bg-slate-900/40 rounded-xs px-1 -mx-1 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectSymbol(f.symbol)}
                            className="w-36 sm:w-44 shrink-0 text-left cursor-pointer"
                          >
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                                {f.factor}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                {f.symbol}
                              </span>
                            </div>
                          </button>

                          {/* Centered Diverging Bar */}
                          <button
                            type="button"
                            onClick={() => onSelectSymbol(f.symbol)}
                            className="flex-1 flex items-center h-5 cursor-pointer"
                            aria-label={`${f.factor} ${formatSignedPercent(val)}`}
                          >
                            <div className="w-1/2 flex justify-end pr-1">
                              {!pos && (
                                <div
                                  className="h-3 rounded-l-xs bg-red-700/80 dark:bg-red-500/80"
                                  style={{ width: `${Math.max(4, barPct)}%` }}
                                />
                              )}
                            </div>
                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 shrink-0" />
                            <div className="w-1/2 flex justify-start pl-1">
                              {pos && (
                                <div
                                  className="h-3 rounded-r-xs bg-emerald-700/80 dark:bg-emerald-500/80"
                                  style={{ width: `${Math.max(4, barPct)}%` }}
                                />
                              )}
                            </div>
                          </button>

                          <div className="w-16 text-right font-mono text-xs font-semibold tabular-nums shrink-0">
                            <span
                              className={
                                pos
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {formatSignedPercent(val)}
                            </span>
                          </div>

                          <div className="hidden sm:block w-14 text-right font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                            {f.annualizedVol.toFixed(1)}%v
                          </div>

                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(f.symbol)}
                            aria-label={
                              saved
                                ? `Remove ${f.symbol} from watchlist`
                                : `Add ${f.symbol} to watchlist`
                            }
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer shrink-0"
                          >
                            {saved ? (
                              <BookmarkCheck className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                            ) : (
                              <Bookmark className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Risk vs Return Factor Scatter Plot */}
                <div className="xl:col-span-6 xl:border-l xl:border-slate-100 xl:dark:border-slate-800/80 xl:pl-6">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Factor Risk-Return Map (3M Realized Vol vs. 3M Return)
                  </div>
                  <FactorScatterChart
                    factors={data?.factors || []}
                    spyReturn3m={data?.spyReturn3m || 0}
                    spyVol={data?.spyVol || 15}
                    onSelectSymbol={onSelectSymbol}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Cross-Asset Regime Ratios */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Cross-Asset Market Regime Ratios
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Internal breadth, credit appetite, cyclicality, and global growth barometers over trailing 3 months
                </p>
              </div>
              {data && data.ratios.length > 0 && (
                <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {regimeTally.riskOn} Risk-On
                  </span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {regimeTally.neutral} Neutral
                  </span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-red-700 dark:text-red-400 font-semibold">
                    {regimeTally.riskOff} Risk-Off
                  </span>
                </div>
              )}
            </div>

            {loading && !data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[198px] rounded-md bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(data?.ratios || []).map((ratio) => (
                  <RegimeRatioCard
                    key={ratio.id}
                    ratio={ratio}
                    onInspect={onSelectSymbol}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Performance Dispersion Spectrum (7 cols) + 52-Week Range Positioning (5 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Visual Performance Dispersion Spectrum */}
            <section className="xl:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Session Performance Dispersion
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ranked intraday return spectrum &amp; 5-day sparkline · Click any bar to inspect
                  </p>
                </div>

                <div
                  className="inline-flex flex-wrap items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  role="tablist"
                  aria-label="Dispersion asset group"
                >
                  {DISPERSION_GROUPS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="tab"
                      aria-selected={dispersionGroup === g.id}
                      onClick={() => setDispersionGroup(g.id)}
                      className={`px-2 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                        dispersionGroup === g.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading && !data ? (
                <div className="h-[310px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {activeDispersionQuotes.map((q) => {
                    const pos = q.changePercent >= 0;
                    const barW = Math.min(100, (Math.abs(q.changePercent) / maxDispersionAbs) * 100);
                    return (
                      <button
                        key={q.symbol}
                        type="button"
                        onClick={() => onSelectSymbol(q.symbol)}
                        className="w-full py-2 px-1 -mx-1 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xs transition-colors text-left cursor-pointer"
                      >
                        <div className="w-36 sm:w-44 shrink-0 min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                            {q.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {q.symbol}
                            {q.region ? ` · ${q.region}` : ''}
                          </div>
                        </div>

                        <div className="flex-1 flex items-center h-5">
                          <div className="w-1/2 flex justify-end pr-1">
                            {!pos && (
                              <div
                                className="h-2.5 rounded-l-xs bg-red-700/80 dark:bg-red-500/80"
                                style={{ width: `${Math.max(3, barW)}%` }}
                              />
                            )}
                          </div>
                          <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700 shrink-0" />
                          <div className="w-1/2 flex justify-start pl-1">
                            {pos && (
                              <div
                                className="h-2.5 rounded-r-xs bg-emerald-700/80 dark:bg-emerald-500/80"
                                style={{ width: `${Math.max(3, barW)}%` }}
                              />
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:flex justify-end w-16 shrink-0">
                          <Sparkline data={q.sparkline} positive={pos} width={54} height={18} />
                        </div>

                        <div className="w-18 text-right font-mono text-xs tabular-nums shrink-0">
                          <div
                            className={`font-semibold ${
                              pos
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {formatSignedPercent(q.changePercent)}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatIndexValue(q.price)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Right: 52-Week Range Positioning Visual */}
            <section className="xl:col-span-5 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  52-Week Range Positioning
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Where global benchmarks and mega-cap leaders trade between annual lows and highs
                </p>
              </div>

              {loading && !data ? (
                <div className="h-[310px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              ) : (
                <div className="space-y-3.5">
                  {rangeLeaders.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => onSelectSymbol(item.symbol)}
                      className="w-full text-left group space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                            {item.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {item.symbol}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] tabular-nums shrink-0 text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-900 dark:text-slate-100">
                            {item.rangePct}%
                          </strong>
                          <span className="text-slate-400 dark:text-slate-500">
                            {' · '}
                            {item.distFromHighPct.toFixed(1)}% off high
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] tabular-nums text-slate-400 w-14 text-left shrink-0">
                          {formatIndexValue(item.fiftyTwoWeekLow!)}
                        </span>
                        <div className="relative flex-1 h-1.5 rounded-xs bg-slate-100 dark:bg-slate-800">
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded-xs bg-blue-700/25 dark:bg-blue-400/30"
                            style={{ width: `${item.rangePct}%` }}
                          />
                          <div
                            className="absolute -top-0.5 w-2 h-2.5 rounded-xs bg-blue-700 dark:bg-blue-400"
                            style={{ left: `calc(${Math.max(1, Math.min(97, item.rangePct))}% - 4px)` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-slate-400 w-14 text-right shrink-0">
                          {formatIndexValue(item.fiftyTwoWeekHigh!)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Section 4: Compact On-Demand Asset Directory (Collapsed by default) */}
          <section className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setDirectoryOpen((v) => !v)}
              aria-expanded={directoryOpen}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Full Instrument Directory
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Expand tabular quote lookup, sorting, and watchlist bookmarking across all {allDirectoryQuotes.length} tracked instruments
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">
                <span>{directoryOpen ? 'Hide table' : 'Browse table'}</span>
                {directoryOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {directoryOpen && (
              <div className="border-t border-slate-200 dark:border-slate-800">
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        ...DISPERSION_GROUPS,
                      ] as Array<{ id: 'all' | DispersionGroup; label: string }>
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDirectoryCategory(cat.id)}
                        className={`px-2.5 py-1 text-xs rounded-sm transition-colors cursor-pointer ${
                          directoryCategory === cat.id
                            ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter symbol or name..."
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-md bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-4 font-medium">
                          <button
                            type="button"
                            onClick={() => toggleSort('symbol')}
                            className="inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Instrument</span>
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          </button>
                        </th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('price')}
                            className="inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <span>Last</span>
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          </button>
                        </th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('changePercent')}
                            className="inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <span>1D Change</span>
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          </button>
                        </th>
                        <th className="py-2.5 px-4 font-medium text-right hidden md:table-cell">
                          <button
                            type="button"
                            onClick={() => toggleSort('volume')}
                            className="inline-flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <span>Volume</span>
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          </button>
                        </th>
                        <th className="py-2.5 px-4 font-medium text-right w-12">Watch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                      {filteredDirectory.map((q) => {
                        const pos = q.changePercent >= 0;
                        const saved = hasSymbol(q.symbol);
                        return (
                          <tr
                            key={`${q.category}-${q.symbol}`}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => onSelectSymbol(q.symbol)}
                                className="text-left group cursor-pointer"
                              >
                                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                                  {q.symbol}
                                </span>
                                <span className="ml-2 text-slate-500 dark:text-slate-400">
                                  {q.name}
                                </span>
                              </button>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                              {formatIndexValue(q.price)}
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right font-mono font-semibold tabular-nums ${
                                pos
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {formatSignedPercent(q.changePercent)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 hidden md:table-cell">
                              {q.volume ? formatCompactNumber(q.volume) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => onToggleWatchlist(q.symbol)}
                                aria-label={
                                  saved
                                    ? `Remove ${q.symbol} from watchlist`
                                    : `Add ${q.symbol} to watchlist`
                                }
                                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                              >
                                {saved ? (
                                  <BookmarkCheck className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                ) : (
                                  <Bookmark className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
