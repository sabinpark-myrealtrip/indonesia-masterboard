'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendRow, City, CITY_COLORS } from '@/lib/types';
import { format, startOfWeek, startOfMonth } from 'date-fns';

type Grain = '일간' | '주간' | '월간';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

function groupTrends(rows: TrendRow[], grain: Grain) {
  const grouped: Record<string, { cgmv: number; rsvCnt: number; crsvCnt: number; cm: number }> = {};

  rows.forEach(r => {
    let key = r.basisDate;
    if (grain === '주간') {
      const d = new Date(r.basisDate);
      key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else if (grain === '월간') {
      key = r.basisDate.slice(0, 7);
    }
    if (!grouped[key]) grouped[key] = { cgmv: 0, rsvCnt: 0, crsvCnt: 0, cm: 0 };
    grouped[key].cgmv += r.cgmv;
    grouped[key].rsvCnt += r.rsvCnt;
    grouped[key].crsvCnt += r.crsvCnt;
    grouped[key].cm += r.cm;
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: grain === '일간' ? date.slice(5) : grain === '주간' ? `${date.slice(5)}~` : date,
      cgmv: v.cgmv,
      rsvCnt: v.rsvCnt,
      crsvCnt: v.crsvCnt,
      cfr: v.rsvCnt > 0 ? parseFloat(((v.crsvCnt / v.rsvCnt) * 100).toFixed(1)) : 0,
    }));
}

interface Props {
  trends: TrendRow[];
  city: City;
}

export default function PerformanceDetail({ trends, city }: Props) {
  const [grain, setGrain] = useState<Grain>('일간');
  const grains: Grain[] = ['일간', '주간', '월간'];
  const color = CITY_COLORS[city];

  const chartData = groupTrends(trends, grain);

  return (
    <div className="space-y-4">
      {/* Grain 선택 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {grains.map(g => (
          <button
            key={g}
            onClick={() => setGrain(g)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              grain === g
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* CGMV 차트 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">CGMV 추이</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmtKrw(v)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${fmtKrw(v)}원`, 'CGMV']} />
            <Bar dataKey="cgmv" name="CGMV" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CFR 차트 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">CFR 추이</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'CFR']} />
            <Line
              type="monotone"
              dataKey={() => 70}
              stroke="#ef4444"
              strokeDasharray="4 4"
              dot={false}
              name="기준선 70%"
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="cfr"
              name="CFR"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 실적 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">실적 상세 ({grain})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">기간</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">CGMV</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">예약</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">확정</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">CFR</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((r, i) => (
                <tr key={r.date} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-2 font-medium">{r.date}</td>
                  <td className="text-right px-4 py-2">{fmtKrw(r.cgmv)}원</td>
                  <td className="text-right px-4 py-2">{r.rsvCnt.toLocaleString()}</td>
                  <td className="text-right px-4 py-2 text-emerald-600">{r.crsvCnt.toLocaleString()}</td>
                  <td className="text-right px-4 py-2">
                    <span className={`font-semibold ${
                      r.cfr >= 85 ? 'text-emerald-600' :
                      r.cfr >= 70 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {r.cfr.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
