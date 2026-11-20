import type { RegimeRatio } from '../../lib/types';
import { formatSignedPercent } from '../../lib/analytics';

interface RegimeRatioCardProps {
  ratio: RegimeRatio;
  onInspect: (symbol: string) => void;
}

export function RegimeRatioCard({ ratio, onInspect }: RegimeRatioCardProps) {
  const pts = ratio.points;
  const width = 260;
  const height = 74;
  const pad = 4;

  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const coords = pts.map((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (p.value - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height - pad} L${coords[0].x.toFixed(1)},${height - pad} Z`
      : '';

  const strokeColor =
    ratio.signal === 'Risk-On'
      ? '#15803D'
      : ratio.signal === 'Risk-Off'
        ? '#B91C1C'
        : '#475569';

  const signalTextClass =
    ratio.signal === 'Risk-On'
      ? 'text-emerald-700 dark:text-emerald-400'
      : ratio.signal === 'Risk-Off'
        ? 'text-red-700 dark:text-red-400'
        : 'text-slate-600 dark:text-slate-400';

  return (
    <button
      type="button"
      onClick={() => onInspect(ratio.numerator)}
      className="text-left bg-white dark:bg-[#0F1522] border border-slate-200 dark:border-slate-800 rounded-md p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between gap-3 cursor-pointer"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {ratio.name}
          </span>
          <span className={`font-mono text-[11px] font-semibold whitespace-nowrap ${signalTextClass}`}>
            {ratio.signal}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span>{ratio.pairLabel}</span>
          <span
            className={
              ratio.change3mPct >= 0
                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                : 'text-red-700 dark:text-red-400 font-semibold'
            }
          >
            {formatSignedPercent(ratio.change3mPct)} (3M)
          </span>
        </div>
      </div>

      {/* Spark-Area Ratio Trend */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[68px] block overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`ratio-grad-${ratio.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill={`url(#ratio-grad-${ratio.id})`} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* 3M Range Bar + Description */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
            <span>Ratio {ratio.currentRatio.toFixed(ratio.currentRatio < 1 ? 4 : 2)}</span>
            <span>3M Pos: {ratio.rangePositionPct}%</span>
          </div>
          <div className="relative h-1.5 rounded-xs bg-slate-100 dark:bg-slate-800">
            <div
              className="absolute top-0 bottom-0 w-1.5 rounded-xs"
              style={{
                left: `calc(${Math.max(2, Math.min(96, ratio.rangePositionPct))}% - 3px)`,
                backgroundColor: strokeColor,
              }}
            />
          </div>
        </div>
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
          {ratio.description}
        </p>
      </div>
    </button>
  );
}
