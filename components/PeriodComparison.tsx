'use client';

import { useState, useEffect } from 'react';
import { ComparisonData, PeriodMetrics } from '@/lib/types';

function fmtKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtVal(key: keyof PeriodMetrics, val: number): string {
  if (key === 'gmv' || key === 'cm') return fmtKrw(val) + '원';
  if (key === 'rsvCnt' || key === 'detailUv') return Math.round(val).toLocaleString('ko-KR');
  return val.toFixed(1) + '%';
}

function pctDelta(cur: number, base: number | null | undefined): number | null {
  if (!base) return null;
  return ((cur - base) / base) * 100;
}

function DeltaCell({ cur, base, metricKey }: { cur: number; base: PeriodMetrics | null; metricKey: keyof PeriodMetrics }) {
  const baseVal = base?.[metricKey] ?? null;
  const delta = pctDelta(cur, baseVal);

  const cellVal = fmtVal(metricKey, cur);
  const baseFormatted = baseVal != null ? fmtVal(metricKey, baseVal) : null;

  let bg = 'bg-white';
  let deltaTxt = null;

  if (delta !== null) {
    const isPositive = delta >= 0;
    const abs = Math.abs(delta);
    // 색상 강도
    if (abs >= 20) bg = isPositive ? 'bg-emerald-100' : 'bg-red-100';
    else if (abs >= 10) bg = isPositive ? 'bg-emerald-50' : 'bg-red-50';
    else if (abs >= 3) bg = isPositive ? 'bg-green-50/60' : 'bg-rose-50/60';

    deltaTxt = (
      <span className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPositive ? '▲' : '▼'} {abs.toFixed(1)}%
      </span>
    );
  }

  return (
    <td className={`px-3 py-2.5 text-right ${bg} transition-colors`}>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs font-semibold text-slate-800">{cellVal}</span>
        <div className="flex items-center gap-1">
          {deltaTxt ?? <span className="text-[10px] text-slate-300">-</span>}
          {baseFormatted && (
            <span className="text-[10px] text-slate-400">{baseFormatted}</span>
          )}
        </div>
      </div>
    </td>
  );
}

const METRICS: { key: keyof PeriodMetrics; label: string }[] = [
  { key: 'gmv',      label: 'GMV' },
  { key: 'cm',       label: 'CM' },
  { key: 'cmr',      label: 'CMR' },
  { key: 'cfr',      label: 'CFR' },
  { key: 'cvr',      label: 'CVR' },
  { key: 'rsvCnt',   label: '예약' },
  { key: 'detailUv', label: 'UV' },
];

const CITY_EMOJI: Record<string, string> = {
  전체: '🇮🇩', 발리: '🏝️',
};

type Period = 'wow' | 'mom' | 'yoy';

const PERIOD_CONFIG: Record<Period, { label: string; color: string; desc: string }> = {
  wow: { label: 'WoW', color: 'bg-indigo-600', desc: '전주 대비' },
  mom: { label: 'MoM', color: 'bg-amber-500',  desc: '전월 동기 대비' },
  yoy: { label: 'YoY', color: 'bg-emerald-600', desc: '전년 동기 대비' },
};

export default function PeriodComparison({ month }: { month: string }) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('wow');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/comparison?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d?.rows ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month]);

  const periodLabel: Record<Period, string | undefined> = data ? {
    wow: data.wowLabel,
    mom: data.momLabel,
    yoy: data.yoyLabel,
  } : { wow: undefined, mom: undefined, yoy: undefined };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">일본 매출 분석</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            현재: {data?.currentLabel ?? '로딩 중...'}
          </p>
        </div>
        {/* 기간 탭 */}
        <div className="flex gap-1.5">
          {(Object.entries(PERIOD_CONFIG) as [Period, typeof PERIOD_CONFIG[Period]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === key
                  ? `${cfg.color} text-white shadow-sm`
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {cfg.label}
              <span className={`ml-1 text-[10px] font-normal ${period === key ? 'text-white/80' : 'text-slate-400'}`}>
                {cfg.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            데이터 불러오는 중...
          </div>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-slate-400">데이터를 불러올 수 없습니다</div>
      ) : (
        <>
          {/* 비교 기간 표시 */}
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${PERIOD_CONFIG[period].color}`}>
              {PERIOD_CONFIG[period].label}
            </span>
            <span className="text-xs text-slate-400">비교 기준: {periodLabel[period]}</span>
            <span className="text-[10px] text-slate-300 ml-auto">각 셀 = 현재값 / 증감률 (비교값)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[90px]">
                    지역
                  </th>
                  {METRICS.map(m => (
                    <th key={m.key} className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[110px]">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  const base = row[period];
                  const isTotal = row.city === '전체';
                  return (
                    <tr
                      key={row.city}
                      className={`border-b border-slate-50 ${isTotal ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'} transition-colors`}
                    >
                      <td className={`px-5 py-2.5 sticky left-0 z-10 ${isTotal ? 'bg-slate-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{CITY_EMOJI[row.city] ?? '📍'}</span>
                          <span className={`text-sm ${isTotal ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                            {row.city}
                          </span>
                        </div>
                      </td>
                      {METRICS.map(m => (
                        <DeltaCell
                          key={m.key}
                          cur={row.current?.[m.key] ?? 0}
                          base={base}
                          metricKey={m.key}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 범례 */}
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-4 bg-slate-50/50">
            <span className="text-[10px] text-slate-400 font-medium">색상 기준</span>
            {[
              { bg: 'bg-emerald-100', label: '▲ 20%↑' },
              { bg: 'bg-emerald-50',  label: '▲ 10~20%' },
              { bg: 'bg-green-50',    label: '▲ 3~10%' },
              { bg: 'bg-rose-50',     label: '▼ 3~10%' },
              { bg: 'bg-red-50',      label: '▼ 10~20%' },
              { bg: 'bg-red-100',     label: '▼ 20%↑' },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded ${bg} border border-slate-200`} />
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
