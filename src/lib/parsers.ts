import type { MacroDataPoint, NewsItem, YieldCurvePoint } from './types.ts';

/**
 * Parses a FRED CSV response (observation_date,VALUE) into clean sorted data points,
 * filtering out FRED's "." missing-observation markers.
 */
export function parseFredCsv(csvText: string): MacroDataPoint[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const points: MacroDataPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const date = line.slice(0, commaIdx).trim();
    const rawVal = line.slice(commaIdx + 1).trim();
    if (!date || !rawVal || rawVal === '.') continue;
    const value = Number(rawVal);
    if (Number.isFinite(value)) {
      points.push({ date, value });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Computes Year-over-Year percentage change from a monthly index series (e.g. CPIAUCSL, PCEPILFE, M2SL).
 */
export function computeYoYFromMonthlyIndex(points: MacroDataPoint[]): MacroDataPoint[] {
  if (points.length < 13) return [];
  const byMonth = new Map<string, number>();
  for (const pt of points) {
    byMonth.set(pt.date.slice(0, 7), pt.value);
  }

  const yoy: MacroDataPoint[] = [];
  for (const pt of points) {
    const year = Number(pt.date.slice(0, 4));
    const month = pt.date.slice(5, 7);
    const prevKey = `${year - 1}-${month}`;
    const prevVal = byMonth.get(prevKey);
    if (prevVal !== undefined && prevVal > 0) {
      const pct = ((pt.value - prevVal) / prevVal) * 100;
      yoy.push({ date: pt.date, value: Number(pct.toFixed(2)) });
    }
  }
  return yoy;
}

/**
 * Parses ECB Statistical Data Portal CSV (YC dataset) into sorted YieldCurvePoint[].
 */
export function parseEcbYieldCurveCsv(csvText: string): { asOf: string; points: YieldCurvePoint[] } {
  if (!csvText) return { asOf: '', points: [] };
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { asOf: '', points: [] };

  const header = lines[0].split(',');
  const typeIdx = header.indexOf('DATA_TYPE_FM');
  const timeIdx = header.indexOf('TIME_PERIOD');
  const valIdx = header.indexOf('OBS_VALUE');
  if (typeIdx === -1 || valIdx === -1) return { asOf: '', points: [] };

  const tenorMonths: Record<string, { label: string; months: number }> = {
    SR_3M: { label: '3M', months: 3 },
    SR_6M: { label: '6M', months: 6 },
    SR_1Y: { label: '1Y', months: 12 },
    SR_2Y: { label: '2Y', months: 24 },
    SR_5Y: { label: '5Y', months: 60 },
    SR_10Y: { label: '10Y', months: 120 },
    SR_20Y: { label: '20Y', months: 240 },
    SR_30Y: { label: '30Y', months: 360 },
  };

  let asOf = '';
  const map = new Map<string, YieldCurvePoint>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const tenorCode = cols[typeIdx]?.trim();
    const def = tenorMonths[tenorCode];
    if (!def) continue;
    const val = Number(cols[valIdx]);
    if (!Number.isFinite(val)) continue;
    if (timeIdx !== -1 && cols[timeIdx]) {
      const d = cols[timeIdx].trim();
      if (d > asOf) asOf = d;
    }
    map.set(def.label, {
      maturity: def.label,
      months: def.months,
      current: Number(val.toFixed(2)),
    });
  }

  const points = Array.from(map.values()).sort((a, b) => a.months - b.months);
  return { asOf, points };
}

/**
 * Parses Deutsche Bundesbank Svensson Bund yield curve CSV (semicolon-delimited, German decimal commas).
 */
export function parseBundesbankCsv(csvText: string): { asOf: string; points: YieldCurvePoint[] } {
  if (!csvText) return { asOf: '', points: [] };
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 3) return { asOf: '', points: [] };

  const headerCols = lines[0].split(';');
  const tenorMap: Array<{ colIdx: number; maturity: string; months: number }> = [];

  const codeToTenor: Record<string, { maturity: string; months: number }> = {
    R01XX: { maturity: '1Y', months: 12 },
    R02XX: { maturity: '2Y', months: 24 },
    R03XX: { maturity: '3Y', months: 36 },
    R05XX: { maturity: '5Y', months: 60 },
    R07XX: { maturity: '7Y', months: 84 },
    R10XX: { maturity: '10Y', months: 120 },
    R20XX: { maturity: '20Y', months: 240 },
    R30XX: { maturity: '30Y', months: 360 },
  };

  headerCols.forEach((col, idx) => {
    if (col.includes('_FLAGS')) return;
    for (const [code, meta] of Object.entries(codeToTenor)) {
      if (col.includes(`.${code}.`)) {
        tenorMap.push({ colIdx: idx, ...meta });
      }
    }
  });

  // Find latest observation row (YYYY-MM-DD;...)
  let latestRow: string[] | null = null;
  let asOf = '';
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(';');
    if (/^\d{4}-\d{2}-\d{2}$/.test(cols[0]?.trim() || '')) {
      const hasNumeric = tenorMap.some((t) => {
        const raw = cols[t.colIdx]?.trim().replace(',', '.');
        return raw !== '' && Number.isFinite(Number(raw));
      });
      if (hasNumeric) {
        latestRow = cols;
        asOf = cols[0].trim();
        break;
      }
    }
  }

  if (!latestRow) return { asOf: '', points: [] };

  const points: YieldCurvePoint[] = [];
  for (const t of tenorMap) {
    const raw = latestRow[t.colIdx]?.trim().replace(',', '.');
    const val = Number(raw);
    if (Number.isFinite(val)) {
      points.push({ maturity: t.maturity, months: t.months, current: Number(val.toFixed(2)) });
    }
  }

  points.sort((a, b) => a.months - b.months);
  return { asOf, points };
}

