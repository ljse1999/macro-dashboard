import { cachedFetch } from './cache.ts';
import {
  parseFredCsv,
  computeYoYFromMonthlyIndex,
  parseEcbYieldCurveCsv,
  parseBundesbankCsv,
  parseMofJgbCsv,
  parseBocValetJson,
  parseRssFeed,
  mergeAndSortNews,
} from '../src/lib/parsers.ts';
import {
  computeReturns,
  computeAnnualizedVolatility,
  computeCorrelationMatrix,
  normalizeToBase100,
  extractPreviousDayClose,
  computeHorizonReturn,
  computeRatioSeries,
} from '../src/lib/analytics.ts';
import type {
  AssetCategory,
  CalendarEvent,
  CandlePoint,
  ChartPayload,
  CorrelationPayload,
  FactorMetric,
  FearGreedData,
  FxCommoditiesPayload,
  FxHistoryPoint,
  GlobalBondBenchmark,
  MacroDataPoint,
  MacroPayload,
  MacroPillar,
  MacroSeries,
  MarketDebatesPayload,
  MarketQuote,
  MarketStructurePayload,
  NewsItem,
  OverviewPayload,
  RegimeRatio,
  RelativeSeriesItem,
  SearchQuoteResult,
  SovereignCurve,
  WorldEconomyRow,
  YieldCurvePoint,
} from '../src/lib/types.ts';
import { buildMarketDebates } from '../src/lib/debates.ts';

const USER_AGENT = 'Mozilla/5.0 (compatible; MeridianMacro/2.0)';

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchText(url: string, timeoutMs = 9000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

// ---------------------------------------------------------------------------
// Symbol Universes
// ---------------------------------------------------------------------------

interface SymbolDef {
  symbol: string;
  name: string;
  category: AssetCategory;
  region?: string;
  weight?: number;
}

const GLOBAL_INDICES: SymbolDef[] = [
  { symbol: '^GSPC', name: 'S&P 500', category: 'indices', region: 'US' },
  { symbol: '^IXIC', name: 'NASDAQ Composite', category: 'indices', region: 'US' },
  { symbol: '^DJI', name: 'Dow Jones Industrial', category: 'indices', region: 'US' },
  { symbol: '^RUT', name: 'Russell 2000', category: 'indices', region: 'US' },
  { symbol: '^FTSE', name: 'FTSE 100', category: 'indices', region: 'UK' },
  { symbol: '^GDAXI', name: 'DAX 40', category: 'indices', region: 'Europe' },
  { symbol: '^FCHI', name: 'CAC 40', category: 'indices', region: 'Europe' },
  { symbol: '^N225', name: 'Nikkei 225', category: 'indices', region: 'Asia' },
  { symbol: '^HSI', name: 'Hang Seng', category: 'indices', region: 'Asia' },
];

const US_SECTORS: SymbolDef[] = [
  { symbol: 'XLK', name: 'Technology', category: 'sectors', weight: 31.5 },
  { symbol: 'XLF', name: 'Financials', category: 'sectors', weight: 13.8 },
  { symbol: 'XLV', name: 'Health Care', category: 'sectors', weight: 11.4 },
  { symbol: 'XLY', name: 'Cons. Discretionary', category: 'sectors', weight: 10.6 },
  { symbol: 'XLC', name: 'Communication', category: 'sectors', weight: 9.2 },
  { symbol: 'XLI', name: 'Industrials', category: 'sectors', weight: 8.5 },
  { symbol: 'XLP', name: 'Consumer Staples', category: 'sectors', weight: 5.8 },
  { symbol: 'XLE', name: 'Energy', category: 'sectors', weight: 3.6 },
  { symbol: 'XLU', name: 'Utilities', category: 'sectors', weight: 2.5 },
  { symbol: 'XLRE', name: 'Real Estate', category: 'sectors', weight: 2.3 },
  { symbol: 'XLB', name: 'Materials', category: 'sectors', weight: 2.1 },
];

const EQUITY_FACTORS: Array<{ symbol: string; name: string; factor: string }> = [
  { symbol: 'MTUM', name: 'iShares MSCI USA Momentum', factor: 'Momentum' },
  { symbol: 'QUAL', name: 'iShares MSCI USA Quality', factor: 'Quality' },
  { symbol: 'VLUE', name: 'iShares MSCI USA Value', factor: 'Value' },
  { symbol: 'USMV', name: 'iShares MSCI USA Min Vol', factor: 'Low Volatility' },
  { symbol: 'SIZE', name: 'iShares MSCI USA Size', factor: 'Size (Equal)' },
  { symbol: 'VUG', name: 'Vanguard US Growth', factor: 'Large Growth' },
  { symbol: 'VTV', name: 'Vanguard US Value', factor: 'Large Value' },
  { symbol: 'SCHD', name: 'Schwab US Dividend Equity', factor: 'High Dividend' },
  { symbol: 'IWM', name: 'iShares Russell 2000', factor: 'Small Cap' },
  { symbol: 'RSP', name: 'Invesco S&P 500 Equal Wt', factor: 'Equal Weight' },
];

const COMMODITIES: SymbolDef[] = [
  { symbol: 'GC=F', name: 'Gold Futures', category: 'commodities', region: 'Metals' },
  { symbol: 'SI=F', name: 'Silver Futures', category: 'commodities', region: 'Metals' },
  { symbol: 'CL=F', name: 'WTI Crude Oil', category: 'commodities', region: 'Energy' },
  { symbol: 'BZ=F', name: 'Brent Crude Oil', category: 'commodities', region: 'Energy' },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'commodities', region: 'Energy' },
  { symbol: 'HG=F', name: 'Copper Futures', category: 'commodities', region: 'Metals' },
];

const VOLATILITY_DOLLAR: SymbolDef[] = [
  { symbol: '^VIX', name: 'CBOE Volatility (VIX)', category: 'indices', region: 'US' },
  { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)', category: 'fx', region: 'Global' },
];

