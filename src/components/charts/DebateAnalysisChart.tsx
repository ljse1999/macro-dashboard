import { useState } from 'react';
import type { DebateChartSpec } from '../../lib/types';

interface DebateAnalysisChartProps {
  chart: DebateChartSpec;
}

export function DebateAnalysisChart({ chart }: DebateAnalysisChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const activeSeries = chart.series.filter((s) => s.points.length >= 2);
  if (activeSeries.length === 0) {
    return (
      <div className="h-[245px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Live series temporarily unavailable.
      </div>
    );
  }

  // Align all series by date intersection or union indexed to primary series dates
  const primary = activeSeries[0];
  const baseDates = primary.points.map((p) => p.date);
  const seriesMaps = activeSeries.map((s) => {
    const m = new Map<string, number>();
    for (const pt of s.points) m.set(pt.date, pt.value);
    return m;
  });

  // Build aligned point arrays along baseDates (carrying forward if minor holiday gap)
  const alignedValues: number[][] = activeSeries.map((s, sIdx) => {
    const m = seriesMaps[sIdx];
    let lastVal = s.points[0].value;
    return baseDates.map((d) => {
      const exact = m.get(d);
      if (exact !== undefined) {
        lastVal = exact;
        return exact;
      }
      return lastVal;
    });
  });

  const n = baseDates.length;
  const width = 640;
  const height = 240;
  const padTop = 16;
  const padBottom = 26;
  const padLeft = 44;
  const padRight = chart.mode === 'dual_axis' ? 44 : 18;
  const cw = width - padLeft - padRight;
  const ch = height - padTop - padBottom;

  const xFor = (i: number) => padLeft + (i / Math.max(1, n - 1)) * cw;

  // Compute Y scale(s)
  const computeRange = (vals: number[], includeRef?: number) => {
    const all = includeRef !== undefined ? [...vals, includeRef] : vals;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const margin = (hi - lo) * 0.14 || 0.5;
    return { min: lo - margin, max: hi + margin };
  };

  let leftRange: { min: number; max: number };
  let rightRange: { min: number; max: number } | null = null;

  if (chart.mode === 'dual_axis' && activeSeries.length >= 2) {
    leftRange = computeRange(alignedValues[0]);
    rightRange = computeRange(alignedValues[1]);
  } else {
    const allVals = alignedValues.flat();
    leftRange = computeRange(allVals, chart.referenceLine);
  }

  const yLeft = (v: number) =>
    padTop + (1 - (v - leftRange.min) / (leftRange.max - leftRange.min || 1)) * ch;
  const yRight = (v: number) => {
    const r = rightRange || leftRange;
    return padTop + (1 - (v - r.min) / (r.max - r.min || 1)) * ch;
  };

  const yForSeries = (sIdx: number, v: number) =>
    chart.mode === 'dual_axis' && activeSeries[sIdx].axis === 'right' ? yRight(v) : yLeft(v);

  const ticks = 4;
  const leftTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = leftRange.max - (i / ticks) * (leftRange.max - leftRange.min);
    return { val, y: padTop + (i / ticks) * ch };
  });
  const rightTicks = rightRange
    ? Array.from({ length: ticks + 1 }, (_, i) => {
        const val = rightRange!.max - (i / ticks) * (rightRange!.max - rightRange!.min);
        return { val, y: padTop + (i / ticks) * ch };
      })
    : [];

  const activeIdx = hoverIdx !== null ? hoverIdx : n - 1;
  const activeDate = baseDates[activeIdx] || '';

  // Optional shaded polygon between series 0 and series 1 (e.g., Real Policy Rate or Breakeven band)
  let wedgePath = '';
  if (chart.fillBetween && activeSeries.length >= 2 && chart.mode !== 'dual_axis') {
    const topPts = alignedValues[0].map((v, i) => `${xFor(i).toFixed(1)},${yLeft(v).toFixed(1)}`);
    const botPts = [...alignedValues[1]]
      .map((v, i) => `${xFor(i).toFixed(1)},${yLeft(v).toFixed(1)}`)
      .reverse();
    wedgePath = `M${topPts.join(' L')} L${botPts.join(' L')} Z`;
  }

  const xLabelIndices = [0, Math.floor(n * 0.33), Math.floor(n * 0.66), n - 1];

  const formatTick = (v: number, unit: string) => {
    if (chart.mode === 'indexed_100') return v.toFixed(0);
    return `${v.toFixed(1)}${unit}`;
  };

  const formatReadout = (v: number, unit: string) => {
    if (chart.mode === 'indexed_100') {
      const diff = v - 100;
      return `${v.toFixed(1)} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)`;
    }
    return `${v.toFixed(2)}${unit}`;
  };

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          {chart.title}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{chart.subtitle}</p>
      </div>

      {/* Synchronized Legend + Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          {activeSeries.map((s, sIdx) => (
            <div key={s.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 shrink-0"
                style={{
                  backgroundColor: s.color,
                  borderTop: s.dashed ? `1.5px dashed ${s.color}` : undefined,
                }}
              />
              <span className="text-slate-600 dark:text-slate-400">{s.label}</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {formatReadout(alignedValues[sIdx][activeIdx], s.unit)}
              </strong>
            </div>
          ))}
        </div>
        <span className="text-slate-400 dark:text-slate-500 shrink-0">
          {activeDate.slice(0, 10)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={chart.title}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padLeft) / cw) * (n - 1));
          setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
        }}
      >
        {/* Horizontal Gridlines & Left Axis */}
        {leftTicks.map((t, i) => (
          <g key={`lt-${i}`}>
            <line
              x1={padLeft}
              x2={padLeft + cw}
              y1={t.y}
              y2={t.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray={i === ticks ? undefined : '2 3'}
            />
            <text
              x={padLeft - 7}
              y={t.y + 3.5}
              textAnchor="end"
              className="font-mono text-[9.5px]"
              fill={chart.mode === 'dual_axis' ? activeSeries[0].color : '#64748B'}
            >
              {formatTick(t.val, activeSeries[0].unit)}
            </text>
          </g>
        ))}

        {/* Right Axis Ticks for dual_axis mode */}
        {chart.mode === 'dual_axis' &&
          rightTicks.map((t, i) => (
            <text
              key={`rt-${i}`}
              x={padLeft + cw + 7}
              y={t.y + 3.5}
              textAnchor="start"
              className="font-mono text-[9.5px]"
              fill={activeSeries[1]?.color || '#64748B'}
            >
              {formatTick(t.val, activeSeries[1]?.unit || '')}
            </text>
          ))}

        {/* Optional Reference Line (e.g. 2.0% Target or Base 100) */}
        {chart.referenceLine !== undefined && chart.mode !== 'dual_axis' && (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + cw}
              y1={yLeft(chart.referenceLine)}
              y2={yLeft(chart.referenceLine)}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            {chart.referenceLabel && (
              <text
                x={padLeft + cw - 3}
                y={yLeft(chart.referenceLine) - 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-[9.5px]"
              >
                {chart.referenceLabel}
              </text>
            )}
          </g>
        )}

        {/* Shaded Spread Wedge */}
        {wedgePath && (
          <path
            d={wedgePath}
            className="fill-blue-700/[0.08] dark:fill-blue-400/[0.12]"
          />
        )}

        {/* Series Lines */}
        {activeSeries.map((s, sIdx) => {
          const d = alignedValues[sIdx]
            .map(
              (v, i) =>
                `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yForSeries(sIdx, v).toFixed(1)}`
            )
            .join(' ');
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeDasharray={s.dashed ? '4 3' : undefined}
              strokeLinejoin="round"
            />
          );
        })}

        {/* Hover Vertical Guide & Points */}
        <line
          x1={xFor(activeIdx)}
          x2={xFor(activeIdx)}
          y1={padTop}
          y2={padTop + ch}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {activeSeries.map((s, sIdx) => (
          <circle
            key={`pt-${s.id}`}
            cx={xFor(activeIdx)}
            cy={yForSeries(sIdx, alignedValues[sIdx][activeIdx])}
            r="3.5"
            fill={s.color}
            className="stroke-white dark:stroke-slate-900"
            strokeWidth="1.5"
          />
        ))}

        {/* X-Axis Dates */}
        {xLabelIndices.map((idx, i) => (
          <text
            key={`xl-${i}`}
            x={xFor(idx)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === xLabelIndices.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[9.5px]"
          >
            {chart.mode === 'indexed_100'
              ? baseDates[idx]?.slice(5, 10)
              : baseDates[idx]?.slice(0, 7)}
          </text>
        ))}
      </svg>

      {/* Analytical Takeaway Line */}
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <strong className="font-semibold text-slate-800 dark:text-slate-200">Data reading: </strong>
        {chart.takeaway}
      </p>
    </div>
  );
}
