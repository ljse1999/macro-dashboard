import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import type { MarketDebate, MarketDebatesPayload, NewsItem } from '../lib/types';
import { formatRelativeTime } from '../lib/analytics';
import { MarketDebatesSection } from '../components/MarketDebatesSection';

interface NewsPageProps {
  refreshKey: number;
}

const NEWS_CATEGORIES = [
  { id: 'all', label: 'All Dispatches' },
  { id: 'markets', label: 'Markets' },
  { id: 'economy', label: 'Economy' },
  { id: 'central_banks', label: 'Central Banks' },
  { id: 'equities', label: 'Finance & Equities' },
];

export function NewsPage({ refreshKey }: NewsPageProps) {
  const [category, setCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [activeDebateFilter, setActiveDebateFilter] = useState<MarketDebate | null>(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [debatesData, setDebatesData] = useState<MarketDebatesPayload | null>(null);
  const [debatesLoading, setDebatesLoading] = useState(true);

  const wireSectionRef = useRef<HTMLDivElement>(null);

  // Load live Ongoing Market Debates & Data Briefings
  useEffect(() => {
    let cancelled = false;
    setDebatesLoading(true);
    fetch('/api/news/debates')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Debates unavailable'))))
      .then((payload: MarketDebatesPayload) => {
        if (!cancelled) setDebatesData(payload);
      })
      .catch(() => {
        if (!cancelled) setDebatesData(null);
      })
      .finally(() => {
        if (!cancelled) setDebatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Load live News & Central Bank Wire
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedSource('all');
    setVisibleCount(20);

    fetch(`/api/news?category=${encodeURIComponent(category)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load news wire'))))
      .then((res) => {
        if (!cancelled) {
          const list = Array.isArray(res.items) ? (res.items as NewsItem[]) : [];
          setItems(list);
          if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to fetch news');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, refreshKey]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.source, (counts.get(item.source) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const debateIdSet = useMemo(() => {
    if (!activeDebateFilter) return null;
    return new Set(activeDebateFilter.matchedIds);
  }, [activeDebateFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (debateIdSet && !debateIdSet.has(n.id)) return false;
      if (selectedSource !== 'all' && n.source !== selectedSource) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      );
    });
  }, [items, debateIdSet, selectedSource, search]);

  const selectedArticle =
    filtered.find((n) => n.id === selectedId) ||
    items.find((n) => n.id === selectedId) ||
    filtered[0] ||
    null;

  const handleSelectDebateArticle = (articleId: string) => {
    setSelectedId(articleId);
    // Ensure article is reachable even if a category filter was active
    if (!filtered.some((n) => n.id === articleId)) {
      setCategory('all');
      setSelectedSource('all');
      setActiveDebateFilter(null);
      setSearch('');
    }
    wireSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFilterWireByDebate = (debate: MarketDebate | null) => {
    setActiveDebateFilter(debate);
    setVisibleCount(20);
    if (debate) {
      setCategory('all');
      setSelectedSource('all');
      wireSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Global Financial News &amp; Central Bank Wire
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live RSS dispatches across Financial Times, MarketWatch, NYT Economy, BBC, The Guardian, CNBC, Federal Reserve, ECB, Bank of England, Bank of Japan, and BIS.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {filtered.length} dispatches · {sourceCounts.length} active sources
        </div>
      </div>

      {/* Top Briefing Section: Ongoing Market Debates + Data Analysis & Visualization */}
      <MarketDebatesSection
        data={debatesData}
        loading={debatesLoading}
        activeDebateFilterId={activeDebateFilter?.id || null}
        onFilterWireByDebate={handleFilterWireByDebate}
        onSelectArticle={handleSelectDebateArticle}
      />

      {/* Chronological Wire Section */}
      <div ref={wireSectionRef} className="space-y-4 scroll-mt-18">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Live Chronological Wire
            </h2>
            {activeDebateFilter && (
              <button
                type="button"
                onClick={() => setActiveDebateFilter(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-700/30 dark:border-blue-400/30 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 cursor-pointer"
              >
                <span>Debate: {activeDebateFilter.shortTitle}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
          </div>
        </div>

        {/* Category & Search Controls */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800"
              role="tablist"
              aria-label="News category filter"
            >
              {NEWS_CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setCategory(c.id);
                      setActiveDebateFilter(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <label htmlFor="news-search" className="sr-only">
                Filter news wire by keyword
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="news-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter headlines or source..."
                className="w-full h-9 pl-8.5 pr-3 text-xs rounded-md bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Source Filter Strip */}
          {sourceCounts.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Filter wire by publisher"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedSource === 'all'}
                onClick={() => {
                  setSelectedSource('all');
                  setVisibleCount(20);
                }}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSource === 'all'
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white font-medium'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1522] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                All Sources{' '}
                <span className="font-mono tabular-nums opacity-75">{items.length}</span>
              </button>
              {sourceCounts.map(([src, count]) => {
                const active = selectedSource === src;
                return (
                  <button
                    key={src}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedSource(src);
                      setVisibleCount(20);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white font-medium'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1522] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {src}{' '}
                    <span className="font-mono tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error ? (
          <div className="p-8 rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#0F1522] text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Chronological Wire List */}
            <div className="lg:col-span-7 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
              {loading && items.length === 0 ? (
                <div className="p-5 space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 bg-slate-100 dark:bg-slate-900 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No dispatches match your current filter.
                </div>
              ) : (
                <>
                  {filtered.slice(0, visibleCount).map((item) => {
                    const isSelected = selectedArticle?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left px-5 py-4 transition-colors cursor-pointer block ${
                          isSelected
                            ? 'bg-slate-50 dark:bg-slate-900/80'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.source}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{item.category.replace('_', ' ')}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatRelativeTime(item.publishedAt)}
                          </span>
                        </div>
                        <h3
                          className={`text-sm leading-snug font-medium ${
                            isSelected
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {item.title}
                        </h3>
                      </button>
                    );
                  })}
                  {visibleCount < filtered.length && (
                    <div className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + 25)}
                        className="px-4 py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                      >
                        Load more dispatches ({filtered.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Editorial Reader Briefing Pane */}
            <aside className="lg:col-span-5 lg:sticky lg:top-20 bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-6 space-y-5">
              {selectedArticle ? (
                <>
                  <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedArticle.source}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(selectedArticle.publishedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-semibold leading-snug text-slate-900 dark:text-slate-50">
                      {selectedArticle.title}
                    </h3>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {selectedArticle.summary}
                  </p>

                  <div className="pt-2">
                    <a
                      href={selectedArticle.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      <span>Read full release at {selectedArticle.source}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-slate-500">
                  Select a dispatch from the wire to read its summary and source link.
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
