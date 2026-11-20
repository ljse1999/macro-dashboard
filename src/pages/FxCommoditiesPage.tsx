import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { FxCommoditiesPayload } from '../lib/types';
import {
  computeCrossRate,
  formatIndexValue,
  formatSignedPercent,
} from '../lib/analytics';
import { RelativePerfChart } from '../components/charts/RelativePerfChart';
import { Sparkline } from '../components/charts/Sparkline';

interface FxCommoditiesPageProps {
  refreshKey: number;
  onSelectSymbol: (symbol: string) => void;
}

export function FxCommoditiesPage({ refreshKey, onSelectSymbol }: FxCommoditiesPageProps) {
  const [data, setData] = useState<FxCommoditiesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairFrom, setPairFrom] = useState('EUR');
  const [pairTo, setPairTo] = useState('USD');
  const [convertAmount, setConvertAmount] = useState('1000');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/fx')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load FX & commodities'))))
      .then((payload: FxCommoditiesPayload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load FX data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const pairSeries = useMemo(() => {
    if (!data?.history) return [];
    return data.history
      .map((pt) => {
        const rate = computeCrossRate(pairFrom, pairTo, pt.rates);
        return rate !== null ? { date: pt.date, value: rate } : null;
      })
      .filter((x): x is { date: string; value: number } => x !== null);
  }, [data, pairFrom, pairTo]);

  const currentPairRate = useMemo(() => {
    if (!data?.latestRates) return null;
    return computeCrossRate(pairFrom, pairTo, data.latestRates);
  }, [data, pairFrom, pairTo]);

  const pairReturn90d = useMemo(() => {
    if (pairSeries.length < 2) return 0;
    const first = pairSeries[0].value;
    const last = pairSeries[pairSeries.length - 1].value;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [pairSeries]);

  const parsedAmount = Number(convertAmount);
  const convertedValue =
    Number.isFinite(parsedAmount) && currentPairRate !== null ? parsedAmount * currentPairRate : null;

  const gold = data?.commodities.find((c) => c.symbol === 'GC=F');
  const silver = data?.commodities.find((c) => c.symbol === 'SI=F');
  const wti = data?.commodities.find((c) => c.symbol === 'CL=F');
  const brent = data?.commodities.find((c) => c.symbol === 'BZ=F');
  const goldSilverRatio = gold && silver && silver.price > 0 ? gold.price / silver.price : null;
  const brentWtiSpread = brent && wti ? brent.price - wti.price : null;

  // Render inline 90D FX chart
  const renderPairChart = () => {
    if (pairSeries.length < 2) {
      return (
        <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
          Select two distinct currencies to view 90-day exchange rate history.
        </div>
      );
    }

    const width = 580;
    const height = 210;
    const padTop = 16;
    const padRight = 14;
    const padBottom = 26;
    const padLeft = 52;
    const cw = width - padLeft - padRight;
    const ch = height - padTop - padBottom;

    const vals = pairSeries.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const margin = (max - min) * 0.1 || max * 0.005 || 0.01;
    const lo = min - margin;
    const hi = max + margin;
    const span = hi - lo || 1;

    const xFor = (i: number) => padLeft + (i / (pairSeries.length - 1)) * cw;
    const yFor = (v: number) => padTop + (1 - (v - lo) / span) * ch;

    const path = pairSeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
      .join(' ');
    const area = `${path} L${xFor(pairSeries.length - 1).toFixed(1)},${(padTop + ch).toFixed(1)} L${xFor(0).toFixed(1)},${(padTop + ch).toFixed(1)} Z`;

    const activeIdx = hoverIdx !== null ? hoverIdx : pairSeries.length - 1;
    const active = pairSeries[activeIdx];
    const decimals = active.value >= 20 ? 2 : 4;
    const stroke = pairReturn90d >= 0 ? '#15803D' : '#B91C1C';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span>
            {active.date} · <strong className="text-slate-900 dark:text-slate-100">{active.value.toFixed(decimals)}</strong>
          </span>
          <span>
            90D Range: {min.toFixed(decimals)} – {max.toFixed(decimals)}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`${pairFrom}/${pairTo} 90-day exchange rate chart`}
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const idx = Math.round(((relX - padLeft) / cw) * (pairSeries.length - 1));
            setHoverIdx(Math.max(0, Math.min(pairSeries.length - 1, idx)));
          }}
        >
          <defs>
            <linearGradient id="fx-pair-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((r, i) => {
            const y = padTop + r * ch;
            const val = hi - r * span;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  x2={padLeft + cw}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
                >
                  {val.toFixed(decimals)}
                </text>
              </g>
            );
          })}
          <path d={area} fill="url(#fx-pair-fill)" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round" />
          <line
            x1={xFor(activeIdx)}
            x2={xFor(activeIdx)}
            y1={padTop}
            y2={padTop + ch}
            className="stroke-slate-400/70 dark:stroke-slate-600"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx={xFor(activeIdx)}
            cy={yFor(active.value)}
            r="3.5"
            fill={stroke}
            className="stroke-white dark:stroke-slate-900"
            strokeWidth="1.5"
          />
          <text x={padLeft} y={height - 6} className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]">
            {pairSeries[0].date.slice(5)}
          </text>
          <text
            x={padLeft + cw}
            y={height - 6}
            textAnchor="end"
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
          >
            {pairSeries[pairSeries.length - 1].date.slice(5)}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Foreign Exchange &amp; Real Assets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ECB reference FX cross-rate matrix, 90-day currency trajectories, live converter, and energy &amp; metals complex.
          </p>
        </div>
        {data && (
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            ECB Reference Rates · {data.date}
          </div>
        )}
      </div>

      {error && !data ? (
        <div className="p-8 rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#0F1522] text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : (
        <>
          {/* Section 1: FX Cross-Rate Matrix + Interactive Pair Chart & Converter */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <section className="xl:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Major FX Cross-Rate Matrix
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any cell to inspect its 90-day trajectory and load it into the live converter (Row = Base, Column = Quote)
                </p>
              </div>

              {loading && !data ? (
                <div className="h-[280px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="p-2 text-left font-medium">Base / Quote</th>
                        {(data?.currencies || []).map((c) => (
                          <th key={c} className="p-2 text-right font-semibold text-slate-700 dark:text-slate-300">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {(data?.currencies || []).map((rowCur) => (
                        <tr key={rowCur}>
                          <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                            {rowCur}
                          </td>
                          {(data?.currencies || []).map((colCur) => {
                            const rate = data ? computeCrossRate(rowCur, colCur, data.latestRates) : null;
                            const isDiag = rowCur === colCur;
                            const isSelected = rowCur === pairFrom && colCur === pairTo;
                            const decimals = rate !== null && rate >= 20 ? 2 : 4;
                            return (
                              <td key={`${rowCur}-${colCur}`} className="p-1 text-right">
                                {isDiag ? (
                                  <span className="block px-1.5 py-1.5 text-slate-300 dark:text-slate-700">
                                    1.000
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPairFrom(rowCur);
                                      setPairTo(colCur);
                                      setHoverIdx(null);
                                    }}
                                    aria-label={`Select ${rowCur}/${colCur} rate`}
                                    className={`w-full px-1.5 py-1.5 rounded-xs text-right transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-700 text-white font-semibold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {rate !== null ? rate.toFixed(decimals) : '—'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right: Selected Pair 90D History + Converter */}
            <section className="xl:col-span-5 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Spot Reference Pair
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
                      {pairFrom} / {pairTo}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPairFrom(pairTo);
                      setPairTo(pairFrom);
                    }}
                    aria-label="Invert currency pair"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Invert</span>
                  </button>
                </div>

                {currentPairRate !== null && (
                  <div className="flex items-baseline gap-3 font-mono tabular-nums">
                    <span className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {currentPairRate.toFixed(currentPairRate >= 20 ? 2 : 4)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        pairReturn90d >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatSignedPercent(pairReturn90d)} (90D)
                    </span>
                  </div>
                )}

                {renderPairChart()}
              </div>

              {/* Currency Converter */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <label
                  htmlFor="fx-convert-amount"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Quick Currency Converter
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="fx-convert-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-32 h-9 px-3 text-sm font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                  <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {pairFrom} =
                  </span>
                  <div className="flex-1 h-9 px-3 rounded-md bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-sm tabular-nums">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {convertedValue !== null
                        ? convertedValue.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">{pairTo}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Section 2: Commodities Relative Performance & Table */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <section className="xl:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Commodities 3-Month Relative Performance (Indexed = 100)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hover legend items to isolate a contract; click to open full futures candlestick inspector
                </p>
              </div>
              <RelativePerfChart
                series={data?.relativeCommodities || []}
                onSelectSymbol={onSelectSymbol}
              />
            </section>

            <section className="xl:col-span-5 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Metals &amp; Energy Futures Board
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2 text-left font-medium">Contract</th>
                        <th className="py-2 text-right font-medium">Last</th>
                        <th className="py-2 text-right font-medium">1D</th>
                        <th className="py-2 text-right font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {(data?.commodities || []).map((c) => {
                        const pos = c.changePercent >= 0;
                        return (
                          <tr key={c.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <td className="py-2.5">
                              <button
                                type="button"
                                onClick={() => onSelectSymbol(c.symbol)}
                                className="text-left group cursor-pointer"
                              >
                                <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                                  {c.name}
                                </div>
                                <div className="font-mono text-[11px] text-slate-400">{c.symbol}</div>
                              </button>
                            </td>
                            <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                              ${formatIndexValue(c.price)}
                            </td>
                            <td
                              className={`py-2.5 text-right font-mono font-semibold tabular-nums ${
                                pos
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {formatSignedPercent(c.changePercent)}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex justify-end">
                                <Sparkline data={c.sparkline} positive={pos} width={56} height={20} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Structural Spreads */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono tabular-nums">
                <div>
                  <div className="text-slate-500 dark:text-slate-400 font-sans">Gold / Silver Ratio</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {goldSilverRatio !== null ? `${goldSilverRatio.toFixed(1)}x` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 font-sans">Brent – WTI Spread</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {brentWtiSpread !== null
                      ? `${brentWtiSpread >= 0 ? '+' : ''}$${brentWtiSpread.toFixed(2)}`
                      : '—'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
