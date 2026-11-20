import { useState } from 'react';
import type { SovereignCurve } from '../../lib/types';

interface SovereignYieldCurvesChartProps {
  curves: SovereignCurve[];
}

const UNIFIED_TENORS = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: '3Y', months: 36 },
  { label: '5Y', months: 60 },
  { label: '7Y', months: 84 },
  { label: '10Y', months: 120 },
  { label: '20Y', months: 240 },
  { label: '30Y', months: 360 },
];

export function SovereignYieldCurvesChart({ curves }: SovereignYieldCurvesChartProps) {
  const [enabledIds, setEnabledIds] = useState<string[]>(['US', 'DE', 'CA', 'JP', 'EU']);
  const [hoverTenorIdx, setHoverTenorIdx] = useState<number | null>(null);

  const visibleCurves = curves.filter((c) => enabledIds.includes(c.id));

  const toggleCurve = (id: string) => {
    setEnabledIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1 active
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  if (curves.length === 0) {
    return (
      <div className="h-[290px] flex items-center justify-center text-sm text-slate-500">
        Sovereign yield curves unavailable.
      </div>
    );
  }

  const width = 740;
  const height = 280;
  const padTop = 20;
  const padRight = 24;
  const padBottom = 34;
  const padLeft = 46;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allVals = visibleCurves.flatMap((c) =>
    c.points.filter((p) => p.months >= 12).map((p) => p.current)
  );
  const minVal = allVals.length ? Math.max(0, Math.floor((Math.min(...allVals) - 0.3) * 2) / 2) : 0;
  const maxVal = allVals.length ? Math.ceil((Math.max(...allVals) + 0.35) * 2) / 2 : 6;
  const span = maxVal - minVal || 1;

  // Use a smooth compressed scale across 1Y..30Y so 1Y-10Y is legible without squashing
  const xPosForMonths = (months: number) => {
    const idx = UNIFIED_TENORS.findIndex((t) => t.months === months);
    if (idx !== -1) {
      return padLeft + (idx / (UNIFIED_TENORS.length - 1)) * chartW;
    }
    // Interpolate between closest tenors
    for (let i = 0; i < UNIFIED_TENORS.length - 1; i++) {
      const a = UNIFIED_TENORS[i];
      const b = UNIFIED_TENORS[i + 1];
      if (months >= a.months && months <= b.months) {
        const t = (months - a.months) / (b.months - a.months);
        return padLeft + ((i + t) / (UNIFIED_TENORS.length - 1)) * chartW;
      }
    }
    return padLeft;
  };

  const yFor = (v: number) => padTop + (1 - (v - minVal) / span) * chartH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = maxVal - (i / ticks) * span;
    return { val, y: padTop + (i / ticks) * chartH };
  });

  const activeTenorIdx = hoverTenorIdx !== null ? hoverTenorIdx : 5; // Default to 10Y
  const activeTenor = UNIFIED_TENORS[activeTenorIdx];

  return (
    <div className="space-y-3.5">
      {/* Sovereign Toggle Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {curves.map((c) => {
            const on = enabledIds.includes(c.id);
            const pt = c.points.find((p) => p.maturity === activeTenor.label);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCurve(c.id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all whitespace-nowrap cursor-pointer ${
                  on
                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium'
                    : 'border-slate-200/70 dark:border-slate-800/70 text-slate-400 dark:text-slate-600 opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: on ? c.color : '#94A3B8' }}
                />
                <span>{c.id}</span>
                {pt && on && (
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {pt.current.toFixed(2)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          Maturity Focus: <strong className="text-slate-900 dark:text-slate-100">{activeTenor.label}</strong>
        </div>
      </div>

      {/* Multi-Sovereign SVG Chart */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label="Global sovereign bond yield curves comparison across US, Germany, Euro Area, Canada, and Japan"
        onMouseLeave={() => setHoverTenorIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padLeft) / chartW) * (UNIFIED_TENORS.length - 1));
          setHoverTenorIdx(Math.max(0, Math.min(UNIFIED_TENORS.length - 1, idx)));
        }}
      >
        {/* Horizontal Gridlines */}
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

        {/* Vertical Hover Guide */}
        <line
          x1={xPosForMonths(activeTenor.months)}
          x2={xPosForMonths(activeTenor.months)}
          y1={padTop}
          y2={padTop + chartH}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Curves */}
        {visibleCurves.map((curve) => {
          const curvePts = curve.points.filter((p) => p.months >= 12);
          if (curvePts.length < 2) return null;
          const path = curvePts
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPosForMonths(p.months).toFixed(1)},${yFor(p.current).toFixed(1)}`)
            .join(' ');
          return (
            <g key={curve.id}>
              <path
                d={path}
                fill="none"
                stroke={curve.color}
                strokeWidth={curve.id === 'US' ? 2.5 : 1.9}
                strokeLinejoin="round"
              />
              {curvePts.map((p) => {
                const isFocus = p.maturity === activeTenor.label;
                return (
                  <circle
                    key={`${curve.id}-${p.maturity}`}
                    cx={xPosForMonths(p.months)}
                    cy={yFor(p.current)}
                    r={isFocus ? 4.2 : 2.6}
                    fill={isFocus ? curve.color : '#FFFFFF'}
                    stroke={curve.color}
                    strokeWidth="1.6"
                  />
                );
              })}
            </g>
          );
        })}

        {/* X-Axis Maturity Labels */}
        {UNIFIED_TENORS.map((t, idx) => (
          <text
            key={t.label}
            x={padLeft + (idx / (UNIFIED_TENORS.length - 1)) * chartW}
            y={height - 10}
            textAnchor="middle"
            className={`font-mono text-[10px] ${
              idx === activeTenorIdx
                ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                : 'fill-slate-500 dark:fill-slate-400'
            }`}
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
