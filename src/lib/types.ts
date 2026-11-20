export type AssetCategory = 'indices' | 'equities' | 'sectors' | 'commodities' | 'crypto' | 'fx' | 'factors';

export interface MarketQuote {
  symbol: string;
  name: string;
  category: AssetCategory;
  region?: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  marketCap?: number;
  currency: string;
  exchange?: string;
  weight?: number;
  sparkline: number[];
  updatedAt: string;
}

export interface CandlePoint {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPayload {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  range: string;
  interval: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  candles: CandlePoint[];
  news: NewsItem[];
  updatedAt: string;
}

export interface SearchQuoteResult {
  symbol: string;
  shortname: string;
  exchange: string;
  quoteType: string;
  sector?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  category: 'markets' | 'economy' | 'central_banks' | 'equities';
  publishedAt: string;
  summary: string;
  symbols?: string[];
}

export interface YieldCurvePoint {
  maturity: string;
  months: number;
  current: number;
  oneMonthAgo?: number;
  oneYearAgo?: number;
}

export interface SovereignCurve {
  id: 'US' | 'DE' | 'EU' | 'JP' | 'CA';
  name: string;
  currency: string;
  source: string;
  color: string;
  asOf: string;
  spread10y2y: number | null;
  points: YieldCurvePoint[];
}

export interface GlobalBondBenchmark {
  country: string;
  code: string;
  currency: string;
  yield10y: number;
  spreadVsUsBps: number | null;
  yield2y: number | null;
  slope2s10sBps: number | null;
  asOf: string;
  source: string;
}

export type MacroPillar = 'inflation' | 'growth' | 'labor' | 'liquidity';

export interface MacroDataPoint {
  date: string;
  value: number;
}

export interface MacroSeries {
  id: string;
  name: string;
  shortName: string;
  pillar: MacroPillar;
  unit: string;
  frequency: string;
  source: string;
  description: string;
  latest: number;
  previous: number;
  change: number;
  targetLine?: number;
  targetLabel?: string;
  points: MacroDataPoint[];
}

export interface WorldEconomyRow {
  code: string;
  name: string;
  region: string;
  gdpGrowth: number | null;
  gdpYear: string;
  inflation: number | null;
  inflationYear: string;
  unemployment: number | null;
  unemploymentYear: string;
}

export interface FearGreedData {
  value: number;
  classification: string;
  updatedAt: string;
  history: { date: string; value: number; classification: string }[];
}

export interface FactorMetric {
  symbol: string;
  name: string;
  factor: string;
  price: number;
  return1d: number;
  return1m: number;
  return3m: number;
  alpha3mVsSpy: number;
  annualizedVol: number;
  sharpeProxy: number;
  sparkline: number[];
}

export interface RegimeRatio {
  id: string;
  name: string;
  pairLabel: string;
  numerator: string;
  denominator: string;
  description: string;
  currentRatio: number;
  change3mPct: number;
  rangePositionPct: number; // 0-100 within 3M low-high
  signal: 'Risk-On' | 'Neutral' | 'Risk-Off';
  points: { date: string; value: number }[];
}

export interface MarketStructurePayload {
  factors: FactorMetric[];
  spyReturn3m: number;
  spyVol: number;
  ratios: RegimeRatio[];
  indices: MarketQuote[];
  sectors: MarketQuote[];
  equities: MarketQuote[];
  commodities: MarketQuote[];
  crypto: MarketQuote[];
  updatedAt: string;
}

export interface OverviewPayload {
  indices: MarketQuote[];
  sectors: MarketQuote[];
  commodities: MarketQuote[];
  volatility: MarketQuote[];
  macroSummary: {
    us10y: number | null;
    us2y: number | null;
    spread10y2y: number | null;
    us10yReal: number | null;
    usDe10ySpreadBps: number | null;
    fedFunds: number | null;
    cpiYoY: number | null;
    corePceYoY: number | null;
    unemployment: number | null;
    hySpread: number | null;
    nfci: number | null;
    asOf: string;
  };
  fearGreed: FearGreedData | null;
  headlines: NewsItem[];
  updatedAt: string;
}

export interface MacroPayload {
  yieldCurve: YieldCurvePoint[];
  sovereignCurves: SovereignCurve[];
  globalBenchmarks: GlobalBondBenchmark[];
  spread10y2y: number | null;
  spread10y3m: number | null;
  curveDate: string;
  regimeMetrics: {
    realPolicyRate: number | null;
    us10yRealYield: number | null;
    nfci: number | null;
    hyIgQualitySpreadBps: number | null;
    fedBalanceSheetTrillions: number | null;
  };
  series: MacroSeries[];
  worldEconomies: WorldEconomyRow[];
  updatedAt: string;
}

export interface FxHistoryPoint {
  date: string;
  rates: Record<string, number>;
}

export interface RelativeSeriesItem {
  symbol: string;
  name: string;
  color: string;
  latestPrice: number;
  totalReturnPct: number;
  points: { date: string; value: number }[];
}

export interface FxCommoditiesPayload {
  base: string;
  date: string;
  currencies: string[];
  latestRates: Record<string, number>;
  history: FxHistoryPoint[];
  commodities: MarketQuote[];
  relativeCommodities: RelativeSeriesItem[];
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  country: 'US' | 'EU' | 'UK' | 'JP' | 'CN' | 'Global';
  category: 'Central Bank' | 'Inflation' | 'Labor' | 'Growth' | 'Sentiment';
  title: string;
  impact: 'High' | 'Medium';
  previous?: string;
  consensus?: string;
  notes: string;
}

export interface CorrelationPayload {
  symbols: string[];
  names: Record<string, string>;
  matrix: number[][];
  annualizedVol: Record<string, number>;
  periodReturn: Record<string, number>;
  observations: number;
  updatedAt: string;
}

export interface DebateKpi {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface DebateSeries {
  id: string;
  label: string;
  color: string;
  unit: string;
  dashed?: boolean;
  axis?: 'left' | 'right';
  points: { date: string; value: number }[];
}

export interface DebateChartSpec {
  mode: 'dual_rate' | 'indexed_100' | 'dual_axis';
  title: string;
  subtitle: string;
  takeaway: string;
  fillBetween?: boolean;
  referenceLine?: number;
  referenceLabel?: string;
  series: DebateSeries[];
}

export interface MarketDebate {
  id: string;
  shortTitle: string;
  title: string;
  question: string;
  regimeTag: string;
  regimeTone: 'positive' | 'negative' | 'neutral';
  summary: string;
  constructiveCase: { label: string; argument: string };
  cautiousCase: { label: string; argument: string };
  kpis: DebateKpi[];
  chart: DebateChartSpec;
  matchedCount: number;
  matchedIds: string[];
  newsPoints: NewsItem[];
}

export interface MarketDebatesPayload {
  debates: MarketDebate[];
  totalWireArticles: number;
  updatedAt: string;
}

