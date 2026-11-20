import { useMemo } from 'react';
import type { MarketQuote } from '../../lib/types';
import { computeTreemap } from '../../lib/treemap';
import { formatSignedPercent } from '../../lib/analytics';

interface SectorTreemapProps {
  sectors: MarketQuote[];
  onSelectSymbol: (symbol: string) => void;
}

function getHeatColor(pct: number): { bg: string; text: string; border: string } {
  if (pct >= 1.5) return { bg: '#14532D', text: '#F0FDF4', border: '#166534' };
  if (pct >= 0.5) return { bg: '#15803D', text: '#F0FDF4', border: '#16A34A' };
  if (pct > 0.05) return { bg: '#22863A', text: '#F8FAFC', border: '#2EA043' };
  if (pct >= -0.05) return { bg: '#475569', text: '#F8FAFC', border: '#64748B' };
  if (pct > -0.5) return { bg: '#B91C1C', text: '#FEF2F2', border: '#DC2626' };
  if (pct > -1.5) return { bg: '#991B1B', text: '#FEF2F2', border: '#B91C1C' };
  return { bg: '#7F1D1D', text: '#FEF2F2', border: '#991B1B' };
}

export function SectorTreemap({ sectors, onSelectSymbol }: SectorTreemapProps) {
  const tiles = useMemo(() => {
    const items = sectors.map((s) => ({
      id: s.symbol,
      weight: s.weight ?? 5,
      quote: s,
    }));
    return computeTreemap(items, 100, 100);
  }, [sectors]);

  if (tiles.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
        Sector ETF data unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div
        className="relative w-full h-[270px] rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900"
        data-testid="sector-treemap"
      >
        {tiles.map((t) => {
          const { quote } = t.item;
          const colors = getHeatColor(quote.changePercent);
          const isSmall = t.width < 18 || t.height < 22;
          const isTiny = t.width < 13 || t.height < 16;
          return (
            <button
              key={quote.symbol}
              type="button"
              onClick={() => onSelectSymbol(quote.symbol)}
              aria-label={`Inspect ${quote.name} (${quote.symbol}) ${formatSignedPercent(quote.changePercent)}`}
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: `${t.width}%`,
                height: `${t.height}%`,
                backgroundColor: colors.bg,
                color: colors.text,
              }}
              className="absolute p-2 text-left flex flex-col justify-between border border-white/20 dark:border-slate-950/60 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white transition-[filter] duration-150 overflow-hidden cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-mono font-semibold tracking-tight ${isTiny ? 'text-[10px]' : 'text-xs'}`}>
                    {quote.symbol}
                  </span>
                  {!isSmall && quote.weight && (
                    <span className="font-mono text-[10px] opacity-75 tabular-nums">
                      {quote.weight.toFixed(0)}%
                    </span>
                  )}
                </div>
                {!isTiny && (
                  <p className="text-[11px] leading-tight opacity-90 truncate mt-0.5">
                    {quote.name}
                  </p>
                )}
              </div>
              <div className={`font-mono font-semibold tabular-nums ${isSmall ? 'text-[11px]' : 'text-sm'}`}>
                {formatSignedPercent(quote.changePercent)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Diverging scale legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
        <span>Sized by S&amp;P 500 GICS sector weight</span>
        <div className="flex items-center gap-1">
          <span>-1.5%</span>
          <span className="w-3.5 h-2 rounded-xs bg-[#7F1D1D]" />
          <span className="w-3.5 h-2 rounded-xs bg-[#B91C1C]" />
          <span className="w-3.5 h-2 rounded-xs bg-[#475569]" />
          <span className="w-3.5 h-2 rounded-xs bg-[#22863A]" />
          <span className="w-3.5 h-2 rounded-xs bg-[#14532D]" />
          <span>+1.5%</span>
        </div>
      </div>
    </div>
  );
}