const MEGA_CAP_EQUITIES: SymbolDef[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'equities', region: 'Tech' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'equities', region: 'Tech' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'equities', region: 'Semiconductors' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'equities', region: 'Consumer' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'equities', region: 'Communication' },
  { symbol: 'META', name: 'Meta Platforms', category: 'equities', region: 'Communication' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', category: 'equities', region: 'Semiconductors' },
  { symbol: 'TSM', name: 'TSMC (ADR)', category: 'equities', region: 'Semiconductors' },
  { symbol: 'JPM', name: 'JPMorgan Chase', category: 'equities', region: 'Financials' },
  { symbol: 'LLY', name: 'Eli Lilly & Co.', category: 'equities', region: 'Health Care' },
  { symbol: 'XOM', name: 'Exxon Mobil', category: 'equities', region: 'Energy' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway', category: 'equities', region: 'Financials' },
];

const KNOWN_SYMBOL_MAP = new Map<string, SymbolDef>(
  [
    ...GLOBAL_INDICES,
    ...US_SECTORS,
    ...COMMODITIES,
    ...VOLATILITY_DOLLAR,
    ...MEGA_CAP_EQUITIES,
    ...EQUITY_FACTORS.map((f) => ({
      symbol: f.symbol,
      name: f.name,
      category: 'factors' as const,
      region: f.factor,
    })),
  ].map((d) => [d.symbol.toUpperCase(), d])
);

// ---------------------------------------------------------------------------
// Yahoo Finance Fetchers
// ---------------------------------------------------------------------------

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

export async function fetchYahooQuote(def: SymbolDef, force = false): Promise<MarketQuote | null> {
  return cachedFetch(
    `yf:quote:${def.symbol}`,
    90_000,
    async () => {
      const encoded = encodeURIComponent(def.symbol);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1h`;
      const data = await fetchJson<YahooChartResponse>(url, 7000);
      const res = data.chart?.result?.[0];
      if (!res?.meta) return null;

      const meta = res.meta;
      const timestamps = res.timestamp || [];
      const closesRaw = res.indicators?.quote?.[0]?.close || [];
      const sparkline = closesRaw.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

      const price =
        typeof meta.regularMarketPrice === 'number'
          ? meta.regularMarketPrice
          : sparkline[sparkline.length - 1] ?? 0;

      const fallbackPrev =
        typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
          ? meta.chartPreviousClose
          : sparkline[0] ?? price;
      const prevClose =
        typeof meta.previousClose === 'number' && meta.previousClose > 0
          ? meta.previousClose
          : extractPreviousDayClose(timestamps, closesRaw, fallbackPrev);

      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const step = Math.max(1, Math.floor(sparkline.length / 24));
      const sampled = sparkline.filter((_, idx) => idx % step === 0);
      if (sparkline.length > 0 && sampled[sampled.length - 1] !== sparkline[sparkline.length - 1]) {
        sampled.push(sparkline[sparkline.length - 1]);
      }

      const resolvedName = (def.name || meta.shortName || meta.longName || def.symbol).trim();

      return {
        symbol: def.symbol,
        name: resolvedName,
        category: def.category,
        region: def.region,
        weight: def.weight,
        price: Number(price.toFixed(4)),
        change: Number(change.toFixed(4)),
        changePercent: Number(changePercent.toFixed(2)),
        previousClose: Number(prevClose.toFixed(4)),
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        volume: meta.regularMarketVolume,
        currency: meta.currency || 'USD',
        exchange: meta.exchangeName || '',
        sparkline: sampled,
        updatedAt: meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
      };
    },
    force
  ).catch(() => null);
}

async function fetchYahooQuotesBatch(defs: SymbolDef[], force = false): Promise<MarketQuote[]> {
  const results = await Promise.all(defs.map((d) => fetchYahooQuote(d, force)));
  return results.filter((q): q is MarketQuote => q !== null && q.price > 0);
}

export async function fetchQuotesBySymbols(symbols: string[]): Promise<MarketQuote[]> {
  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))).slice(0, 20);
  const defs: SymbolDef[] = unique.map((sym) => {
    const known = KNOWN_SYMBOL_MAP.get(sym);
    if (known) return known;
    return { symbol: sym, name: '', category: 'equities' };
  });
  return fetchYahooQuotesBatch(defs);
}

export async function fetchChartData(
  symbol: string,
  range = '3mo',
  interval?: string,
  includeNews = true
): Promise<ChartPayload> {
  const cleanSymbol = symbol.trim();
  const allowedRanges: Record<string, string> = {
    '1d': '5m',
    '5d': '30m',
    '1mo': '1d',
    '3mo': '1d',
    '6mo': '1d',
    '1y': '1d',
    '5y': '1wk',
  };
  const safeRange = allowedRanges[range] ? range : '3mo';
  const safeInterval = interval || allowedRanges[safeRange];

  return cachedFetch(`yf:chart:${cleanSymbol}:${safeRange}:${safeInterval}:${includeNews ? 'n' : 'c'}`, 180_000, async () => {
    const encoded = encodeURIComponent(cleanSymbol);
    const [chartRes, searchRes] = await Promise.all([
      fetchJson<YahooChartResponse>(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${safeRange}&interval=${safeInterval}`,
        8000
      ),
      includeNews ? fetchYahooSearchRaw(cleanSymbol).catch(() => ({ quotes: [], news: [] })) : Promise.resolve({ quotes: [], news: [] }),
    ]);

    const res = chartRes.chart?.result?.[0];
    if (!res?.meta) {
      throw new Error(`No market data found for symbol "${cleanSymbol}"`);
    }

    const meta = res.meta;
    const timestamps = res.timestamp || [];
    const quote = res.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const candles: CandlePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (typeof c !== 'number' || !Number.isFinite(c)) continue;
      const o = typeof opens[i] === 'number' && Number.isFinite(opens[i]) ? opens[i]! : c;
      const h = typeof highs[i] === 'number' && Number.isFinite(highs[i]) ? highs[i]! : Math.max(o, c);
      const l = typeof lows[i] === 'number' && Number.isFinite(lows[i]) ? lows[i]! : Math.min(o, c);
      const v = typeof volumes[i] === 'number' && Number.isFinite(volumes[i]) ? volumes[i]! : 0;
      const dt = new Date(timestamps[i] * 1000);
      const dateStr =
        safeRange === '1d' || safeRange === '5d'
          ? dt.toISOString()
          : dt.toISOString().slice(0, 10);

      candles.push({
        time: timestamps[i],
        date: dateStr,
        open: Number(o.toFixed(4)),
        high: Number(h.toFixed(4)),
        low: Number(l.toFixed(4)),
        close: Number(c.toFixed(4)),
        volume: Math.round(v),
      });
    }

    const latestClose = candles[candles.length - 1]?.close ?? meta.regularMarketPrice ?? 0;
    const price = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : latestClose;
    const firstOpen = candles[0]?.open ?? candles[0]?.close ?? price;
    const refClose =
      safeRange === '1d' && typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
        ? meta.chartPreviousClose
        : firstOpen;
    const change = price - refClose;
    const changePercent = refClose > 0 ? (change / refClose) * 100 : 0;

    const known = KNOWN_SYMBOL_MAP.get(cleanSymbol.toUpperCase());
    const truePrevClose =
      typeof meta.previousClose === 'number' && meta.previousClose > 0
        ? meta.previousClose
        : extractPreviousDayClose(timestamps, closes, meta.chartPreviousClose ?? refClose);

    return {
      symbol: meta.symbol || cleanSymbol,
      name: (known?.name || meta.shortName || meta.longName || cleanSymbol).trim(),
      currency: meta.currency || 'USD',
      exchange: meta.exchangeName || '',
      range: safeRange,
      interval: safeInterval,
      price: Number(price.toFixed(4)),
      previousClose: Number(truePrevClose.toFixed(4)),
      change: Number(change.toFixed(4)),
      changePercent: Number(changePercent.toFixed(2)),
      dayHigh: meta.regularMarketDayHigh ?? Math.max(...candles.slice(-1).map((x) => x.high), price),
      dayLow: meta.regularMarketDayLow ?? Math.min(...candles.slice(-1).map((x) => x.low), price),
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? Math.max(...candles.map((x) => x.high), price),
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? Math.min(...candles.map((x) => x.low), price),
      volume: meta.regularMarketVolume ?? candles[candles.length - 1]?.volume ?? 0,
      candles,
      news: searchRes.news,
      updatedAt: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  });
}

interface YahooSearchApi {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
    sector?: string;
  }>;
  news?: Array<{
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
    relatedTickers?: string[];
  }>;
}

