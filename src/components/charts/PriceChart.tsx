import { useMemo, useState } from 'react';
import type { CandlePoint } from '../../lib/types';
import { computeSMA, formatCompactNumber, formatIndexValue } from '../../lib/analytics';

export type ChartMode = 'area' | 'candles';

interface PriceChartProps {
  candles: CandlePoint[];
  currency?: string;
  mode: ChartMode;
  showSma?: boolean;
  height?: number;
  symbol?: string;
}

export function PriceChart({
  candles,
  mode,
  showSma = true,
  height = 310,
  symbol = '',
}: PriceChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 760;
  const padTop = 18;
  const padRight = 64;
  const padBottom = 28;
  const padLeft = 12;
  const volHeight = 46;
  const priceHeight = height - padTop - padBottom - volHeight - 10;
  const chartW = width - padLeft - padRight;

  const { minPrice, maxPrice, maxVol, sma20, isPositive } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 0, maxPrice: 1, maxVol: 1, sma20: [] as (number | null)[], isPositive: true };
    }
    let lo = Infinity;
    let hi = -Infinity;
    let mv = 0;
    for (const c of candles) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
      if (c.volume > mv) mv = c.volume;
    }
    const margin = (hi - lo) * 0.06 || hi * 0.01 || 1;
    const closes = candles.map((c) => c.close);
    const sma = computeSMA(closes, Math.min(20, Math.max(5, Math.floor(closes.length / 4))));
    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    return {
      minPrice: lo - margin,
      maxPrice: hi + margin,
      maxVol: mv || 1,
      sma20: sma,
      isPositive: last >= first,
    };
  }, [candles]);

  if (candles.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md"
        style={{ height }}
      >
        Insufficient price history for this timeframe.
      </div>
    );
  }

  const priceSpan = maxPrice - minPrice || 1;
  const xFor = (i: number) => padLeft + (i / (candles.length - 1)) * chartW;
  const yFor = (p: number) => padTop + (1 - (p - minPrice) / priceSpan) * priceHeight;
  const volBaseY = padTop + priceHeight + 10 + volHeight;

  const linePath = candles
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(c.close).toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L${xFor(candles.length - 1).toFixed(1)},${(padTop + priceHeight).toFixed(1)} L${xFor(0).toFixed(1)},${(padTop + priceHeight).toFixed(1)} Z`;

  const smaPath = sma20
    .map((val, i) => {
      if (val === null) return '';
      const prevNull = i === 0 || sma20[i - 1] === null;
      return `${prevNull ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(val).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');

  const gridTicks = 4;
  const yTicks = Array.from({ length: gridTicks + 1 }, (_, i) => {
    const ratio = i / gridTicks;
    const val = maxPrice - ratio * priceSpan;
    return { val, y: padTop + ratio * priceHeight };
  });

  const xLabelIndices = [
    0,
    Math.floor(candles.length * 0.25),
    Math.floor(candles.length * 0.5),
    Math.floor(candles.length * 0.75),
    candles.length - 1,
  ];

  const activeIdx = hoverIdx !== null ? hoverIdx : candles.length - 1;
  const active = candles[activeIdx];
  const activeSma = sma20[activeIdx];
  const accentColor = isPositive ? '#15803D' : '#B91C1C';
  const gradId = `price-grad-${symbol.replace(/[^a-zA-Z0-9]/g, '')}-${isPositive ? 'up' : 'dn'}`;

  const candleWidth = Math.max(2, Math.min(9, (chartW / candles.length) * 0.62));

  const formatDateShort = (raw: string) => {
    if (raw.includes('T')) {
      const d = new Date(raw);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const d = new Date(raw + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  return (
    <div className="w-full select-none">
      {/* Live OHLCV Crosshair Readout */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-slate-900 dark:text-slate-200 font-medium">
            {formatDateShort(active.date)}
          </span>
          <span>O {formatIndexValue(active.open)}</span>
          <span>H {formatIndexValue(active.high)}</span>
          <span>L {formatIndexValue(active.low)}</span>
          <span className="text-slate-900 dark:text-slate-100 font-semibold">
            C {formatIndexValue(active.close)}
          </span>
          {active.volume > 0 && <span>Vol {formatCompactNumber(active.volume)}</span>}
        </div>
        {showSma && activeSma !== null && (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="inline-block w-3 h-0.5 bg-amber-600 dark:bg-amber-400" />
            <span>SMA {formatIndexValue(activeSma)}</span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`${symbol || 'Asset'} historical price chart`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const clamped = Math.max(padLeft, Math.min(padLeft + chartW, relX));
          const idx = Math.round(((clamped - padLeft) / chartW) * (candles.length - 1));
          setHoverIdx(Math.max(0, Math.min(candles.length - 1, idx)));
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines & right price axis */}
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={t.y}
              y2={t.y}
              className="stroke-slate-200/80 dark:stroke-slate-800/80"
              strokeWidth="1"
              strokeDasharray={idx === gridTicks ? undefined : '2 3'}
            />
            <text
              x={padLeft + chartW + 6}
              y={t.y + 3.5}
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {formatIndexValue(t.val)}
            </text>
          </g>
        ))}

        {/* Volume bars */}
        {candles.map((c, i) => {
          if (c.volume <= 0) return null;
          const vh = (c.volume / maxVol) * volHeight;
          const up = c.close >= c.open;
          return (
            <rect
              key={`v-${i}`}
              x={xFor(i) - candleWidth / 2}
              y={volBaseY - vh}
              width={candleWidth}
              height={Math.max(1, vh)}
              fill={up ? '#15803D' : '#B91C1C'}
              opacity={hoverIdx === i ? 0.65 : 0.22}
            />
          );
        })}

        {/* Area or Candlestick series */}
        {mode === 'area' ? (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </>
        ) : (
          candles.map((c, i) => {
            const x = xFor(i);
            const up = c.close >= c.open;
            const color = up ? '#15803D' : '#B91C1C';
            const bodyTop = yFor(Math.max(c.open, c.close));
            const bodyBottom = yFor(Math.min(c.open, c.close));
            const bodyH = Math.max(1.5, bodyBottom - bodyTop);
            return (
              <g key={`c-${i}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={yFor(c.high)}
                  y2={yFor(c.low)}
                  stroke={color}
                  strokeWidth="1"
                />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyH}
                  fill={color}
                />
              </g>
            );
          })
        )}

        {/* SMA Overlay */}
        {showSma && smaPath && (
          <path
            d={smaPath}
            fill="none"
            stroke="#D97706"
            strokeWidth="1.25"
            strokeDasharray="4 2"
            opacity="0.9"
          />
        )}

        {/* X-Axis Labels */}
        {xLabelIndices.map((idx, i) => (
          <text
            key={`xl-${i}`}
            x={xFor(idx)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === xLabelIndices.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
          >
            {candles[idx].date.includes('T')
              ? new Date(candles[idx].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : candles[idx].date.slice(5)}
          </text>
        ))}

        {/* Interactive Crosshair */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={padTop}
              y2={volBaseY}
              className="stroke-slate-400 dark:stroke-slate-500"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={yFor(active.close)}
              y2={yFor(active.close)}
              className="stroke-slate-400/70 dark:stroke-slate-500/70"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={xFor(hoverIdx)}
              cy={yFor(active.close)}
              r="3.5"
              fill={accentColor}
              className="stroke-white dark:stroke-slate-900"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