/**
 * Parses Japan Ministry of Finance (MOF) JGB daily curve CSV (jgbcme.csv).
 */
export function parseMofJgbCsv(csvText: string): { asOf: string; points: YieldCurvePoint[] } {
  if (!csvText) return { asOf: '', points: [] };
  const lines = csvText.trim().split(/\r?\n/);

  const headerIdx = lines.findIndex((l) => l.startsWith('Date,'));
  if (headerIdx === -1) return { asOf: '', points: [] };

  const headers = lines[headerIdx].split(',').map((h) => h.trim());
  const wanted: Record<string, number> = {
    '1Y': 12,
    '2Y': 24,
    '5Y': 60,
    '10Y': 120,
    '20Y': 240,
    '30Y': 360,
  };

  let latestCols: string[] | null = null;
  let asOf = '';

  for (let i = lines.length - 1; i > headerIdx; i--) {
    const cols = lines[i].split(',');
    const d = cols[0]?.trim() || '';
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(d)) {
      const parts = d.split('/');
      asOf = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      latestCols = cols;
      break;
    }
  }

  if (!latestCols) return { asOf: '', points: [] };

  const points: YieldCurvePoint[] = [];
  headers.forEach((h, idx) => {
    if (wanted[h] !== undefined) {
      const val = Number(latestCols![idx]?.trim());
      if (Number.isFinite(val)) {
        points.push({ maturity: h, months: wanted[h], current: Math.round(val * 100) / 100 });
      }
    }
  });

  points.sort((a, b) => a.months - b.months);
  return { asOf, points };
}

/**
 * Parses Bank of Canada Valet API JSON observations for GoC benchmark yields.
 */
