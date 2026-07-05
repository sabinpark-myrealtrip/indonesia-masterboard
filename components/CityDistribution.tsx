'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { CityDistributionRow, CityHotelFlatRow } from '@/lib/types';

const BaliMap = dynamic(() => import('./BaliMap'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-slate-50 rounded-xl">
    <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
  </div>
) });

const BALI_CITIES = new Set([
  'Bali','Canggu','Denpasar','Jimbaran','Kuta',
  'Lembongan Island','Nusa Dua','Penida Island','Sanur','Seminyak','Ubud',
]);

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

function cmrBadge(cmr: number) {
  if (cmr >= 8)  return { label: '우수', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (cmr >= 3)  return { label: '보통', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (cmr >= 0)  return { label: '낮음', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return           { label: '역마진', cls: 'bg-red-50 text-red-600 border-red-200' };
}

interface Props { month: string; }

export default function CityDistribution({ month }: Props) {
  const [distData, setDistData]         = useState<CityDistributionRow[]>([]);
  const [hotelData, setHotelData]       = useState<CityHotelFlatRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [expandedGpids, setExpandedGpids] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setSelectedCity(null);
    setExpandedGpids(new Set());
    Promise.all([
      fetch(`/api/city-distribution?month=${month}`).then(r => r.json()),
      fetch(`/api/city-top-hotels?month=${month}`).then(r => r.json()),
    ]).then(([dist, hotels]) => {
      const distArr: CityDistributionRow[] = Array.isArray(dist) ? dist : [];
      setDistData(distArr);
      setHotelData(Array.isArray(hotels) ? hotels : []);
      const top = distArr.filter(d => BALI_CITIES.has(d.city)).sort((a,b) => b.rsv - a.rsv)[0];
      if (top) setSelectedCity(top.city);
    }).catch(console.error).finally(() => setLoading(false));
  }, [month]);

  function toggleGpid(gpid: string) {
    setExpandedGpids(prev => {
      const next = new Set(prev);
      next.has(gpid) ? next.delete(gpid) : next.add(gpid);
      return next;
    });
  }

  const baliData  = distData.filter(d => BALI_CITIES.has(d.city)).sort((a,b) => b.rsv - a.rsv);
  const otherData = distData.filter(d => !BALI_CITIES.has(d.city)).sort((a,b) => b.rsv - a.rsv);

  // GPID 기준으로 그룹핑
  const gpidGroups = useMemo(() => {
    const rows = hotelData.filter(h => h.city === selectedCity);
    const map = new Map<string, { gidRows: CityHotelFlatRow[]; rsv: number; crsv: number; cgmv: number; cm: number; hotelNm: string }>();
    for (const h of rows) {
      if (!map.has(h.gpid)) {
        map.set(h.gpid, { gidRows: [], rsv: 0, crsv: 0, cgmv: 0, cm: 0, hotelNm: h.hotelNm });
      }
      const g = map.get(h.gpid)!;
      g.gidRows.push(h);
      g.rsv  += h.rsv;
      g.crsv += h.crsv;
      g.cgmv += h.cgmv;
      g.cm   += h.cm;
      // 가장 짧은 이름 (패키지명 제외)
      if (!h.hotelNm.startsWith('[') && h.hotelNm.length < g.hotelNm.length) g.hotelNm = h.hotelNm;
    }
    return Array.from(map.entries())
      .map(([gpid, g]) => ({
        gpid,
        hotelNm: g.hotelNm,
        rsv:  g.rsv,
        crsv: g.crsv,
        cgmv: g.cgmv,
        cm:   g.cm,
        gmv:  g.gidRows.reduce((s, r) => s + (r.cgmv / (r.cfr / 100 || 1)), 0),
        cfr:  g.cgmv > 0 ? parseFloat(((g.crsv / g.rsv) * 100).toFixed(1)) : 0,
        cmr:  g.cgmv > 0 ? parseFloat(((g.cm / g.cgmv) * 100).toFixed(1)) : 0,
        gidRows: g.gidRows.sort((a, b) => b.rsv - a.rsv),
      }))
      .sort((a, b) => b.rsv - a.rsv)
      .slice(0, 15);
  }, [hotelData, selectedCity]);

  const cityStats = distData.find(d => d.city === selectedCity);

  const allCities = [...baliData, ...otherData];
  const totalRsv  = distData.reduce((s, d) => s + d.rsv, 0);

  return (
    <div className="space-y-4">

      {/* 지도 + 사이드 패널 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">발리 도시별 예약 분포 지도</h2>
            <p className="text-xs text-slate-400 mt-0.5">{month} · 원 크기 = RSV 건수 · 색상 = CMR 수준</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {[['#059669','CMR ≥ 8%'],['#d97706','CMR 3~8%'],['#9ca3af','CMR 0~3%'],['#dc2626','역마진']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>

        <div className="flex" style={{ height: 460 }}>
          {/* 지도 */}
          <div className="flex-1 p-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            ) : (
              <BaliMap
                data={baliData}
                selectedCity={selectedCity}
                onSelectCity={setSelectedCity}
              />
            )}
          </div>

          {/* 도시 목록 사이드 패널 */}
          <div className="w-56 border-l border-slate-100 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              발리권 도시
            </p>
            {baliData.map(d => (
              <button
                key={d.city}
                onClick={() => setSelectedCity(d.city)}
                className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                  selectedCity === d.city ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                }`}
              >
                <p className="text-xs font-semibold text-slate-700">{d.city}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-slate-400">{d.rsv.toLocaleString()}건</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cmrBadge(d.cmr).cls}`}>
                    CMR {d.cmr}%
                  </span>
                </div>
                {/* RSV 미니 바 */}
                <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${totalRsv > 0 ? (d.rsv / totalRsv) * 100 * 4 : 0}%`, maxWidth: '100%' }}
                  />
                </div>
              </button>
            ))}
            {otherData.length > 0 && (
              <>
                <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 border-t border-slate-100 mt-1">
                  기타 인도네시아
                </p>
                {otherData.map(d => (
                  <button
                    key={d.city}
                    onClick={() => setSelectedCity(d.city)}
                    className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                      selectedCity === d.city ? 'bg-blue-50 border-l-2 border-l-blue-400' : ''
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{d.city}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-slate-400">{d.rsv.toLocaleString()}건</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cmrBadge(d.cmr).cls}`}>
                        CMR {d.cmr}%
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 선택된 도시의 탑 호텔 */}
      {selectedCity && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{selectedCity} · 탑 호텔 (RSV 순)</h3>
              {cityStats && (
                <p className="text-xs text-slate-400 mt-0.5">
                  도시 합계 — RSV {cityStats.rsv.toLocaleString()}건 · CFR {cityStats.cfr}% · CMR {cityStats.cmr}%
                </p>
              )}
            </div>
            <p className="text-[11px] text-slate-400">부스팅 우선순위: CMR 높고 RSV 성장 여력 있는 호텔</p>
          </div>

          {gpidGroups.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">해당 도시 데이터 없음</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['', '#', 'GPID', '호텔명', 'RSV', 'CRSV', 'CFR', 'CGMV', 'CM', 'CMR', '마진 등급'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gpidGroups.map((g, i) => {
                    const badge   = cmrBadge(g.cmr);
                    const isOpen  = expandedGpids.has(g.gpid);
                    const hasMulti = g.gidRows.length > 1;
                    return (
                      <>
                        {/* GPID 집계 행 */}
                        <tr
                          key={`gpid-${g.gpid}`}
                          onClick={() => hasMulti && toggleGpid(g.gpid)}
                          className={`border-b border-slate-100 transition-colors ${hasMulti ? 'cursor-pointer hover:bg-slate-50' : ''} ${isOpen ? 'bg-emerald-50/40' : ''}`}
                        >
                          <td className="px-3 py-2.5 w-7">
                            {hasMulti && (
                              <span className="text-slate-400 text-sm leading-none select-none">
                                {isOpen ? '▾' : '▸'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-mono text-[11px] text-slate-500">{g.gpid}</div>
                            {!hasMulti && g.gidRows[0]?.partner && (
                              <div className="mt-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">
                                {g.gidRows[0].partner}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700 max-w-[200px] truncate">
                            {g.hotelNm}
                            {hasMulti && (
                              <span className="ml-1.5 text-[10px] font-normal text-slate-400">GID {g.gidRows.length}개</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-700">{g.rsv.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-slate-600">{g.crsv.toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <span className={g.cfr >= 70 ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>{g.cfr}%</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{fmtKrw(g.cgmv)}원</td>
                          <td className="px-3 py-2.5">
                            <span className={g.cm >= 0 ? 'text-slate-600' : 'text-red-500 font-semibold'}>{fmtKrw(g.cm)}원</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            <span className={g.cmr >= 8 ? 'text-emerald-600' : g.cmr >= 3 ? 'text-amber-600' : g.cmr >= 0 ? 'text-slate-500' : 'text-red-500'}>
                              {g.cmr}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                          </td>
                        </tr>

                        {/* GID 하위 행 */}
                        {isOpen && g.gidRows.map((h, j) => (
                          <tr key={`gid-${h.gid}`} className="border-b border-slate-50 bg-slate-50/60">
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-slate-300 font-mono text-[11px]">└ {j + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-mono text-[11px] text-slate-400">{h.gid}</div>
                              {h.partner && (
                                <div className="mt-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block">
                                  {h.partner}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[200px]">
                              <div className="truncate text-slate-600 text-[11px]">{h.hotelNm}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-semibold text-[11px]">{h.rsv.toLocaleString()}</td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">{h.crsv.toLocaleString()}</td>
                            <td className="px-3 py-2 text-[11px]">
                              <span className={h.cfr >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{h.cfr}%</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">{fmtKrw(h.cgmv)}원</td>
                            <td className="px-3 py-2 text-[11px]">
                              <span className={h.cm >= 0 ? 'text-slate-500' : 'text-red-500'}>{fmtKrw(h.cm)}원</span>
                            </td>
                            <td className="px-3 py-2 text-[11px]">
                              <span className={h.cmr >= 8 ? 'text-emerald-600' : h.cmr >= 3 ? 'text-amber-600' : h.cmr >= 0 ? 'text-slate-500' : 'text-red-500'}>
                                {h.cmr}%
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cmrBadge(h.cmr).cls}`}>
                                {cmrBadge(h.cmr).label}
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
      )}
    </div>
  );
}
