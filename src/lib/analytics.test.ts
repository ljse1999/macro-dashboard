import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFredCsv,
  computeYoYFromMonthlyIndex,
  parseEcbYieldCurveCsv,
  parseBundesbankCsv,
  parseMofJgbCsv,
  parseBocValetJson,
  parseRssFeed,
  mergeAndSortNews,
  decodeXmlText,
} from './parsers';
import {
  computeSMA,
  computeReturns,
  computeAnnualizedVolatility,
  pearsonCorrelation,
  computeCorrelationMatrix,
  normalizeToBase100,
  computeCrossRate,
  extractPreviousDayClose,
  computeHorizonReturn,
  computeRatioSeries,
  formatSignedPercent,
  formatCompactNumber,
} from './analytics';
import { computeTreemap } from './treemap';
import {
  alignMonthlyMacroSeries,
  buildMarketDebates,
  matchNewsForDebate,
} from './debates';

test('parseFredCsv skips missing dots and sorts chronologically', () => {
  const csv = [
    'observation_date,DGS10',
    '2026-01-03,4.52',
    '2026-01-02,.',
    '2026-01-01,4.48',
  ].join('\n');

  const points = parseFredCsv(csv);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { date: '2026-01-01', value: 4.48 });
  assert.deepEqual(points[1], { date: '2026-01-03', value: 4.52 });
});

test('computeYoYFromMonthlyIndex calculates exact 12-month inflation change', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    date: `2025-${String(i + 1).padStart(2, '0')}-01`,
    value: 300 + i,
  }));
  months.push({ date: '2026-01-01', value: 309 });
  const yoy = computeYoYFromMonthlyIndex(months);
  assert.equal(yoy.length, 1);
  assert.equal(yoy[0].date, '2026-01-01');
  assert.equal(yoy[0].value, 3);
});

test('sovereign yield curve parsers decode ECB, Bundesbank, MOF JGB, and Bank of Canada formats', () => {
  const ecbCsv = [
    'KEY,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE',
    'YC.1,SR_10Y,2026-11-18,3.4103',
    'YC.2,SR_2Y,2026-11-18,3.0859',
  ].join('\n');
  const ecb = parseEcbYieldCurveCsv(ecbCsv);
  assert.equal(ecb.asOf, '2026-11-18');
  assert.equal(ecb.points.length, 2);
  assert.equal(ecb.points[0].maturity, '2Y');
  assert.equal(ecb.points[1].current, 3.41);

  const bbkCsv = [
    '"";BBSIS.D.R02XX.A;BBSIS.D.R02XX.A_FLAGS;BBSIS.D.R10XX.A;BBSIS.D.R10XX.A_FLAGS',
    '"";2Y;;10Y;',
    '2026-11-19;3,14;;3,45;',
  ].join('\n');
  const bbk = parseBundesbankCsv(bbkCsv);
  assert.equal(bbk.asOf, '2026-11-19');
  assert.deepEqual(
    bbk.points.map((p) => [p.maturity, p.current]),
    [
      ['2Y', 3.14],
      ['10Y', 3.45],
    ]
  );

  const mofCsv = [
    'Interest Rate (November 2026),,,,',
    'Date,1Y,2Y,5Y,10Y,20Y,30Y',
    '2026/11/2,1.671,1.88,2.243,2.817,3.669,3.94',
    '2026/11/4,1.676,1.891,2.269,2.855,3.693,3.979',
  ].join('\n');
  const mof = parseMofJgbCsv(mofCsv);
  assert.equal(mof.asOf, '2026-11-04');
  assert.equal(mof.points.find((p) => p.maturity === '10Y')?.current, 2.86);

  const boc = parseBocValetJson([
    { d: '2026-10-15', 'BD.CDN.2YR.DQ.YLD': { v: '3.20' }, 'BD.CDN.10YR.DQ.YLD': { v: '3.83' } },
    { d: '2026-11-15', 'BD.CDN.2YR.DQ.YLD': { v: '3.35' }, 'BD.CDN.10YR.DQ.YLD': { v: '3.95' } },
  ]);
  assert.equal(boc.asOf, '2026-11-15');
  assert.equal(boc.points.find((p) => p.maturity === '10Y')?.current, 3.95);
  assert.equal(boc.points.find((p) => p.maturity === '10Y')?.oneMonthAgo, 3.83);
});

