'use client';

import { useEffect, useState } from 'react';
import { FpnaPeriodData, FpnaPeriodRow } from '@/lib/types';

type MetricKey = 'confirmGmv' | 'refundGmv' | 'netCgmv' | 'netCm' | 'cmr' | 'cfr' | 'confirmOrders' | 'refundOrders';

const METRIC_TABS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'confirmGmv',    label: '확정 GMV',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'refundGmv',     label: '취소 CGMV', fmt: v => v > 0 ? '-' + Math.round(v).toLocaleString('ko-KR') + '원' : '-' },
  { key: 'netCgmv',       label: '순 CGMV',   fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'netCm',         label: '순 CM',     fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cmr',           label: 'CMR',       fmt: v => v.toFixed(2) + '%' },
  { key: 'cfr',           label: 'CFR',       fmt: v => v.toFixed(1) + '%' },
  { key: 'confirmOrders', label: '확정 건수',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'refundOrders',  label: '취소 건수',  fmt: v => v > 0 ? Math.round(v).toLocaleString('ko-KR') + '건' : '-' },
];

const PARTNER_COLORS: Record<string, string> = {
  AGODA:       'bg-red-100 text-red-700',
  EPS:         'bg-blue-100 text-blue-700',
  HOTELBEDS:   'bg-yellow-100 text-yellow-700',
  DH_MY_HOTEL: 'bg-pink-100 text-pink-700',
  STAYNET:     'bg-green-100 text-green-700',
};

function getVal(r: FpnaPeriodRow, key: MetricKey): number {
  return r[key] as number;
}

function delta(cur: number, prev: number | undefined) {
  if (prev === undefined || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

interface FpnaPeriodTableProps {
  title: string;
  subtitle: string;
  apiUrl: string;
  fmtPeriod: (p: string) => string;
  currentPeriod: string;
}

export default function FpnaPeriodTable({ title, subtitle, apiUrl, fmtPeriod, currentPeriod }: FpnaPeriodTableProps) {
  const [data, setData] = useState<FpnaPeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('confirmGmv');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setExpanded(false);
    fetch(apiUrl)
      .then(r => r.json())
      .then(d => { setData(d?.periods && d?.rows ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        {title} 로딩 중...
      </div>
    </div>
  );

  if (!data || !data.rows.length) return null;

  const { periods, rows, partners } = data;
  const metric = METRIC_TABS.find(t => t.key === activeMetric)!;
  const isNegBetter = activeMetric === 'refundGmv' || activeMetric === 'refundOrders';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
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

      {/* 테이블 — PeriodTable과 동일 구조: 행=연동사(전체+파트너), 열=기간 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="sticky left-0 bg-slate-50 z-20 text-left px-5 py-3 text-xs font-semibold text-slate-500 min-w-[140px]">
                연동사
              </th>
              {periods.map((p, i) => (
                <th key={p} className="text-right px-4 py-3 text-xs font-semibold text-slate-500 min-w-[120px]">
                  <div>{fmtPeriod(p)}</div>
                  {p === currentPeriod && <span className="text-[10px] font-normal text-blue-500">진행 중</span>}
                  {i === periods.length - 1 && p !== currentPeriod && <span className="text-[10px] font-normal text-blue-500">최신</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 전체 합계 행 (dark) */}
            <tr
              onClick={() => setExpanded(v => !v)}
              className="border-b border-slate-100 cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <td className="sticky left-0 z-10 bg-slate-800 hover:bg-slate-700 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇮🇩</span>
                  <span className="font-semibold text-sm text-white">전체</span>
                  <span className="text-xs text-slate-400 ml-auto">{expanded ? '▲' : '▼'}</span>
                </div>
              </td>
              {rows.map((r, i) => {
                const val     = getVal(r, activeMetric);
                const prevVal = i > 0 ? getVal(rows[i - 1], activeMetric) : undefined;
                const d       = delta(val, prevVal);
                const good    = d !== null && (isNegBetter ? d <= 0 : d >= 0);
                return (
                  <td key={r.period} className="text-right px-4 py-3">
                    <div className="font-semibold text-sm text-white">{metric.fmt(val)}</div>
                    {d !== null && (
                      <div className={`text-[10px] font-medium mt-0.5 ${good ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 파트너 확장 행 */}
            {expanded && partners.map(pt => (
              <tr key={pt.partner} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td className="sticky left-0 z-10 bg-white px-5 py-2.5 pl-10">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${PARTNER_COLORS[pt.partner] ?? 'bg-slate-100 text-slate-600'}`}>
                    {pt.partner}
                  </span>
                </td>
                {pt.rows.map((r, i) => {
                  const val     = getVal(r, activeMetric);
                  const prevVal = i > 0 ? getVal(pt.rows[i - 1], activeMetric) : undefined;
                  const d       = delta(val, prevVal);
                  const good    = d !== null && (isNegBetter ? d <= 0 : d >= 0);
                  return (
                    <td key={r.period} className="text-right px-4 py-2.5">
                      <div className="text-xs text-slate-700">{metric.fmt(val)}</div>
                      {d !== null && (
                        <div className={`text-[10px] font-medium mt-0.5 ${good ? 'text-emerald-600' : 'text-red-500'}`}>
                          {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400">
        * 전체 행 클릭 → 연동사별 상세 확인 · B2B, 마이팩, 나연팩 제외 · D-1 기준
      </div>
    </div>
  );
}
