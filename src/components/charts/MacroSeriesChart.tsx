import { useState } from 'react';
import type { MacroSeries } from '../../lib/types';

interface MacroSeriesChartProps {
  series: MacroSeries;
}

export function MacroSeriesChart({ series }: MacroSeriesChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { points } = series;

  if (!points || points.length < 2) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-slate-500">
        No time-series observations available.
      </div>
    );
  }

  const width = 720;
  const height = 240;
  const padTop = 18;
  const padRight = 18;
  const padBottom = 28;
  const padLeft = 46;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const vals = points.map((p) => p.value);
  if (series.targetLine !== undefined) vals.push(series.targetLine);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const margin = (hi - lo) * 0.12 || 0.5;
  const minVal = lo - margin;
  const maxVal = hi + margin;
  const span = maxVal - minVal || 1;

  const xFor = (i: number) => padLeft + (i / (points.length - 1)) * chartW;
  const yFor = (v: number) => padTop + (1 - (v - minVal) / span) * chartH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)},${(padTop + chartH).toFixed(1)} L${xFor(0).toFixed(1)},${(padTop + chartH).toFixed(1)} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = maxVal - (i / ticks) * span;
    return { val, y: padTop + (i / ticks) * chartH };
  });

  const formatVal = (v: number, decimals = 2) => {
    if (series.unit === '$T') return `$${v.toFixed(decimals)}T`;
    if (series.unit === 'K') return `${v.toFixed(0)}K`;
    if (series.unit === 'idx' || series.unit === '') return v.toFixed(decimals);
    return `${v.toFixed(decimals)}${series.unit}`;
  };

  const activeIdx = hoverIdx !== null ? hoverIdx : points.length - 1;
  const active = points[activeIdx];
  const xLabelIndices = [0, Math.floor(points.length * 0.33), Math.floor(points.length * 0.66), points.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
        <div>
          <span className="text-slate-900 dark:text-slate-100 font-semibold">{active.date}</span>
          <span className="mx-2 text-slate-300 dark:text-slate-700">/</span>
          <span className="text-blue-700 dark:text-blue-400 font-semibold">
            {formatVal(active.value, 2)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Min {formatVal(Math.min(...points.map((p) => p.value)), 2)}</span>
          <span>Max {formatVal(Math.max(...points.map((p) => p.value)), 2)}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`${series.name} historical trend`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padLeft) / chartW) * (points.length - 1));
          setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
        }}
      >
        <defs>
          <linearGradient id={`macro-fill-${series.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={t.y}
              y2={t.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray={i === ticks ? undefined : '2 3'}
            />
            <text
              x={padLeft - 8}
              y={t.y + 3.5}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {formatVal(t.val, 1)}
            </text>
          </g>
        ))}

        {/* Optional target reference line */}
        {series.targetLine !== undefined && (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={yFor(series.targetLine)}
              y2={yFor(series.targetLine)}
              stroke="#D97706"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            {series.targetLabel && (
              <text
                x={padLeft + chartW - 4}
                y={yFor(series.targetLine) - 5}
                textAnchor="end"
                className="fill-amber-700 dark:fill-amber-400 font-mono text-[10px]"
              >
                {series.targetLabel}
              </text>
            )}
          </g>
        )}

        <path d={areaPath} fill={`url(#macro-fill-${series.id})`} />
        <path
          d={linePath}
          fill="none"
          className="stroke-blue-700 dark:stroke-blue-400"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {xLabelIndices.map((idx, i) => (
          <text
            key={i}
            x={xFor(idx)}
            y={height - 7}
            textAnchor={i === 0 ? 'start' : i === xLabelIndices.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
          >
            {points[idx].date.slice(0, 7)}
          </text>
        ))}

        {/* Hover cursor */}
        <line
          x1={xFor(activeIdx)}
          x2={xFor(activeIdx)}
          y1={padTop}
          y2={padTop + chartH}
          className="stroke-slate-400/70 dark:stroke-slate-600"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <circle
          cx={xFor(activeIdx)}
          cy={yFor(active.value)}
          r="3.8"
          className="fill-blue-700 dark:fill-blue-400 stroke-white dark:stroke-slate-900"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
