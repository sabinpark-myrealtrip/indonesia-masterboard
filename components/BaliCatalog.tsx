'use client';

import { useState, useEffect, useMemo } from 'react';
import type { BaliOptionRow } from '@/lib/bigquery-bali';

type ExpiryFilter = 'all' | 'expired' | 'expiring' | 'ok' | 'always';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getOptionExpiry(row: BaliOptionRow): 'expired' | 'expiring' | 'ok' | 'always' {
  if (!row.applyEndDate || row.applyPeriodType === 'ALL') return 'always';
  const today = getToday();
  const in30 = getDatePlusDays(30);
  if (row.applyEndDate < today) return 'expired';
  if (row.applyEndDate <= in30) return 'expiring';
  return 'ok';
}

const EXPIRY_BADGE: Record<string, { label: string; cls: string }> = {
  expired:  { label: '만료됨',    cls: 'bg-red-100 text-red-700 border border-red-200' },
  expiring: { label: '만료임박',  cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  ok:       { label: '정상',      cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  always:   { label: '상시',      cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const STATUS_BADGE: Record<string, string> = {
  ON_SALE: 'bg-emerald-100 text-emerald-700',
  HOLD:    'bg-yellow-100 text-yellow-700',
  STOP:    'bg-red-100 text-red-700',
};

interface OptionRowData {
  optionId: number;
  optionName: string;
  optionEnabled: boolean;
  applyPeriodType: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  inclusions: string[];
  descriptions: { title: string; text: string }[];
  minNights: number | null;
  expiry: 'expired' | 'expiring' | 'ok' | 'always';
}

interface RoomData {
  roomId: number;
  roomName: string;
  roomStatus: string;
  options: OptionRowData[];
}

interface PropertyData {
  propertyId: number;
  propertyName: string;
  propertyStatus: string;
  propertyType: string;
  rooms: Map<number, RoomData>;
  noRooms: boolean;
}

interface PartnerData {
  partnerId: string;
  partnerName: string;
  partnerGmv: number;
  properties: Map<number, PropertyData>;
}

function buildHierarchy(rows: BaliOptionRow[]): Map<string, PartnerData> {
  const partners = new Map<string, PartnerData>();

  for (const row of rows) {
    if (!partners.has(row.partnerId)) {
      partners.set(row.partnerId, { partnerId: row.partnerId, partnerName: row.partnerName, partnerGmv: row.partnerGmv, properties: new Map() });
    }
    const partner = partners.get(row.partnerId)!;

    if (!partner.properties.has(row.propertyId)) {
      partner.properties.set(row.propertyId, {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        propertyStatus: row.propertyStatus,
        propertyType: row.propertyType,
        rooms: new Map(),
        noRooms: row.roomId === null,
      });
    }
    const prop = partner.properties.get(row.propertyId)!;

    if (row.roomId === null) { prop.noRooms = true; continue; }

    if (!prop.rooms.has(row.roomId)) {
      prop.rooms.set(row.roomId, {
        roomId: row.roomId,
        roomName: row.roomName ?? '',
        roomStatus: row.roomStatus ?? '',
        options: [],
      });
    }
    const room = prop.rooms.get(row.roomId)!;

    if (row.optionId !== null) {
      const expiry = getOptionExpiry(row);
      const exists = room.options.some(o => o.optionId === row.optionId);
      if (!exists) {
        room.options.push({
          optionId: row.optionId,
          optionName: row.optionName ?? '',
          optionEnabled: row.optionEnabled ?? true,
          applyPeriodType: row.applyPeriodType,
          applyStartDate: row.applyStartDate,
          applyEndDate: row.applyEndDate,
          inclusions: row.inclusions,
          descriptions: row.descriptions,
          minNights: row.minNights,
          expiry,
        });
      }
    }
  }

  return partners;
}

function countExpiry(partners: Map<string, PartnerData>): { expired: number; expiring: number } {
  let expired = 0; let expiring = 0;
  for (const p of partners.values()) {
    for (const prop of p.properties.values()) {
      for (const room of prop.rooms.values()) {
        for (const opt of room.options) {
          if (opt.expiry === 'expired') expired++;
          else if (opt.expiry === 'expiring') expiring++;
        }
      }
    }
  }
  return { expired, expiring };
}

export default function BaliCatalog() {
  const [rows, setRows] = useState<BaliOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('HOTEL');
  const [openPartners, setOpenPartners] = useState<Set<string>>(new Set());
  const [openProperties, setOpenProperties] = useState<Set<number>>(new Set());
  const [partnerStatusFilters, setPartnerStatusFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch('/api/bali')
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const hierarchy = useMemo(() => buildHierarchy(rows), [rows]);
  const { expired, expiring } = useMemo(() => countExpiry(hierarchy), [hierarchy]);

  const partnerList = useMemo(() =>
    Array.from(hierarchy.values()).map(p => ({ id: p.partnerId, name: p.partnerName })),
    [hierarchy]
  );

  const filtered = useMemo(() => {
    const result: PartnerData[] = [];
    for (const partner of hierarchy.values()) {
      if (partnerFilter !== 'all' && partner.partnerId !== partnerFilter) continue;

      const filteredProps: PropertyData[] = [];
      for (const prop of partner.properties.values()) {
        if (categoryFilter !== 'all' && prop.propertyType !== categoryFilter) continue;
        if (expiryFilter === 'all') {
          filteredProps.push(prop);
          continue;
        }
        // filter rooms by expiry
        const filteredRooms = new Map<number, RoomData>();
        for (const [rid, room] of prop.rooms.entries()) {
          const opts = room.options.filter(o => o.expiry === expiryFilter);
          if (opts.length > 0) {
            filteredRooms.set(rid, { ...room, options: opts });
          }
        }
        if (filteredRooms.size > 0) {
          filteredProps.push({ ...prop, rooms: filteredRooms });
        }
      }
      if (filteredProps.length > 0) {
        result.push({ ...partner, properties: new Map(filteredProps.map(p => [p.propertyId, p])) });
      }
    }
    return result;
  }, [hierarchy, expiryFilter, partnerFilter, categoryFilter]);

  function togglePartner(id: string) {
    setOpenPartners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleProperty(id: number) {
    setOpenProperties(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenPartners(new Set(Array.from(hierarchy.keys())));
    setOpenProperties(new Set(Array.from(hierarchy.values()).flatMap(p => Array.from(p.properties.keys()))));
  }

  function collapseAll() {
    setOpenPartners(new Set());
    setOpenProperties(new Set());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">발리 상품 카탈로그 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="py-12 text-center text-red-500">오류: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* 알림 배너 */}
      {(expired > 0 || expiring > 0) && (
        <div className="flex gap-3 flex-wrap">
          {expired > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
            >
              <span className="text-red-500 text-lg">⚠</span>
              <span className="text-sm font-semibold text-red-700">만료된 옵션 {expired}개</span>
              <span className="text-xs text-red-500">클릭하여 필터</span>
            </div>
          )}
          {expiring > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
              onClick={() => setExpiryFilter(expiryFilter === 'expiring' ? 'all' : 'expiring')}
            >
              <span className="text-yellow-500 text-lg">⏰</span>
              <span className="text-sm font-semibold text-yellow-700">30일 내 만료 {expiring}개</span>
              <span className="text-xs text-yellow-500">클릭하여 필터</span>
            </div>
          )}
        </div>
      )}

      {/* 필터 바 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">파트너</span>
          <select
            value={partnerFilter}
            onChange={e => setPartnerFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          >
            <option value="all">전체 ({partnerList.length}개)</option>
            {partnerList.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">카테고리</span>
          {(['all', 'HOTEL', 'RESORT', 'HANIN_MINBAK'] as string[]).map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                categoryFilter === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {c === 'all' ? '전체' : c === 'HOTEL' ? '호텔' : c === 'RESORT' ? '리조트' : '한인민박'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">옵션 기간</span>
          {(['all', 'expired', 'expiring', 'ok', 'always'] as ExpiryFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setExpiryFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                expiryFilter === f
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {f === 'all' ? '전체' : f === 'expired' ? '만료됨' : f === 'expiring' ? '만료임박' : f === 'ok' ? '정상' : '상시'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={expandAll} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 border border-slate-200 rounded-lg">전체 펼치기</button>
          <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 border border-slate-200 rounded-lg">전체 접기</button>
        </div>
      </div>

      {/* 파트너 목록 */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">필터 조건에 해당하는 항목이 없습니다</div>
      ) : (
        filtered.map(partner => {
          const isPartnerOpen = openPartners.has(partner.partnerId);
          const propList = Array.from(partner.properties.values());
          const partnerExpired = propList.flatMap(p => Array.from(p.rooms.values()).flatMap(r => r.options)).filter(o => o.expiry === 'expired').length;
          const partnerExpiring = propList.flatMap(p => Array.from(p.rooms.values()).flatMap(r => r.options)).filter(o => o.expiry === 'expiring').length;

          const statusFilter = partnerStatusFilters[partner.partnerId] ?? 'all';
          const availableStatuses = Array.from(new Set(propList.map(p => p.propertyStatus)));
          const statusFilteredProps = propList.filter(p => statusFilter === 'all' || p.propertyStatus === statusFilter);

          return (
            <div key={partner.partnerId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* 파트너 헤더 */}
              <button
                onClick={() => togglePartner(partner.partnerId)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏢</span>
                  <div>
                    <span className="font-semibold text-slate-900 text-sm">{partner.partnerName}</span>
                    <span className="ml-1.5 text-xs text-slate-400 font-mono">#{partner.partnerId}</span>
                    <span className="ml-2 text-xs text-slate-400">상품 {propList.length}개</span>
                  </div>
                  {partnerExpired > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full border border-red-200">만료 {partnerExpired}</span>
                  )}
                  {partnerExpiring > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full border border-yellow-200">임박 {partnerExpiring}</span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">{isPartnerOpen ? '▲' : '▼'}</span>
              </button>

              {/* 상품 목록 */}
              {isPartnerOpen && (
                <>
                  {/* 상품 상태 필터 */}
                  <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">상품 상태</span>
                    {(['all', ...availableStatuses] as string[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setPartnerStatusFilters(prev => ({ ...prev, [partner.partnerId]: s }))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          statusFilter === s
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {s === 'all' ? `전체 (${propList.length})` : s === 'ON_SALE' ? `판매중 (${propList.filter(p => p.propertyStatus === s).length})` : s === 'HOLD' ? `일시중단 (${propList.filter(p => p.propertyStatus === s).length})` : s === 'STOP' ? `판매중지 (${propList.filter(p => p.propertyStatus === s).length})` : `${s} (${propList.filter(p => p.propertyStatus === s).length})`}
                      </button>
                    ))}
                  </div>
                <div className="divide-y divide-slate-100">
                  {statusFilteredProps.map(prop => {
                    const isPropOpen = openProperties.has(prop.propertyId);
                    const roomList = Array.from(prop.rooms.values());
                    const allOptions = roomList.flatMap(r => r.options);
                    const propExpired = allOptions.filter(o => o.expiry === 'expired').length;
                    const propExpiring = allOptions.filter(o => o.expiry === 'expiring').length;

                    return (
                      <div key={prop.propertyId} className="ml-4 border-l-2 border-slate-100">
                        {/* 상품 헤더 */}
                        <button
                          onClick={() => toggleProperty(prop.propertyId)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-sm">🏨</span>
                            <span className="text-sm font-medium text-slate-800">{prop.propertyName}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[prop.propertyStatus] ?? 'bg-slate-100 text-slate-500'}`}>
                              {prop.propertyStatus}
                            </span>
                            {prop.noRooms && <span className="text-xs text-slate-400">객실 없음</span>}
                            {roomList.length > 0 && <span className="text-xs text-slate-400">객실 {roomList.length}개 · 옵션 {allOptions.length}개</span>}
                            {propExpired > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded border border-red-200">만료 {propExpired}</span>}
                            {propExpiring > 0 && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded border border-yellow-200">임박 {propExpiring}</span>}
                          </div>
                          <span className="text-slate-400 text-xs ml-4">{isPropOpen ? '▲' : '▼'}</span>
                        </button>

                        {/* 객실 & 옵션 테이블 */}
                        {isPropOpen && roomList.length > 0 && (
                          <div className="px-4 pb-3 space-y-3">
                            {roomList.map(room => (
                              <div key={room.roomId} className="rounded-lg border border-slate-200 overflow-hidden">
                                {/* 객실 헤더 */}
                                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2">
                                  <span className="text-xs">🛏</span>
                                  <span className="text-xs font-semibold text-slate-700">{room.roomName}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    room.roomStatus === 'ON_SALE' ? 'bg-emerald-100 text-emerald-600' :
                                    room.roomStatus === 'HOLD' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>{room.roomStatus}</span>
                                </div>

                                {/* 옵션 목록 */}
                                {room.options.length === 0 ? (
                                  <div className="px-4 py-2 text-xs text-slate-400">옵션 없음</div>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-white">
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium w-44">옵션명</th>
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium">포함혜택</th>
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium w-16">최소숙박</th>
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium">상세설명</th>
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium w-36">적용기간</th>
                                        <th className="text-left px-3 py-2 text-slate-400 font-medium w-20">상태</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {room.options.map(opt => {
                                        const badge = EXPIRY_BADGE[opt.expiry];
                                        const periodText = opt.applyPeriodType === 'ALL'
                                          ? '상시'
                                          : opt.applyStartDate && opt.applyEndDate
                                            ? `${opt.applyStartDate} ~ ${opt.applyEndDate}`
                                            : opt.applyEndDate ?? '-';
                                        return (
                                          <tr key={opt.optionId} className={`border-b border-slate-50 last:border-0 ${!opt.optionEnabled ? 'opacity-50' : ''} ${opt.expiry === 'expired' ? 'bg-red-50/40' : opt.expiry === 'expiring' ? 'bg-yellow-50/40' : ''}`}>
                                            <td className="px-3 py-2 font-medium text-slate-700">{opt.optionName}</td>
                                            <td className="px-3 py-2">
                                              <div className="flex flex-wrap gap-1">
                                                {opt.inclusions.length === 0
                                                  ? <span className="text-slate-300">-</span>
                                                  : opt.inclusions.map((inc, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">{inc}</span>
                                                  ))
                                                }
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 text-[11px] font-medium">
                                              {opt.minNights ? `${opt.minNights}박+` : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex flex-wrap gap-1">
                                                {opt.descriptions.length === 0
                                                  ? <span className="text-slate-300">-</span>
                                                  : opt.descriptions.map((d, i) => (
                                                    <span key={i} title={d.text} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-200 cursor-help text-[11px]">{d.title}</span>
                                                  ))
                                                }
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{periodText}</td>
                                            <td className="px-3 py-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
