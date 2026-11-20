import type {
  CandlePoint,
  DebateKpi,
  MacroDataPoint,
  MacroPayload,
  MarketDebate,
  MarketDebatesPayload,
  NewsItem,
} from './types.ts';
import { computeHorizonReturn, normalizeToBase100 } from './analytics.ts';

export interface DebateInputs {
  news: NewsItem[];
  macro: MacroPayload;
  us10yHistory: MacroDataPoint[];
  charts: {
    qqq?: CandlePoint[];
    rsp?: CandlePoint[];
    spy?: CandlePoint[];
    dxy?: CandlePoint[];
    gold?: CandlePoint[];
    eem?: CandlePoint[];
    vixLatest?: number | null;
  };
}

interface DebateTaxonomy {
  id: string;
  patterns: RegExp[];
  preferredCategories?: NewsItem['category'][];
}

const DEBATE_TAXONOMIES: Record<string, DebateTaxonomy> = {
  'inflation-rates': {
    id: 'inflation-rates',
    preferredCategories: ['central_banks', 'economy'],
    patterns: [
      /\binflation\b/i,
      /\bcpi\b/i,
      /\bpce\b/i,
      /\bfed\b/i,
      /\bfomc\b/i,
      /\bfederal reserve\b/i,
      /\brate cut/i,
      /\brate hike/i,
      /\binterest rate/i,
      /\bcentral bank/i,
      /\bmonetary policy\b/i,
      /\bpowell\b/i,
      /\becb\b/i,
      /\blagarde\b/i,
      /\bbank of england\b/i,
      /\bdisinflation\b/i,
      /\bhawkish\b/i,
      /\bdovish\b/i,
      /\bconsumer price/i,
    ],
  },
  'ai-concentration': {
    id: 'ai-concentration',
    preferredCategories: ['markets', 'equities'],
    patterns: [
      /\bai\b/i,
      /\bartificial intelligence\b/i,
      /\bnvidia\b/i,
      /\bchip/i,
      /\bsemiconductor/i,
      /\bdata center/i,
      /\bcapex\b/i,
      /\btech\b/i,
      /\bsoftware\b/i,
      /\bapple\b/i,
      /\bmicrosoft\b/i,
      /\bgoogle\b/i,
      /\balphabet\b/i,
      /\bamazon\b/i,
      /\bmeta\b/i,
      /\banthropic\b/i,
      /\bopenai\b/i,
      /\bamd\b/i,
      /\bbroadcom\b/i,
      /\bnasdaq\b/i,
      /\bvaluation/i,
      /\bipo\b/i,
      /\bmega.?cap/i,
      /\bs&p 500\b/i,
      /\bstock/i,
      /\bequities\b/i,
    ],
  },
  'sovereign-yields': {
    id: 'sovereign-yields',
    preferredCategories: ['markets', 'economy', 'central_banks'],
    patterns: [
      /\btreasur/i,
      /\bbond/i,
      /\byield/i,
      /\bdebt\b/i,
      /\bdeficit/i,
      /\bfiscal\b/i,
      /\bsovereign\b/i,
      /\bgilt/i,
      /\bbund/i,
      /\bjgb\b/i,
      /\bdebt limit\b/i,
      /\bbudget\b/i,
      /\btax\b/i,
      /\bterm premi/i,
      /\bborrowing\b/i,
      /\bauction\b/i,
    ],
  },
  'credit-growth': {
    id: 'credit-growth',
    preferredCategories: ['economy', 'markets', 'equities'],
    patterns: [
      /\bcredit\b/i,
      /\bloan/i,
      /\blender/i,
      /\bbank\b/i,
      /\bbanking\b/i,
      /\brecession\b/i,
      /\bunemployment\b/i,
      /\bjobs?\b/i,
      /\blabor\b/i,
      /\bpayroll/i,
      /\bconsumer\b/i,
      /\bgdp\b/i,
      /\bearnings\b/i,
      /\bdefault/i,
      /\bspread/i,
      /\bliquidity\b/i,
      /\bfinancial stability\b/i,
      /\beconomy\b/i,
      /\bgrowth\b/i,
      /\bshort seller\b/i,
    ],
  },
  'global-divergence': {
    id: 'global-divergence',
    preferredCategories: ['economy', 'central_banks', 'markets'],
    patterns: [
      /\bchina\b/i,
      /\bjapan\b/i,
      /\byen\b/i,
      /\bboj\b/i,
      /\bbank of japan\b/i,
      /\beurope\b/i,
      /\beuro\b/i,
      /\bdollar\b/i,
      /\bcurrency\b/i,
      /\bfx\b/i,
      /\btariff/i,
      /\btrade\b/i,
      /\bexport/i,
      /\boil\b/i,
      /\benergy\b/i,
      /\bgold\b/i,
      /\bcommodity\b/i,
      /\bgeopolit/i,
      /\bglobal\b/i,
      /\btrump\b/i,
      /\bputin\b/i,
      /\bemerging\b/i,
    ],
  },
};

