'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { differenceInHours, format } from 'date-fns';
import { City, CITIES, CITY_COLORS, DashboardData } from '@/lib/types';
import { analyzeDashboard } from '@/lib/analyzer';
import KpiCards from './KpiCards';
import TrendCharts from './TrendCharts';
import PartnerTable from './PartnerTable';
import HotelRanking from './HotelRanking';
import DailyInsights from './DailyInsights';
import MonthlyTable from './MonthlyTable';
import WeeklyTable from './WeeklyTable';
import YearlyTable from './YearlyTable';
import TopSelling from './TopSelling';
import CityDetailUV from './CityDetailUV';
import NegativeCmHotels from './NegativeCmHotels';
import TrafficSources from './TrafficSources';
import DailyTable from './DailyTable';
import BaliSeasonality from './BaliSeasonality';
import CityDistribution from './CityDistribution';
import BaliCatalog from './BaliCatalog';
import FpnaDailyTable from './FpnaDailyTable';
import FpnaMonthlyTable from './FpnaMonthlyTable';
import FpnaYearlyTable from './FpnaYearlyTable';
import { getDailyTarget } from '@/lib/targets';

function getMonthOptions() {
  const options: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

const CITY_EMOJI: Record<City, string> = {
  전체: '🇮🇩',
  발리: '🏝️',
};

function fmtKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}


type NavPage = City | 'indonesia-data' | 'topselling' | 'negative-cm' | 'traffic-sources' | 'city-distribution' | 'bali-catalog';
type DataViewMode = 'booking' | 'performance';


const CITY_DISPLAY: Record<City, string> = {
  전체: '인도네시아 전체',
  발리: '발리',
};

interface TargetInputs {
  monthlyGmv: string;
  monthlyCm: string;
  dailyGmv: string;
  dailyCm: string;
}

function loadTargetInputs(key: string): TargetInputs {
  if (typeof window === 'undefined') return { monthlyGmv: '', monthlyCm: '', dailyGmv: '', dailyCm: '' };
  try {
    const raw = localStorage.getItem(`targets:${key}`);
    return raw ? JSON.parse(raw) : { monthlyGmv: '', monthlyCm: '', dailyGmv: '', dailyCm: '' };
  } catch { return { monthlyGmv: '', monthlyCm: '', dailyGmv: '', dailyCm: '' }; }
}

function parseWon(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) || v.trim() === '' ? undefined : n;
}

