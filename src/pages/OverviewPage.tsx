import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Maximize2 } from 'lucide-react';
import type { ChartPayload, OverviewPayload } from '../lib/types';
import {
  formatIndexValue,
  formatRelativeTime,
  formatSignedPercent,
} from '../lib/analytics';
import { PriceChart, type ChartMode } from '../components/charts/PriceChart';
import { SectorTreemap } from '../components/charts/SectorTreemap';
import { Sparkline } from '../components/charts/Sparkline';
import type { NavSection } from '../components/Layout';

interface OverviewPageProps {
  data: OverviewPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectSymbol: (symbol: string) => void;
  onNavigate: (section: NavSection) => void;
}

const BENCHMARKS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'NASDAQ' },
  { symbol: '^DJI', label: 'Dow 30' },
  { symbol: 'GC=F', label: 'Gold' },
  { symbol: 'CL=F', label: 'WTI Crude' },
  { symbol: '^VIX', label: 'VIX' },
];

const RANGES = [
  { id: '1d', label: '1D' },
  { id: '5d', label: '5D' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '1y', label: '1Y' },
];

export function OverviewPage({
  data,
  loading,
  error,
  onRetry,
  onSelectSymbol,
  onNavigate,
}: OverviewPageProps) {
  const [chartSymbol, setChartSymbol] = useState('^GSPC');
  const [chartRange, setChartRange] = useState('3mo');
  const [chartMode, setChartMode] = useState<ChartMode>('area');
  const [showSma, setShowSma] = useState(true);
  const [chartData, setChartData] = useState<ChartPayload | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/chart?symbol=${encodeURIComponent(chartSymbol)}&range=${encodeURIComponent(chartRange)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Chart unavailable'))))
      .then((payload: ChartPayload) => {
        if (!cancelled) setChartData(payload);
      })
      .catch(() => {
        if (!cancelled) setChartData(null);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartSymbol, chartRange]);

  if (error && !data) {
    return (
      <div className="p-8 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1522] text-center space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 dark:bg-blue-600 text-white cursor-pointer"
        >
          Retry live feed
        </button>
      </div>
    );
  }

  const macro = data?.macroSummary;
  const spread = macro?.spread10y2y;
  const vix = data?.volatility.find((v) => v.symbol === '^VIX');
  const dxy = data?.volatility.find((v) => v.symbol === 'DX-Y.NYB');
  const fng = data?.fearGreed;

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Global Market Pulse
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live cross-asset benchmarks, US sector breadth, Treasury rates, and central bank dispatches.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {vix && (
            <button
              type="button"
              onClick={() => onSelectSymbol('^VIX')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              VIX <strong className="text-slate-900 dark:text-slate-100">{vix.price.toFixed(2)}</strong>{' '}
              <span className={vix.changePercent >= 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                {formatSignedPercent(vix.changePercent)}
              </span>
            </button>
          )}
          {vix && dxy && <span aria-hidden="true">·</span>}
          {dxy && (
            <button
              type="button"
              onClick={() => onSelectSymbol('DX-Y.NYB')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              DXY <strong className="text-slate-900 dark:text-slate-100">{dxy.price.toFixed(2)}</strong>{' '}
              <span className={dxy.changePercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                {formatSignedPercent(dxy.changePercent)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Global Equity Indices Strip */}
      <section aria-label="Global equity indices">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white dark:bg-[#0F1522] p-3.5 h-[96px] animate-pulse" />
              ))
            : (data?.indices || []).slice(0, 6).map((idx) => {
                const pos = idx.changePercent >= 0;
                const isCharted = chartSymbol === idx.symbol;
                return (
                  <button
                    key={idx.symbol}
                    type="button"
                    onClick={() => setChartSymbol(idx.symbol)}
                    className={`text-left bg-white dark:bg-[#0F1522] p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      isCharted ? 'ring-1 ring-inset ring-blue-700 dark:ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {idx.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                        {idx.region}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="font-mono tabular-nums">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {formatIndexValue(idx.price)}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            pos
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {formatSignedPercent(idx.changePercent)}
                        </div>
                      </div>
                      <Sparkline data={idx.sparkline} positive={pos} width={58} height={22} />
                    </div>
                  </button>
                );
              })}
        </div>
      </section>

      {/* Primary Stage: Benchmark Interactive Chart (8 cols) + Macro Snapshot (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Dominant Focal Anchor: Multi-Asset Interactive Chart */}
        <section className="xl:col-span-8 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Benchmark Tabs & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Chart benchmark selector">
                {BENCHMARKS.map((b) => {
                  const active = chartSymbol === b.symbol;
                  return (
                    <button
                      key={b.symbol}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setChartSymbol(b.symbol)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-slate-900 dark:bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {RANGES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setChartRange(r.id)}
                      className={`px-2 py-1 text-xs font-mono rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                        chartRange === r.id
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
                    onClick={() => setChartMode('area')}
                    className={`px-2 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      chartMode === 'area'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Area
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('candles')}
                    className={`px-2 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      chartMode === 'candles'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Candles
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSma((s) => !s)}
                  className={`hidden sm:inline-flex px-2 py-1 text-xs font-mono rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                    showSma
                      ? 'border-amber-600/50 text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  SMA
                </button>
              </div>
            </div>

            {/* Chart Title & Live Value */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {chartData?.name || chartSymbol}
                </h2>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {chartData?.symbol || chartSymbol}
                </span>
                {chartData && (
                  <>
                    <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatIndexValue(chartData.price)}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        chartData.changePercent >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatSignedPercent(chartData.changePercent)} ({chartRange.toUpperCase()})
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onSelectSymbol(chartSymbol)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Inspect asset</span>
              </button>
            </div>
          </div>

          {chartLoading && !chartData ? (
            <div className="h-[275px] rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : (
            <PriceChart
              candles={chartData?.candles || []}
              mode={chartMode}
              showSma={showSma}
              height={275}
              symbol={chartSymbol}
            />
          )}
        </section>

        {/* Right Column: Macro & Rates Snapshot */}
        <section className="xl:col-span-4 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Macro &amp; Sovereign Vital Signs
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  FRED &amp; Bundesbank Sovereign Benchmarks
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('macro')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>Yield curves</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <dl className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">US 10Y Nominal / Real</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.us10y != null ? `${macro.us10y.toFixed(2)}%` : '—'}
                  {macro?.us10yReal != null && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {' / '}
                      {macro.us10yReal.toFixed(2)}%
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">US 10Y–2Y Curve Spread</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {spread != null ? (
                    <span
                      className={
                        spread < 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      {spread >= 0 ? '+' : ''}
                      {spread} bps · {spread < 0 ? 'Inverted' : 'Normal'}
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">US–Germany 10Y Spread</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.usDe10ySpreadBps != null
                    ? `${macro.usDe10ySpreadBps >= 0 ? '+' : ''}${macro.usDe10ySpreadBps} bps`
                    : '—'}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Effective Fed Funds</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.fedFunds != null ? `${macro.fedFunds.toFixed(2)}%` : '—'}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">CPI / Core PCE (YoY)</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.cpiYoY != null ? `${macro.cpiYoY.toFixed(2)}%` : '—'}
                  {macro?.corePceYoY != null && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {' / '}
                      {macro.corePceYoY.toFixed(2)}%
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">US Unemployment (U-3)</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.unemployment != null ? `${macro.unemployment.toFixed(1)}%` : '—'}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">HY Credit OAS / NFCI</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {macro?.hySpread != null ? `${macro.hySpread.toFixed(2)}%` : '—'}
                  {macro?.nfci != null && (
                    <span
                      className={`font-normal ${
                        macro.nfci <= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {' · '}
                      {macro.nfci >= 0 ? '+' : ''}
                      {macro.nfci.toFixed(2)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Risk Sentiment Bar (Alternative.me Fear & Greed) */}
          {fng && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Risk Appetite Index
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {fng.value} / 100 · {fng.classification}
                </span>
              </div>
              <div className="relative h-2 rounded-xs bg-gradient-to-r from-red-700 via-amber-500 to-emerald-700">
                <div
                  className="absolute -top-0.5 w-1.5 h-3 bg-slate-950 dark:bg-white rounded-xs border border-white dark:border-slate-950"
                  style={{ left: `calc(${Math.max(2, Math.min(98, fng.value))}% - 3px)` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500">
                <span>Extreme Fear</span>
                <span>Neutral</span>
                <span>Extreme Greed</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Secondary Stage: US Sector Performance Treemap (7 cols) + Live Market Wire (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                US Equity Sector Performance Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live SPDR GICS Sector ETFs · Click any sector tile to inspect candles and news
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Factors &amp; markets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && !data ? (
            <div className="h-[270px] rounded bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : (
            <SectorTreemap sectors={data?.sectors || []} onSelectSymbol={onSelectSymbol} />
          )}
        </section>

        <section className="xl:col-span-5 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Live Market &amp; Policy Wire
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  FT, MarketWatch, NYT, CNBC, Fed, ECB, BoE, BoJ &amp; BIS
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('news')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>Full wire</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading && !data ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {(data?.headlines || []).slice(0, 6).map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] leading-snug font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {item.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100" />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{item.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{formatRelativeTime(item.publishedAt)}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
