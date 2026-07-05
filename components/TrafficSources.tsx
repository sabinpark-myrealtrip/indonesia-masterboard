'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { City, CITIES, CITY_COLORS, TrafficSourceDailyRow } from '@/lib/types';

const CITY_LABELS: Record<City, string> = { 전체: '전체', 발리: '발리' };
const DAY_OPTIONS = [{ label: '7일', value: 7 }, { label: '14일', value: 14 }, { label: '30일', value: 30 }];

const UTM_PALETTE: Record<string, string> = {
  naver: '#03C75A', google: '#4285F4', unknown: '#94A3B8', mktpartner: '#0EA5E9',
  direct: '#F59E0B', kakao: '#FBBF24', instagram: '#E1306C', braze: '#14B8A6',
  email: '#7C3AED', youtube: '#FF0000',
};
function utmColor(utm: string) { return UTM_PALETTE[utm.toLowerCase()] ?? '#CBD5E1'; }

function fmtDate(d: string) { return d.slice(5).replace('-', '/'); } // MM/DD
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function weekday(d: string) { return WEEKDAYS[new Date(d + 'T00:00:00').getDay()]; }

type MetricKey = 'detailUv' | 'purchaseUv' | 'cvr';
const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'detailUv',  label: '상세 UV',    fmt: v => Math.round(v).toLocaleString('ko-KR') },
  { key: 'purchaseUv', label: '결제완료 UV', fmt: v => Math.round(v).toLocaleString('ko-KR') },
  { key: 'cvr',       label: 'CVR',        fmt: v => v.toFixed(2) + '%' },
];

// 채널 행 1개: 날짜→값 맵 + 평균 + 최신
interface ChannelSeries {
  utm: string;
  byDate: Record<string, number>;
  avg: number;
  latest: number;
  latestDev: number;  // (latest - avg) / avg
  total: number;
}

// 편차에 따른 셀 색상 (하락 = 경고)
function devCellClass(val: number, avg: number): string {
  if (avg <= 0) return 'text-slate-300';
  const dev = (val - avg) / avg;
  if (dev <= -0.30) return 'bg-red-50 text-red-700 font-semibold';
  if (dev <= -0.15) return 'bg-amber-50 text-amber-700';
  if (dev >= 0.30)  return 'bg-emerald-50 text-emerald-700';
  return 'text-slate-600';
}

