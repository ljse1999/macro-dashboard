import { useEffect, useMemo, useState } from 'react';
import type { MacroPayload, MacroPillar, MacroSeries } from '../lib/types';
import { YieldCurveChart } from '../components/charts/YieldCurveChart';
import { SovereignYieldCurvesChart } from '../components/charts/SovereignYieldCurvesChart';
import { MacroSeriesChart } from '../components/charts/MacroSeriesChart';

interface MacroPageProps {
  refreshKey: number;
}

const PILLARS: Array<{ id: MacroPillar; label: string; subtitle: string }> = [
  { id: 'inflation', label: 'Inflation & Prices', subtitle: 'CPI, Core PCE, breakevens & forward expectations' },
  { id: 'growth', label: 'Growth & Consumer', subtitle: 'Real GDP, industrial output, sentiment & housing credit' },
  { id: 'labor', label: 'Labor Market', subtitle: 'Headline unemployment & weekly jobless claims' },
  { id: 'liquidity', label: 'Liquidity & Conditions', subtitle: 'Policy rates, TIPS real yields, Fed balance sheet, M2, NFCI & credit OAS' },
];

function formatSeriesValue(val: number, unit: string): string {
  if (unit === '$T') return `$${val.toFixed(2)}T`;
  if (unit === 'K') return `${val.toFixed(0)}K`;
  if (unit === 'idx' || unit === '') return val.toFixed(2);
  return `${val.toFixed(2)}${unit}`;
}

function formatSeriesDelta(change: number, unit: string): string {
  const sign = change >= 0 ? '+' : '';
  if (unit === '$T') return `${sign}$${change.toFixed(2)}T`;
  if (unit === 'K') return `${sign}${change.toFixed(0)}K`;
  if (unit === '%') return `${sign}${change.toFixed(2)}pp`;
  return `${sign}${change.toFixed(2)}`;
}

