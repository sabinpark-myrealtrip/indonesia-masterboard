'use client';

import { useState } from 'react';
import { HotelRow, City, CITY_COLORS } from '@/lib/types';

type SortKey = 'gmv' | 'cgmv' | 'cm' | 'cfr' | 'cmr' | 'rsvCnt' | 'uv';
type CategoryTab = '전체 카테고리' | '호텔' | '민박';

const MINBAK_CATEGORIES = new Set(['KOREAN_MINBAK', 'LOCAL_ACCOMMODATION_V2']);
// 호텔: LODGING_V2, LODGE_V2 등 나머지 / 민박: KOREAN_MINBAK, LOCAL_ACCOMMODATION_V2

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

interface Props {
  hotels: HotelRow[];
  city: City;
}

export default function HotelRanking({ hotels, city }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('gmv');
  const [riskOnly, setRiskOnly] = useState(false);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('전체 카테고리');

  let filtered = hotels;
  if (categoryTab === '호텔') filtered = filtered.filter(h => !MINBAK_CATEGORIES.has(h.category ?? ''));
  if (categoryTab === '민박') filtered = filtered.filter(h => MINBAK_CATEGORIES.has(h.category ?? ''));
  if (riskOnly) filtered = filtered.filter(h => h.cfr < 70);

  const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);
  const display = sorted.slice(0, 50);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'gmv', label: 'GMV' },
    { key: 'cgmv', label: 'CGMV' },
    { key: 'cm', label: 'CM' },
    { key: 'cmr', label: 'CMR' },
    { key: 'cfr', label: 'CFR' },
    { key: 'rsvCnt', label: '예약건수' },
    { key: 'uv', label: 'UV' },
  ];

  const CATEGORY_TABS: CategoryTab[] = ['전체 카테고리', '호텔', '민박'];

  return (
    <div className="space-y-4">
      {/* 카테고리 탭 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setCategoryTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              categoryTab === tab
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {sortOptions.map(o => (
            <button
              key={o.key}
              onClick={() => setSortKey(o.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                sortKey === o.key
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={e => setRiskOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-red-500"
          />
          <span className="text-sm text-slate-600">CFR 위험 호텔만</span>
        </label>
        <span className="text-xs text-slate-400 ml-auto">{display.length}개 호텔</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-24">GPID</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">호텔명</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">도시</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">GMV</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CGMV</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CM</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CMR</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">예약</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">확정</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">CFR</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">UV</th>
              </tr>
            </thead>
            <tbody>
              {display.map((h, i) => {
                const cityColor = CITY_COLORS[h.city as City] ?? '#6B7280';
                return (
                  <tr
                    key={h.gpid}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`}
                  >
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{h.gpid}</td>
                    <td className="px-4 py-2.5 font-medium max-w-[200px]">
                      <span className="truncate block" title={h.hotelNm}>{h.hotelNm}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: cityColor }}
                      >
                        {h.city}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 font-medium">{fmtKrw(h.gmv)}원</td>
                    <td className="text-right px-4 py-2.5 font-medium">{fmtKrw(h.cgmv)}원</td>
                    <td className="text-right px-4 py-2.5">{fmtKrw(h.cm)}원</td>
                    <td className="text-right px-4 py-2.5">
                      <span className={h.cmr >= 3 ? 'text-emerald-600 font-medium' : 'text-red-500'}>
                        {h.cmr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5">{h.rsvCnt.toLocaleString()}</td>
                    <td className="text-right px-4 py-2.5 text-emerald-600">{h.crsvCnt.toLocaleString()}</td>
                    <td className="text-right px-4 py-2.5">
                      <span className={`font-semibold ${
                        h.cfr >= 85 ? 'text-emerald-600' :
                        h.cfr >= 70 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {h.cfr.toFixed(1)}%
                        {h.cfr < 60 && ' ⚠'}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 text-slate-600">{(h.uv ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {display.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              {riskOnly ? 'CFR 위험 호텔이 없습니다.' : '데이터가 없습니다.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