export default function TrafficSources() {
  const [selectedCity, setSelectedCity] = useState<City>('전체');
  const [days, setDays] = useState(14);
  const [metric, setMetric] = useState<MetricKey>('detailUv');
  const [dailyRows, setDailyRows] = useState<TrafficSourceDailyRow[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/traffic-sources?city=${encodeURIComponent(selectedCity)}&days=${days}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'API error');
      setDailyRows(json.dailyRows ?? []);
      setDateRange({ start: json.startDate, end: json.endDate });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedCity, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredDaily = useMemo(() =>
    selectedCity === '전체' ? dailyRows : dailyRows.filter(r => r.city === selectedCity),
    [dailyRows, selectedCity]);

  // 날짜 목록 (최신 → 과거)
  const dates = useMemo(() =>
    [...new Set(filteredDaily.map(r => r.basisDate))].sort().reverse(),
    [filteredDaily]);

  const latestDate = dates[0];

  function metricVal(r: TrafficSourceDailyRow): number {
    if (metric === 'detailUv') return r.detailUv;
    if (metric === 'purchaseUv') return r.purchaseUv;
    return r.detailUv > 0 ? (r.purchaseUv / r.detailUv * 100) : 0;
  }

  // 채널별 시계열 집계
  const channels = useMemo<ChannelSeries[]>(() => {
    const utms = [...new Set(filteredDaily.map(r => r.utmSource))];
    const result: ChannelSeries[] = utms.map(utm => {
      const byDate: Record<string, number> = {};
      let totalDetail = 0;
      for (const d of dates) {
        const dayRows = filteredDaily.filter(r => r.basisDate === d && r.utmSource === utm);
        if (metric === 'cvr') {
          const du = dayRows.reduce((s, r) => s + r.detailUv, 0);
          const pu = dayRows.reduce((s, r) => s + r.purchaseUv, 0);
          byDate[d] = du > 0 ? parseFloat((pu / du * 100).toFixed(2)) : 0;
        } else {
          byDate[d] = dayRows.reduce((s, r) => s + metricVal(r), 0);
        }
        totalDetail += dayRows.reduce((s, r) => s + r.detailUv, 0);
      }
      const vals = dates.map(d => byDate[d]);
      const nonZero = vals.filter(v => v > 0);
      const avg = nonZero.length ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
      const latest = byDate[latestDate] ?? 0;
      const latestDev = avg > 0 ? (latest - avg) / avg : 0;
      return { utm, byDate, avg, latest, latestDev, total: totalDetail };
    });
    // 전체 상세 UV 기준 정렬
    return result.sort((a, b) => b.total - a.total);
  }, [filteredDaily, dates, latestDate, metric]);

  // 합계 행 (날짜별 전체)
  const totalByDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of dates) {
      const dayRows = filteredDaily.filter(r => r.basisDate === d);
      if (metric === 'cvr') {
        const du = dayRows.reduce((s, r) => s + r.detailUv, 0);
        const pu = dayRows.reduce((s, r) => s + r.purchaseUv, 0);
        m[d] = du > 0 ? parseFloat((pu / du * 100).toFixed(2)) : 0;
      } else {
        m[d] = dayRows.reduce((s, r) => s + metricVal(r), 0);
      }
    }
    return m;
  }, [filteredDaily, dates, metric]);
  const totalVals = dates.map(d => totalByDate[d]).filter(v => v > 0);
  const totalAvg = totalVals.length ? totalVals.reduce((s, v) => s + v, 0) / totalVals.length : 0;
  const totalLatest = totalByDate[latestDate] ?? 0;
  const totalDev = totalAvg > 0 ? (totalLatest - totalAvg) / totalAvg : 0;

  // ⚠️ 최신일 평균 이하로 떨어진 채널 (CVR 외 지표에서, 15% 이상 하락)
  const alerts = useMemo(() =>
    channels
      .filter(c => c.avg >= 5 && c.latestDev <= -0.15)  // 평균이 너무 작은 채널 제외
      .sort((a, b) => a.latestDev - b.latestDev),
    [channels]);

  const fmt = METRICS.find(m => m.key === metric)!.fmt;

  return (
    <div className="space-y-4">
      {/* ── 헤더 ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">유입 데이터 · 일별 채널 모니터링</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              채널별 일별 유입 추이 · 평균 대비 급감 채널 자동 감지
              {dateRange && <span className="ml-1">({dateRange.start} ~ {dateRange.end})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {METRICS.map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  className={`px-3 py-1.5 text-xs transition-colors ${metric === m.key ? 'bg-slate-800 text-white font-semibold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {DAY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setDays(opt.value)}
                  className={`px-3 py-1.5 text-xs transition-colors ${days === opt.value ? 'bg-slate-800 text-white font-semibold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={fetchData} disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1">
              <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              {loading ? '로딩 중' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 도시 탭 */}
        <div className="flex gap-1.5 flex-wrap mt-3">
          {CITIES.map(c => (
            <button key={c} onClick={() => setSelectedCity(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                selectedCity === c ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
              style={selectedCity === c ? {
                backgroundColor: c === '전체' ? '#1E293B' : CITY_COLORS[c],
                borderColor: c === '전체' ? '#1E293B' : CITY_COLORS[c],
              } : {}}>
              {CITY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">불러오는 중...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── ⚠️ 평균 이하 알림 배너 ── */}
          {metric !== 'cvr' && (
            <div className={`rounded-xl border px-5 py-4 ${alerts.length ? 'bg-red-50/60 border-red-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
              {alerts.length ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">⚠️</span>
                    <p className="text-sm font-bold text-red-700">
                      {latestDate && fmtDate(latestDate)} 기준 평균 이하로 떨어진 채널 {alerts.length}개 — 액션 필요
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alerts.map(c => (
                      <div key={c.utm} className="flex items-center gap-2 bg-white rounded-lg border border-red-200 px-3 py-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: utmColor(c.utm) }} />
                        <span className="text-xs font-semibold text-slate-700">{c.utm}</span>
                        <span className="text-xs text-red-600 font-bold">{(c.latestDev * 100).toFixed(0)}%</span>
                        <span className="text-[11px] text-slate-400">
                          {fmt(c.latest)} <span className="text-slate-300">/ 평균 {fmt(c.avg)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-base">✅</span>
                  <p className="text-sm font-semibold text-emerald-700">
                    {latestDate && fmtDate(latestDate)} 기준 평균 이하로 크게 떨어진 채널 없음
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 일별 채널 표 ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700">채널 × 일별 {METRICS.find(m => m.key === metric)!.label}</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" />급감(-30%↓)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />하락(-15%↓)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />급증(+30%↑)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="sticky left-0 bg-slate-50 z-20 text-left px-4 py-2.5 text-slate-500 font-semibold min-w-[110px]">채널</th>
                    <th className="text-right px-3 py-2.5 text-slate-500 font-semibold min-w-[72px] border-r border-slate-200">일평균</th>
                    {dates.map((d, i) => (
                      <th key={d} className={`text-right px-3 py-2.5 font-semibold min-w-[64px] ${i === 0 ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500'}`}>
                        <div>{fmtDate(d)}</div>
                        <div className="text-[10px] font-normal text-slate-400">{weekday(d)}{i === 0 ? ' · 최신' : ''}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 합계 행 */}
                  <tr className="border-b border-slate-200 bg-slate-800">
                    <td className="sticky left-0 z-10 bg-slate-800 px-4 py-2.5">
                      <span className="font-bold text-white">🇮🇩 전체</span>
                    </td>
                    <td className="text-right px-3 py-2.5 font-bold text-slate-200 border-r border-slate-600">{fmt(totalAvg)}</td>
                    {dates.map((d, i) => (
                      <td key={d} className={`text-right px-3 py-2.5 ${i === 0 ? 'bg-slate-700' : ''}`}>
                        <span className="font-bold text-white">{fmt(totalByDate[d])}</span>
                        {i === 0 && totalAvg > 0 && (
                          <div className={`text-[10px] font-medium ${totalDev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {totalDev >= 0 ? '▲' : '▼'}{Math.abs(totalDev * 100).toFixed(0)}%
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* 채널 행 */}
                  {channels.map(c => (
                    <tr key={c.utm} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: utmColor(c.utm) }} />
                          <span className="font-semibold text-slate-700">{c.utm}</span>
                        </div>
                      </td>
                      <td className="text-right px-3 py-2.5 text-slate-500 border-r border-slate-200">{fmt(c.avg)}</td>
                      {dates.map((d, i) => {
                        const v = c.byDate[d] ?? 0;
                        const cls = metric === 'cvr' ? 'text-slate-600' : devCellClass(v, c.avg);
                        return (
                          <td key={d} className={`text-right px-3 py-2.5 ${cls} ${i === 0 ? 'ring-1 ring-inset ring-blue-100' : ''}`}>
                            {v > 0 ? fmt(v) : <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400">
              * 색상은 각 채널의 기간 평균 대비 편차 기준 · 셀 값이 0이면 ‘-’ · 최신일 = D-1
            </div>
          </div>
        </>
      )}
    </div>
  );
}
