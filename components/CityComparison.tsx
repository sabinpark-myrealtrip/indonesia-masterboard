'use client';

import { SummaryMetrics, City, CITY_COLORS } from '@/lib/types';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

interface Props {
  summaries: SummaryMetrics[];
}

export default function CityComparison({ summaries }: Props) {
  if (!summaries?.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">도시별 비교</h2>
        <p className="text-xs text-slate-400 mt-0.5">도시별 주요 지표 현황</p>
      </div>
      <div className="grid divide-x divide-slate-100" style={{ gridTemplateColumns: `repeat(${summaries.length}, 1fr)` }}>
        {summaries.map(s => {
          const color = CITY_COLORS[s.city as City] ?? '#6B7280';
          const cfrColor =
            s.cfr >= 85 ? '#059669' :
            s.cfr >= 70 ? '#D97706' : '#DC2626';
          const achievePct = s.targetCgmv
            ? ((s.cgmv / s.targetCgmv) * 100).toFixed(0)
            : null;

          return (
            <div key={s.city} className="p-4">
              {/* 도시 헤더 */}
              <div
                className="text-sm font-bold mb-4 pb-2.5 border-b-2 flex items-center justify-between"
                style={{ color, borderColor: color }}
              >
                <span>{s.city}</span>
                {achievePct && (
                  <span className="text-xs font-normal text-slate-400">{achievePct}%</span>
                )}
              </div>

              {/* 지표 목록 */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">GMV</p>
                  <p className="text-sm font-bold text-slate-800">{fmtKrw(s.gmv)}원</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">CM</p>
                  <p className="text-sm font-bold text-slate-800">{fmtKrw(s.cm)}원</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">CMR</p>
                  <p className={`text-sm font-bold ${s.cmr >= 3 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.cmr.toFixed(1)}%
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">CFR</p>
                  <p className="text-sm font-bold" style={{ color: cfrColor }}>{s.cfr.toFixed(1)}%</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">상세 UV</p>
                  <p className="text-sm font-bold text-slate-800">{s.detailUv.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
