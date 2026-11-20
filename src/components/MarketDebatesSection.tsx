import { useState } from 'react';
import { ArrowRight, ExternalLink, Filter } from 'lucide-react';
import type { MarketDebate, MarketDebatesPayload } from '../lib/types';
import { formatRelativeTime } from '../lib/analytics';
import { DebateAnalysisChart } from './charts/DebateAnalysisChart';

interface MarketDebatesSectionProps {
  data: MarketDebatesPayload | null;
  loading: boolean;
  activeDebateFilterId: string | null;
  onFilterWireByDebate: (debate: MarketDebate | null) => void;
  onSelectArticle: (articleId: string) => void;
}

const DEBATE_COLORS = ['#1D4ED8', '#0F766E', '#D97706', '#B91C1C', '#6D28D9'];

export function MarketDebatesSection({
  data,
  loading,
  activeDebateFilterId,
  onFilterWireByDebate,
  onSelectArticle,
}: MarketDebatesSectionProps) {
  const [selectedId, setSelectedId] = useState<string>('inflation-rates');

  const debates = data?.debates || [];
  const activeDebate = debates.find((d) => d.id === selectedId) || debates[0] || null;

  const totalMatches = debates.reduce((sum, d) => sum + d.matchedCount, 0) || 1;
  const isFilteredToActive = activeDebate !== null && activeDebateFilterId === activeDebate.id;

  return (
    <section
      aria-label="Ongoing market debates and data briefing"
      className="bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden"
    >
      {/* Editorial Briefing Header + Wire Narrative Share Bar */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50">
              Ongoing Market Debates &amp; Data Briefings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Key macro and market tensions synthesized from today&apos;s live wire dispatches and real-time economic series
            </p>
          </div>
          {data && (
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {debates.length} core debates · {data.totalWireArticles} live dispatches scanned
            </div>
          )}
        </div>

        {/* Proportional Narrative Attention Bar */}
        {!loading && debates.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Live Wire Narrative Share</span>
              <span className="font-mono tabular-nums">
                Click any theme to inspect data &amp; dispatches
              </span>
            </div>
            <div className="flex h-2 w-full rounded-xs overflow-hidden bg-slate-100 dark:bg-slate-800 gap-px">
              {debates.map((d, idx) => {
                const share = Math.max(6, (d.matchedCount / totalMatches) * 100);
                const selected = activeDebate?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    title={`${d.shortTitle}: ${d.matchedCount} matched dispatches`}
                    aria-label={`Select ${d.shortTitle} debate (${d.matchedCount} dispatches)`}
                    className="h-full transition-opacity cursor-pointer"
                    style={{
                      width: `${share}%`,
                      backgroundColor: DEBATE_COLORS[idx % DEBATE_COLORS.length],
                      opacity: selected ? 1 : 0.42,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 5-Debate Tab Selector Strip */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2"
          role="tablist"
          aria-label="Market debates selector"
        >
          {loading && debates.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-md bg-slate-100 dark:bg-slate-900 animate-pulse"
                />
              ))
            : debates.map((d, idx) => {
                const selected = activeDebate?.id === d.id;
                const accent = DEBATE_COLORS[idx % DEBATE_COLORS.length];
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setSelectedId(d.id)}
                    className={`text-left px-3 py-2.5 rounded-md border transition-colors cursor-pointer space-y-1 ${
                      selected
                        ? 'border-slate-900 dark:border-blue-500 bg-slate-50 dark:bg-slate-900/90'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: accent }}
                        />
                        <span
                          className={`text-xs truncate ${
                            selected
                              ? 'font-semibold text-slate-900 dark:text-slate-50'
                              : 'font-medium text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {d.shortTitle}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                        {d.matchedCount}
                      </span>
                    </div>
                    <div
                      className={`font-mono text-[10.5px] truncate ${
                        d.regimeTone === 'positive'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : d.regimeTone === 'negative'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {d.regimeTag}
                    </div>
                  </button>
                );
              })}
        </div>
      </div>

      {/* Active Debate 12-Column Editorial & Data Canvas */}
      {loading && !activeDebate ? (
        <div className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-6 h-[340px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
          <div className="xl:col-span-6 h-[340px] bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
        </div>
      ) : activeDebate ? (
        <div className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column (6 cols): Editorial Thesis, Two-Sided Framing & Matched Recent News */}
          <div className="xl:col-span-6 space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeDebate.title}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    activeDebate.regimeTone === 'positive'
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : activeDebate.regimeTone === 'negative'
                        ? 'text-red-700 dark:text-red-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 font-semibold'
                  }
                >
                  {activeDebate.regimeTag}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold leading-snug text-slate-900 dark:text-slate-50">
                {activeDebate.question}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {activeDebate.summary}
              </p>
            </div>

            {/* Two-Sided Debate Framing (Hairline 2-column split, zero nested card boxes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {activeDebate.constructiveCase.label}
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {activeDebate.constructiveCase.argument}
                </p>
              </div>
              <div className="space-y-1 sm:border-l sm:border-slate-100 sm:dark:border-slate-800/80 sm:pl-4">
                <div className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {activeDebate.cautiousCase.label}
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {activeDebate.cautiousCase.argument}
                </p>
              </div>
            </div>

            {/* Linked Recent Wire Dispatches */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Recent Dispatches Relating to This Debate
                </h4>
                {activeDebate.matchedCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onFilterWireByDebate(isFilteredToActive ? null : activeDebate)
                    }
                    className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                      isFilteredToActive
                        ? 'text-slate-900 dark:text-slate-100 underline'
                        : 'text-blue-700 dark:text-blue-400 hover:underline'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>
                      {isFilteredToActive
                        ? 'Clear wire filter'
                        : `Filter wire (${activeDebate.matchedCount})`}
                    </span>
                    {!isFilteredToActive && <ArrowRight className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {activeDebate.newsPoints.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {activeDebate.newsPoints.map((item) => (
                    <li
                      key={item.id}
                      className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectArticle(item.id)}
                        className="text-left group flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="text-[13px] leading-snug font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.source}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatRelativeTime(item.publishedAt)}
                          </span>
                        </div>
                      </button>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.source} article in new tab`}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 mt-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No recent wire dispatches matched this debate in the current cycle.
                </p>
              )}
            </div>
          </div>

          {/* Right Column (6 cols): Live Quantitative KPIs + Interactive Chart */}
          <div className="xl:col-span-6 xl:border-l xl:border-slate-100 xl:dark:border-slate-800/80 xl:pl-6 space-y-4">
            {/* 4-Cell Live KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
              {activeDebate.kpis.map((kpi) => (
                <div key={kpi.label} className="bg-white dark:bg-[#0F1522] px-3 py-2.5 space-y-0.5">
                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                    {kpi.label}
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      kpi.tone === 'positive'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : kpi.tone === 'negative'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive SVG Data Visualization */}
            <DebateAnalysisChart chart={activeDebate.chart} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
