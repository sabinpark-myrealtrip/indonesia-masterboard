'use client';

import { useState, useEffect } from 'react';
import { CITY_COLORS, TOPSELLING_CITIES } from '@/lib/types';
import { TopSellingRow } from '@/lib/types';

const CITY_EMOJI: Record<string, string> = {
  전체: '🇮🇩', 발리: '🏝️',
  교토: '⛩', 미야코지마: '🌊', 이시가키: '🐠', 유후인: '♨️',
};

const EXTRA_COLORS: Record<string, string> = {
  교토: '#9333EA',
  미야코지마: '#0EA5E9',
  이시가키: '#10B981',
  유후인: '#F97316',
};

function getCityColor(city: string): string {
  return (CITY_COLORS as Record<string, string>)[city] ?? EXTRA_COLORS[city] ?? '#6B7280';
}

function fmtKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

export default function TopSelling() {
  const [city, setCity] = useState('전체');
  const [data, setData] = useState<TopSellingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/topselling?city=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [city]);

  const isAll = city === '전체';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800">인도네시아 탑셀링 상품</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            2025년 기준 · {isAll ? '전체 GMV 상위 100개' : `${city} GMV 상위 100개`} · GPID 기준
          </p>
        </div>
        {/* 도시 탭 */}
        <div className="flex gap-1 flex-wrap justify-end">
          {TOPSELLING_CITIES.map(c => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                city === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {CITY_EMOJI[c] ?? '📍'} {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            로딩 중...
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 w-12">순위</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-28">GPID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">호텔명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-24">도시</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">RSV</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">RN</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">GMV</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">CM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-36">도시 내 비중</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const color = getCityColor(row.city);
                return (
                  <tr
                    key={`${row.gpid}-${row.city}-${i}`}
                    className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}
                  >
                    <td className="text-center px-3 py-2.5">
                      <span className={`text-xs font-bold ${row.rank <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank - 1] : row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.gpid}</td>
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <span className="truncate block font-medium text-slate-800" title={row.hotelNm}>
                        {row.hotelNm}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: color }}>
                        {row.city}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 text-slate-700 font-semibold">{row.rsv.toLocaleString()}</td>
                    <td className="text-right px-4 py-2.5 text-slate-600">{row.rn.toLocaleString()}</td>
                    <td className="text-right px-4 py-2.5 font-medium text-slate-800">{fmtKrw(row.gmv)}원</td>
                    <td className="text-right px-4 py-2.5 text-slate-600">{fmtKrw(row.cm)}원</td>
                    <td className="text-right px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.min(row.gmvShare * 10, 100)}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-10 text-right">
                          {row.gmvShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">데이터가 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