/**
 * Scores a news item against a debate's keyword taxonomy.
 * Headline matches carry 3x weight; summary matches carry 1x weight.
 */
export function scoreArticleForDebate(item: NewsItem, taxonomy: DebateTaxonomy): number {
  let score = 0;
  for (const re of taxonomy.patterns) {
    if (re.test(item.title)) score += 3;
    else if (re.test(item.summary)) score += 1;
  }
  if (score > 0 && taxonomy.preferredCategories?.includes(item.category)) {
    score += 1;
  }
  return score;
}

/**
 * Matches and ranks news dispatches for a given debate, prioritizing high relevance
 * and publisher diversity for the featured news points.
 */
export function matchNewsForDebate(
  news: NewsItem[],
  debateId: string,
  maxFeatured = 4
): { matchedCount: number; matchedIds: string[]; newsPoints: NewsItem[] } {
  const taxonomy = DEBATE_TAXONOMIES[debateId];
  if (!taxonomy || news.length === 0) {
    return { matchedCount: 0, matchedIds: [], newsPoints: [] };
  }

  const scored = news
    .map((item) => ({ item, score: scoreArticleForDebate(item, taxonomy) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt);
    });

  // Select top featured news points while favoring distinct sources
  const featured: NewsItem[] = [];
  const usedSources = new Set<string>();

  for (const entry of scored) {
    if (featured.length >= maxFeatured) break;
    if (!usedSources.has(entry.item.source)) {
      featured.push(entry.item);
      usedSources.add(entry.item.source);
    }
  }
  // Top up if fewer than maxFeatured unique sources matched
  for (const entry of scored) {
    if (featured.length >= maxFeatured) break;
    if (!featured.some((f) => f.id === entry.item.id)) {
      featured.push(entry.item);
    }
  }

  return {
    matchedCount: scored.length,
    matchedIds: scored.map((s) => s.item.id),
    newsPoints: featured,
  };
}

/**
 * Resamples two time series onto shared YYYY-MM buckets for clean multi-year macro overlays.
 */
export function alignMonthlyMacroSeries(
  seriesA: MacroDataPoint[],
  seriesB: MacroDataPoint[],
  maxMonths = 48
): { a: MacroDataPoint[]; b: MacroDataPoint[] } {
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  for (const pt of seriesA) {
    mapA.set(pt.date.slice(0, 7), pt.value);
  }
  for (const pt of seriesB) {
    mapB.set(pt.date.slice(0, 7), pt.value);
  }

  const common = Array.from(mapA.keys())
    .filter((ym) => mapB.has(ym))
    .sort()
    .slice(-maxMonths);

  return {
    a: common.map((ym) => ({ date: `${ym}-01`, value: Number(mapA.get(ym)!.toFixed(2)) })),
    b: common.map((ym) => ({ date: `${ym}-01`, value: Number(mapB.get(ym)!.toFixed(2)) })),
  };
}