export default function Dashboard() {
  const [page, setPage] = useState<NavPage>('전체');
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>('booking');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetInputs, setTargetInputs] = useState<TargetInputs>({ monthlyGmv: '', monthlyCm: '', dailyGmv: '', dailyCm: '' });

  const city: City = (page === 'indonesia-data' || page === 'topselling' || page === 'negative-cm' || page === 'traffic-sources' || page === 'city-distribution' || page === 'bali-catalog') ? '전체' : page;

  const fetchData = useCallback(async () => {
    if (page === 'indonesia-data' || page === 'topselling' || page === 'negative-cm' || page === 'traffic-sources' || page === 'city-distribution' || page === 'bali-catalog') { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?month=${month}&city=${encodeURIComponent(city)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'API error');
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, city, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const targetKey = `${month}-${city}`;
  useEffect(() => {
    setTargetInputs(loadTargetInputs(targetKey));
  }, [targetKey]);

  function updateTarget(field: keyof TargetInputs, value: string) {
    const next = { ...targetInputs, [field]: value };
    setTargetInputs(next);
    localStorage.setItem(`targets:${targetKey}`, JSON.stringify(next));
  }

  const months = getMonthOptions();
  const cityColor = CITY_COLORS[city];
  const rawSummary = data?.summary?.find(s => s.city === city) ?? data?.summary?.[0];
  const summaryForCity = rawSummary ? {
    ...rawSummary,
    targetGmv: parseWon(targetInputs.monthlyGmv) ?? rawSummary.targetGmv,
    targetCm:  parseWon(targetInputs.monthlyCm)  ?? rawSummary.targetCm,
  } : undefined;
  const citySummaries = data?.summary?.filter(s => s.city !== '전체') ?? [];

  // sync는 하루 3번(09/13/18시) 도는데, 8시간 넘게 안 돌았으면 예정된 회차를 하나 이상 놓친 것
  const syncHoursAgo = data?.syncedAt ? differenceInHours(new Date(), new Date(data.syncedAt)) : null;
  const syncStale = syncHoursAgo !== null && syncHoursAgo >= 8;

  const analysis = useMemo(() => {
    if (!data || page === 'indonesia-data' || page === 'topselling' || page === 'negative-cm' || page === 'traffic-sources' || page === 'city-distribution' || page === 'bali-catalog') return null;
    return analyzeDashboard({
      trends: data.trends,
      partnerSummary: data.partnerSummary,
      hotels: data.hotels,
      hotelDaily: data.hotelDaily ?? [],
      summary: data.summary,
      city,
    });
  }, [data, city, page]);

  const pageTitle = page === 'indonesia-data' ? '인도네시아 데이터'
    : page === 'negative-cm' ? '역마진 호텔 분석'
    : page === 'traffic-sources' ? '유입 데이터'
    : page === 'city-distribution' ? '도시별 예약 분포'
    : page === 'bali-catalog' ? '상품 현황'
    : city === '전체' ? '인도네시아 현황'
    : `${CITY_DISPLAY[city]} 현황`;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-48 bg-slate-900 flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-700/60">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Myrealtrip</p>
          <p className="text-sm text-white font-bold mt-0.5">인도네시아 마스터보드</p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {/* 도시 탭 */}
          <p className="px-4 pt-2 pb-1 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">지역별 현황</p>
          {CITIES.map(c => {
            const isActive = page === c;
            const color = CITY_COLORS[c];
            return (
              <button
                key={c}
                onClick={() => setPage(c)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
                  isActive
                    ? 'bg-slate-700/80 text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="text-base w-5 text-center leading-none">{CITY_EMOJI[c]}</span>
                <span>{CITY_DISPLAY[c]}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                )}
              </button>
            );
          })}

          {/* 도시별 예약 분포 탭 */}
          <button
            onClick={() => setPage('city-distribution')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'city-distribution'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">🗺️</span>
            <span>도시별 분포</span>
            {page === 'city-distribution' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
            )}
          </button>

          {/* 구분선 */}
          <div className="mx-4 my-2 border-t border-slate-700/60" />

          {/* 인도네시아 데이터 탭 */}
          <p className="px-4 pt-1 pb-1 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">분석</p>
          <button
            onClick={() => setPage('indonesia-data')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'indonesia-data'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">📊</span>
            <span>인도네시아 데이터</span>
            {page === 'indonesia-data' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
            )}
          </button>
          <button
            onClick={() => setPage('topselling')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'topselling'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">🏆</span>
            <span>인도네시아 탑셀링</span>
            {page === 'topselling' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            )}
          </button>
          <button
            onClick={() => setPage('negative-cm')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'negative-cm'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">🔴</span>
            <span>역마진 호텔</span>
            {page === 'negative-cm' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
            )}
          </button>
          <button
            onClick={() => setPage('traffic-sources')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'traffic-sources'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">📡</span>
            <span>유입 데이터</span>
            {page === 'traffic-sources' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
          </button>

{/* 구분선 */}
          <div className="mx-4 my-2 border-t border-slate-700/60" />

          {/* 상품 현황 탭 */}
          <p className="px-4 pt-1 pb-1 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">파트너</p>
          <button
            onClick={() => setPage('bali-catalog')}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left ${
              page === 'bali-catalog'
                ? 'bg-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-base w-5 text-center leading-none">📋</span>
            <span>상품 현황</span>
            {page === 'bali-catalog' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            )}
          </button>
        </nav>
        <div className="px-4 py-3 border-t border-slate-700/60">
          <p className="text-[10px] text-slate-600">{month} 기준</p>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {pageTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">마이리얼트립 인도네시아 숙소 성과 대시보드</p>
          </div>
          <div className="flex items-center gap-2.5">
            {data?.syncedAt && (
              <p className={`text-[11px] ${syncStale ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                최근 동기화 {format(new Date(data.syncedAt), 'MM/dd HH:mm')}
                {syncStale && ' (지연됨)'}
              </p>
            )}
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-sm px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              {loading ? '로딩 중...' : '데이터 업데이트'}
            </button>
          </div>
        </header>

        {/* 스크롤 영역 */}
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── 상품 현황 탭 ── */}
          {page === 'bali-catalog' && <BaliCatalog />}

          {/* ── 도시별 예약 분포 탭 ── */}
          {page === 'city-distribution' && <CityDistribution month={month} />}

          {/* ── 인도네시아 데이터 탭 ── */}
          {page === 'indonesia-data' && (
            <div className="space-y-5">
              {/* 뷰 토글 */}
              <div className="flex items-center gap-1 p-1 bg-slate-200 rounded-xl w-fit">
                <button
                  onClick={() => setDataViewMode('booking')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    dataViewMode === 'booking'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📅 예약 기준
                </button>
                <button
                  onClick={() => setDataViewMode('performance')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    dataViewMode === 'performance'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📊 성과 기준 (전사 KPI)
                </button>
              </div>

              {/* 예약 기준 뷰 */}
              {dataViewMode === 'booking' && (
                <>
                  <BaliSeasonality />
                  <DailyTable />
                  <WeeklyTable month={month} />
                  <MonthlyTable month={month} />
                  <YearlyTable month={month} />
                </>
              )}

              {/* 성과 기준 뷰 */}
              {dataViewMode === 'performance' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="text-sm font-bold text-indigo-900">성과 기준 (전사 KPI) vs 예약 기준의 차이</p>
                        <div className="text-xs text-indigo-700 mt-2 space-y-1">
                          <p><span className="font-semibold">예약 기준</span> — 해당 월에 예약이 들어온 건 기준. 이후에 취소돼도 GMV에 포함. CGMV는 현재 시점 확정 상태 기준.</p>
                          <p><span className="font-semibold">성과 기준 (현재 뷰)</span> — 해당 월에 확정된 GMV + 해당 월에 처리된 취소 GMV를 차감. 전사 CM/CMR 산정 기준과 동일.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <FpnaDailyTable />
                  <FpnaMonthlyTable month={month} />
                  <FpnaYearlyTable month={month} />
                </div>
              )}
            </div>
          )}

          {/* ── 인도네시아 탑셀링 탭 ── */}
          {page === 'topselling' && <TopSelling />}

          {/* ── 역마진 호텔 탭 ── */}
          {page === 'negative-cm' && <NegativeCmHotels />}

          {/* ── 유입 데이터 탭 ── */}
          {page === 'traffic-sources' && <TrafficSources />}

          {/* ── 지역별 현황 탭 ── */}
          {page !== 'indonesia-data' && page !== 'topselling' && page !== 'negative-cm' && page !== 'traffic-sources' && page !== 'city-distribution' && page !== 'bali-catalog' && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">데이터 불러오는 중...</p>
                  </div>
                </div>
              )}

              {!loading && data && summaryForCity && (
                <>
                  {/* 목표 입력 */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">목표 설정 <span className="normal-case font-normal text-slate-400">(단위: 원)</span></p>
                    <div className="grid grid-cols-4 gap-3">
                      {([
                        { label: '월 GMV 목표', field: 'monthlyGmv' as const },
                        { label: '월 CM 목표',  field: 'monthlyCm'  as const },
                        { label: '일 GMV 목표', field: 'dailyGmv'   as const },
                        { label: '일 CM 목표',  field: 'dailyCm'    as const },
                      ]).map(({ label, field }) => (
                        <div key={field}>
                          <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="—"
                              value={targetInputs[field]}
                              onChange={e => updateTarget(field, e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">원</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <KpiCards metrics={summaryForCity} color={cityColor} />
                  <TrendCharts trends={data.trends} color={cityColor} city={city} dailyTarget={{
                    gmv: parseWon(targetInputs.dailyGmv) ?? getDailyTarget(month, city).gmv,
                    cm:  parseWon(targetInputs.dailyCm)  ?? getDailyTarget(month, city).cm,
                  }} />
                  {analysis && <DailyInsights analysis={analysis} />}
                  <PartnerTable partnerSummary={data.partnerSummary} />
                  <HotelRanking hotels={data.hotels} city={city} />
                </>
              )}

              {!loading && !data && (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center">
                    <p className="text-slate-500 font-medium">데이터를 불러올 수 없습니다</p>
                    <button onClick={fetchData} className="mt-3 text-sm text-blue-600 hover:underline">
                      다시 시도
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
