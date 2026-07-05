'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { PromotionRow } from '@/lib/types';

// ── localStorage 저장 ──────────────────────────────────────────────
const STORAGE_KEY = 'promotion_saved_v2';

interface SavedPromotion {
  id: string;
  campaignId: string;
  idType: 'gid' | 'gpid';
  idsText: string;
  startDate: string;
  endDate: string;
  tGmvInput: string;
  tCmInput: string;
}

function loadSaved(): SavedPromotion[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function saveToDB(item: SavedPromotion) {
  const list = loadSaved().filter(s => s.id !== item.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...list]));
}
function deleteFromDB(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadSaved().filter(s => s.id !== id)));
}

// ── 포맷 헬퍼 ─────────────────────────────────────────────────────
function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return Math.round(n).toLocaleString('ko-KR');
}
function fmtFull(n: number) { return Math.round(n).toLocaleString('ko-KR'); }

// ── 공통 카드 컴포넌트 ─────────────────────────────────────────────
function KpiCard({
  label, value, unit, target, isCount,
}: {
  label: string; value: number; unit?: string;
  target?: number | null; isCount?: boolean;
}) {
  const display = isCount ? value.toLocaleString('ko-KR') : fmtKrw(value);
  const pct = target ? Math.min((value / target) * 100, 100) : null;
  const achv = target ? (value / target) * 100 : null;
  const barColor = achv == null ? '#94a3b8'
    : achv >= 100 ? '#059669' : achv >= 70 ? '#D97706' : '#DC2626';
  const badgeClass = achv == null ? '' : achv >= 100
    ? 'text-emerald-600 bg-emerald-50' : achv >= 70
    ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight mt-2">
        {display}{unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
      {target != null && achv != null && (
        <div className="mt-3">
          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>진척률 <span className={`font-semibold px-1 py-0.5 rounded ${badgeClass}`}>{achv.toFixed(1)}%</span></span>
            <span>목표 {isCount ? target.toLocaleString() : fmtKrw(target)}{unit}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight mt-2">{value}</p>
    </div>
  );
}

// ── 누적 집계 ──────────────────────────────────────────────────────
function computeCumulative(rows: PromotionRow[]) {
  const gmv    = rows.reduce((s, r) => s + r.gmv, 0);
  const cgmv   = rows.reduce((s, r) => s + r.cgmv, 0);
  const cm     = rows.reduce((s, r) => s + r.cm, 0);
  const resve  = rows.reduce((s, r) => s + r.resve, 0);
  const cresve = rows.reduce((s, r) => s + r.cresve, 0);
  const cfr    = gmv > 0 ? (cgmv / gmv) * 100 : 0;
  const cmr    = cgmv > 0 ? (cm / cgmv) * 100 : 0;
  return { gmv, cgmv, cm, resve, cresve, cfr, cmr, lastUpdatedAt: rows[rows.length - 1]?.lastUpdatedAt ?? '' };
}

// ── 누적 뷰 ───────────────────────────────────────────────────────
function CumulativeView({ rows, tGmv, tCm }: { rows: PromotionRow[]; tGmv: number | null; tCm: number | null }) {
  const c = computeCumulative(rows);
  const cfrColor = c.cfr >= 85 ? 'text-emerald-600' : c.cfr >= 70 ? 'text-amber-600' : 'text-red-500';
  const cmrColor = c.cmr >= 5 ? 'text-emerald-600' : c.cmr >= 3 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="GMV" value={c.gmv} unit="원" target={tGmv} />
        <KpiCard label="CM" value={c.cm} unit="원" target={tCm} />
        <KpiCard label="CGMV" value={c.cgmv} unit="원" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="예약수 (RESVE)" value={c.resve} unit="건" isCount />
        <KpiCard label="확정 예약수 (CRESVE)" value={c.cresve} unit="건" isCount />
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex gap-6 items-center">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">CFR</p>
            <p className={`text-2xl font-bold leading-tight mt-2 ${cfrColor}`}>{c.cfr.toFixed(1)}%</p>
          </div>
          <div className="w-px h-10 bg-slate-100" />
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">CMR</p>
            <p className={`text-2xl font-bold leading-tight mt-2 ${cmrColor}`}>{c.cmr.toFixed(1)}%</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-slate-400">마지막 업데이트</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.lastUpdatedAt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 일별 추이 차트 ────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="text-slate-500 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmtFull(p.value)}원
        </p>
      ))}
    </div>
  );
};

