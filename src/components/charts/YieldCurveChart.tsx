import { useState } from 'react';
import type { YieldCurvePoint } from '../../lib/types';

interface YieldCurveChartProps {
  points: YieldCurvePoint[];
}

export function YieldCurveChart({ points }: YieldCurveChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!points || points.length < 2) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
        US Treasury yield curve data unavailable.
      </div>
    );
  }

  const width = 720;
  const height = 270;
  const padTop = 20;
  const padRight = 24;
  const padBottom = 34;
  const padLeft = 46;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allVals = points
    .flatMap((p) => [p.current, p.oneMonthAgo ?? p.current, p.oneYearAgo ?? p.current])
    .filter((v) => v > 0);
  const minVal = Math.max(0, Math.floor((Math.min(...allVals) - 0.35) * 2) / 2);
  const maxVal = Math.ceil((Math.max(...allVals) + 0.35) * 2) / 2;
  const span = maxVal - minVal || 1;

  const xFor = (i: number) => padLeft + (i / (points.length - 1)) * chartW;
  const yFor = (v: number) => padTop + (1 - (v - minVal) / span) * chartH;

  const buildPath = (accessor: (p: YieldCurvePoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(accessor(p)).toFixed(1)}`)
      .join(' ');

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = maxVal - (i / ticks) * span;
    return { val, y: padTop + (i / ticks) * chartH };
  });

  const active = hoverIdx !== null ? points[hoverIdx] : points.find((p) => p.maturity === '10Y') || points[points.length - 1];
  const activeIdx = points.indexOf(active);
  const active1M = active.oneMonthAgo ?? active.current;
  const active1Y = active.oneYearAgo ?? active.current;
  const delta1M = (active.current - active1M) * 100;
  const delta1Y = (active.current - active1Y) * 100;

  return (
    <div className="space-y-3">
      {/* Legend + Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-semibold">
            <span className="inline-block w-3.5 h-0.5 bg-blue-700 dark:bg-blue-400" />
            <span>Current ({active.maturity}: {active.current.toFixed(2)}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="inline-block w-3.5 h-0.5 bg-slate-500 border-t border-dashed" />
            <span>1M Ago ({active1M.toFixed(2)}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="inline-block w-3.5 h-0.5 bg-amber-600/80" />
            <span>1Y Ago ({active1Y.toFixed(2)}%)</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <span>
            1M Δ: <strong className={delta1M >= 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {delta1M >= 0 ? '+' : ''}{delta1M.toFixed(0)} bps
            </strong>
          </span>
          <span>
            1Y Δ: <strong className={delta1Y >= 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {delta1Y >= 0 ? '+' : ''}{delta1Y.toFixed(0)} bps
            </strong>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label="US Treasury yield curve across 1-month to 30-year maturities"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padLeft) / chartW) * (points.length - 1));
          setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
        }}
      >
        {/* Horizontal gridlines */}
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
              {t.val.toFixed(1)}%
            </text>
          </g>
        ))}

        {/* 1Y Ago curve */}
        <path
          d={buildPath((p) => p.oneYearAgo ?? p.current)}
          fill="none"
          stroke="#D97706"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          opacity="0.75"
        />

        {/* 1M Ago curve */}
        <path
          d={buildPath((p) => p.oneMonthAgo ?? p.current)}
          fill="none"
          stroke="#64748B"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          opacity="0.85"
        />

        {/* Current curve */}
        <path
          d={buildPath((p) => p.current)}
          fill="none"
          className="stroke-blue-700 dark:stroke-blue-400"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Active vertical guide */}
        <line
          x1={xFor(activeIdx)}
          x2={xFor(activeIdx)}
          y1={padTop}
          y2={padTop + chartH}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Nodes & Maturity Labels */}
        {points.map((p, i) => {
          const x = xFor(i);
          const isSelected = i === activeIdx;
          return (
            <g key={p.maturity}>
              <circle
                cx={x}
                cy={yFor(p.current)}
                r={isSelected ? 4.5 : 3}
                className={
                  isSelected
                    ? 'fill-blue-700 dark:fill-blue-400 stroke-white dark:stroke-slate-900'
                    : 'fill-white dark:fill-slate-900 stroke-blue-700 dark:stroke-blue-400'
                }
                strokeWidth="1.8"
              />
              <text
                x={x}
                y={height - 10}
                textAnchor="middle"
                className={`font-mono text-[10px] ${
                  isSelected
                    ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                    : 'fill-slate-500 dark:fill-slate-400'
                }`}
              >
                {p.maturity}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
