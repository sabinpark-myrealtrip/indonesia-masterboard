'use client';

import { SummaryMetrics, City, CITIES, CITY_COLORS } from '@/lib/types';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

function StatusBadge({ value, threshold }: { value: number; threshold: number }) {
  const ok = value >= threshold;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {ok ? '양호' : '위험'}
    </span>
  );
}

interface Props {
  summaries: SummaryMetrics[];
  selectedCity: City;
}

export default function ClosingForecast({ summaries, selectedCity }: Props) {
  if (!summaries?.length) return null;

  const displayCities: City[] = selectedCity === '전체'
    ? ['발리']
    : [selectedCity];

  const rows = summaries.filter(s =>
    selectedCity === '전체'
      ? s.city !== '전체'
      : s.city === selectedCity
  );

  // 전체 집계
  const total = summaries.find(s => s.city === '전체') ?? summaries[0];

  return (
    <div className="space-y-6">
      {/* 전체 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 mb-1">전체 예약건수</p>
          <p className="text-2xl font-bold">{total?.rsvCnt.toLocaleString()}건</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 mb-1">전체 확정건수</p>
          <p className="text-2xl font-bold text-emerald-600">{total?.crsvCnt.toLocaleString()}건</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 mb-1">전체 CFR</p>
          <p className={`text-2xl font-bold ${
            (total?.cfr ?? 0) >= 85 ? 'text-emerald-600' :
            (total?.cfr ?? 0) >= 70 ? 'text-amber-500' : 'text-red-500'
          }`}>{total?.cfr.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 mb-1">전체 CGMV</p>
          <p className="text-2xl font-bold">{fmtKrw(total?.cgmv ?? 0)}원</p>
        </div>
      </div>

      {/* 도시별 마감 전망 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">도시별 마감 전망</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">도시</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">예약</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">확정</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CFR</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CGMV</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CM</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CMR</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const color = CITY_COLORS[s.city as City] ?? '#6B7280';
                return (
                  <tr key={s.city} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium">{s.city}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3">{s.rsvCnt.toLocaleString()}</td>
                    <td className="text-right px-4 py-3 text-emerald-600 font-medium">
                      {s.crsvCnt.toLocaleString()}
                    </td>
                    <td className="text-right px-4 py-3">
                      <span className={`font-semibold ${
                        s.cfr >= 85 ? 'text-emerald-600' :
                        s.cfr >= 70 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {s.cfr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right px-4 py-3">{fmtKrw(s.cgmv)}원</td>
                    <td className="text-right px-4 py-3">{fmtKrw(s.cm)}원</td>
                    <td className="text-right px-4 py-3">
                      <span className={s.cmr >= 3 ? 'text-emerald-600' : 'text-red-500'}>
                        {s.cmr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <StatusBadge value={s.cfr} threshold={70} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