test('parseRssFeed supports pubDate, dc:date RDF items, CDATA, and deduplication', () => {
  const xml = `<?xml version="1.0"?>
  <rdf:RDF><item>
    <title><![CDATA[BIS quarterly review &amp; liquidity note]]></title>
    <link>https://bis.org/1</link>
    <dc:date>2026-11-19T14:00:00Z</dc:date>
    <description><![CDATA[<p>Global dollar funding remained orderly.</p>]]></description>
  </item>
  <item>
    <title>Treasury yields ease after CPI report</title>
    <link>https://example.com/2</link>
    <pubDate>Thu, 19 Nov 2026 15:30:00 GMT</pubDate>
    <description>Ten-year note fell 6 bps.</description>
  </item></rdf:RDF>`;

  const parsed = parseRssFeed(xml, 'BIS', 'central_banks');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'BIS quarterly review & liquidity note');
  assert.equal(parsed[0].publishedAt, '2026-11-19T14:00:00.000Z');

  const merged = mergeAndSortNews([parsed, [parsed[0]]]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'Treasury yields ease after CPI report');
  assert.equal(decodeXmlText('A&#8217;s &quot;test&quot;'), `A's "test"`);
});

test('computeSMA, returns, volatility, correlation matrix, and ratio signals work accurately', () => {
  const sma = computeSMA([10, 20, 30, 40, 50], 3);
  assert.deepEqual(sma, [null, null, 20, 30, 40]);

  const returns = computeReturns([100, 110, 99]);
  assert.equal(returns.length, 2);
  assert.ok(computeAnnualizedVolatility(returns) > 0);
  assert.equal(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2]), -1);

  const matrix = computeCorrelationMatrix(['A', 'B'], {
    A: [0.01, -0.02, 0.03, 0.01],
    B: [-0.01, 0.02, -0.03, -0.01],
  });
  assert.equal(matrix[0][1], -1);

  assert.equal(computeHorizonReturn([100, 105, 110, 120], 2), 14.29);

  const ratio = computeRatioSeries(
    [
      { date: '2026-09-01', close: 100 },
      { date: '2026-10-01', close: 104 },
      { date: '2026-11-01', close: 110 },
    ],
    [
      { date: '2026-09-01', close: 100 },
      { date: '2026-10-01', close: 100 },
      { date: '2026-11-01', close: 100 },
    ]
  );
  assert.equal(ratio.currentRatio, 1.1);
  assert.equal(ratio.change3mPct, 10);
  assert.equal(ratio.signal, 'Risk-On');
});

test('normalizeToBase100, computeCrossRate, extractPreviousDayClose, and formatters behave consistently', () => {
  assert.deepEqual(normalizeToBase100([200, 220, 180]), [100, 110, 90]);

  const rates = { EUR: 0.9, JPY: 150, GBP: 0.78 };
  const eurJpy = computeCrossRate('EUR', 'JPY', rates);
  assert.ok(eurJpy !== null && Math.abs(eurJpy - 150 / 0.9) < 1e-6);

  assert.equal(formatSignedPercent(1.234), '+1.23%');
  assert.equal(formatCompactNumber(2_450_000_000), '2.45B');

  const day1a = Math.floor(Date.parse('2026-11-18T14:30:00Z') / 1000);
  const day1b = Math.floor(Date.parse('2026-11-18T20:00:00Z') / 1000);
  const day2a = Math.floor(Date.parse('2026-11-19T14:30:00Z') / 1000);
  assert.equal(extractPreviousDayClose([day1a, day1b, day2a], [152.0, 150.96, 148.5], 166), 150.96);
});

test('computeTreemap tiles the full bounding area without gaps or overlap', () => {
  const rects = computeTreemap(
    [
      { id: 'XLK', weight: 31 },
      { id: 'XLF', weight: 14 },
      { id: 'XLV', weight: 12 },
      { id: 'XLY', weight: 10 },
      { id: 'XLE', weight: 4 },
    ],
    100,
    100
  );
  assert.equal(rects.length, 5);
  const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
  assert.ok(Math.abs(totalArea - 10000) < 0.01);
});

