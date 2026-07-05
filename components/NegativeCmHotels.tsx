'use client';

import { useState, useEffect, useCallback } from 'react';
import { City, CITIES, HotelNegativeCmRow } from '@/lib/types';

const CITY_LABELS: Record<City, string> = {
  전체: '전체',
  발리: '발리',
};

const DAY_OPTIONS = [
  { label: '최근 7일', value: 7 },
  { label: '최근 14일', value: 14 },
  { label: '최근 30일', value: 30 },
];

function fmtKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

export default function NegativeCmHotels() {
  const [city, setCity] = useState<City>('전체');
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState<HotelNegativeCmRow[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/negative-cm?city=${encodeURIComponent(city)}&days=${days}`,
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'API error');
      setRows(json.rows ?? []);
      setDateRange({ start: json.startDate, end: json.endDate });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [city, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalNegCm = rows.reduce((s, r) => s + r.cm, 0);
  const uniqueDates = [...new Set(rows.map(r => r.basisDate))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">일별 역마진 호텔</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              CM &lt; 0인 호텔을 날짜별로 집계합니다
              {dateRange && (
                <span className="ml-1 text-slate-500">
                  ({dateRange.start} ~ {dateRange.end})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 기간 선택 */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {DAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    days === opt.value
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* 도시 선택 */}
            <select
              value={city}
              onChange={e => setCity(e.target.value as City)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {CITIES.map(c => (
                <option key={c} value={c}>{CITY_LABELS[c]}</option>
              ))}
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              {loading ? '로딩 중' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        {!loading && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-[11px] text-red-400 font-semibold uppercase tracking-wide">역마진 건수</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">{rows.length.toLocaleString()}건</p>
              <p className="text-[11px] text-red-400 mt-0.5">호텔×일 단위</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-[11px] text-red-400 font-semibold uppercase tracking-wide">총 역마진 CM</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">{fmtKrw(totalNegCm)}원</p>
              <p className="text-[11px] text-red-400 mt-0.5">확정 기준</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">영향 날짜 수</p>
              <p className="text-xl font-bold text-slate-700 mt-0.5">{uniqueDates.length}일</p>
              <p className="text-[11px] text-slate-400 mt-0.5">역마진 발생일</p>
            </div>
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-slate-400">해당 기간 역마진 호텔이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-28">날짜</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-24">GID</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">호텔명</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-20">도시</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-semibold w-16">확정예약</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-semibold w-28">CGMV</th>
                  <th className="text-right px-4 py-2.5 text-red-500 font-semibold w-28">CM</th>
                  <th className="text-right px-4 py-2.5 text-red-500 font-semibold w-20">CMR</th>
                </tr>
              </thead>
              <tbody>
                {uniqueDates.map(date => {
                  const dateRows = rows.filter(r => r.basisDate === date);
                  const dateCm = dateRows.reduce((s, r) => s + r.cm, 0);
                  return (
                    <>
                      {/* 날짜 구분 행 */}
                      <tr key={`header-${date}`} className="bg-slate-50/80 border-t border-b border-slate-100">
                        <td colSpan={6} className="px-4 py-1.5 text-[11px] font-bold text-slate-600">
                          {date}
                          <span className="ml-2 text-slate-400 font-normal">({dateRows.length}개 호텔)</span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-[11px] font-bold text-red-600">
                          {fmtKrw(dateCm)}원
                        </td>
                        <td className="px-4 py-1.5" />
                      </tr>
                      {/* 호텔 행 */}
                      {dateRows.map((r, i) => (
                        <tr
                          key={`${date}-${r.gpid}-${i}`}
                          className="border-b border-slate-50 hover:bg-red-50/40 transition-colors"
                        >
                          <td className="px-4 py-2 text-slate-300">—</td>
                          <td className="px-4 py-2 text-slate-400 font-mono text-[11px]">{r.gpid}</td>
                          <td className="px-4 py-2 text-slate-700 font-medium">{r.hotelNm}</td>
                          <td className="px-4 py-2 text-slate-500">{r.city}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{r.crsvCnt.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmtKrw(r.cgmv)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-red-600">
                            {fmtKrw(r.cm)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                              {fmtPct(r.cmr)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
