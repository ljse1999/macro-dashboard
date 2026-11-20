/**
 * Computes Simple Moving Average (SMA) over a numeric series.
 * Indices prior to (period - 1) return null.
 */
export function computeSMA(values: number[], period: number): (number | null)[] {
  if (period <= 0 || values.length === 0) return [];
  const result: (number | null)[] = new Array(values.length).fill(null);
  let runningSum = 0;

  for (let i = 0; i < values.length; i++) {
    runningSum += values[i];
    if (i >= period) {
      runningSum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = Number((runningSum / period).toFixed(4));
    }
  }
  return result;
}

/**
 * Computes simple period-over-period percentage returns from a price array.
 */
export function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && Number.isFinite(curr)) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

/**
 * Computes annualized volatility (%) from daily simple returns using 252 trading days.
 */
export function computeAnnualizedVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) * (r - mean), 0) /
    (dailyReturns.length - 1);
  return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
}

/**
 * Computes Pearson correlation coefficient between two equal-length series.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return 0;
  const corr = num / denom;
  return Number(Math.max(-1, Math.min(1, corr)).toFixed(3));
}

/**
 * Builds an N x N correlation matrix from aligned return series by symbol.
 */
export function computeCorrelationMatrix(
  symbols: string[],
  returnMap: Record<string, number[]>
): number[][] {
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        const a = returnMap[symbols[i]] || [];
        const b = returnMap[symbols[j]] || [];
        const len = Math.min(a.length, b.length);
        const corr = pearsonCorrelation(a.slice(a.length - len), b.slice(b.length - len));
        matrix[i][j] = corr;
      }
    }
  }
  return matrix;
}

/**
 * Normalizes a price series to Base = 100 at index 0 for multi-asset comparison.
 */
export function normalizeToBase100(values: number[]): number[] {
  if (values.length === 0) return [];
  const base = values[0];
  if (!Number.isFinite(base) || base === 0) return values.map(() => 100);
  return values.map((v) => Number(((v / base) * 100).toFixed(2)));
}

/**
 * Computes FX cross-rate from a base-USD rates map (e.g. USD->EUR and USD->JPY => EUR/JPY).
 */
export function computeCrossRate(
  from: string,
  to: string,
  usdRates: Record<string, number>
): number | null {
  if (from === to) return 1;
  const rateFrom = from === 'USD' ? 1 : usdRates[from];
  const rateTo = to === 'USD' ? 1 : usdRates[to];
  if (!rateFrom || !rateTo || rateFrom <= 0) return null;
  return rateTo / rateFrom;
}

/**
 * Extracts the closing price from the most recent trading day strictly before
 * the latest observation date, ensuring accurate 1D change calculations even
 * when multi-day chart responses omit meta.previousClose.
 */
export function extractPreviousDayClose(
  timestamps: number[],
  closes: Array<number | null>,
  fallback: number
): number {
  const valid: Array<{ date: string; close: number }> = [];
  const len = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < len; i++) {
    const c = closes[i];
    const t = timestamps[i];
    if (typeof c === 'number' && Number.isFinite(c) && typeof t === 'number' && Number.isFinite(t)) {
      valid.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close: c });
    }
  }
  if (valid.length < 2) return fallback;
  const latestDate = valid[valid.length - 1].date;
  for (let i = valid.length - 2; i >= 0; i--) {
    if (valid[i].date !== latestDate) {
      return valid[i].close;
    }
  }
  return valid[0].close;
}

/**
 * Computes percentage return over the trailing N trading observations.
 */
export function computeHorizonReturn(closes: number[], lookbackBars: number): number {
  if (closes.length < 2) return 0;
  const latest = closes[closes.length - 1];
  const refIdx = Math.max(0, closes.length - 1 - lookbackBars);
  const ref = closes[refIdx];
  if (!Number.isFinite(latest) || !Number.isFinite(ref) || ref <= 0) return 0;
  return Number((((latest - ref) / ref) * 100).toFixed(2));
}

/**
 * Computes an aligned daily price ratio series (numerator / denominator) along with
 * 3-month % change, 0..100 range position, and institutional regime signal.
 */
export function computeRatioSeries(
  numSeries: Array<{ date: string; close: number }>,
  denSeries: Array<{ date: string; close: number }>
): {
  currentRatio: number;
  change3mPct: number;
  rangePositionPct: number;
  signal: 'Risk-On' | 'Neutral' | 'Risk-Off';
  points: { date: string; value: number }[];
} {
  const denMap = new Map<string, number>();
  for (const pt of denSeries) {
    if (pt.close > 0) denMap.set(pt.date.slice(0, 10), pt.close);
  }

  const points: { date: string; value: number }[] = [];
  for (const pt of numSeries) {
    const d = pt.date.slice(0, 10);
    const den = denMap.get(d);
    if (den && den > 0 && pt.close > 0) {
      points.push({ date: d, value: Number((pt.close / den).toPrecision(5)) });
    }
  }

  if (points.length < 2) {
    return {
      currentRatio: points[0]?.value ?? 0,
      change3mPct: 0,
      rangePositionPct: 50,
      signal: 'Neutral',
      points,
    };
  }

  const vals = points.map((p) => p.value);
  const first = vals[0];
  const last = vals[vals.length - 1];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const change3mPct = first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : 0;
  const rangePositionPct = max > min ? Math.round(((last - min) / (max - min)) * 100) : 50;

  let signal: 'Risk-On' | 'Neutral' | 'Risk-Off' = 'Neutral';
  if (change3mPct >= 1.2 || rangePositionPct >= 68) {
    signal = 'Risk-On';
  } else if (change3mPct <= -1.2 || rangePositionPct <= 32) {
    signal = 'Risk-Off';
  }

  return {
    currentRatio: last,
    change3mPct,
    rangePositionPct,
    signal,
    points,
  };
}

/**
 * Formatting helpers with strict tabular precision.
 */
export function formatPrice(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 2 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'GBP') return `£${formatted}`;
  if (currency === 'JPY') return `¥${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  return formatted;
}

export function formatIndexValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 2 : 4;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatSignedPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatCompactNumber(value?: number): string {
  if (value === undefined || !Number.isFinite(value) || value === 0) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatRelativeTime(isoDate: string): string {
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