function candlesToIndexed(candles?: CandlePoint[]): { date: string; value: number }[] {
  if (!candles || candles.length < 2) return [];
  const closes = candles.map((c) => c.close);
  const norm = normalizeToBase100(closes);
  return candles.map((c, idx) => ({
    date: c.date.slice(0, 10),
    value: Number(norm[idx].toFixed(2)),
  }));
}

function fmtSigned(n: number | null | undefined, suffix = '%', decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}${suffix}`;
}

function fmtPlain(n: number | null | undefined, suffix = '%', decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}${suffix}`;
}

/**
 * Deterministically builds the 5 live Ongoing Market Debates with matched real news points,
 * quantitative summaries, Bull vs. Bear arguments, KPIs, and visualization specs.
 */
export function buildMarketDebates(input: DebateInputs): MarketDebatesPayload {
  const { news, macro, us10yHistory, charts } = input;
  const findSeries = (id: string) => macro.series.find((s) => s.id === id);

  const fedFunds = findSeries('FEDFUNDS');
  const corePce = findSeries('CORE_PCE_YOY');
  const cpi = findSeries('CPI_YOY');
  const t10yie = findSeries('T10YIE');
  const t5yifr = findSeries('T5YIFR');
  const dfii10 = findSeries('DFII10');
  const hyOas = findSeries('BAMLH0A0HYM2');
  const unrate = findSeries('UNRATE');
  const nfci = findSeries('NFCI');

  const us10yLatest = macro.yieldCurve.find((p) => p.maturity === '10Y')?.current ?? null;
  const de10y = macro.globalBenchmarks.find((b) => b.code === 'DE')?.yield10y ?? null;
  const jp10y = macro.globalBenchmarks.find((b) => b.code === 'JP')?.yield10y ?? null;
  const usDeSpreadBps =
    us10yLatest != null && de10y != null ? Math.round((us10yLatest - de10y) * 100) : null;
  const usJpSpreadBps =
    us10yLatest != null && jp10y != null ? Math.round((us10yLatest - jp10y) * 100) : null;

  const debates: MarketDebate[] = [];

  // -------------------------------------------------------------------------
  // 1. Inflation Persistence vs. Policy Normalization
  // -------------------------------------------------------------------------
  {
    const match = matchNewsForDebate(news, 'inflation-rates');
    const aligned = alignMonthlyMacroSeries(fedFunds?.points || [], corePce?.points || [], 48);
    const realPolicy = macro.regimeMetrics.realPolicyRate;
    const isRestrictive = realPolicy != null && realPolicy >= 1;
    const isAboveTarget = (corePce?.latest ?? 0) > 2.5;

    const kpis: DebateKpi[] = [
      { label: 'Fed Funds', value: fmtPlain(fedFunds?.latest, '%'), tone: 'neutral' },
      {
        label: 'Core PCE YoY',
        value: fmtPlain(corePce?.latest, '%'),
        tone: isAboveTarget ? 'negative' : 'positive',
      },
      {
        label: 'Real Policy Rate',
        value: fmtSigned(realPolicy, '%'),
        tone: isRestrictive ? 'negative' : 'neutral',
      },
      { label: '5Y5Y Fwd Infl.', value: fmtPlain(t5yifr?.latest, '%'), tone: 'neutral' },
    ];

    debates.push({
      id: 'inflation-rates',
      shortTitle: 'Inflation & Rates',
      title: 'Inflation Persistence vs. Central Bank Easing',
      question: 'Are sticky prices forcing policymakers to stay restrictive longer than markets expect?',
      regimeTag: isRestrictive ? 'Restrictive Policy' : isAboveTarget ? 'Sticky Inflation' : 'Disinflating',
      regimeTone: isAboveTarget ? 'negative' : 'positive',
      summary: `Core PCE stands at ${fmtPlain(corePce?.latest, '%')} YoY (Headline CPI ${fmtPlain(cpi?.latest, '%')}) against an Effective Fed Funds rate of ${fmtPlain(fedFunds?.latest, '%')}, leaving the real policy rate at ${fmtSigned(realPolicy, '%')}. Long-run inflation expectations (5Y5Y forward) sit at ${fmtPlain(t5yifr?.latest, '%')}, anchoring the central debate between further rate cuts and a renewed hawkish pause.`,
      constructiveCase: {
        label: 'Disinflation / Dovish View',
        argument: `Market-implied 10Y breakevens (${fmtPlain(t10yie?.latest, '%')}) and 5Y5Y forwards (${fmtPlain(t5yifr?.latest, '%')}) remain contained near central bank targets, giving policymakers room to normalize rates as shelter and wage pressures cool.`,
      },
      cautiousCase: {
        label: 'Sticky Price / Hawkish View',
        argument: `With Core PCE (${fmtPlain(corePce?.latest, '%')}) and Headline CPI (${fmtPlain(cpi?.latest, '%')}) running above the 2.0% mandate, premature easing risks re-accelerating services inflation and unanchoring term expectations.`,
      },
      kpis,
      chart: {
        mode: 'dual_rate',
        title: 'Effective Fed Funds vs. Core PCE Inflation (YoY)',
        subtitle: 'Shaded wedge tracks the real policy rate (Fed Funds minus Core PCE)',
        takeaway:
          realPolicy != null && realPolicy > 0
            ? `Policy rates sit ${realPolicy.toFixed(2)} percentage points above Core PCE — keeping monetary conditions positive in real terms.`
            : `Core PCE sits near or above the policy rate, narrowing central banks' real-rate buffer against price pressures.`,
        fillBetween: true,
        referenceLine: 2.0,
        referenceLabel: 'Fed 2.0% Target',
        series: [
          {
            id: 'fedfunds',
            label: 'Fed Funds',
            color: '#1D4ED8',
            unit: '%',
            points: aligned.a,
          },
          {
            id: 'corepce',
            label: 'Core PCE YoY',
            color: '#B91C1C',
            unit: '%',
            points: aligned.b,
          },
        ],
      },
      ...match,
    });
  }

  // -------------------------------------------------------------------------
  // 2. AI Capex & Mega-Cap Valuation vs. Market Breadth
  // -------------------------------------------------------------------------
  {
    const match = matchNewsForDebate(news, 'ai-concentration');
    const qqqRet = charts.qqq ? computeHorizonReturn(charts.qqq.map((c) => c.close), 63) : null;
    const rspRet = charts.rsp ? computeHorizonReturn(charts.rsp.map((c) => c.close), 63) : null;
    const spyRet = charts.spy ? computeHorizonReturn(charts.spy.map((c) => c.close), 63) : null;
    const breadthSpread = qqqRet != null && rspRet != null ? Number((rspRet - qqqRet).toFixed(2)) : null;
    const broadening = breadthSpread != null && breadthSpread >= 0;

    const kpis: DebateKpi[] = [
      {
        label: 'NASDAQ-100 (3M)',
        value: fmtSigned(qqqRet, '%'),
        tone: qqqRet != null && qqqRet >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Equal-Wt S&P (3M)',
        value: fmtSigned(rspRet, '%'),
        tone: rspRet != null && rspRet >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Breadth (RSP−QQQ)',
        value: fmtSigned(breadthSpread, '%'),
        tone: broadening ? 'positive' : 'neutral',
      },
      {
        label: 'VIX Volatility',
        value: fmtPlain(charts.vixLatest, '', 2),
        tone: charts.vixLatest != null && charts.vixLatest >= 22 ? 'negative' : 'positive',
      },
    ];

    debates.push({
      id: 'ai-concentration',
      shortTitle: 'AI & Breadth',
      title: 'AI Capex Intensity vs. Equity Market Breadth',
      question: 'Will massive AI infrastructure spend sustain mega-cap leadership, or is capital rotating to the broader index?',
      regimeTag: broadening ? 'Broadening Rotation' : 'Mega-Cap Led',
      regimeTone: broadening ? 'positive' : 'neutral',
      summary: `Over the past three months, Equal-Weight S&P 500 (RSP, ${fmtSigned(rspRet, '%')}) has ${broadening ? 'outperformed' : 'trailed'} NASDAQ-100 (QQQ, ${fmtSigned(qqqRet, '%')}) by ${fmtSigned(breadthSpread, 'pp')} while the S&P 500 sits at ${fmtSigned(spyRet, '%')} with VIX at ${fmtPlain(charts.vixLatest, '', 1)}. Investors are weighing hyperscaler capex durability against earnings broadening across cyclical and defensive sectors.`,
      constructiveCase: {
        label: 'AI Productivity / Earnings View',
        argument: `Hyperscaler data-center investment, silicon demand, and enterprise AI monetization continue to expand cash-flow moats while breadth rotation (${fmtSigned(breadthSpread, 'pp')} RSP vs. QQQ) cushions index-level concentration risk.`,
      },
      cautiousCase: {
        label: 'Capex ROI / Multiple Risk View',
        argument: `Elevated implied volatility (VIX ${fmtPlain(charts.vixLatest, '', 1)}) and stretched mega-cap valuations leave market indices vulnerable if AI capital expenditure outpaces near-term enterprise revenue returns.`,
      },
      kpis,
      chart: {
        mode: 'indexed_100',
        title: 'NASDAQ-100 (QQQ) vs. Equal-Weight (RSP) vs. S&P 500 (SPY)',
        subtitle: 'Indexed to 100 at start of 3-month window — divergence reveals concentration vs. breadth',
        takeaway: broadening
          ? `Equal-Weight RSP leads QQQ by ${fmtSigned(breadthSpread, 'pp')} over 3M, signaling investors are rotating away from narrow mega-cap concentration.`
          : `NASDAQ-100 leads Equal-Weight RSP by ${fmtSigned(breadthSpread != null ? -breadthSpread : null, 'pp')} over 3M, confirming mega-cap growth dominance.`,
        referenceLine: 100,
        referenceLabel: 'Base 100',
        series: [
          {
            id: 'qqq',
            label: 'QQQ (Tech / AI)',
            color: '#1D4ED8',
            unit: '',
            points: candlesToIndexed(charts.qqq),
          },
          {
            id: 'rsp',
            label: 'RSP (Equal-Wt)',
            color: '#0F766E',
            unit: '',
            points: candlesToIndexed(charts.rsp),
          },
          {
            id: 'spy',
            label: 'SPY (Cap-Wt)',
            color: '#64748B',
            unit: '',
            dashed: true,
            points: candlesToIndexed(charts.spy),
          },
        ],
      },
      ...match,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Sovereign Debt, Term Premia & Global Bond Yields
  // -------------------------------------------------------------------------
  {
    const match = matchNewsForDebate(news, 'sovereign-yields');
    const aligned = alignMonthlyMacroSeries(us10yHistory, dfii10?.points || [], 36);
    const real10y = macro.regimeMetrics.us10yRealYield;
    const slope2s10s = macro.spread10y2y;
    const impliedBreakeven =
      us10yLatest != null && real10y != null ? Number((us10yLatest - real10y).toFixed(2)) : null;

    const kpis: DebateKpi[] = [
      { label: 'US 10Y Nominal', value: fmtPlain(us10yLatest, '%'), tone: 'neutral' },
      {
        label: 'US 10Y Real (TIPS)',
        value: fmtPlain(real10y, '%'),
        tone: real10y != null && real10y >= 2.25 ? 'negative' : 'neutral',
      },
      {
        label: 'US 2s10s Slope',
        value: slope2s10s != null ? `${slope2s10s >= 0 ? '+' : ''}${slope2s10s}bp` : '—',
        tone: slope2s10s != null && slope2s10s < 0 ? 'negative' : 'positive',
      },
      {
        label: 'US–Germany 10Y',
        value: usDeSpreadBps != null ? `${usDeSpreadBps >= 0 ? '+' : ''}${usDeSpreadBps}bp` : '—',
        tone: 'neutral',
      },
    ];

    debates.push({
      id: 'sovereign-yields',
      shortTitle: 'Bonds & Fiscal',
      title: 'Sovereign Debt Supply, Real Yields & Term Premia',
      question: 'Are elevated long-end bond yields reflecting resilient real growth or fiscal term-premium stress?',
      regimeTag: real10y != null && real10y >= 2.25 ? 'High Real Yields' : 'Normal Curve',
      regimeTone: real10y != null && real10y >= 2.25 ? 'negative' : 'neutral',
      summary: `The US 10-year Treasury yields ${fmtPlain(us10yLatest, '%')}, decomposed into a ${fmtPlain(real10y, '%')} real TIPS yield and ${fmtPlain(impliedBreakeven, '%')} implied inflation breakeven, while trading ${usDeSpreadBps != null ? `${usDeSpreadBps >= 0 ? '+' : ''}${usDeSpreadBps} bps` : '—'} vs. German Bunds. Rising real yields across G7 sovereigns have put fiscal deficits and auction demand back at the center of global asset pricing.`,
      constructiveCase: {
        label: 'Growth & Duration Opportunity View',
        argument: `Positive 10Y real yields (${fmtPlain(real10y, '%')}) and a ${slope2s10s != null && slope2s10s >= 0 ? 'positively sloped' : 're-steepening'} 2s10s curve (${slope2s10s != null ? `${slope2s10s >= 0 ? '+' : ''}${slope2s10s}bp` : '—'}) restore sovereign bonds' hedging power and real income cushion.`,
      },
      cautiousCase: {
        label: 'Fiscal Vigilante / Term Premium View',
        argument: `Persistent Treasury issuance, sovereign debt debates, and elevated real hurdle rates (${fmtPlain(real10y, '%')}) tighten equity valuation ceilings and pressure interest-rate-sensitive sectors globally.`,
      },
      kpis,
      chart: {
        mode: 'dual_rate',
        title: 'US 10Y Nominal Yield vs. US 10Y Real Yield (TIPS)',
        subtitle: 'Shaded band represents 10Y market-implied inflation compensation (Nominal minus Real)',
        takeaway: `Real TIPS yields account for ${fmtPlain(real10y, '%')} of the ${fmtPlain(us10yLatest, '%')} nominal 10Y rate, indicating real discount rates — not runaway breakevens — are driving long-end repricing.`,
        fillBetween: true,
        series: [
          {
            id: 'us10y',
            label: 'US 10Y Nominal',
            color: '#1D4ED8',
            unit: '%',
            points: aligned.a,
          },
          {
            id: 'tips10y',
            label: 'US 10Y Real (TIPS)',
            color: '#D97706',
            unit: '%',
            points: aligned.b,
          },
        ],
      },
      ...match,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Credit Stress & Financial Conditions vs. Soft Landing
  // -------------------------------------------------------------------------
  {
    const match = matchNewsForDebate(news, 'credit-growth');
    const aligned = alignMonthlyMacroSeries(hyOas?.points || [], unrate?.points || [], 48);
    const hyLatest = hyOas?.latest ?? null;
    const unrateLatest = unrate?.latest ?? null;
    const nfciLatest = nfci?.latest ?? null;
    const hyIgBps = macro.regimeMetrics.hyIgQualitySpreadBps;
    const looseConditions = nfciLatest != null && nfciLatest <= 0;

    const kpis: DebateKpi[] = [
      {
        label: 'HY Credit OAS',
        value: fmtPlain(hyLatest, '%'),
        tone: hyLatest != null && hyLatest < 4.0 ? 'positive' : 'negative',
      },
      {
        label: 'HY–IG Spread',
        value: hyIgBps != null ? `${hyIgBps} bps` : '—',
        tone: 'neutral',
      },
      {
        label: 'US Unemployment',
        value: fmtPlain(unrateLatest, '%', 1),
        tone: unrateLatest != null && unrateLatest <= 4.3 ? 'positive' : 'negative',
      },
      {
        label: 'Chicago Fed NFCI',
        value: fmtSigned(nfciLatest, ''),
        tone: looseConditions ? 'positive' : 'negative',
      },
    ];

    debates.push({
      id: 'credit-growth',
      shortTitle: 'Credit & Cycle',
      title: 'Tight Credit Spreads vs. Late-Cycle Labor Cooling',
      question: 'Are corporate bond markets confirming a resilient soft landing or underpricing refinancing and labor risks?',
      regimeTag: looseConditions && (hyLatest ?? 9) < 4 ? 'Benign Credit' : 'Credit Watch',
      regimeTone: looseConditions && (hyLatest ?? 9) < 4 ? 'positive' : 'negative',
      summary: `US High-Yield credit spreads sit at ${fmtPlain(hyLatest, '%')} (a ${hyIgBps != null ? `${hyIgBps} bps` : '—'} quality premium over Investment Grade) while Chicago Fed Financial Conditions read ${fmtSigned(nfciLatest, '')} (${looseConditions ? 'looser' : 'tighter'} than historical average) and unemployment holds at ${fmtPlain(unrateLatest, '%', 1)}.`,
      constructiveCase: {
        label: 'Soft Landing / Balance-Sheet View',
        argument: `Contained high-yield OAS (${fmtPlain(hyLatest, '%')}), ample liquidity (NFCI ${fmtSigned(nfciLatest, '')}), and resilient employment (${fmtPlain(unrateLatest, '%', 1)}) point to strong corporate interest coverage and low near-term default risk.`,
      },
      cautiousCase: {
        label: 'Late-Cycle / Complacency View',
        argument: `Historically compressed credit spreads leave minimal compensation for earnings misses, private-credit refinancing walls, or any abrupt deterioration in payrolls and consumer spending.`,
      },
      kpis,
      chart: {
        mode: 'dual_axis',
        title: 'US High-Yield Credit OAS (Left) vs. Unemployment Rate (Right)',
        subtitle: 'Tracking whether corporate credit risk pricing diverges from labor market trends',
        takeaway: `HY spreads (${fmtPlain(hyLatest, '%')}) remain well below recessionary stress levels (>6%), continuing to align with an orderly ${fmtPlain(unrateLatest, '%', 1)} labor market.`,
        series: [
          {
            id: 'hyoas',
            label: 'HY Credit OAS (%)',
            color: '#B91C1C',
            unit: '%',
            axis: 'left',
            points: aligned.a,
          },
          {
            id: 'unrate',
            label: 'Unemployment (%)',
            color: '#0F766E',
            unit: '%',
            axis: 'right',
            points: aligned.b,
          },
        ],
      },
      ...match,
    });
  }

  // -------------------------------------------------------------------------
  // 5. Global Monetary Divergence, Yen/JGB Repricing & Trade
  // -------------------------------------------------------------------------
  {
    const match = matchNewsForDebate(news, 'global-divergence');
    const dxyRet = charts.dxy ? computeHorizonReturn(charts.dxy.map((c) => c.close), 63) : null;
    const goldRet = charts.gold ? computeHorizonReturn(charts.gold.map((c) => c.close), 63) : null;
    const eemRet = charts.eem ? computeHorizonReturn(charts.eem.map((c) => c.close), 63) : null;
    const dxyLatest = charts.dxy && charts.dxy.length > 0 ? charts.dxy[charts.dxy.length - 1].close : null;

    const kpis: DebateKpi[] = [
      { label: 'US Dollar (DXY)', value: fmtPlain(dxyLatest, '', 2), tone: 'neutral' },
      {
        label: 'Gold (3M)',
        value: fmtSigned(goldRet, '%'),
        tone: goldRet != null && goldRet >= 0 ? 'positive' : 'negative',
      },
      { label: 'Japan 10Y JGB', value: fmtPlain(jp10y, '%'), tone: 'neutral' },
      {
        label: 'US–Japan 10Y',
        value: usJpSpreadBps != null ? `${usJpSpreadBps >= 0 ? '+' : ''}${usJpSpreadBps}bp` : '—',
        tone: 'neutral',
      },
    ];

    debates.push({
      id: 'global-divergence',
      shortTitle: 'FX, JGBs & Trade',
      title: 'Global Policy Divergence, Japan Repricing & Trade Friction',
      question: 'How are diverging Fed, ECB, and Bank of Japan rate paths alongside tariff shifts reshaping global flows?',
      regimeTag: dxyRet != null && dxyRet >= 1 ? 'Dollar Firm' : goldRet != null && goldRet >= 2 ? 'Hard-Asset Bid' : 'Cross-Currents',
      regimeTone: 'neutral',
      summary: `With Japan 10Y JGBs at ${fmtPlain(jp10y, '%')} (${usJpSpreadBps != null ? `${usJpSpreadBps >= 0 ? '+' : ''}${usJpSpreadBps} bps` : '—'} below US Treasuries) and the US Dollar Index at ${fmtPlain(dxyLatest, '', 2)} (${fmtSigned(dxyRet, '%')} over 3M), global allocators are navigating BoJ normalization, tariff headline volatility, and shifting emerging-market (${fmtSigned(eemRet, '%')}) vs. gold (${fmtSigned(goldRet, '%')}) flows.`,
      constructiveCase: {
        label: 'Global Rebalancing View',
        argument: `Higher Japanese yields (${fmtPlain(jp10y, '%')}) signal Japan's exit from decades of deflation, while diversified reserve demand supports hard assets (Gold ${fmtSigned(goldRet, '%')} 3M) and non-US value markets.`,
      },
      cautiousCase: {
        label: 'Carry-Unwind & Trade Friction View',
        argument: `Wide transatlantic and transpacific rate differentials combined with tariff uncertainty can trigger sudden yen carry-trade unwinds, tighter EM dollar liquidity (EEM ${fmtSigned(eemRet, '%')} 3M), and imported inflation shocks.`,
      },
      kpis,
      chart: {
        mode: 'indexed_100',
        title: 'Gold vs. US Dollar Index (DXY) vs. Emerging Markets (EEM)',
        subtitle: 'Indexed to 100 over 3M — tracks global capital rotation, dollar strength & safe-haven hedging',
        takeaway: `Over the trailing 3 months, Gold (${fmtSigned(goldRet, '%')}), DXY (${fmtSigned(dxyRet, '%')}), and Emerging Markets (${fmtSigned(eemRet, '%')}) highlight how FX and geopolitical hedges are pricing policy divergence.`,
        referenceLine: 100,
        referenceLabel: 'Base 100',
        series: [
          {
            id: 'gold',
            label: 'Gold (GC=F)',
            color: '#D97706',
            unit: '',
            points: candlesToIndexed(charts.gold),
          },
          {
            id: 'dxy',
            label: 'US Dollar (DXY)',
            color: '#1D4ED8',
            unit: '',
            points: candlesToIndexed(charts.dxy),
          },
          {
            id: 'eem',
            label: 'EM Equities (EEM)',
            color: '#0F766E',
            unit: '',
            dashed: true,
            points: candlesToIndexed(charts.eem),
          },
        ],
      },
      ...match,
    });
  }

  return {
    debates,
    totalWireArticles: news.length,
    updatedAt: new Date().toISOString(),
  };
}
