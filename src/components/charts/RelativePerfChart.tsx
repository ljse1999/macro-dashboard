import { useState } from 'react';
import type { RelativeSeriesItem } from '../../lib/types';
import { formatSignedPercent } from '../../lib/analytics';

interface RelativePerfChartProps {
  series: RelativeSeriesItem[];
  onSelectSymbol?: (symbol: string) => void;
}

export function RelativePerfChart({ series, onSelectSymbol }: RelativePerfChartProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-slate-500">
        Relative performance series unavailable.
      </div>
    );
  }

  const width = 720;
  const height = 250;
  const padTop = 16;
  const padRight = 22;
  const padBottom = 26;
  const padLeft = 46;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const minVal = Math.min(95, ...allValues);
  const maxVal = Math.max(105, ...allValues);
  const span = maxVal - minVal || 1;

  const yFor = (v: number) => padTop + (1 - (v - minVal) / span) * chartH;
  const y100 = yFor(100);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = maxVal - (i / ticks) * span;
    return { val, y: padTop + (i / ticks) * chartH };
  });

  const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]);
  const xLabelIndices = [0, Math.floor(longest.points.length * 0.5), longest.points.length - 1];

  return (
    <div className="space-y-3">
      {/* Interactive Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {series.map((s) => {
          const isMuted = focused !== null && focused !== s.symbol;
          const ptIdx =
            hoverRatio !== null
              ? Math.min(s.points.length - 1, Math.round(hoverRatio * (s.points.length - 1)))
              : s.points.length - 1;
          const pct = (s.points[ptIdx]?.value ?? 100) - 100;

          return (
            <button
              key={s.symbol}
              type="button"
              onMouseEnter={() => setFocused(s.symbol)}
              onMouseLeave={() => setFocused(null)}
              onClick={() => onSelectSymbol?.(s.symbol)}
              className={`inline-flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap ${
                isMuted ? 'opacity-35' : 'opacity-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
              <span
                className={`font-mono tabular-nums ${
                  pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                }`}
              >
                {formatSignedPercent(pct)}
              </span>
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label="Normalized 3-month commodities relative performance indexed to 100"
        onMouseLeave={() => setHoverRatio(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const r = Math.max(0, Math.min(1, (relX - padLeft) / chartW));
          setHoverRatio(r);
        }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={t.y}
              y2={t.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={padLeft - 8}
              y={t.y + 3.5}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {t.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Base 100 Reference Line */}
        <line
          x1={padLeft}
          x2={padLeft + chartW}
          y1={y100}
          y2={y100}
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="1.2"
        />

        {series.map((s) => {
          const len = s.points.length;
          if (len < 2) return null;
          const d = s.points
            .map((p, i) => {
              const x = padLeft + (i / (len - 1)) * chartW;
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yFor(p.value).toFixed(1)}`;
            })
            .join(' ');
          const isMuted = focused !== null && focused !== s.symbol;
          return (
            <path
              key={s.symbol}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={focused === s.symbol ? 2.6 : 1.75}
              opacity={isMuted ? 0.2 : 0.95}
              strokeLinejoin="round"
            />
          );
        })}

        {hoverRatio !== null && (
          <line
            x1={padLeft + hoverRatio * chartW}
            x2={padLeft + hoverRatio * chartW}
            y1={padTop}
            y2={padTop + chartH}
            className="stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {xLabelIndices.map((idx, i) => (
          <text
            key={i}
            x={padLeft + (idx / Math.max(1, longest.points.length - 1)) * chartW}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === xLabelIndices.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
          >
            {longest.points[idx]?.date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}