async function fetchYahooSearchRaw(
  query: string
): Promise<{ quotes: SearchQuoteResult[]; news: NewsItem[] }> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=6`;
  const data = await fetchJson<YahooSearchApi>(url, 6000);
  const quotes: SearchQuoteResult[] = (data.quotes || [])
    .filter((q) => q.symbol && (q.shortname || q.longname))
    .map((q) => ({
      symbol: q.symbol!,
      shortname: q.shortname || q.longname || q.symbol!,
      exchange: q.exchange || '',
      quoteType: q.quoteType || 'EQUITY',
      sector: q.sector,
    }));

  const news: NewsItem[] = (data.news || [])
    .filter((n) => n.title && n.link)
    .map((n, i) => ({
      id: n.uuid || `yf-news-${i}-${Date.now()}`,
      title: n.title!,
      link: n.link!,
      source: n.publisher || 'Yahoo Finance',
      category: 'equities',
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : new Date().toISOString(),
      summary: n.relatedTickers?.length
        ? `Related tickers: ${n.relatedTickers.slice(0, 5).join(', ')}`
        : `Coverage from ${n.publisher || 'Yahoo Finance'}`,
      symbols: n.relatedTickers,
    }));

  return { quotes, news };
}

export async function searchSymbols(query: string): Promise<{ quotes: SearchQuoteResult[]; news: NewsItem[] }> {
  const q = query.trim();
  if (!q) return { quotes: [], news: [] };
  return cachedFetch(`yf:search:${q.toLowerCase()}`, 120_000, () => fetchYahooSearchRaw(q));
}

// ---------------------------------------------------------------------------
// CoinGecko Crypto Markets
// ---------------------------------------------------------------------------

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  total_volume: number;
  market_cap: number;
  last_updated: string;
  sparkline_in_7d?: { price?: number[] };
}

export async function fetchCryptoQuotes(force = false): Promise<MarketQuote[]> {
  return cachedFetch(
    'cg:markets',
    120_000,
    async () => {
      const url =
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&page=1&sparkline=true';
      const data = await fetchJson<CoinGeckoMarket[]>(url, 8000);
      return data.map((coin) => {
        const spark = coin.sparkline_in_7d?.price || [];
        const step = Math.max(1, Math.floor(spark.length / 24));
        const sampled = spark.filter((_, idx) => idx % step === 0);
        return {
          symbol: `${coin.symbol.toUpperCase()}-USD`,
          name: coin.name,
          category: 'crypto' as const,
          region: 'Digital Assets',
          price: coin.current_price,
          change: coin.price_change_24h ?? 0,
          changePercent: Number((coin.price_change_percentage_24h ?? 0).toFixed(2)),
          previousClose: coin.current_price - (coin.price_change_24h ?? 0),
          dayHigh: coin.high_24h,
          dayLow: coin.low_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          currency: 'USD',
          exchange: 'Spot Aggregate',
          sparkline: sampled,
          updatedAt: coin.last_updated || new Date().toISOString(),
        };
      });
    },
    force
  ).catch(() => []);
}

// ---------------------------------------------------------------------------
// Market Structure: Equity Factors + Cross-Asset Regime Ratios (v2)
// ---------------------------------------------------------------------------

const REGIME_RATIO_DEFS: Array<{
  id: string;
  name: string;
  pairLabel: string;
  numerator: string;
  denominator: string;
  description: string;
}> = [
  {
    id: 'breadth',
    name: 'Market Breadth',
    pairLabel: 'RSP / SPY',
    numerator: 'RSP',
    denominator: 'SPY',
    description: 'Equal-weight vs. cap-weight S&P 500; rising ratio confirms broad market participation beyond mega-caps.',
  },
  {
    id: 'small-large',
    name: 'Small vs. Large Cap',
    pairLabel: 'IWM / SPY',
    numerator: 'IWM',
    denominator: 'SPY',
    description: 'Russell 2000 vs. S&P 500; tracks domestic growth breadth and funding sensitivity.',
  },
  {
    id: 'credit',
    name: 'Credit Risk Appetite',
    pairLabel: 'HYG / LQD',
    numerator: 'HYG',
    denominator: 'LQD',
    description: 'High-yield vs. investment-grade corporate bonds; key institutional early warning for credit stress.',
  },
  {
    id: 'cyclical',
    name: 'Cyclical vs. Defensive',
    pairLabel: 'XLY / XLP',
    numerator: 'XLY',
    denominator: 'XLP',
    description: 'Consumer Discretionary vs. Consumer Staples; reflects real-time household demand conviction.',
  },
  {
    id: 'copper-gold',
    name: 'Global Growth Pulse',
    pairLabel: 'Copper / Gold',
    numerator: 'HG=F',
    denominator: 'GC=F',
    description: 'Industrial doctor-copper vs. safe-haven gold; classic macro barometer for global manufacturing and yields.',
  },
  {
    id: 'em-us',
    name: 'Emerging vs. US Equities',
    pairLabel: 'EEM / SPY',
    numerator: 'EEM',
    denominator: 'SPY',
    description: 'MSCI Emerging Markets vs. S&P 500; tracks global capital rotation and dollar liquidity sensitivity.',
  },
];

export async function fetchMarketStructure(force = false): Promise<MarketStructurePayload> {
  return cachedFetch(
    'markets:structure:v2',
    180_000,
    async () => {
      const ratioSymbols = Array.from(
        new Set([
          'SPY',
          ...EQUITY_FACTORS.map((f) => f.symbol),
          ...REGIME_RATIO_DEFS.flatMap((r) => [r.numerator, r.denominator]),
        ])
      );

      const [chartEntries, indices, sectors, equities, commodities, crypto] = await Promise.all([
        Promise.all(
          ratioSymbols.map((sym) =>
            fetchChartData(sym, '3mo', '1d', false)
              .then((ch) => [sym, ch] as const)
              .catch(() => [sym, null] as const)
          )
        ),
        fetchYahooQuotesBatch(GLOBAL_INDICES, force),
        fetchYahooQuotesBatch(US_SECTORS, force),
        fetchYahooQuotesBatch(MEGA_CAP_EQUITIES, force),
        fetchYahooQuotesBatch(COMMODITIES, force),
        fetchCryptoQuotes(force),
      ]);

      const chartMap = new Map<string, ChartPayload>();
      for (const [sym, ch] of chartEntries) {
        if (ch && ch.candles.length >= 5) chartMap.set(sym, ch);
      }

      const spyChart = chartMap.get('SPY');
      const spyCloses = spyChart ? spyChart.candles.map((c) => c.close) : [];
      const spyReturn3m = spyCloses.length >= 2 ? computeHorizonReturn(spyCloses, spyCloses.length - 1) : 0;
      const spyVol = spyCloses.length >= 5 ? computeAnnualizedVolatility(computeReturns(spyCloses)) : 15;

      const factors: FactorMetric[] = [];
      for (const def of EQUITY_FACTORS) {
        const ch = chartMap.get(def.symbol);
        if (!ch || ch.candles.length < 5) continue;
        const closes = ch.candles.map((c) => c.close);
        const return1d =
          ch.previousClose > 0
            ? Number((((ch.price - ch.previousClose) / ch.previousClose) * 100).toFixed(2))
            : computeHorizonReturn(closes, 1);
        const return1m = computeHorizonReturn(closes, Math.min(21, closes.length - 1));
        const return3m = computeHorizonReturn(closes, closes.length - 1);
        const annualizedVol = computeAnnualizedVolatility(computeReturns(closes));
        const alpha3mVsSpy = Number((return3m - spyReturn3m).toFixed(2));
        const annualizedRet = return3m * 4;
        const sharpeProxy = annualizedVol > 0 ? Number(((annualizedRet - 4.0) / annualizedVol).toFixed(2)) : 0;

        const step = Math.max(1, Math.floor(closes.length / 24));
        const sparkline = closes.filter((_, idx) => idx % step === 0);

        factors.push({
          symbol: def.symbol,
          name: def.name,
          factor: def.factor,
          price: ch.price,
          return1d,
          return1m,
          return3m,
          alpha3mVsSpy,
          annualizedVol,
          sharpeProxy,
          sparkline,
        });
      }

      const ratios: RegimeRatio[] = [];
      for (const def of REGIME_RATIO_DEFS) {
        const numCh = chartMap.get(def.numerator);
        const denCh = chartMap.get(def.denominator);
        if (!numCh || !denCh) continue;

        const computed = computeRatioSeries(numCh.candles, denCh.candles);
        if (computed.points.length < 5) continue;

        ratios.push({
          id: def.id,
          name: def.name,
          pairLabel: def.pairLabel,
          numerator: def.numerator,
          denominator: def.denominator,
          description: def.description,
          ...computed,
        });
      }

      return {
        factors,
        spyReturn3m,
        spyVol,
        ratios,
        indices,
        sectors,
        equities,
        commodities,
        crypto,
        updatedAt: new Date().toISOString(),
      };
    },
    force
  );
}

// ---------------------------------------------------------------------------
// Alternative.me Fear & Greed Index
// ---------------------------------------------------------------------------

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  return cachedFetch('alt:fng', 600_000, async () => {
    const data = await fetchJson<{
      data?: Array<{ value: string; value_classification: string; timestamp: string }>;
    }>('https://api.alternative.me/fng/?limit=30', 6000);

    const rows = data.data || [];
    if (rows.length === 0) return null;
    const latest = rows[0];
    return {
      value: Number(latest.value),
      classification: latest.value_classification,
      updatedAt: new Date(Number(latest.timestamp) * 1000).toISOString(),
      history: rows
        .map((r) => ({
          date: new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 10),
          value: Number(r.value),
          classification: r.value_classification,
        }))
        .reverse(),
    };
  }).catch(() => null);
}

// ---------------------------------------------------------------------------
// FRED Public CSV & Multi-Sovereign Bond Curves (v2)
// ---------------------------------------------------------------------------

async function fetchFredSeries(seriesId: string, cosd = '2021-01-01'): Promise<MacroDataPoint[]> {
  return cachedFetch(`fred:${seriesId}:${cosd}`, 1_800_000, async () => {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${cosd}`;
    const csv = await fetchText(url, 9000);
    return parseFredCsv(csv);
  }).catch(() => []);
}

function getValueAtOffset(points: MacroDataPoint[], daysBack: number): number {
  if (points.length === 0) return 0;
  const latestTs = Date.parse(points[points.length - 1].date);
  const targetTs = latestTs - daysBack * 86400_000;
  let best = points[0];
  let bestDiff = Math.abs(Date.parse(best.date) - targetTs);
  for (const pt of points) {
    const diff = Math.abs(Date.parse(pt.date) - targetTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = pt;
    }
  }
  return best.value;
}

