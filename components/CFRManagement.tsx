'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CfrDailyRow, ReservationRow, City, CITY_COLORS } from '@/lib/types';

type CFRSubTab = '확정 현황' | 'CFR 트렌드' | '취소 분석';

const PARTNER_COLORS: Record<string, string> = {
  agoda: '#e11d48',
  booking: '#0369a1',
  expedia: '#eab308',
  airbnb: '#ec4899',
  hotels: '#16a34a',
};

function fmtDate(d: string) {
  return d.slice(5); // 'MM-DD'
}

interface TrendChartProps {
  data: CfrDailyRow[];
  city: City;
}

function TrendChart({ data, city }: TrendChartProps) {
  const partners = [...new Set(data.map(d => d.partner))].slice(0, 5);
  const dates = [...new Set(data.map(d => d.basisDate))].sort();

  const chartData = dates.map(date => {
    const row: Record<string, string | number> = { date: fmtDate(date) };
    partners.forEach(p => {
      const found = data.find(d => d.basisDate === date && d.partner === p);
      row[p] = found ? Math.round(found.cfrPct * 10) / 10 : 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend />
        {/* CFR 경계선 */}
        <Line
          type="monotone"
          dataKey={() => 70}
          stroke="#ef4444"
          strokeDasharray="4 4"
          dot={false}
          name="CFR 70% 기준"
          strokeWidth={1}
        />
        {partners.map(p => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={PARTNER_COLORS[p] ?? '#94a3b8'}
            strokeWidth={2}
            dot={false}
            name={p}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

interface ReservationTableProps {
  data: ReservationRow[];
}

function ReservationTable({ data }: ReservationTableProps) {
  const riskRows = data.filter(r => r.status === 'wait_confirm' && r.elapsedDays >= 3);
  const display = riskRows.slice(0, 50);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-slate-600">예약번호</th>
            <th className="text-left px-4 py-2 font-semibold text-slate-600">파트너</th>
            <th className="text-left px-4 py-2 font-semibold text-slate-600">호텔명</th>
            <th className="text-left px-4 py-2 font-semibold text-slate-600">도시</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">예약일</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">경과일</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">금액</th>
            <th className="text-center px-4 py-2 font-semibold text-slate-600">상태</th>
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => (
            <tr key={r.resveId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
              <td className="px-4 py-2 font-mono text-xs">{r.resveId}</td>
              <td className="px-4 py-2">
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: PARTNER_COLORS[r.partner] ?? '#94a3b8' }}
                >
                  {r.partner}
                </span>
              </td>
              <td className="px-4 py-2 max-w-[200px] truncate">{r.hotelNm}</td>
              <td className="px-4 py-2">{r.city}</td>
              <td className="text-right px-4 py-2 text-slate-500">{r.bookingDate}</td>
              <td className="text-right px-4 py-2">
                <span className={`font-semibold ${r.elapsedDays >= 7 ? 'text-red-500' : r.elapsedDays >= 3 ? 'text-amber-500' : ''}`}>
                  D+{r.elapsedDays}
                </span>
              </td>
              <td className="text-right px-4 py-2">
                {(r.salesKrwPrice / 10000).toFixed(0)}만원
              </td>
              <td className="text-center px-4 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  r.status === 'wait_confirm'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {r.status === 'wait_confirm' ? '미확정' : '확정'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {riskRows.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          미확정 예약이 없습니다.
        </div>
      )}
    </div>
  );
}

interface CancelAnalysisProps {
  data: CfrDailyRow[];
}

function CancelAnalysis({ data }: CancelAnalysisProps) {
  const byPartner: Record<string, { partner: string; cancelTotal: number; rsv: number }> = {};
  data.forEach(d => {
    if (!byPartner[d.partner]) byPartner[d.partner] = { partner: d.partner, cancelTotal: 0, rsv: 0 };
    byPartner[d.partner].cancelTotal += d.cancelCustomer + d.cancelPartner;
    byPartner[d.partner].rsv += d.rsvCnt;
  });
  const rows = Object.values(byPartner).sort((a, b) => b.cancelTotal - a.cancelTotal);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-slate-600">파트너</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">예약건수</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">취소건수</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-600">취소율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.partner} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: PARTNER_COLORS[r.partner] ?? '#94a3b8' }}
                >
                  {r.partner}
                </span>
              </td>
              <td className="text-right px-4 py-3">{r.rsv.toLocaleString()}</td>
              <td className="text-right px-4 py-3 text-red-500">{r.cancelTotal.toLocaleString()}</td>
              <td className="text-right px-4 py-3">
                <span className={`font-semibold ${
                  r.rsv > 0 && r.cancelTotal / r.rsv > 0.2 ? 'text-red-500' : 'text-slate-700'
                }`}>
                  {r.rsv > 0 ? ((r.cancelTotal / r.rsv) * 100).toFixed(1) : 0}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  cfrDaily: CfrDailyRow[];
  reservations: ReservationRow[];
  city: City;
}

export default function CFRManagement({ cfrDaily, reservations, city }: Props) {
  const [subTab, setSubTab] = useState<CFRSubTab>('확정 현황');
  const subTabs: CFRSubTab[] = ['확정 현황', 'CFR 트렌드', '취소 분석'];

  return (
    <div className="space-y-4">
      {/* 서브 탭 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {subTabs.map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              subTab === t
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {subTab === '확정 현황' && (
          <>
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">미확정 예약 현황 (D+3 이상)</h3>
              <p className="text-xs text-slate-500 mt-0.5">3일 이상 미확정 예약을 우선 관리하세요</p>
            </div>
            <ReservationTable data={reservations} />
          </>
        )}
        {subTab === 'CFR 트렌드' && (
          <>
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">파트너별 CFR 트렌드</h3>
            </div>
            <div className="p-4">
              <TrendChart data={cfrDaily} city={city} />
            </div>
          </>
        )}
        {subTab === '취소 분석' && (
          <>
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">파트너별 취소 분석</h3>
            </div>
            <CancelAnalysis data={cfrDaily} />
          </>
        )}
      </div>
    </div>
  );
}
