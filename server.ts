import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCache } from './server/cache.ts';
import {
  computeWatchlistCorrelation,
  fetchAllNews,
  fetchChartData,
  fetchEconomicCalendar,
  fetchFxAndCommodities,
  fetchMacroData,
  fetchMarketDebates,
  fetchMarketsByCategory,
  fetchMarketStructure,
  fetchOverview,
  fetchQuotesBySymbols,
  searchSymbols,
} from './server/dataService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Force refresh cache
  app.post('/api/refresh', (_req, res) => {
    clearCache();
    res.json({ cleared: true, time: new Date().toISOString() });
  });

  // Overview payload
  app.get('/api/overview', async (req, res) => {
    try {
      const force = req.query.force === '1';
      const payload = await fetchOverview(force);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load overview' });
    }
  });

  // Visual Market Structure, Equity Factors & Regime Ratios (v2)
  app.get('/api/market-structure', async (req, res) => {
    try {
      const force = req.query.force === '1';
      const payload = await fetchMarketStructure(force);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load market structure' });
    }
  });

  // Multi-asset screener
  app.get('/api/markets', async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : 'all';
      const force = req.query.force === '1';
      const quotes = await fetchMarketsByCategory(category, force);
      res.json({ category, quotes, updatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load markets' });
    }
  });

  // Specific symbol batch quotes (for Watchlist)
  app.get('/api/quotes', async (req, res) => {
    try {
      const raw = typeof req.query.symbols === 'string' ? req.query.symbols : '';
      const symbols = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const quotes = await fetchQuotesBySymbols(symbols);
      res.json({ quotes, updatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load quotes' });
    }
  });

  // Historical OHLCV Chart + Symbol News
  app.get('/api/chart', async (req, res) => {
    try {
      const symbol = typeof req.query.symbol === 'string' && req.query.symbol.trim()
        ? req.query.symbol.trim()
        : '^GSPC';
      const range = typeof req.query.range === 'string' ? req.query.range : '3mo';
      const interval = typeof req.query.interval === 'string' ? req.query.interval : undefined;
      const chart = await fetchChartData(symbol, range, interval);
      res.json(chart);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Symbol chart unavailable' });
    }
  });

  // Live Symbol Search
  app.get('/api/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchSymbols(q);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed' });
    }
  });

  // Macro & Yield Curve
  app.get('/api/macro', async (_req, res) => {
    try {
      const macro = await fetchMacroData();
      res.json(macro);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load macro data' });
    }
  });

  // FX & Commodities
  app.get('/api/fx', async (_req, res) => {
    try {
      const data = await fetchFxAndCommodities();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load FX data' });
    }
  });

  // News & Central Bank Wire
  app.get('/api/news', async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : 'all';
      const force = req.query.force === '1';
      const all = await fetchAllNews(force);
      const items = category === 'all' ? all : all.filter((n) => n.category === category);
      res.json({ items, total: all.length, updatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load news wire' });
    }
  });

  // Ongoing Market Debates & Quantitative Data Briefings
  app.get('/api/news/debates', async (req, res) => {
    try {
      const force = req.query.force === '1';
      const payload = await fetchMarketDebates(force);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load market debates' });
    }
  });

  // Economic Calendar
  app.get('/api/calendar', async (_req, res) => {
    try {
      const events = await fetchEconomicCalendar();
      res.json({ events, updatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load calendar' });
    }
  });

  // Watchlist Return Correlation Matrix
  app.post('/api/correlation', async (req, res) => {
    try {
      const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols.map(String) : [];
      const payload = await computeWatchlistCorrelation(symbols);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to compute correlation' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Macro server listening on http://localhost:${PORT}`);
  });
}

createServer();