const US_YIELD_TENORS: Array<{ id: string; maturity: string; months: number }> = [
  { id: 'DGS1MO', maturity: '1M', months: 1 },
  { id: 'DGS3MO', maturity: '3M', months: 3 },
  { id: 'DGS6MO', maturity: '6M', months: 6 },
  { id: 'DGS1', maturity: '1Y', months: 12 },
  { id: 'DGS2', maturity: '2Y', months: 24 },
  { id: 'DGS5', maturity: '5Y', months: 60 },
  { id: 'DGS10', maturity: '10Y', months: 120 },
  { id: 'DGS20', maturity: '20Y', months: 240 },
  { id: 'DGS30', maturity: '30Y', months: 360 },
];

async function fetchGermanyCurve(): Promise<SovereignCurve | null> {
  return cachedFetch<SovereignCurve | null>('sov:de', 1_800_000, async () => {
    const url =
      'https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R01XX+R02XX+R03XX+R05XX+R07XX+R10XX+R20XX+R30XX.R.A.A._Z._Z.A?lastNObservations=2&format=csv';
    const csv = await fetchText(url, 9000);
    const parsed = parseBundesbankCsv(csv);
    if (parsed.points.length < 3) return null;
    const y10 = parsed.points.find((p) => p.maturity === '10Y')?.current;
    const y2 = parsed.points.find((p) => p.maturity === '2Y')?.current;
    return {
      id: 'DE',
      name: 'Germany (Bunds)',
      currency: 'EUR',
      source: 'Deutsche Bundesbank',
      color: '#D97706',
      asOf: parsed.asOf,
      spread10y2y: y10 !== undefined && y2 !== undefined ? Math.round((y10 - y2) * 100) : null,
      points: parsed.points,
    };
  }).catch(() => null);
}

async function fetchEuroAaaCurve(): Promise<SovereignCurve | null> {
  return cachedFetch<SovereignCurve | null>('sov:eu', 1_800_000, async () => {
    const url =
      'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_1Y+SR_2Y+SR_5Y+SR_10Y+SR_20Y+SR_30Y?lastNObservations=1&format=csvdata';
    const csv = await fetchText(url, 10000);
    const parsed = parseEcbYieldCurveCsv(csv);
    if (parsed.points.length < 3) return null;
    const y10 = parsed.points.find((p) => p.maturity === '10Y')?.current;
    const y2 = parsed.points.find((p) => p.maturity === '2Y')?.current;
    return {
      id: 'EU',
      name: 'Euro Area (AAA)',
      currency: 'EUR',
      source: 'European Central Bank',
      color: '#0F766E',
      asOf: parsed.asOf,
      spread10y2y: y10 !== undefined && y2 !== undefined ? Math.round((y10 - y2) * 100) : null,
      points: parsed.points,
    };
  }).catch(() => null);
}

async function fetchJapanCurve(): Promise<SovereignCurve | null> {
  return cachedFetch<SovereignCurve | null>('sov:jp', 1_800_000, async () => {
    const csv = await fetchText(
      'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv',
      9000
    );
    const parsed = parseMofJgbCsv(csv);
    if (parsed.points.length < 3) return null;
    const y10 = parsed.points.find((p) => p.maturity === '10Y')?.current;
    const y2 = parsed.points.find((p) => p.maturity === '2Y')?.current;
    return {
      id: 'JP',
      name: 'Japan (JGBs)',
      currency: 'JPY',
      source: 'Ministry of Finance Japan',
      color: '#B91C1C',
      asOf: parsed.asOf,
      spread10y2y: y10 !== undefined && y2 !== undefined ? Math.round((y10 - y2) * 100) : null,
      points: parsed.points,
    };
  }).catch(() => null);
}

async function fetchCanadaCurve(): Promise<SovereignCurve | null> {
  return cachedFetch<SovereignCurve | null>('sov:ca', 1_800_000, async () => {
    const data = await fetchJson<{ observations?: Array<Record<string, unknown>> }>(
      'https://www.bankofcanada.ca/valet/observations/BD.CDN.2YR.DQ.YLD,BD.CDN.3YR.DQ.YLD,BD.CDN.5YR.DQ.YLD,BD.CDN.7YR.DQ.YLD,BD.CDN.10YR.DQ.YLD,BD.CDN.LONG.DQ.YLD/json?recent=25',
      9000
    );
    const parsed = parseBocValetJson(data.observations || []);
    if (parsed.points.length < 3) return null;
    const y10 = parsed.points.find((p) => p.maturity === '10Y')?.current;
    const y2 = parsed.points.find((p) => p.maturity === '2Y')?.current;
    return {
      id: 'CA',
      name: 'Canada (GoC)',
      currency: 'CAD',
      source: 'Bank of Canada',
      color: '#7C3AED',
      asOf: parsed.asOf,
      spread10y2y: y10 !== undefined && y2 !== undefined ? Math.round((y10 - y2) * 100) : null,
      points: parsed.points,
    };
  }).catch(() => null);
}

