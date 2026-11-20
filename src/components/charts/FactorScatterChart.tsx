import { useState } from 'react';
import type { FactorMetric } from '../../lib/types';
import { formatSignedPercent } from '../../lib/analytics';

interface FactorScatterChartProps {
  factors: FactorMetric[];
  spyReturn3m: number;
  spyVol: number;
  onSelectSymbol: (symbol: string) => void;
}

export function FactorScatterChart({
  factors,
  spyReturn3m,
  spyVol,
  onSelectSymbol,
}: FactorScatterChartProps) {
  const [hovered, setHovered] = useState<FactorMetric | null>(null);

  if (factors.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
        Equity factor analytics unavailable.
      </div>
    );
  }

  const width = 620;
  const height = 310;
  const padTop = 24;
  const padRight = 28;
  const padBottom = 38;
  const padLeft = 52;
  const cw = width - padLeft - padRight;
  const ch = height - padTop - padBottom;

  const vols = [...factors.map((f) => f.annualizedVol), spyVol];
  const rets = [...factors.map((f) => f.return3m), spyReturn3m];

  const minVol = Math.max(4, Math.floor(Math.min(...vols) - 2));
  const maxVol = Math.ceil(Math.max(...vols) + 2.5);
  const minRet = Math.floor(Math.min(...rets) - 2.5);
  const maxRet = Math.ceil(Math.max(...rets) + 2.5);

  const volSpan = maxVol - minVol || 1;
  const retSpan = maxRet - minRet || 1;

  const xFor = (v: number) => padLeft + ((v - minVol) / volSpan) * cw;
  const yFor = (r: number) => padTop + (1 - (r - minRet) / retSpan) * ch;

  const spyX = xFor(spyVol);
  const spyY = yFor(spyReturn3m);

  const yTicks = [minRet, minRet + retSpan * 0.5, maxRet];
  const xTicks = [minVol, minVol + volSpan * 0.5, maxVol];

  return (
    <div className="space-y-2.5">
      {/* Live Hover Callout */}
      <div className="min-h-[20px] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
        {hovered ? (
          <div className="flex flex-wrap items-center gap-3 text-slate-900 dark:text-slate-100">
            <strong>
              {hovered.factor} ({hovered.symbol})
            </strong>
            <span>3M: {formatSignedPercent(hovered.return3m)}</span>
            <span
              className={
                hovered.alpha3mVsSpy >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }
            >
              Alpha vs SPY: {formatSignedPercent(hovered.alpha3mVsSpy)}
            </span>
            <span>Vol: {hovered.annualizedVol.toFixed(1)}%</span>
          </div>
        ) : (
          <span>
            Crosshair anchored at S&amp;P 500 (SPY): {formatSignedPercent(spyReturn3m)} ·{' '}
            {spyVol.toFixed(1)}% vol · Click any factor to inspect
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label="Equity factor risk versus 3-month return scatter plot relative to S&P 500"
      >
        {/* Subtle Quadrant Tinting */}
        <rect
          x={padLeft}
          y={padTop}
          width={Math.max(0, spyX - padLeft)}
          height={Math.max(0, spyY - padTop)}
          className="fill-emerald-500/[0.05] dark:fill-emerald-400/[0.06]"
        />
        <rect
          x={spyX}
          y={spyY}
          width={Math.max(0, padLeft + cw - spyX)}
          height={Math.max(0, padTop + ch - spyY)}
          className="fill-red-500/[0.04] dark:fill-red-400/[0.06]"
        />

        {/* Grid & Axes */}
        {yTicks.map((val, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={padLeft}
              x2={padLeft + cw}
              y1={yFor(val)}
              y2={yFor(val)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={padLeft - 8}
              y={yFor(val) + 3.5}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {val >= 0 ? '+' : ''}
              {val.toFixed(0)}%
            </text>
          </g>
        ))}

        {xTicks.map((val, i) => (
          <g key={`xt-${i}`}>
            <line
              x1={xFor(val)}
              x2={xFor(val)}
              y1={padTop}
              y2={padTop + ch}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={xFor(val)}
              y={height - 16}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {val.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* Axis Titles */}
        <text
          x={padLeft + cw / 2}
          y={height - 3}
          textAnchor="middle"
          className="fill-slate-400 dark:fill-slate-500 text-[10px]"
        >
          Annualized Volatility (3M Realized)
        </text>

        {/* Quadrant Labels */}
        <text
          x={padLeft + 6}
          y={padTop + 12}
          className="fill-emerald-700/80 dark:fill-emerald-400/80 text-[9.5px] font-medium"
        >
          Outperform · Lower Vol
        </text>
        <text
          x={padLeft + cw - 6}
          y={padTop + 12}
          textAnchor="end"
          className="fill-slate-500/80 dark:fill-slate-400/80 text-[9.5px] font-medium"
        >
          High-Beta Leaders
        </text>
        <text
          x={padLeft + cw - 6}
          y={padTop + ch - 6}
          textAnchor="end"
          className="fill-red-700/75 dark:fill-red-400/75 text-[9.5px] font-medium"
        >
          Higher Vol · Lagging
        </text>

        {/* SPY Benchmark Crosshair */}
        <line
          x1={padLeft}
          x2={padLeft + cw}
          y1={spyY}
          y2={spyY}
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <line
          x1={spyX}
          x2={spyX}
          y1={padTop}
          y2={padTop + ch}
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <rect
          x={spyX - 4}
          y={spyY - 4}
          width="8"
          height="8"
          transform={`rotate(45 ${spyX} ${spyY})`}
          className="fill-slate-900 dark:fill-slate-100"
        />
        <text
          x={spyX + 8}
          y={spyY - 6}
          className="fill-slate-700 dark:fill-slate-300 font-mono text-[10px] font-semibold"
        >
          SPY
        </text>

        {/* Factor Points with deterministic collision-aware label offsets */}
        {(() => {
          const shortLabel = (f: FactorMetric) => {
            const map: Record<string, string> = {
              USMV: 'Low Vol',
              SCHD: 'Dividend',
              VTV: 'Lg Value',
              QUAL: 'Quality',
              RSP: 'Eq Weight',
              SIZE: 'Size',
              VUG: 'Lg Growth',
              IWM: 'Small Cap',
              VLUE: 'Value',
              MTUM: 'Momentum',
            };
            return map[f.symbol] || f.symbol;
          };

          const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [
            // Reserve SPY label box so factor labels avoid SPY too
            { x: spyX + 4, y: spyY - 16, w: 30, h: 14 },
          ];

          const candidates = [
            { dx: 0, dy: -10, anchor: 'middle' as const },
            { dx: 0, dy: 16, anchor: 'middle' as const },
            { dx: 9, dy: 3, anchor: 'start' as const },
            { dx: -9, dy: 3, anchor: 'end' as const },
            { dx: 9, dy: -9, anchor: 'start' as const },
            { dx: -9, dy: -9, anchor: 'end' as const },
            { dx: 9, dy: 14, anchor: 'start' as const },
            { dx: -9, dy: 14, anchor: 'end' as const },
          ];

          const plotted = [...factors]
            .sort((a, b) => b.return3m - a.return3m)
            .map((f) => {
              const cx = xFor(f.annualizedVol);
              const cy = yFor(f.return3m);
              const text = shortLabel(f);
              const w = text.length * 6.1 + 4;
              const h = 13;

              let chosen = candidates[0];
              for (const cand of candidates) {
                const lx =
                  cand.anchor === 'middle'
                    ? cx + cand.dx - w / 2
                    : cand.anchor === 'start'
                      ? cx + cand.dx
                      : cx + cand.dx - w;
                const ly = cy + cand.dy - h + 2;

                // Stay inside plot area
                if (lx < padLeft + 2 || lx + w > padLeft + cw - 2 || ly < padTop + 14 || ly + h > padTop + ch - 4) {
                  continue;
                }

                const collides = placedBoxes.some(
                  (b) => lx < b.x + b.w && lx + w > b.x && ly < b.y + b.h && ly + h > b.y
                );
                if (!collides) {
                  chosen = cand;
                  placedBoxes.push({ x: lx, y: ly, w, h });
                  break;
                }
              }

              return { f, cx, cy, text, chosen };
            });

          return plotted.map(({ f, cx, cy, text, chosen }) => {
            const beatsSpy = f.alpha3mVsSpy >= 0;
            const isHov = hovered?.symbol === f.symbol;
            return (
              <g
                key={f.symbol}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(f)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectSymbol(f.symbol)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHov ? 7.5 : 5.2}
                  fill={beatsSpy ? '#15803D' : '#B91C1C'}
                  opacity={hovered && !isHov ? 0.35 : 0.9}
                  className="stroke-white dark:stroke-slate-900 transition-all"
                  strokeWidth="1.5"
                />
                <text
                  x={cx + chosen.dx}
                  y={cy + chosen.dy}
                  textAnchor={chosen.anchor}
                  className={`font-mono text-[9.5px] ${
                    isHov
                      ? 'fill-slate-900 dark:fill-slate-50 font-semibold'
                      : 'fill-slate-700 dark:fill-slate-300'
                  }`}
                >
                  {text}
                </text>
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}
