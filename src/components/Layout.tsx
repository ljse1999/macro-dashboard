import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Globe2,
  Menu,
  Moon,
  Newspaper,
  RefreshCw,
  Search,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import type { SearchQuoteResult } from '../lib/types';

export type NavSection = 'overview' | 'markets' | 'macro' | 'fx' | 'news' | 'calendar';

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onSelectSymbol: (symbol: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastSynced: string | null;
  watchlistCount: number;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  breadcrumb: string;
  icon: typeof Activity;
}> = [
  { id: 'overview', label: 'Market Pulse', breadcrumb: 'Overview', icon: Activity },
  { id: 'markets', label: 'Markets & Factors', breadcrumb: 'Markets & Factors', icon: TrendingUp },
  { id: 'macro', label: 'Macro & Yields', breadcrumb: 'Macro & Yields', icon: BarChart3 },
  { id: 'fx', label: 'FX & Commodities', breadcrumb: 'FX & Commodities', icon: Globe2 },
  { id: 'news', label: 'News & Wire', breadcrumb: 'News & Wire', icon: Newspaper },
  { id: 'calendar', label: 'Calendar & Desk', breadcrumb: 'Calendar & Desk', icon: CalendarDays },
];

export function Layout({
  activeSection,
  onNavigate,
  onSelectSymbol,
  theme,
  onToggleTheme,
  onRefresh,
  refreshing,
  lastSynced,
  watchlistCount,
  children,
}: LayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchQuoteResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((res) => {
          setSearchResults(Array.isArray(res.quotes) ? res.quotes : []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePickResult = (sym: string) => {
    onSelectSymbol(sym);
    setQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const renderSidebarNav = () => (
    <div className="flex flex-col h-full">
      {/* Brand Wordmark */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            onNavigate('overview');
            setMobileNavOpen(false);
          }}
          className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap cursor-pointer"
        >
          Meridian Macro
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary workspace navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileNavOpen(false);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'calendar' && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-slate-300 dark:text-blue-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {watchlistCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quiet Data Attribution Footer */}
      <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 space-y-1">
        <div className="font-medium text-slate-700 dark:text-slate-300">Open Data Sources</div>
        <p>Yahoo Finance · FRED · Bundesbank · ECB · MoF Japan · BoC · World Bank · FT / BoE / BoJ / BIS RSS</p>
        {lastSynced && (
          <p className="font-mono tabular-nums pt-1 text-slate-400 dark:text-slate-500">
            Synced {new Date(lastSynced).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F7F9] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1522] sticky top-0 h-screen">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-64 max-w-[82vw] h-full bg-white dark:bg-[#0F1522] border-r border-slate-200 dark:border-slate-800">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb — Global Ticker Search — Primary Actions */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white/95 dark:bg-[#0F1522]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          {/* Left: Mobile Trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500">Meridian</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {currentNav.breadcrumb}
              </span>
            </div>
          </div>

          {/* Center: Live Ticker Search */}
          <div ref={searchBoxRef} className="relative flex-1 max-w-md">
            <label htmlFor="global-ticker-search" className="sr-only">
              Search global ticker or asset
            </label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                id="global-ticker-search"
                type="search"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    if (searchResults.length > 0) {
                      handlePickResult(searchResults[0].symbol);
                    } else {
                      handlePickResult(query.trim().toUpperCase());
                    }
                  }
                }}
                placeholder="Search ticker (AAPL, NVDA, ^GSPC)..."
                className="w-full h-9 pl-8.5 pr-3 text-xs sm:text-sm rounded-md bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
              />
            </div>

            {searchOpen && query.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-md bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden z-40">
                {searching ? (
                  <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                    Searching global markets...
                  </div>
                ) : searchResults.length > 0 ? (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                    {searchResults.map((res) => (
                      <li key={res.symbol}>
                        <button
                          type="button"
                          onClick={() => handlePickResult(res.symbol)}
                          className="w-full px-3 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {res.symbol}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {res.shortname}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                            {res.exchange || res.quoteType}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePickResult(query.trim().toUpperCase())}
                    className="w-full px-3 py-2.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Inspect ticker <strong className="font-mono">{query.trim().toUpperCase()}</strong> directly
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Theme Toggle + Refresh Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light paper theme' : 'Switch to dark terminal theme'}
              className="p-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Syncing' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