function TrendSection({
  rows, tGmv, tCm, startDate, endDate,
}: {
  rows: PromotionRow[];
  tGmv: number | null; tCm: number | null;
  startDate: string; endDate: string;
}) {
  const totalDays = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1,
  );
  const dailyTargetGmv = tGmv ? tGmv / totalDays : null;
  const dailyTargetCm  = tCm  ? tCm  / totalDays : null;

  const chartData = rows.map(r => ({
    date: r.basisHour.slice(5),
    GMV: r.gmv,
    CM: r.cm,
  }));

  const gmvValues = rows.map(r => r.gmv);
  const cmValues  = rows.map(r => r.cm);
  const gmvMax = Math.max(...gmvValues, dailyTargetGmv ?? 0) * 1.1;
  const gmvMin = Math.min(...gmvValues, dailyTargetGmv ?? Infinity) * 0.9;
  const cmMax  = Math.max(...cmValues,  dailyTargetCm  ?? 0) * 1.1;
  const cmMin  = Math.min(...cmValues,  dailyTargetCm  ?? Infinity) * 0.9;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">일별 추이</h2>
        {dailyTargetGmv && (
          <p className="text-xs text-slate-400">
            데일리 타겟 GMV <span className="font-semibold text-red-400">{fmtKrw(dailyTargetGmv)}원</span>
            {dailyTargetCm && <> · CM <span className="font-semibold text-red-400">{fmtKrw(dailyTargetCm)}원</span></>}
          </p>
        )}
      </div>
      <div className="flex gap-4">
        {/* GMV 차트 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">GMV</p>
          <p className="text-lg font-bold text-slate-800 mb-3">{fmtKrw(rows.reduce((s,r) => s+r.gmv,0))}원</p>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pgmv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40}
                domain={[gmvMin, gmvMax]} tickFormatter={fmtKrw} tickCount={4} />
              <Tooltip content={<ChartTooltip />} />
              {dailyTargetGmv != null && (
                <ReferenceLine y={dailyTargetGmv} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `목표 ${fmtKrw(dailyTargetGmv)}`, position: 'insideTopRight', fontSize: 9, fill: '#ef4444', fontWeight: 600 }} />
              )}
              <Area type="monotone" dataKey="GMV" stroke="#6366f1" strokeWidth={2} fill="url(#pgmv)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* CM 차트 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">CM</p>
          <p className="text-lg font-bold text-slate-800 mb-3">{fmtKrw(rows.reduce((s,r) => s+r.cm,0))}원</p>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pcm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40}
                domain={[cmMin, cmMax]} tickFormatter={fmtKrw} tickCount={4} />
              <Tooltip content={<ChartTooltip />} />
              {dailyTargetCm != null && (
                <ReferenceLine y={dailyTargetCm} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `목표 ${fmtKrw(dailyTargetCm)}`, position: 'insideTopRight', fontSize: 9, fill: '#ef4444', fontWeight: 600 }} />
              )}
              <Area type="monotone" dataKey="CM" stroke="#f59e0b" strokeWidth={2} fill="url(#pcm)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── 데일리 테이블 ─────────────────────────────────────────────────
function DailyTable({ rows }: { rows: PromotionRow[] }) {
  const c = computeCumulative(rows);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700">일별 상세</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-semibold">날짜</th>
              <th className="px-4 py-2.5 text-right font-semibold">GMV</th>
              <th className="px-4 py-2.5 text-right font-semibold">CGMV</th>
              <th className="px-4 py-2.5 text-right font-semibold">CFR</th>
              <th className="px-4 py-2.5 text-right font-semibold">CM</th>
              <th className="px-4 py-2.5 text-right font-semibold">CMR</th>
              <th className="px-4 py-2.5 text-right font-semibold">예약수</th>
              <th className="px-4 py-2.5 text-right font-semibold">확정예약</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => {
              const cfr = r.gmv > 0 ? (r.cgmv / r.gmv) * 100 : 0;
              const cmr = r.cgmv > 0 ? (r.cm / r.cgmv) * 100 : 0;
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{r.basisHour.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmtFull(r.gmv)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmtFull(r.cgmv)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-semibold ${cfr >= 85 ? 'text-emerald-600' : cfr >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                      {cfr.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmtFull(r.cm)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-semibold ${cmr >= 5 ? 'text-emerald-600' : cmr >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                      {cmr.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{r.resve.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{r.cresve.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-semibold text-slate-700 border-t border-slate-200">
              <td className="px-4 py-2.5">합계</td>
              <td className="px-4 py-2.5 text-right">{fmtFull(c.gmv)}</td>
              <td className="px-4 py-2.5 text-right">{fmtFull(c.cgmv)}</td>
              <td className="px-4 py-2.5 text-right">{c.cfr.toFixed(1)}%</td>
              <td className="px-4 py-2.5 text-right">{fmtFull(c.cm)}</td>
              <td className="px-4 py-2.5 text-right">{c.cmr.toFixed(1)}%</td>
              <td className="px-4 py-2.5 text-right">{c.resve.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right">{c.cresve.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function Promotion() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [campaignId, setCampaignId] = useState('');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [idType, setIdType] = useState<'gid' | 'gpid'>('gid');
  const [idsText, setIdsText] = useState('');
  const [showTargets, setShowTargets] = useState(false);
  const [tGmvInput, setTGmvInput] = useState('');
  const [tCmInput, setTCmInput] = useState('');
  const [view, setView] = useState<'누적' | '데일리'>('누적');
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedId, setSearchedId] = useState('');
  const [searchedStart, setSearchedStart] = useState('');
  const [searchedEnd, setSearchedEnd] = useState('');
  const [savedList, setSavedList] = useState<SavedPromotion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { setSavedList(loadSaved()); }, []);

  const tGmv = tGmvInput ? Number(tGmvInput.replace(/,/g, '')) : null;
  const tCm  = tCmInput  ? Number(tCmInput.replace(/,/g, ''))  : null;
  const canSearch = !!(campaignId.trim() && idsText.trim() && startDate && endDate);

  async function handleSearch() {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        campaign_id: campaignId.trim(), start_date: startDate,
        end_date: endDate, id_type: idType, ids: idsText.trim(),
      });
      const res = await fetch(`/api/promotion?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'API error');
      setRows(json.rows ?? []);
      setSearched(true);
      setSearchedId(campaignId.trim());
      setSearchedStart(startDate);
      setSearchedEnd(endDate);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    const id = activeId ?? `${campaignId}_${Date.now()}`;
    const item: SavedPromotion = {
      id, campaignId, idType, idsText, startDate, endDate, tGmvInput, tCmInput,
    };
    saveToDB(item);
    setSavedList(loadSaved());
    setActiveId(id);
  }

  function handleLoad(item: SavedPromotion) {
    setCampaignId(item.campaignId);
    setIdType(item.idType);
    setIdsText(item.idsText);
    setStartDate(item.startDate);
    setEndDate(item.endDate);
    setTGmvInput(item.tGmvInput);
    setTCmInput(item.tCmInput);
    setActiveId(item.id);
    if (item.tGmvInput || item.tCmInput) setShowTargets(true);
  }

  function handleDelete(id: string) {
    deleteFromDB(id);
    setSavedList(loadSaved());
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="space-y-5">
      {/* 저장된 프로모션 목록 */}
      {savedList.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">저장된 프로모션</p>
          <div className="flex flex-wrap gap-2">
            {savedList.map(item => (
              <div
                key={item.id}
                onClick={() => handleLoad(item)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  activeId === item.id
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] text-slate-400 uppercase">{item.idType}</span>
                <span>{item.campaignId}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{item.startDate.slice(5)} ~ {item.endDate.slice(5)}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                  className="ml-1 text-slate-300 hover:text-red-400 transition-colors"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 폼 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-4">프로모션 조회</p>

        {/* 1행: Campaign ID + 기간 */}
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Campaign ID</label>
            <input type="text" value={campaignId} onChange={e => setCampaignId(e.target.value)}
              placeholder="예: AcmJapan_zip"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* 2행: GID/GPID + ID 목록 + 버튼 */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">ID 유형</label>
            <div className="flex bg-slate-100 rounded-lg p-0.5 h-[34px]">
              {(['gid', 'gpid'] as const).map(t => (
                <button key={t} onClick={() => setIdType(t)}
                  className={`px-3 text-xs font-semibold rounded-md transition-all ${
                    idType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-slate-500 font-medium">
              {idType === 'gid' ? 'GID 목록' : 'GPID 목록'}
              <span className="text-slate-400 font-normal ml-1">(쉼표 또는 줄바꿈으로 구분)</span>
            </label>
            <textarea value={idsText} onChange={e => setIdsText(e.target.value)}
              placeholder={idType === 'gid' ? '예: 12345, 67890' : '예: 98765, 43210'}
              rows={2}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none w-full" />
          </div>
          <div className="flex flex-col justify-end">
            <label className="text-xs text-slate-500 font-medium invisible">.</label>
            <div className="flex gap-2">
              <button onClick={handleSearch} disabled={loading || !canSearch}
                className="px-5 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors h-[34px]">
                {loading ? '조회 중...' : '조회'}
              </button>
              <button onClick={handleSave} disabled={!canSearch}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors h-[34px]">
                저장
              </button>
            </div>
          </div>
        </div>

        {/* 목표치 입력 */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button onClick={() => setShowTargets(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors">
            <span className={`transition-transform inline-block ${showTargets ? 'rotate-90' : ''}`}>▶</span>
            목표치 직접 입력 (선택사항)
          </button>
          {showTargets && (
            <div className="mt-3 flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">목표 GMV (원)</label>
                <input type="text" inputMode="numeric" value={tGmvInput}
                  onChange={e => setTGmvInput(e.target.value)} placeholder="예: 2,485,600,000"
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">목표 CM (원)</label>
                <input type="text" inputMode="numeric" value={tCmInput}
                  onChange={e => setTCmInput(e.target.value)} placeholder="예: 56,451,468"
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </div>

      {/* 결과 없음 */}
      {!searched && !loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Campaign ID와 GID/GPID를 입력하고 조회하세요
        </div>
      )}
      {searched && rows.length === 0 && !loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          해당 기간에 데이터가 없습니다
        </div>
      )}

      {/* 결과 */}
      {searched && rows.length > 0 && (
        <>
          {/* 헤더 + 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-800">{searchedId}</p>
              <p className="text-xs text-slate-400 mt-0.5">{searchedStart} ~ {searchedEnd}</p>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {(['누적', '데일리'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                    view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 일별 추이 (항상 표시) */}
          <TrendSection rows={rows} tGmv={tGmv} tCm={tCm} startDate={searchedStart} endDate={searchedEnd} />

          {/* 누적 / 데일리 */}
          {view === '누적'
            ? <CumulativeView rows={rows} tGmv={tGmv} tCm={tCm} />
            : <DailyTable rows={rows} />}
        </>
      )}
    </div>
  );
}