export function MacroPage({ refreshKey }: MacroPageProps) {
  const [data, setData] = useState<MacroPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [curveMode, setCurveMode] = useState<'global' | 'us_history'>('global');
  const [activePillar, setActivePillar] = useState<MacroPillar>('inflation');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('CPI_YOY');
  const [econSort, setEconSort] = useState<'gdpGrowth' | 'inflation' | 'unemployment'>('gdpGrowth');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/macro')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load macro data'))))
      .then((payload: MacroPayload) => {
        if (!cancelled) {
          setData(payload);
          if (payload.series.length > 0 && !payload.series.some((s) => s.id === selectedSeriesId)) {
            setSelectedSeriesId(payload.series[0].id);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load macro desk');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const seriesByPillar = useMemo(() => {
    const grouped: Record<MacroPillar, MacroSeries[]> = {
      inflation: [],
      growth: [],
      labor: [],
      liquidity: [],
    };
    for (const s of data?.series || []) {
      if (grouped[s.pillar]) grouped[s.pillar].push(s);
    }
    return grouped;
  }, [data]);

  const pillarSeries = seriesByPillar[activePillar] || [];

  const handleSelectPillar = (pillar: MacroPillar) => {
    setActivePillar(pillar);
    const list = seriesByPillar[pillar];
    if (list && list.length > 0) {
      setSelectedSeriesId(list[0].id);
    }
  };

  const activeSeries =
    pillarSeries.find((s) => s.id === selectedSeriesId) ||
    pillarSeries[0] ||
    data?.series[0] ||
    null;

  const sortedEconomies = useMemo(() => {
    return [...(data?.worldEconomies || [])].sort((a, b) => {
      const av = a[econSort] ?? -999;
      const bv = b[econSort] ?? -999;
      return bv - av;
    });
  }, [data, econSort]);

  const rm = data?.regimeMetrics;
  const activePillarMeta = PILLARS.find((p) => p.id === activePillar) || PILLARS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Macroeconomics &amp; Global Sovereign Yields
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live G7 sovereign yield curves (US, Germany, Euro AAA, Canada, Japan), 19 FRED macro indicators across 4 pillars, and World Bank G9 comparisons.
          </p>
        </div>
        {data && (
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            US Curve as of {data.curveDate} · {data.sovereignCurves?.length || 0} live curves
          </div>
        )}
      </div>

      {error && !data ? (
        <div className="p-8 rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#0F1522] text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : (
        <>
          {/* Section 0: Macro Regime Synthesis Strip */}
          <section aria-label="Macroeconomic regime synthesis">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
              {loading && !data ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-[#0F1522] p-4 h-[92px] animate-pulse" />
                ))
              ) : (
                <>
                  {/* 1. Real Policy Rate */}
                  <div className="bg-white dark:bg-[#0F1522] p-4 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Real Policy Rate (FF − Core PCE)
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rm?.realPolicyRate != null
                          ? `${rm.realPolicyRate >= 0 ? '+' : ''}${rm.realPolicyRate.toFixed(2)}%`
                          : '—'}
                      </span>
                      {rm?.realPolicyRate != null && (
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            rm.realPolicyRate >= 1
                              ? 'text-amber-700 dark:text-amber-400'
                              : rm.realPolicyRate >= 0
                                ? 'text-slate-600 dark:text-slate-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {rm.realPolicyRate >= 1
                            ? 'Restrictive'
                            : rm.realPolicyRate >= 0
                              ? 'Neutral'
                              : 'Accommodative'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Monetary stance vs. core inflation
                    </div>
                  </div>

                  {/* 2. US 10Y Real Yield (TIPS) */}
                  <div className="bg-white dark:bg-[#0F1522] p-4 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      US 10Y Real Yield (TIPS)
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rm?.us10yRealYield != null ? `${rm.us10yRealYield.toFixed(2)}%` : '—'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        FRED DFII10
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Inflation-adjusted risk-free hurdle rate
                    </div>
                  </div>

                  {/* 3. Chicago Fed Financial Conditions (NFCI) */}
                  <div className="bg-white dark:bg-[#0F1522] p-4 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Financial Conditions (NFCI)
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rm?.nfci != null
                          ? `${rm.nfci >= 0 ? '+' : ''}${rm.nfci.toFixed(2)}`
                          : '—'}
                      </span>
                      {rm?.nfci != null && (
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            rm.nfci <= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {rm.nfci <= 0 ? 'Looser than avg' : 'Tighter than avg'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Chicago Fed weekly composite (0 = avg)
                    </div>
                  </div>

                  {/* 4. Credit Quality Spread & Fed Balance Sheet */}
                  <div className="bg-white dark:bg-[#0F1522] p-4 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      HY–IG Credit Spread / Fed Assets
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rm?.hyIgQualitySpreadBps != null ? `${rm.hyIgQualitySpreadBps} bps` : '—'}
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {rm?.fedBalanceSheetTrillions != null
                          ? `$${rm.fedBalanceSheetTrillions.toFixed(2)}T`
                          : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Credit risk premium &amp; central bank balance sheet
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Section 1: Multi-Sovereign Yield Curve Studio + Global 10Y Benchmarks */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <section className="xl:col-span-8 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {curveMode === 'global'
                      ? 'Global Sovereign Bond Yield Curves'
                      : 'US Treasury Historical Curve Shift'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {curveMode === 'global'
                      ? 'Live official term structures: US Treasuries, German Bunds, Euro Area AAA, Canada GoC & Japan JGBs'
                      : 'Constant maturity US yields (1M–30Y) overlaid against 1-month and 1-year trailing curves'}
                  </p>
                </div>

                <div
                  className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  role="tablist"
                  aria-label="Yield curve view mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={curveMode === 'global'}
                    onClick={() => setCurveMode('global')}
                    className={`px-2.5 py-1 rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      curveMode === 'global'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Global Sovereign Overlay
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={curveMode === 'us_history'}
                    onClick={() => setCurveMode('us_history')}
                    className={`px-2.5 py-1 rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      curveMode === 'us_history'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    US Historical Shift
                  </button>
                </div>
              </div>

              {loading && !data ? (
                <div className="h-[290px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              ) : curveMode === 'global' ? (
                <SovereignYieldCurvesChart curves={data?.sovereignCurves || []} />
              ) : (
                <YieldCurveChart points={data?.yieldCurve || []} />
              )}
            </section>

            {/* Right Panel: Global 10Y Benchmarks & Spreads OR US Tenor Breakdown */}
            <section className="xl:col-span-4 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 flex flex-col justify-between gap-4">
              {curveMode === 'global' ? (
                <div>
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Global 10Y Sovereign Benchmarks
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Spreads vs. US 10Y Treasury &amp; domestic 2s10s slope
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-2 text-left font-medium font-sans">Sovereign</th>
                          <th className="py-2 text-right font-medium">10Y</th>
                          <th className="py-2 text-right font-medium">vs US</th>
                          <th className="py-2 text-right font-medium">2s10s</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {(data?.globalBenchmarks || []).map((b) => (
                          <tr key={b.code}>
                            <td className="py-2 font-sans">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {b.country}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {b.currency} · {b.source}
                              </div>
                            </td>
                            <td className="py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                              {b.yield10y.toFixed(2)}%
                            </td>
                            <td
                              className={`py-2 text-right ${
                                b.spreadVsUsBps === null || b.spreadVsUsBps === 0
                                  ? 'text-slate-400'
                                  : b.spreadVsUsBps > 0
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              {b.spreadVsUsBps === null
                                ? '—'
                                : b.spreadVsUsBps === 0
                                  ? 'Base'
                                  : `${b.spreadVsUsBps > 0 ? '+' : ''}${b.spreadVsUsBps}bp`}
                            </td>
                            <td
                              className={`py-2 text-right ${
                                b.slope2s10sBps === null
                                  ? 'text-slate-400'
                                  : b.slope2s10sBps < 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {b.slope2s10sBps === null
                                ? '—'
                                : `${b.slope2s10sBps >= 0 ? '+' : ''}${b.slope2s10sBps}bp`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      US Tenor Breakdown
                    </h2>
                    {data && data.spread10y2y !== null && (
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          data.spread10y2y < 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        2s10s: {data.spread10y2y >= 0 ? '+' : ''}
                        {data.spread10y2y}bp
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-2 text-left font-medium">Tenor</th>
                          <th className="py-2 text-right font-medium">Yield</th>
                          <th className="py-2 text-right font-medium">1M Δ</th>
                          <th className="py-2 text-right font-medium">1Y Δ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {(data?.yieldCurve || []).map((p) => {
                          const d1m = Math.round((p.current - (p.oneMonthAgo ?? p.current)) * 100);
                          const d1y = Math.round((p.current - (p.oneYearAgo ?? p.current)) * 100);
                          return (
                            <tr key={p.maturity}>
                              <td className="py-2 font-semibold text-slate-800 dark:text-slate-200">
                                {p.maturity}
                              </td>
                              <td className="py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                                {p.current.toFixed(2)}%
                              </td>
                              <td
                                className={`py-2 text-right ${
                                  d1m > 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : d1m < 0
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-500'
                                }`}
                              >
                                {d1m > 0 ? '+' : ''}
                                {d1m}bp
                              </td>
                              <td
                                className={`py-2 text-right ${
                                  d1y > 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : d1y < 0
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-500'
                                }`}
                              >
                                {d1y > 0 ? '+' : ''}
                                {d1y}bp
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
          </div>

          {/* Section 2: 4-Pillar FRED Macroeconomic Indicators Explorer (19 live series) */}
          <section className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Macroeconomic Indicators Explorer (FRED · {data?.series.length || 0} Live Series)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activePillarMeta.subtitle}
                </p>
              </div>

              {/* Pillar Selector */}
              <div
                className="flex flex-wrap items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                role="tablist"
                aria-label="Macroeconomic pillar selector"
              >
                {PILLARS.map((p) => {
                  const active = activePillar === p.id;
                  const count = seriesByPillar[p.id]?.length || 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleSelectPillar(p.id)}
                      className={`px-2.5 py-1 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {p.label}{' '}
                      <span className="font-mono text-[10px] opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Indicators within Selected Pillar */}
            {pillarSeries.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-2"
                role="tablist"
                aria-label="Series selector within pillar"
              >
                {pillarSeries.map((s) => {
                  const active = activeSeries?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedSeriesId(s.id)}
                      className={`inline-flex items-baseline gap-2 px-3 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white font-medium'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span>{s.shortName}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          active ? 'text-slate-200 dark:text-blue-100' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatSeriesValue(s.latest, s.unit)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeSeries ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
                <div className="lg:col-span-4 space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {activeSeries.frequency} · {activeSeries.source}
                    </div>
                    <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50 mt-1">
                      {activeSeries.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatSeriesValue(activeSeries.latest, activeSeries.unit)}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      Prior: {formatSeriesValue(activeSeries.previous, activeSeries.unit)} (
                      {formatSeriesDelta(activeSeries.change, activeSeries.unit)})
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeSeries.description}
                  </p>
                </div>

                <div className="lg:col-span-8">
                  <MacroSeriesChart series={activeSeries} />
                </div>
              </div>
            ) : (
              <div className="h-[240px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
            )}
          </section>

          {/* Section 3: Global Major Economies (World Bank API) */}
          <section className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Global Major Economies Comparison
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Annualized indicators from World Bank Open Data (most recent reported year per economy)
                </p>
              </div>
              <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                {(
                  [
                    { id: 'gdpGrowth', label: 'Sort: GDP Growth' },
                    { id: 'inflation', label: 'Inflation' },
                    { id: 'unemployment', label: 'Unemployment' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEconSort(opt.id)}
                    className={`px-2.5 py-1 rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      econSort === opt.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 text-left font-medium">Economy</th>
                    <th className="py-2.5 px-3 text-left font-medium">Region</th>
                    <th className="py-2.5 px-3 text-right font-medium">Real GDP Growth</th>
                    <th className="py-2.5 px-3 text-right font-medium">CPI Inflation</th>
                    <th className="py-2.5 px-3 text-right font-medium">Unemployment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {sortedEconomies.map((row) => {
                    const gdpBarW = row.gdpGrowth !== null ? Math.min(100, Math.abs(row.gdpGrowth) * 11) : 0;
                    return (
                      <tr key={row.code} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          <span>{row.name}</span>
                          <span className="ml-2 font-mono text-[11px] text-slate-400">{row.code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400">
                          {row.region}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                          {row.gdpGrowth !== null ? (
                            <div className="inline-flex items-center justify-end gap-2.5">
                              <div className="hidden sm:block w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-xs overflow-hidden">
                                <div
                                  className={`h-full ${row.gdpGrowth >= 0 ? 'bg-blue-700 dark:bg-blue-400' : 'bg-red-700'}`}
                                  style={{ width: `${gdpBarW}%` }}
                                />
                              </div>
                              <span
                                className={`font-semibold ${
                                  row.gdpGrowth >= 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {row.gdpGrowth >= 0 ? '+' : ''}
                                {row.gdpGrowth.toFixed(2)}%
                              </span>
                              <span className="text-[10px] text-slate-400">({row.gdpYear})</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                          {row.inflation !== null ? (
                            <>
                              <span className="font-semibold">{row.inflation.toFixed(2)}%</span>
                              <span className="ml-1 text-[10px] text-slate-400">({row.inflationYear})</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                          {row.unemployment !== null ? (
                            <>
                              <span className="font-semibold">{row.unemployment.toFixed(1)}%</span>
                              <span className="ml-1 text-[10px] text-slate-400">({row.unemploymentYear})</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
