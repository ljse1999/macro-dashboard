import { useCallback, useEffect, useState } from 'react';
import { Layout, type NavSection } from './components/Layout';
import { AssetDrawer } from './components/AssetDrawer';
import { OverviewPage } from './pages/OverviewPage';
import { MarketsPage } from './pages/MarketsPage';
import { MacroPage } from './pages/MacroPage';
import { FxCommoditiesPage } from './pages/FxCommoditiesPage';
import { NewsPage } from './pages/NewsPage';
import { CalendarDeskPage } from './pages/CalendarDeskPage';
import { useWatchlist } from './hooks/useWatchlist';
import type { OverviewPayload } from './lib/types';

function readInitialSection(): NavSection {
  const hash = window.location.hash.replace('#', '') as NavSection;
  const valid: NavSection[] = ['overview', 'markets', 'macro', 'fx', 'news', 'calendar'];
  return valid.includes(hash) ? hash : 'overview';
}

function readInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('meridian_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

export default function App() {
  const [section, setSection] = useState<NavSection>(readInitialSection);
  const [theme, setTheme] = useState<'light' | 'dark'>(readInitialTheme);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [overviewData, setOverviewData] = useState<OverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const { symbols: watchlist, addSymbol, removeSymbol, toggleSymbol, hasSymbol } = useWatchlist();

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('meridian_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Sync hash navigation
  const handleNavigate = useCallback((next: NavSection) => {
    setSection(next);
    window.history.replaceState(null, '', next === 'overview' ? '#overview' : `#${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHashChange = () => setSection(readInitialSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadOverview = useCallback((force = false) => {
    setOverviewLoading(true);
    setOverviewError(null);
    return fetch(`/api/overview${force ? '?force=1' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load live market overview'))))
      .then((payload: OverviewPayload) => {
        setOverviewData(payload);
        setLastSynced(payload.updatedAt);
      })
      .catch((err) => {
        setOverviewError(err instanceof Error ? err.message : 'Unable to reach market data API');
      })
      .finally(() => {
        setOverviewLoading(false);
      });
  }, []);

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  const handleGlobalRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/refresh', { method: 'POST' });
      await loadOverview(true);
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [loadOverview]);

  return (
    <Layout
      activeSection={section}
      onNavigate={handleNavigate}
      onSelectSymbol={setSelectedSymbol}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      onRefresh={handleGlobalRefresh}
      refreshing={refreshing}
      lastSynced={lastSynced}
      watchlistCount={watchlist.length}
    >
      {section === 'overview' && (
        <OverviewPage
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => loadOverview(true)}
          onSelectSymbol={setSelectedSymbol}
          onNavigate={handleNavigate}
        />
      )}
      {section === 'markets' && (
        <MarketsPage
          refreshKey={refreshKey}
          onSelectSymbol={setSelectedSymbol}
          hasSymbol={hasSymbol}
          onToggleWatchlist={toggleSymbol}
        />
      )}
      {section === 'macro' && <MacroPage refreshKey={refreshKey} />}
      {section === 'fx' && (
        <FxCommoditiesPage refreshKey={refreshKey} onSelectSymbol={setSelectedSymbol} />
      )}
      {section === 'news' && <NewsPage refreshKey={refreshKey} />}
      {section === 'calendar' && (
        <CalendarDeskPage
          refreshKey={refreshKey}
          watchlist={watchlist}
          onAddSymbol={addSymbol}
          onRemoveSymbol={removeSymbol}
          onSelectSymbol={setSelectedSymbol}
        />
      )}

      <AssetDrawer
        symbol={selectedSymbol}
        onClose={() => setSelectedSymbol(null)}
        inWatchlist={selectedSymbol ? hasSymbol(selectedSymbol) : false}
        onToggleWatchlist={toggleSymbol}
      />
    </Layout>
  );
}
