'use client';

import { useState } from 'react';
import { SummaryMetrics, City } from '@/lib/types';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

interface Props {
  summaries: SummaryMetrics[];
  city: City;
}

export default function CFRSimulation({ summaries, city }: Props) {
  const [targetCfr, setTargetCfr] = useState<number>(90);

  const rows = summaries.filter(s =>
    city === '전체' ? s.city !== '전체' : s.city === city
  );

  return (
    <div className="space-y-4">
      {/* 목표 CFR 설정 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">CFR 개선 시뮬레이션</h3>
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">목표 CFR</label>
          <input
            type="range"
            min={60}
            max={100}
            step={1}
            value={targetCfr}
            onChange={e => setTargetCfr(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xl font-bold text-blue-600 w-16 text-right">{targetCfr}%</span>
        </div>

        {/* 시뮬레이션 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">도시</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">현재 CFR</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">목표 CFR</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">추가 확정 필요</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">예상 추가 CGMV</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">CGMV 개선 효과</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const targetConfirm = Math.ceil((targetCfr / 100) * s.rsvCnt);
                const additionalConfirm = Math.max(0, targetConfirm - s.crsvCnt);
                const avgCgmvPerConfirm = s.crsvCnt > 0 ? s.cgmv / s.crsvCnt : 0;
                const additionalCgmv = additionalConfirm * avgCgmvPerConfirm;
                const cgmvImprovePct = s.cgmv > 0 ? ((additionalCgmv / s.cgmv) * 100).toFixed(1) : '0';
                const isAlreadyMet = s.cfr >= targetCfr;

                return (
                  <tr key={s.city} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium">{s.city}</td>
                    <td className="text-right px-4 py-3">
                      <span className={`font-semibold ${
                        s.cfr >= 85 ? 'text-emerald-600' :
                        s.cfr >= 70 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {s.cfr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-blue-600 font-semibold">{targetCfr}%</td>
                    <td className="text-right px-4 py-3">
                      {isAlreadyMet ? (
                        <span className="text-emerald-600 text-xs">달성 완료</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">+{additionalConfirm.toLocaleString()}건</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-3">
                      {isAlreadyMet ? '-' : `+${fmtKrw(additionalCgmv)}원`}
                    </td>
                    <td className="text-right px-4 py-3">
                      {isAlreadyMet ? (
                        <span className="text-emerald-600">-</span>
                      ) : (
                        <span className="text-blue-600 font-semibold">+{cgmvImprovePct}%</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주간 CFR 히트맵 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-3">도시별 CFR 목표 달성 현황</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(s => {
            const pct = Math.min((s.cfr / targetCfr) * 100, 100);
            const color = s.cfr >= targetCfr ? '#10b981' : s.cfr >= targetCfr * 0.85 ? '#f59e0b' : '#ef4444';
            return (
              <div key={s.city} className="border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{s.city}</span>
                  <span className="text-sm font-bold" style={{ color }}>{s.cfr.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">목표 {targetCfr}% 대비 {pct.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
