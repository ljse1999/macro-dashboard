interface SparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  positive,
  width = 84,
  height = 26,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className={`inline-flex items-center justify-center text-xs text-slate-400 font-mono ${className}`}
        style={{ width, height }}
      >
        —
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor = positive ? '#15803D' : '#B91C1C';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
    </svg>
  );
}
