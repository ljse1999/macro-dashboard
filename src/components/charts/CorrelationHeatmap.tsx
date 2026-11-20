import { useState } from 'react';
import type { CorrelationPayload } from '../../lib/types';

interface CorrelationHeatmapProps {
  data: CorrelationPayload;
  onSelectSymbol?: (symbol: string) => void;
}

function getCorrelationCellStyle(val: number, isDiagonal: boolean): { bg: string; text: string } {
  if (isDiagonal) return { bg: 'rgba(100, 116, 139, 0.16)', text: 'inherit' };
  if (val >= 0.75) return { bg: '#1E3A8A', text: '#EFF6FF' };
  if (val >= 0.45) return { bg: '#2563EB', text: '#EFF6FF' };
  if (val >= 0.15) return { bg: 'rgba(37, 99, 235, 0.22)', text: 'inherit' };
  if (val > -0.15) return { bg: 'rgba(148, 163, 184, 0.14)', text: 'inherit' };
  if (val > -0.45) return { bg: 'rgba(217, 119, 6, 0.24)', text: 'inherit' };
  return { bg: '#B45309', text: '#FFFBEB' };
}

export function CorrelationHeatmap({ data, onSelectSymbol }: CorrelationHeatmapProps) {
  const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);

  if (data.symbols.length < 2) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Add at least two symbols to your watchlist to compute a live 3-month return correlation matrix.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Pearson correlation of aligned daily returns ({data.observations} trading sessions)
        </span>
        {hovered && hovered.i !== hovered.j ? (
          <span className="font-mono text-slate-900 dark:text-slate-100 font-medium tabular-nums">
            {data.symbols[hovered.i]} vs {data.symbols[hovered.j]}: r ={' '}
            {data.matrix[hovered.i][hovered.j].toFixed(2)}
          </span>
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span>-1.0</span>
            <span className="w-3 h-2.5 rounded-xs bg-[#B45309]" />
            <span className="w-3 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-700" />
            <span className="w-3 h-2.5 rounded-xs bg-[#2563EB]" />
            <span className="w-3 h-2.5 rounded-xs bg-[#1E3A8A]" />
            <span>+1.0</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs font-mono tabular-nums">
          <thead>
            <tr>
              <th className="p-2 text-left text-slate-500 dark:text-slate-400 font-medium">Asset</th>
              {data.symbols.map((sym) => (
                <th key={sym} className="p-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => onSelectSymbol?.(sym)}
                    className="hover:underline cursor-pointer"
                  >
                    {sym}
                  </button>
                </th>
              ))}
              <th className="p-2 text-right text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                Ann. Vol
              </th>
            </tr>
          </thead>
          <tbody>
            {data.symbols.map((rowSym, i) => (
              <tr key={rowSym} className="border-t border-slate-200/70 dark:border-slate-800/70">
                <td className="p-2 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onSelectSymbol?.(rowSym)}
                    className="hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer"
                  >
                    {rowSym}
                  </button>
                </td>
                {data.symbols.map((colSym, j) => {
                  const val = data.matrix[i]?.[j] ?? 0;
                  const style = getCorrelationCellStyle(val, i === j);
                  return (
                    <td
                      key={`${rowSym}-${colSym}`}
                      onMouseEnter={() => setHovered({ i, j })}
                      onMouseLeave={() => setHovered(null)}
                      style={{ backgroundColor: style.bg, color: style.text }}
                      className="p-2 text-center border border-white/60 dark:border-slate-900/80 transition-opacity"
                    >
                      {i === j ? '1.00' : val.toFixed(2)}
                    </td>
                  );
                })}
                <td className="p-2 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {data.annualizedVol[rowSym] !== undefined
                    ? `${data.annualizedVol[rowSym].toFixed(1)}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