export async function fetchMacroData(): Promise<MacroPayload> {
  return cachedFetch('macro:full:v2', 1_200_000, async () => {
    const twoYearsAgo = new Date(Date.now() - 420 * 86400_000).toISOString().slice(0, 10);

    const [
      usYieldResults,
      deCurve,
      euCurve,
      jpCurve,
      caCurve,
      uk10yRaw,
      fr10yRaw,
      it10yRaw,
      cpiRaw,
      coreCpiRaw,
      corePceRaw,
      breakevenRaw,
      fwd5y5yRaw,
      gdpRaw,
      indproRaw,
      umcsentRaw,
      mort30Raw,
      unrateRaw,
      icsaRaw,
      fedFundsRaw,
      dfii10Raw,
      ecbdfrRaw,
      walclRaw,
      m2Raw,
      nfciRaw,
      hySpreadRaw,
      igSpreadRaw,
      worldEconomies,
    ] = await Promise.all([
      Promise.all(US_YIELD_TENORS.map((t) => fetchFredSeries(t.id, twoYearsAgo))),
      fetchGermanyCurve(),
      fetchEuroAaaCurve(),
      fetchJapanCurve(),
      fetchCanadaCurve(),
      fetchFredSeries('IRLTLT01GBM156N', '2025-01-01'),
      fetchFredSeries('IRLTLT01FRM156N', '2025-01-01'),
      fetchFredSeries('IRLTLT01ITM156N', '2025-01-01'),
      fetchFredSeries('CPIAUCSL', '2020-01-01'),
      fetchFredSeries('CPILFESL', '2020-01-01'),
      fetchFredSeries('PCEPILFE', '2020-01-01'),
      fetchFredSeries('T10YIE', '2022-01-01'),
      fetchFredSeries('T5YIFR', '2022-01-01'),
      fetchFredSeries('A191RL1Q225SBEA', '2021-01-01'),
      fetchFredSeries('INDPRO', '2020-01-01'),
      fetchFredSeries('UMCSENT', '2021-01-01'),
      fetchFredSeries('MORTGAGE30US', '2021-01-01'),
      fetchFredSeries('UNRATE', '2020-01-01'),
      fetchFredSeries('ICSA', '2022-01-01'),
      fetchFredSeries('FEDFUNDS', '2020-01-01'),
      fetchFredSeries('DFII10', '2022-01-01'),
      fetchFredSeries('ECBDFR', '2021-01-01'),
      fetchFredSeries('WALCL', '2021-01-01'),
      fetchFredSeries('M2SL', '2020-01-01'),
      fetchFredSeries('NFCI', '2022-01-01'),
      fetchFredSeries('BAMLH0A0HYM2', '2022-01-01'),
      fetchFredSeries('BAMLC0A0CM', '2022-01-01'),
      fetchWorldBankEconomies(),
    ]);

    const yieldCurve: YieldCurvePoint[] = [];
    let curveDate = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < US_YIELD_TENORS.length; i++) {
      const pts = usYieldResults[i];
      if (pts.length === 0) continue;
      const last = pts[pts.length - 1];
      if (US_YIELD_TENORS[i].maturity === '10Y') {
        curveDate = last.date;
      }
      yieldCurve.push({
        maturity: US_YIELD_TENORS[i].maturity,
        months: US_YIELD_TENORS[i].months,
        current: last.value,
        oneMonthAgo: getValueAtOffset(pts, 30),
        oneYearAgo: getValueAtOffset(pts, 365),
      });
    }

    const y10 = yieldCurve.find((p) => p.maturity === '10Y')?.current ?? null;
    const y2 = yieldCurve.find((p) => p.maturity === '2Y')?.current ?? null;
    const y3m = yieldCurve.find((p) => p.maturity === '3M')?.current ?? null;
    const spread10y2y = y10 !== null && y2 !== null ? Math.round((y10 - y2) * 100) : null;
    const spread10y3m = y10 !== null && y3m !== null ? Math.round((y10 - y3m) * 100) : null;

    const usCurve: SovereignCurve = {
      id: 'US',
      name: 'United States (Treasuries)',
      currency: 'USD',
      source: 'US Treasury / FRED',
      color: '#1D4ED8',
      asOf: curveDate,
      spread10y2y,
      points: yieldCurve,
    };

    const sovereignCurves: SovereignCurve[] = [
      usCurve,
      ...[deCurve, euCurve, caCurve, jpCurve].filter((c): c is SovereignCurve => c !== null),
    ];

    // Global 10Y Benchmarks table
    const globalBenchmarks: GlobalBondBenchmark[] = [];
    for (const sc of sovereignCurves) {
      const p10 = sc.points.find((p) => p.maturity === '10Y')?.current;
      const p2 = sc.points.find((p) => p.maturity === '2Y')?.current ?? null;
      if (p10 === undefined) continue;
      globalBenchmarks.push({
        country: sc.name,
        code: sc.id,
        currency: sc.currency,
        yield10y: p10,
        spreadVsUsBps: sc.id === 'US' || y10 === null ? 0 : Math.round((p10 - y10) * 100),
        yield2y: p2,
        slope2s10sBps: sc.spread10y2y,
        asOf: sc.asOf,
        source: sc.source,
      });
    }

    const appendFred10y = (
      pts: MacroDataPoint[],
      country: string,
      code: string,
      currency: string
    ) => {
      if (pts.length === 0) return;
      const last = pts[pts.length - 1];
      const v = Number(last.value.toFixed(2));
      globalBenchmarks.push({
        country,
        code,
        currency,
        yield10y: v,
        spreadVsUsBps: y10 === null ? null : Math.round((v - y10) * 100),
        yield2y: null,
        slope2s10sBps: null,
        asOf: last.date,
        source: 'OECD / FRED',
      });
    };

    appendFred10y(uk10yRaw, 'United Kingdom (Gilts)', 'UK', 'GBP');
    appendFred10y(fr10yRaw, 'France (OATs)', 'FR', 'EUR');
    appendFred10y(it10yRaw, 'Italy (BTPs)', 'IT', 'EUR');

    // Transform derived series
    const cpiYoY = computeYoYFromMonthlyIndex(cpiRaw);
    const coreCpiYoY = computeYoYFromMonthlyIndex(coreCpiRaw);
    const corePceYoY = computeYoYFromMonthlyIndex(corePceRaw);
    const indproYoY = computeYoYFromMonthlyIndex(indproRaw);
    const m2YoY = computeYoYFromMonthlyIndex(m2Raw);
    const icsaThousands = icsaRaw.map((p) => ({ date: p.date, value: Number((p.value / 1000).toFixed(1)) }));
    const walclTrillions = walclRaw.map((p) => ({ date: p.date, value: Number((p.value / 1_000_000).toFixed(2)) }));

    const buildSeries = (
      id: string,
      name: string,
      shortName: string,
      pillar: MacroPillar,
      unit: string,
      frequency: string,
      description: string,
      points: MacroDataPoint[],
      targetLine?: number,
      targetLabel?: string,
      source = 'FRED / Federal Reserve'
    ): MacroSeries => {
      const trimmed =
        points.length > 140
          ? points.filter((_, idx) => idx % Math.ceil(points.length / 120) === 0 || idx === points.length - 1)
          : points;
      const latest = trimmed[trimmed.length - 1]?.value ?? 0;
      const previous = trimmed[trimmed.length - 2]?.value ?? latest;
      return {
        id,
        name,
        shortName,
        pillar,
        unit,
        frequency,
        source,
        description,
        latest: Number(latest.toFixed(2)),
        previous: Number(previous.toFixed(2)),
        change: Number((latest - previous).toFixed(2)),
        targetLine,
        targetLabel,
        points: trimmed,
      };
    };

    const series: MacroSeries[] = [
      // Inflation & Prices
      buildSeries(
        'CPI_YOY',
        'US Headline CPI Inflation (YoY)',
        'Headline CPI',
        'inflation',
        '%',
        'Monthly',
        '12-month percent change in the Consumer Price Index for All Urban Consumers (CPIAUCSL).',
        cpiYoY,
        2.0,
        'Fed 2.0% Target'
      ),
      buildSeries(
        'CORE_PCE_YOY',
        'US Core PCE Inflation (YoY)',
        'Core PCE',
        'inflation',
        '%',
        'Monthly',
        'Personal Consumption Expenditures excluding food and energy (PCEPILFE) — the Federal Reserve primary inflation mandate gauge.',
        corePceYoY,
        2.0,
        'Fed 2.0% Mandate'
      ),
      buildSeries(
        'CORE_CPI_YOY',
        'US Core CPI Inflation (YoY)',
        'Core CPI',
        'inflation',
        '%',
        'Monthly',
        '12-month change in CPI excluding volatile food and energy baskets (CPILFESL).',
        coreCpiYoY,
        2.0,
        '2.0% Target'
      ),
      buildSeries(
        'T10YIE',
        '10-Year Breakeven Inflation',
        '10Y Breakeven',
        'inflation',
        '%',
        'Daily',
        'Market-implied average inflation expected over the next 10 years (10Y Nominal Treasury minus 10Y TIPS).',
        breakevenRaw,
        2.0,
        '2.0% Anchor'
      ),
      buildSeries(
        'T5YIFR',
        '5Y5Y Forward Inflation Expectation',
        '5Y5Y Forward',
        'inflation',
        '%',
        'Daily',
        'Market measure of expected average inflation over the five-year period starting five years from now.',
        fwd5y5yRaw,
        2.0,
        '2.0% Anchor'
      ),
      // Growth & Consumer
      buildSeries(
        'REAL_GDP',
        'US Real GDP Growth (QoQ Annualized)',
        'Real GDP QoQ',
        'growth',
        '%',
        'Quarterly',
        'Seasonally adjusted annualized real gross domestic product growth rate (BEA / A191RL1Q225SBEA).',
        gdpRaw,
        0,
        'Contraction Line'
      ),
      buildSeries(
        'INDPRO_YOY',
        'US Industrial Production (YoY)',
        'Industrial Prod.',
        'growth',
        '%',
        'Monthly',
        'Year-over-year real output growth across US manufacturing, mining, and utilities.',
        indproYoY,
        0,
        'Zero Growth'
      ),
      buildSeries(
        'UMCSENT',
        'Univ. of Michigan Consumer Sentiment',
        'Consumer Sent.',
        'growth',
        ' idx',
        'Monthly',
        'Survey benchmark of US household personal finance confidence and spending outlook.',
        umcsentRaw
      ),
      buildSeries(
        'MORTGAGE30US',
        '30-Year Fixed Mortgage Rate',
        '30Y Mortgage',
        'growth',
        '%',
        'Weekly',
        'Freddie Mac Primary Mortgage Market Survey average commitment rate — key housing transmission channel.',
        mort30Raw
      ),
      // Labor
      buildSeries(
        'UNRATE',
        'US Unemployment Rate (U-3)',
        'Unemployment',
        'labor',
        '%',
        'Monthly',
        'Percentage of civilian labor force actively seeking work (BLS household survey).',
        unrateRaw
      ),
      buildSeries(
        'ICSA',
        'Weekly Initial Jobless Claims',
        'Jobless Claims',
        'labor',
        'K',
        'Weekly',
        'High-frequency count of first-time unemployment insurance filings (in thousands).',
        icsaThousands
      ),
      // Liquidity & Financial Conditions
      buildSeries(
        'FEDFUNDS',
        'Effective Federal Funds Rate',
        'Fed Funds',
        'liquidity',
        '%',
        'Monthly',
        'Volume-weighted median overnight interbank lending rate reflecting Federal Reserve policy stance.',
        fedFundsRaw
      ),
      buildSeries(
        'DFII10',
        'US 10-Year TIPS Real Yield',
        '10Y Real Yield',
        'liquidity',
        '%',
        'Daily',
        'Inflation-indexed 10-year sovereign borrowing cost; key discount-rate driver for long-duration equities and gold.',
        dfii10Raw,
        0,
        'Zero Real Bound'
      ),
      buildSeries(
        'ECBDFR',
        'ECB Deposit Facility Rate',
        'ECB Policy Rate',
        'liquidity',
        '%',
        'Daily',
        'European Central Bank benchmark overnight deposit rate governing euro area monetary policy.',
        ecbdfrRaw,
        undefined,
        undefined,
        'ECB / FRED'
      ),
      buildSeries(
        'WALCL',
        'Federal Reserve Balance Sheet Assets',
        'Fed Assets ($T)',
        'liquidity',
        'T',
        'Weekly',
        'Total assets held by the Federal Reserve (in USD trillions) tracking Quantitative Easing vs. Quantitative Tightening.',
        walclTrillions
      ),
      buildSeries(
        'M2_YOY',
        'US M2 Money Supply Growth (YoY)',
        'M2 Supply YoY',
        'liquidity',
        '%',
        'Monthly',
        '12-month growth rate in broad US money supply (cash, checking, savings, and retail money market funds).',
        m2YoY,
        0,
        'Zero Expansion'
      ),
      buildSeries(
        'NFCI',
        'Chicago Fed Financial Conditions (NFCI)',
        'Financial Cond.',
        'liquidity',
        ' σ',
        'Weekly',
        'Composite gauge of US money, debt, and equity market stress; negative values signal looser-than-average conditions.',
        nfciRaw,
        0,
        'Historical Average'
      ),
      buildSeries(
        'BAMLH0A0HYM2',
        'US High Yield Credit Spread (OAS)',
        'HY Credit OAS',
        'liquidity',
        '%',
        'Daily',
        'ICE BofA US High Yield option-adjusted spread over Treasuries — primary corporate default risk barometer.',
        hySpreadRaw
      ),
      buildSeries(
        'BAMLC0A0CM',
        'US Investment Grade Credit OAS',
        'IG Credit OAS',
        'liquidity',
        '%',
        'Daily',
        'ICE BofA US Investment Grade corporate bond spread over Treasuries.',
        igSpreadRaw
      ),
    ].filter((s) => s.points.length > 0);

    const latestFed = series.find((s) => s.id === 'FEDFUNDS')?.latest ?? null;
    const latestCorePce = series.find((s) => s.id === 'CORE_PCE_YOY')?.latest ?? null;
    const latestReal10 = series.find((s) => s.id === 'DFII10')?.latest ?? null;
    const latestNfci = series.find((s) => s.id === 'NFCI')?.latest ?? null;
    const latestHy = series.find((s) => s.id === 'BAMLH0A0HYM2')?.latest ?? null;
    const latestIg = series.find((s) => s.id === 'BAMLC0A0CM')?.latest ?? null;
    const latestFedBs = series.find((s) => s.id === 'WALCL')?.latest ?? null;

    return {
      yieldCurve,
      sovereignCurves,
      globalBenchmarks,
      spread10y2y,
      spread10y3m,
      curveDate,
      regimeMetrics: {
        realPolicyRate:
          latestFed !== null && latestCorePce !== null
            ? Number((latestFed - latestCorePce).toFixed(2))
            : null,
        us10yRealYield: latestReal10,
        nfci: latestNfci,
        hyIgQualitySpreadBps:
          latestHy !== null && latestIg !== null ? Math.round((latestHy - latestIg) * 100) : null,
        fedBalanceSheetTrillions: latestFedBs,
      },
      series,
      worldEconomies,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// World Bank Global Economies Comparison
// ---------------------------------------------------------------------------

interface WorldBankRecord {
  country?: { id: string; value: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
}

async function fetchWorldBankIndicator(indicator: string): Promise<Map<string, { value: number; year: string }>> {
  const countries = 'USA;EMU;CHN;JPN;GBR;DEU;IND;CAN;BRA';
  const url = `https://api.worldbank.org/v2/country/${countries}/indicator/${indicator}?format=json&mrv=4&per_page=50`;
  const raw = await fetchJson<[unknown, WorldBankRecord[]]>(url, 8000);
  const rows = Array.isArray(raw) && Array.isArray(raw[1]) ? raw[1] : [];
  const map = new Map<string, { value: number; year: string }>();

  for (const row of rows) {
    const code = row.countryiso3code || row.country?.id;
    if (!code || row.value === null || row.value === undefined) continue;
    if (!map.has(code)) {
      map.set(code, { value: Number(row.value.toFixed(2)), year: row.date || '' });
    }
  }
  return map;
}

async function fetchWorldBankEconomies(): Promise<WorldEconomyRow[]> {
  return cachedFetch('wb:economies', 3_600_000, async () => {
    const [gdp, inf, unemp] = await Promise.all([
      fetchWorldBankIndicator('NY.GDP.MKTP.KD.ZG').catch(() => new Map()),
      fetchWorldBankIndicator('FP.CPI.TOTL.ZG').catch(() => new Map()),
      fetchWorldBankIndicator('SL.UEM.TOTL.ZS').catch(() => new Map()),
    ]);

    const defs: Array<{ code: string; name: string; region: string }> = [
      { code: 'USA', name: 'United States', region: 'North America' },
      { code: 'EMU', name: 'Euro Area', region: 'Europe' },
      { code: 'CHN', name: 'China', region: 'Asia-Pacific' },
      { code: 'JPN', name: 'Japan', region: 'Asia-Pacific' },
      { code: 'GBR', name: 'United Kingdom', region: 'Europe' },
      { code: 'DEU', name: 'Germany', region: 'Europe' },
      { code: 'IND', name: 'India', region: 'Asia-Pacific' },
      { code: 'CAN', name: 'Canada', region: 'North America' },
      { code: 'BRA', name: 'Brazil', region: 'Latin America' },
    ];

    return defs.map((d) => ({
      code: d.code,
      name: d.name,
      region: d.region,
      gdpGrowth: gdp.get(d.code)?.value ?? null,
      gdpYear: gdp.get(d.code)?.year ?? '—',
      inflation: inf.get(d.code)?.value ?? null,
      inflationYear: inf.get(d.code)?.year ?? '—',
      unemployment: unemp.get(d.code)?.value ?? null,
      unemploymentYear: unemp.get(d.code)?.year ?? '—',
    }));
  }).catch(() => []);
}

// ---------------------------------------------------------------------------
// Frankfurter FX & Commodities Relative Performance
// ---------------------------------------------------------------------------

const FX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'];
const COMMODITY_COLORS: Record<string, string> = {
  'GC=F': '#D97706',
  'SI=F': '#64748B',
  'CL=F': '#1D4ED8',
  'BZ=F': '#0F766E',
  'NG=F': '#7C3AED',
  'HG=F': '#B45309',
};

export async function fetchFxAndCommodities(): Promise<FxCommoditiesPayload> {
  return cachedFetch('fx:commodities', 300_000, async () => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 95 * 86400_000).toISOString().slice(0, 10);
    const targetSyms = FX_CURRENCIES.filter((c) => c !== 'USD').join(',');

    const [latestFx, histFx, commodities, relCharts] = await Promise.all([
      fetchJson<{ base: string; date: string; rates: Record<string, number> }>(
        `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${targetSyms}`,
        7000
      ),
      fetchJson<{ rates: Record<string, Record<string, number>> }>(
        `https://api.frankfurter.dev/v1/${start}..${end}?base=USD&symbols=${targetSyms}`,
        8000
      ),
      fetchYahooQuotesBatch(COMMODITIES),
      Promise.all(
        COMMODITIES.map((c) =>
          fetchChartData(c.symbol, '3mo', '1d', false)
            .then((ch) => ({ def: c, chart: ch }))
            .catch(() => null)
        )
      ),
    ]);

    const history: FxHistoryPoint[] = Object.entries(histFx.rates || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => ({
        date,
        rates: { USD: 1, ...rates },
      }));

    const relativeCommodities: RelativeSeriesItem[] = relCharts
      .filter((item): item is { def: SymbolDef; chart: ChartPayload } => item !== null && item.chart.candles.length > 5)
      .map(({ def, chart }) => {
        const closes = chart.candles.map((c) => c.close);
        const norm = normalizeToBase100(closes);
        const totalReturnPct = Number((norm[norm.length - 1] - 100).toFixed(2));
        return {
          symbol: def.symbol,
          name: def.name.replace(' Futures', ''),
          color: COMMODITY_COLORS[def.symbol] || '#2563EB',
          latestPrice: chart.price,
          totalReturnPct,
          points: chart.candles.map((c, idx) => ({
            date: c.date.slice(0, 10),
            value: norm[idx],
          })),
        };
      });

    return {
      base: 'USD',
      date: latestFx.date,
      currencies: FX_CURRENCIES,
      latestRates: { USD: 1, ...(latestFx.rates || {}) },
      history,
      commodities,
      relativeCommodities,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Live News & Central Bank RSS Wire (14 Verified Institutional & Media Feeds)
// ---------------------------------------------------------------------------

const RSS_FEEDS: Array<{ url: string; source: string; category: NewsItem['category'] }> = [
  // Markets & Financial Press
  { url: 'https://www.ft.com/markets?format=rss', source: 'Financial Times', category: 'markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', category: 'markets' },
  {
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
    source: 'CNBC Markets',
    category: 'markets',
  },
  // Economy & Geopolitics
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', source: 'New York Times', category: 'economy' },
  { url: 'https://www.ft.com/world?format=rss', source: 'FT Global', category: 'economy' },
  {
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
    source: 'CNBC Economy',
    category: 'economy',
  },
  // Finance & Corporate
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business', category: 'equities' },
  { url: 'https://www.theguardian.com/uk/business/rss', source: 'The Guardian', category: 'equities' },
  {
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    source: 'CNBC Finance',
    category: 'equities',
  },
  // Central Banks & Supranationals
  { url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', source: 'Federal Reserve', category: 'central_banks' },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'European Central Bank', category: 'central_banks' },
  { url: 'https://www.bankofengland.co.uk/rss/news', source: 'Bank of England', category: 'central_banks' },
  { url: 'https://www.boj.or.jp/en/rss/whatsnew.xml', source: 'Bank of Japan', category: 'central_banks' },
  { url: 'https://www.bis.org/doclist/all_pressrels.rss', source: 'BIS', category: 'central_banks' },
];

export async function fetchAllNews(force = false): Promise<NewsItem[]> {
  return cachedFetch(
    'news:all:v2',
    240_000,
    async () => {
      const lists = await Promise.all(
        RSS_FEEDS.map((feed) =>
          fetchText(feed.url, 7000)
            .then((xml) => parseRssFeed(xml, feed.source, feed.category, 12))
            .catch(() => [] as NewsItem[])
        )
      );
      return mergeAndSortNews(lists, 130);
    },
    force
  );
}

// ---------------------------------------------------------------------------
// Overview & Markets Endpoints
// ---------------------------------------------------------------------------

export async function fetchOverview(force = false): Promise<OverviewPayload> {
  return cachedFetch(
    'overview:main:v2',
    90_000,
    async () => {
      const [indices, sectors, commodities, volatility, macro, fearGreed, headlines] =
        await Promise.all([
          fetchYahooQuotesBatch(GLOBAL_INDICES, force),
          fetchYahooQuotesBatch(US_SECTORS, force),
          fetchYahooQuotesBatch(COMMODITIES, force),
          fetchYahooQuotesBatch(VOLATILITY_DOLLAR, force),
          fetchMacroData().catch(() => null),
          fetchFearGreed(),
          fetchAllNews(force).catch(() => []),
        ]);

      const us10y = macro?.yieldCurve.find((p) => p.maturity === '10Y')?.current ?? null;
      const us2y = macro?.yieldCurve.find((p) => p.maturity === '2Y')?.current ?? null;
      const de10y =
        macro?.sovereignCurves
          .find((c) => c.id === 'DE')
          ?.points.find((p) => p.maturity === '10Y')?.current ?? null;
      const fedFunds = macro?.series.find((s) => s.id === 'FEDFUNDS')?.latest ?? null;
      const cpiYoY = macro?.series.find((s) => s.id === 'CPI_YOY')?.latest ?? null;
      const corePceYoY = macro?.series.find((s) => s.id === 'CORE_PCE_YOY')?.latest ?? null;
      const unemployment = macro?.series.find((s) => s.id === 'UNRATE')?.latest ?? null;
      const hySpread = macro?.series.find((s) => s.id === 'BAMLH0A0HYM2')?.latest ?? null;

      return {
        indices,
        sectors,
        commodities,
        volatility,
        macroSummary: {
          us10y,
          us2y,
          spread10y2y: macro?.spread10y2y ?? null,
          us10yReal: macro?.regimeMetrics.us10yRealYield ?? null,
          usDe10ySpreadBps:
            us10y !== null && de10y !== null ? Math.round((us10y - de10y) * 100) : null,
          fedFunds,
          cpiYoY,
          corePceYoY,
          unemployment,
          hySpread,
          nfci: macro?.regimeMetrics.nfci ?? null,
          asOf: macro?.curveDate || new Date().toISOString().slice(0, 10),
        },
        fearGreed,
        headlines: headlines.slice(0, 14),
        updatedAt: new Date().toISOString(),
      };
    },
    force
  );
}

export async function fetchMarketsByCategory(
  category: string,
  force = false
): Promise<MarketQuote[]> {
  if (category === 'indices') return fetchYahooQuotesBatch([...GLOBAL_INDICES, ...VOLATILITY_DOLLAR], force);
  if (category === 'sectors') return fetchYahooQuotesBatch(US_SECTORS, force);
  if (category === 'commodities') return fetchYahooQuotesBatch(COMMODITIES, force);
  if (category === 'equities') return fetchYahooQuotesBatch(MEGA_CAP_EQUITIES, force);
  if (category === 'crypto') return fetchCryptoQuotes(force);
  if (category === 'factors') {
    return fetchYahooQuotesBatch(
      EQUITY_FACTORS.map((f) => ({ symbol: f.symbol, name: f.name, category: 'factors', region: f.factor })),
      force
    );
  }

  const [equities, indices, sectors, commodities, crypto] = await Promise.all([
    fetchYahooQuotesBatch(MEGA_CAP_EQUITIES, force),
    fetchYahooQuotesBatch(GLOBAL_INDICES, force),
    fetchYahooQuotesBatch(US_SECTORS, force),
    fetchYahooQuotesBatch(COMMODITIES, force),
    fetchCryptoQuotes(force),
  ]);

  return [...equities, ...indices, ...sectors, ...commodities, ...crypto];
}

// ---------------------------------------------------------------------------
// Economic Calendar
// ---------------------------------------------------------------------------

export async function fetchEconomicCalendar(): Promise<CalendarEvent[]> {
  const macro = await fetchMacroData().catch(() => null);
  const cpiLatest = macro?.series.find((s) => s.id === 'CPI_YOY')?.latest;
  const corePceLatest = macro?.series.find((s) => s.id === 'CORE_PCE_YOY')?.latest;
  const unrateLatest = macro?.series.find((s) => s.id === 'UNRATE')?.latest;
  const fedFundsLatest = macro?.series.find((s) => s.id === 'FEDFUNDS')?.latest;
  const ecbRateLatest = macro?.series.find((s) => s.id === 'ECBDFR')?.latest;
  const claimsLatest = macro?.series.find((s) => s.id === 'ICSA')?.latest;

  const baseDate = new Date();
  const addDays = (offset: number) => {
    const d = new Date(baseDate.getTime() + offset * 86400_000);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: 'cal-1',
      date: addDays(1),
      time: '08:30 EST',
      country: 'US',
      category: 'Labor',
      title: 'US Initial Jobless Claims',
      impact: 'Medium',
      previous: claimsLatest ? `${Math.round(claimsLatest)}K` : '218K',
      consensus: claimsLatest ? `${Math.round(claimsLatest + 2)}K` : '220K',
      notes: 'Weekly high-frequency indicator of labor market cooling and layoff velocity.',
    },
    {
      id: 'cal-2',
      date: addDays(2),
      time: '04:00 EST',
      country: 'EU',
      category: 'Growth',
      title: 'Eurozone Flash Composite PMI',
      impact: 'High',
      previous: '50.4',
      consensus: '50.6',
      notes: 'S&P Global forward-looking manufacturing and services activity benchmark across the euro area.',
    },
    {
      id: 'cal-3',
      date: addDays(4),
      time: '08:30 EST',
      country: 'US',
      category: 'Inflation',
      title: 'US Core PCE Price Index (MoM & YoY)',
      impact: 'High',
      previous: corePceLatest ? `${corePceLatest.toFixed(2)}% YoY` : '2.7% YoY',
      consensus: corePceLatest ? `${(corePceLatest - 0.05).toFixed(2)}% YoY` : '2.6% YoY',
      notes: 'Federal Reserve preferred inflation gauge; heavily weighted toward shelter and core services.',
    },
    {
      id: 'cal-4',
      date: addDays(7),
      time: '10:00 EST',
      country: 'US',
      category: 'Growth',
      title: 'ISM Manufacturing PMI',
      impact: 'High',
      previous: '49.1',
      consensus: '49.5',
      notes: 'Readings above 50 indicate industrial expansion; watch New Orders and Prices Paid sub-indices.',
    },
    {
      id: 'cal-5',
      date: addDays(11),
      time: '08:30 EST',
      country: 'US',
      category: 'Labor',
      title: 'US Nonfarm Payrolls & Unemployment Rate',
      impact: 'High',
      previous: unrateLatest ? `${unrateLatest.toFixed(1)}% U-3` : '4.2% U-3',
      consensus: unrateLatest ? `${unrateLatest.toFixed(1)}% U-3` : '4.2% U-3',
      notes: 'Headline BLS employment situation report including average hourly earnings and participation.',
    },
    {
      id: 'cal-6',
      date: addDays(14),
      time: '08:30 EST',
      country: 'US',
      category: 'Inflation',
      title: 'US Consumer Price Index (CPI)',
      impact: 'High',
      previous: cpiLatest ? `${cpiLatest.toFixed(2)}% YoY` : '2.6% YoY',
      consensus: cpiLatest ? `${(cpiLatest - 0.1).toFixed(2)}% YoY` : '2.5% YoY',
      notes: 'Primary market-moving inflation print across Headline and Core (ex-food & energy) baskets.',
    },
    {
      id: 'cal-7',
      date: addDays(17),
      time: '08:15 EST',
      country: 'EU',
      category: 'Central Bank',
      title: 'ECB Monetary Policy Rate Decision & Press Conference',
      impact: 'High',
      previous: ecbRateLatest ? `${ecbRateLatest.toFixed(2)}% Deposit` : '2.50% Deposit',
      consensus: ecbRateLatest ? `${ecbRateLatest.toFixed(2)}% Deposit` : '2.50% Deposit',
      notes: 'Governing Council rate statement and updated Eurosystem macroeconomic staff projections.',
    },
    {
      id: 'cal-8',
      date: addDays(20),
      time: '14:00 EST',
      country: 'US',
      category: 'Central Bank',
      title: 'FOMC Rate Decision & Summary of Economic Projections',
      impact: 'High',
      previous: fedFundsLatest ? `${fedFundsLatest.toFixed(2)}% Eff.` : '4.08% Eff.',
      consensus: fedFundsLatest ? `${fedFundsLatest.toFixed(2)}% Eff.` : '4.00% Eff.',
      notes: 'Federal Open Market Committee statement, updated dot-plot rate path, and Chair press conference.',
    },
    {
      id: 'cal-9',
      date: addDays(22),
      time: '07:00 EST',
      country: 'UK',
      category: 'Central Bank',
      title: 'Bank of England MPC Policy Decision',
      impact: 'High',
      previous: '4.00% Bank Rate',
      consensus: '4.00% Bank Rate',
      notes: 'Monetary Policy Committee vote split and updated UK CPI inflation trajectory.',
    },
    {
      id: 'cal-10',
      date: addDays(24),
      time: '23:00 EST',
      country: 'JP',
      category: 'Central Bank',
      title: 'Bank of Japan Policy Statement & Outlook',
      impact: 'High',
      previous: '0.50% Policy',
      consensus: '0.50% Policy',
      notes: 'Watch JPY carry-trade sensitivity, JGB yield guidance, and Shunto wage momentum commentary.',
    },
    {
      id: 'cal-11',
      date: addDays(27),
      time: '21:00 EST',
      country: 'CN',
      category: 'Growth',
      title: 'China NBS Manufacturing & Non-Manufacturing PMI',
      impact: 'Medium',
      previous: '50.2',
      consensus: '50.3',
      notes: 'Official gauge of domestic industrial demand, credit transmission, and export orders.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Live Multi-Asset Return Correlation Matrix
// ---------------------------------------------------------------------------

export async function computeWatchlistCorrelation(symbols: string[]): Promise<CorrelationPayload> {
  const clean = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))).slice(0, 8);
  if (clean.length < 2) {
    return {
      symbols: clean,
      names: {},
      matrix: clean.map(() => [1]),
      annualizedVol: {},
      periodReturn: {},
      observations: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const charts = await Promise.all(
    clean.map((sym) =>
      fetchChartData(sym, '3mo', '1d', false)
        .then((ch) => ({ sym, ch }))
        .catch(() => null)
    )
  );

  const valid = charts.filter((x): x is { sym: string; ch: ChartPayload } => x !== null && x.ch.candles.length >= 10);
  if (valid.length < 2) {
    return {
      symbols: valid.map((v) => v.sym),
      names: Object.fromEntries(valid.map((v) => [v.sym, v.ch.name])),
      matrix: valid.map(() => valid.map(() => 1)),
      annualizedVol: {},
      periodReturn: {},
      observations: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const dateMaps = valid.map((v) => {
    const m = new Map<string, number>();
    for (const c of v.ch.candles) {
      m.set(c.date.slice(0, 10), c.close);
    }
    return m;
  });

  const allDates = Array.from(dateMaps[0].keys()).sort();
  const commonDates = allDates.filter((d) => dateMaps.every((m) => m.has(d)));

  const returnMap: Record<string, number[]> = {};
  const annualizedVol: Record<string, number> = {};
  const periodReturn: Record<string, number> = {};
  const names: Record<string, string> = {};

  for (let i = 0; i < valid.length; i++) {
    const sym = valid[i].sym;
    names[sym] = valid[i].ch.name;
    const closes =
      commonDates.length >= 10
        ? commonDates.map((d) => dateMaps[i].get(d)!)
        : valid[i].ch.candles.map((c) => c.close);

    const rets = computeReturns(closes);
    returnMap[sym] = rets;
    annualizedVol[sym] = computeAnnualizedVolatility(rets);
    periodReturn[sym] =
      closes.length >= 2 && closes[0] > 0
        ? Number((((closes[closes.length - 1] - closes[0]) / closes[0]) * 100).toFixed(2))
        : 0;
  }

  const syms = valid.map((v) => v.sym);
  const matrix = computeCorrelationMatrix(syms, returnMap);

  return {
    symbols: syms,
    names,
    matrix,
    annualizedVol,
    periodReturn,
    observations: Math.max(0, (commonDates.length >= 10 ? commonDates.length : valid[0].ch.candles.length) - 1),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Live Ongoing Market Debates & Quantitative Data Briefings
// ---------------------------------------------------------------------------

export async function fetchMarketDebates(force = false): Promise<MarketDebatesPayload> {
  return cachedFetch(
    'news:debates:v1',
    600_000,
    async () => {
      const [news, macro, us10yHistory, qqq, rsp, spy, dxy, gold, eem, vix] = await Promise.all([
        fetchAllNews(force),
        fetchMacroData(),
        fetchFredSeries('DGS10', '2022-01-01'),
        fetchChartData('QQQ', '3mo', '1d', false).catch(() => null),
        fetchChartData('RSP', '3mo', '1d', false).catch(() => null),
        fetchChartData('SPY', '3mo', '1d', false).catch(() => null),
        fetchChartData('DX-Y.NYB', '3mo', '1d', false).catch(() => null),
        fetchChartData('GC=F', '3mo', '1d', false).catch(() => null),
        fetchChartData('EEM', '3mo', '1d', false).catch(() => null),
        fetchChartData('^VIX', '5d', '1d', false).catch(() => null),
      ]);

      return buildMarketDebates({
        news,
        macro,
        us10yHistory,
        charts: {
          qqq: qqq?.candles,
          rsp: rsp?.candles,
          spy: spy?.candles,
          dxy: dxy?.candles,
          gold: gold?.candles,
          eem: eem?.candles,
          vixLatest: vix?.price ?? null,
        },
      });
    },
    force
  );
}