export function parseBocValetJson(
  observations: Array<Record<string, unknown>>
): { asOf: string; points: YieldCurvePoint[] } {
  if (!Array.isArray(observations) || observations.length === 0) return { asOf: '', points: [] };

  const sorted = [...observations]
    .filter((o) => typeof o.d === 'string')
    .sort((a, b) => String(a.d).localeCompare(String(b.d)));

  const latest = sorted[sorted.length - 1];
  const prev = sorted.length > 15 ? sorted[0] : sorted[0];
  const asOf = String(latest.d);

  const mapDefs: Array<{ key: string; maturity: string; months: number }> = [
    { key: 'BD.CDN.2YR.DQ.YLD', maturity: '2Y', months: 24 },
    { key: 'BD.CDN.3YR.DQ.YLD', maturity: '3Y', months: 36 },
    { key: 'BD.CDN.5YR.DQ.YLD', maturity: '5Y', months: 60 },
    { key: 'BD.CDN.7YR.DQ.YLD', maturity: '7Y', months: 84 },
    { key: 'BD.CDN.10YR.DQ.YLD', maturity: '10Y', months: 120 },
    { key: 'BD.CDN.LONG.DQ.YLD', maturity: '30Y', months: 360 },
  ];

  const extractVal = (row: Record<string, unknown>, key: string): number | undefined => {
    const obj = row[key] as { v?: string } | undefined;
    const v = Number(obj?.v);
    return Number.isFinite(v) ? Number(v.toFixed(2)) : undefined;
  };

  const points: YieldCurvePoint[] = [];
  for (const def of mapDefs) {
    const curr = extractVal(latest, def.key);
    if (curr !== undefined) {
      points.push({
        maturity: def.maturity,
        months: def.months,
        current: curr,
        oneMonthAgo: extractVal(prev, def.key),
      });
    }
  }
  return { asOf, points };
}

/**
 * Decodes common HTML/XML entities and strips markup tags.
 */
export function decodeXmlText(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/<[^>]+>/g, ' ');

  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&#8211;': '–',
    '&#8212;': '—',
  };

  text = text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    if (entities[match]) return entities[match];
    if (match.startsWith('&#x')) {
      const code = parseInt(match.slice(3, -1), 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    }
    if (match.startsWith('&#')) {
      const code = parseInt(match.slice(2, -1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    }
    return match;
  });

  return text.replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

/**
 * Parses RSS 2.0 and RDF/RSS 1.0 XML (supporting both <pubDate> and <dc:date>) into NewsItem[].
 */
export function parseRssFeed(
  xmlText: string,
  source: string,
  category: NewsItem['category'],
  limit = 15
): NewsItem[] {
  if (!xmlText || typeof xmlText !== 'string') return [];
  const itemMatches = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const items: NewsItem[] = [];

  for (let i = 0; i < Math.min(itemMatches.length, limit); i++) {
    const block = itemMatches[i];
    const title = decodeXmlText(extractTag(block, 'title'));
    const link = decodeXmlText(extractTag(block, 'link'));
    const pubDateRaw =
      decodeXmlText(extractTag(block, 'pubDate')) ||
      decodeXmlText(extractTag(block, 'dc:date')) ||
      decodeXmlText(extractTag(block, 'updated'));
    const descRaw = extractTag(block, 'description');
    const summary = decodeXmlText(descRaw).slice(0, 280);

    if (!title || !link) continue;

    let publishedAt = new Date().toISOString();
    if (pubDateRaw) {
      const parsed = Date.parse(pubDateRaw);
      if (Number.isFinite(parsed)) {
        publishedAt = new Date(parsed).toISOString();
      }
    }

    const id = `${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}-${title.slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
    items.push({
      id,
      title,
      link,
      source,
      category,
      publishedAt,
      summary: summary || `${source} dispatch: ${title}`,
    });
  }

  return items;
}

/**
 * Deduplicates news items by normalized title and sorts newest-first.
 */
export function mergeAndSortNews(lists: NewsItem[][], maxItems = 120): NewsItem[] {
  const seen = new Set<string>();
  const combined: NewsItem[] = [];

  for (const list of lists) {
    for (const item of list) {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 56);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
    }
  }

  combined.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return combined.slice(0, maxItems);
}