test('market debates engine scores news with source diversity, aligns macro series, and synthesizes all 5 debates', () => {
  const sampleNews = [
    {
      id: 'n1',
      title: 'Federal Reserve officials weigh sticky inflation before next rate cut',
      link: 'https://example.com/1',
      source: 'Financial Times',
      category: 'central_banks' as const,
      publishedAt: '2026-11-19T16:00:00Z',
      summary: 'Core PCE inflation remains above 2% target.',
    },
    {
      id: 'n2',
      title: 'CPI report shows stubborn services inflation across US metro areas',
      link: 'https://example.com/2',
      source: 'New York Times',
      category: 'economy' as const,
      publishedAt: '2026-11-19T15:00:00Z',
      summary: 'FOMC policy path remains in focus.',
    },
    {
      id: 'n3',
      title: 'Nvidia data center AI chip demand surges as hyperscalers boost capex',
      link: 'https://example.com/3',
      source: 'CNBC Markets',
      category: 'markets' as const,
      publishedAt: '2026-11-19T14:00:00Z',
      summary: 'Semiconductor valuations drive NASDAQ volatility.',
    },
    {
      id: 'n4',
      title: 'Treasury 10-year bond yield jumps on sovereign deficit supply concerns',
      link: 'https://example.com/4',
      source: 'MarketWatch',
      category: 'markets' as const,
      publishedAt: '2026-11-19T13:00:00Z',
      summary: 'Gilt and Bund yields also rose.',
    },
  ];

  const inflMatch = matchNewsForDebate(sampleNews, 'inflation-rates');
  assert.equal(inflMatch.matchedCount, 2);
  assert.equal(inflMatch.newsPoints.length, 2);
  assert.equal(new Set(inflMatch.newsPoints.map((n) => n.source)).size, 2);

  const aligned = alignMonthlyMacroSeries(
    [
      { date: '2026-09-15', value: 4.0 },
      { date: '2026-10-15', value: 3.88 },
    ],
    [
      { date: '2026-09-01', value: 2.9 },
      { date: '2026-10-01', value: 3.12 },
    ]
  );
  assert.equal(aligned.a.length, 2);
  assert.equal(aligned.b[1].value, 3.12);

  const payload = buildMarketDebates({
    news: sampleNews,
    macro: {
      yieldCurve: [{ maturity: '10Y', months: 120, current: 5.05 }],
      sovereignCurves: [],
      globalBenchmarks: [
        { country: 'Germany', code: 'DE', currency: 'EUR', yield10y: 3.45, spreadVsUsBps: -160, yield2y: 3.1, slope2s10sBps: 35, asOf: '2026-11-19', source: 'Bundesbank' },
        { country: 'Japan', code: 'JP', currency: 'JPY', yield10y: 2.85, spreadVsUsBps: -220, yield2y: 1.85, slope2s10sBps: 100, asOf: '2026-11-19', source: 'MOF' },
      ],
      spread10y2y: 25,
      spread10y3m: 40,
      curveDate: '2026-11-19',
      regimeMetrics: {
        realPolicyRate: 0.76,
        us10yRealYield: 2.85,
        nfci: -0.45,
        hyIgQualitySpreadBps: 250,
        fedBalanceSheetTrillions: 6.74,
      },
      series: [
        { id: 'FEDFUNDS', name: 'Fed Funds', shortName: 'Fed Funds', pillar: 'liquidity', unit: '%', frequency: 'Monthly', source: 'FRED', description: '', latest: 3.88, previous: 4.0, change: -0.12, points: aligned.a },
        { id: 'CORE_PCE_YOY', name: 'Core PCE', shortName: 'Core PCE', pillar: 'inflation', unit: '%', frequency: 'Monthly', source: 'FRED', description: '', latest: 3.12, previous: 2.9, change: 0.22, points: aligned.b },
        { id: 'BAMLH0A0HYM2', name: 'HY OAS', shortName: 'HY OAS', pillar: 'liquidity', unit: '%', frequency: 'Daily', source: 'FRED', description: '', latest: 3.47, previous: 3.40, change: 0.07, points: aligned.a },
        { id: 'UNRATE', name: 'Unemployment', shortName: 'Unemployment', pillar: 'labor', unit: '%', frequency: 'Monthly', source: 'FRED', description: '', latest: 4.1, previous: 4.1, change: 0, points: aligned.b },
      ],
      worldEconomies: [],
      updatedAt: '2026-11-19T17:00:00Z',
    },
    us10yHistory: aligned.a,
    charts: {
      qqq: [
        { time: 1, date: '2026-08-20', open: 500, high: 505, low: 495, close: 500, volume: 1000 },
        { time: 2, date: '2026-11-19', open: 490, high: 495, low: 485, close: 485, volume: 1000 },
      ],
      rsp: [
        { time: 1, date: '2026-08-20', open: 180, high: 182, low: 179, close: 180, volume: 1000 },
        { time: 2, date: '2026-11-19', open: 185, high: 187, low: 184, close: 186, volume: 1000 },
      ],
      vixLatest: 24.5,
    },
  });

  assert.equal(payload.debates.length, 5);
  assert.equal(payload.debates[0].id, 'inflation-rates');
  assert.equal(payload.debates[0].chart.series.length, 2);
  assert.equal(payload.debates[1].id, 'ai-concentration');
  assert.equal(payload.debates[1].regimeTag, 'Broadening Rotation');
  const credit = payload.debates.find((d) => d.id === 'credit-growth');
  assert.ok(credit && credit.chart.series[0].points.length === 2 && credit.chart.series[1].points.length === 2);
});

