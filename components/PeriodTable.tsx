'use client';

import { useState, useEffect } from 'react';
import { MonthlyData, MonthlyMetrics } from '@/lib/types';

type MetricKey = keyof MonthlyMetrics;

const METRIC_TABS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'gmv',  label: 'GMV',    fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cgmv', label: 'CGMV',   fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cm',   label: 'CM',     fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cmr',  label: 'CMR',    fmt: v => v.toFixed(1) + '%' },
  { key: 'cfr',  label: 'CFR',    fmt: v => v.toFixed(1) + '%' },
  { key: 'cvr',  label: 'CVR',    fmt: v => v.toFixed(2) + '%' },
  { key: 'rsv',  label: '예약건수', fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'crsv', label: '확정건수', fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'uv',   label: '상세 UV', fmt: v => Math.round(v).toLocaleString('ko-KR') },
];

const PARTNER_COLORS: Record<string, string> = {
  AGODA: 'bg-red-100 text-red-700',
  EPS: 'bg-blue-100 text-blue-700',
  HOTELBEDS: 'bg-yellow-100 text-yellow-700',
  DH_MY_HOTEL: 'bg-pink-100 text-pink-700',
  STAYNET: 'bg-green-100 text-green-700',
};

const CITY_EMOJI: Record<string, string> = {
  전체: '🇮🇩', 발리: '🏝️',
};

function delta(cur: number, prev: number | undefined) {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

interface PeriodTableProps {
  title: string;
  subtitle: string;
  apiUrl: string;
  fmtPeriod: (p: string) => string;
  currentPeriod: string; // MTD 뱃지 표시용
}

export default function PeriodTable({ title, subtitle, apiUrl, fmtPeriod, currentPeriod }: PeriodTableProps) {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('gmv');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(apiUrl)
      .then(r => r.json())
      .then(d => { setData(d?.rows && d?.months ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  const toggle = (city: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(city) ? next.delete(city) : next.add(city);
      return next;
    });
  };

  const metric = METRIC_TABS.find(t => t.key === activeMetric)!;

  if (loading) return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        {title} 로딩 중...
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {METRIC_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveMetric(t.key)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeMetric === t.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="sticky left-0 bg-slate-50 z-20 text-left px-5 py-3 text-xs font-semibold text-slate-500 min-w-[140px]">
                지역 / 연동사
              </th>
              {data.months.map((p, i) => (
                <th key={p} className="text-right px-4 py-3 text-xs font-semibold text-slate-500 min-w-[130px]">
                  <div>{fmtPeriod(p)}</div>
                  {p === currentPeriod && (
                    <span className="text-[10px] font-normal text-blue-500">MTD</span>
                  )}
                  {i === data.months.length - 1 && p !== currentPeriod && (
                    <span className="text-[10px] font-normal text-blue-500">최신</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => {
              const isTotal = row.city === '전체';
              const isExpanded = expanded.has(row.city);
              return (
                <>
                  <tr
                    key={row.city}
                    onClick={() => toggle(row.city)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${
                      isTotal ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <td className={`sticky left-0 z-10 px-5 py-3 ${isTotal ? 'bg-slate-800' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CITY_EMOJI[row.city] ?? '📍'}</span>
                        <span className={`font-semibold text-sm ${isTotal ? 'text-white' : 'text-slate-700'}`}>
                          {row.city}
                        </span>
                        <span className="text-xs ml-auto text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </td>
                    {data.months.map((p, i) => {
                      const val = row.total[p]?.[activeMetric] ?? 0;
                      const prevVal = i > 0 ? row.total[data.months[i - 1]]?.[activeMetric] : undefined;
                      const d = delta(val, prevVal);
                      return (
                        <td key={p} className="text-right px-4 py-3">
                          <div className={`font-semibold text-sm ${isTotal ? 'text-white' : 'text-slate-800'}`}>
                            {metric.fmt(val)}
                          </div>
                          {d !== null && (
                            <div className={`text-[10px] font-medium mt-0.5 ${
                              d >= 0 ? (isTotal ? 'text-emerald-400' : 'text-emerald-600') : (isTotal ? 'text-red-400' : 'text-red-500')
                            }`}>
                              {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && row.partners.map(p => (
                    <tr key={`${row.city}-${p.partner}`} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="sticky left-0 bg-white z-10 px-5 py-2.5 pl-10">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${PARTNER_COLORS[p.partner] ?? 'bg-slate-100 text-slate-600'}`}>
                          {p.partner}
                        </span>
                      </td>
                      {data.months.map((mo, i) => {
                        const val = p.months[mo]?.[activeMetric] ?? 0;
                        const prevVal = i > 0 ? p.months[data.months[i - 1]]?.[activeMetric] : undefined;
                        const d = delta(val, prevVal);
                        return (
                          <td key={mo} className="text-right px-4 py-2.5">
                            <div className="text-xs text-slate-700">{metric.fmt(val)}</div>
                            {d !== null && (
                              <div className={`text-[10px] font-medium mt-0.5 ${d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
