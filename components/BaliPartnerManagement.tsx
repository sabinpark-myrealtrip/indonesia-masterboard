'use client';

import React, { useState, useEffect } from 'react';

interface Partner {
  id: string;
  name: string;
  type: string;
  contactPerson: string;
  contactInfo: string;
  contractStatus: 'active' | 'negotiating' | 'inactive';
  memo: string;
}

interface Product {
  id: string;
  partnerId: string;
  name: string;
  category: string;
  priceRange: string;
  usp: string;
  targetAudience: string;
  promotionable: boolean;
  memo: string;
}

const CONTRACT_STATUS_LABEL: Record<Partner['contractStatus'], string> = {
  active: '계약중',
  negotiating: '협의중',
  inactive: '미계약',
};

const CONTRACT_STATUS_COLOR: Record<Partner['contractStatus'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  negotiating: 'bg-amber-100 text-amber-700',
  inactive: 'bg-slate-100 text-slate-500',
};

const PARTNER_TYPES = ['호텔', '빌라', '리조트', '부티크호텔', '게스트하우스', '기타'];
const CATEGORIES = ['럭셔리 풀빌라', '패밀리 리조트', '허니문 빌라', '비즈니스 호텔', '부티크 호텔', '해변 리조트', '산악 리조트', '기타'];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const EMPTY_PARTNER: Omit<Partner, 'id'> = {
  name: '', type: '호텔', contactPerson: '', contactInfo: '',
  contractStatus: 'active', memo: '',
};

const EMPTY_PRODUCT: Omit<Product, 'id' | 'partnerId'> = {
  name: '', category: '럭셔리 풀빌라', priceRange: '', usp: '',
  targetAudience: '', promotionable: false, memo: '',
};

interface BqProduct {
  partnerId: number;
  partnerName: string;
  gid: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  starRating: number | null;
  propertyStatus: string;
}

const PARTNER_IDS = [124209, 131403, 140457, 157933, 158637, 159133, 159164];

interface WtmInfo {
  room?: string;
  option: string;
  benefits: string[];
  note: string;
}

const WTM_BENEFITS: { key: string; data: WtmInfo }[] = [
  {
    key: '림바 바이 아야나',
    data: {
      room: '리조트뷰',
      option: '조식 패키지',
      benefits: [
        '웰컴 드링크 및 객실 내 제철 현지과일 1회 제공',
        '락바 우선입장 가능 & 테바나 가든 & 사카 박물관 무료 이용',
        '무료 WiFi 제공 & 아야나 어플 채팅 컨시어지',
        '피트니스 센터, 스팀룸, 사우나 무제한 이용',
      ],
      note: '특전은 호텔 사정 상 사전 공지 없이 변경 될 수 있습니다.',
    },
  },
  {
    key: '아야나 리조트',
    data: {
      room: '리조트뷰',
      option: '조식 패키지',
      benefits: [
        '웰컴 드링크 및 객실 내 제철 현지과일 1회 제공',
        '미니바 1회 무료 제공',
        '락바 우선입장 가능 & 테바나 가든 & 사카 박물관 무료 이용',
        '무료 WiFi 제공 & 아야나 어플 채팅 컨시어지',
        '피트니스 센터, 스팀룸, 사우나 무제한 이용',
      ],
      note: '특전은 호텔 사정 상 사전 공지 없이 변경 될 수 있습니다.',
    },
  },
  {
    key: '아야나 세가라',
    data: {
      room: '리조트뷰',
      option: '조식 패키지',
      benefits: [
        '루나 루프탑바에서 웰컴 드링크 및 객실 내 제철 현지과일 1회 제공',
        '미니바 1회 무료 제공',
        '락바 우선입장 가능 & 테바나 가든 & 사카 박물관 무료 이용',
        '무료 WiFi 제공 & 아야나 어플 채팅 컨시어지',
        '피트니스 센터, 스팀룸, 사우나 무제한 이용',
      ],
      note: '특전은 호텔 사정 상 사전 공지 없이 변경 될 수 있습니다.',
    },
  },
  {
    key: '카욘',
    data: {
      option: '조식 패키지',
      benefits: [
        '웰컴 과일 제공',
        '매일 요가 클래스',
        '매일 아침 빌리지 워킹',
        '우붓센터까지 무료셔틀 운행 (스케쥴 운행)',
        '[3박이상] 2인 60분 마사지 1회 제공',
        '[5박이상] 2인 60분 마사지 1회 & 3코스 세트 런치 1회 제공',
      ],
      note: '호텔 사정 상 사전 공지 없이 변경 될 수 있습니다.',
    },
  },
];

function getWtmInfo(propertyName: string): WtmInfo | null {
  const match = WTM_BENEFITS.find(w => propertyName.includes(w.key));
  return match ? match.data : null;
}

const STATUS_COLOR: Record<string, string> = {
  ON_SALE: 'bg-emerald-100 text-emerald-700',
  HOLD: 'bg-slate-100 text-slate-500',
  PREPARING: 'bg-amber-100 text-amber-700',
  REVIEW: 'bg-blue-100 text-blue-600',
};

type SubTab = 'partners' | 'products' | 'comparison' | 'bq-products';

export default function BaliPartnerManagement() {
  const [subTab, setSubTab] = useState<SubTab>('partners');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // 파트너 폼
  const [partnerForm, setPartnerForm] = useState<Omit<Partner, 'id'>>(EMPTY_PARTNER);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [showPartnerForm, setShowPartnerForm] = useState(false);

  // 상품 폼
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, 'id' | 'partnerId'>>(EMPTY_PRODUCT);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  // 비교 분석
  const [compareCategory, setCompareCategory] = useState<string>('');

  // BQ 상품 현황
  const [bqProducts, setBqProducts] = useState<BqProduct[]>([]);
  const [bqLoading, setBqLoading] = useState(false);
  const [bqError, setBqError] = useState<string | null>(null);
  const [bqStatusFilter, setBqStatusFilter] = useState<string>('ON_SALE');
  const [bqPartnerFilter, setBqPartnerFilter] = useState<number | 'all'>('all');
  const [expandedGids, setExpandedGids] = useState<Set<string>>(new Set());

  function toggleGid(gid: string) {
    setExpandedGids(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  useEffect(() => {
    setPartners(loadFromStorage<Partner[]>('bali:partners', []));
    setProducts(loadFromStorage<Product[]>('bali:products', []));
  }, []);

  async function fetchBqProducts() {
    setBqLoading(true);
    setBqError(null);
    try {
      const res = await fetch('/api/partner-gids');
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'API error');
      setBqProducts(json);
    } catch (e) {
      setBqError(String(e));
    } finally {
      setBqLoading(false);
    }
  }

  useEffect(() => {
    if (subTab === 'bq-products' && bqProducts.length === 0 && !bqLoading) {
      fetchBqProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // 파트너 저장
  function savePartner() {
    if (!partnerForm.name.trim()) return;
    let next: Partner[];
    if (editingPartnerId) {
      next = partners.map(p => p.id === editingPartnerId ? { id: editingPartnerId, ...partnerForm } : p);
    } else {
      next = [...partners, { id: genId(), ...partnerForm }];
    }
    setPartners(next);
    saveToStorage('bali:partners', next);
    setPartnerForm(EMPTY_PARTNER);
    setEditingPartnerId(null);
    setShowPartnerForm(false);
  }

  function deletePartner(id: string) {
    const next = partners.filter(p => p.id !== id);
    const nextProducts = products.filter(p => p.partnerId !== id);
    setPartners(next);
    setProducts(nextProducts);
    saveToStorage('bali:partners', next);
    saveToStorage('bali:products', nextProducts);
    if (selectedPartnerId === id) setSelectedPartnerId(null);
  }

  function startEditPartner(p: Partner) {
    setPartnerForm({ name: p.name, type: p.type, contactPerson: p.contactPerson, contactInfo: p.contactInfo, contractStatus: p.contractStatus, memo: p.memo });
    setEditingPartnerId(p.id);
    setShowPartnerForm(true);
  }

  // 상품 저장
  function saveProduct() {
    if (!productForm.name.trim() || !selectedPartnerId) return;
    let next: Product[];
    if (editingProductId) {
      next = products.map(p => p.id === editingProductId ? { id: editingProductId, partnerId: selectedPartnerId, ...productForm } : p);
    } else {
      next = [...products, { id: genId(), partnerId: selectedPartnerId, ...productForm }];
    }
    setProducts(next);
    saveToStorage('bali:products', next);
    setProductForm(EMPTY_PRODUCT);
    setEditingProductId(null);
    setShowProductForm(false);
  }

  function deleteProduct(id: string) {
    const next = products.filter(p => p.id !== id);
    setProducts(next);
    saveToStorage('bali:products', next);
  }

  function startEditProduct(p: Product) {
    setProductForm({ name: p.name, category: p.category, priceRange: p.priceRange, usp: p.usp, targetAudience: p.targetAudience, promotionable: p.promotionable, memo: p.memo });
    setEditingProductId(p.id);
    setShowProductForm(true);
  }

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);
  const partnerProducts = products.filter(p => p.partnerId === selectedPartnerId);

  // 비교 분석: 카테고리별 상품 그룹
  const allCategories = Array.from(new Set(products.map(p => p.category)));
  const compareProducts = products.filter(p => p.category === compareCategory);

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-100">
          {([
            { key: 'partners', label: '파트너 목록', emoji: '🤝' },
            { key: 'products', label: '상품 관리', emoji: '🏨' },
            { key: 'comparison', label: '상품 비교 분석', emoji: '🔍' },
            { key: 'bq-products', label: 'BQ 상품 현황', emoji: '📋' },
          ] as { key: SubTab; label: string; emoji: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-5 py-3.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                subTab === t.key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 파트너 목록 탭 ── */}
        {subTab === 'partners' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">총 {partners.length}개 파트너</p>
              <button
                onClick={() => { setPartnerForm(EMPTY_PARTNER); setEditingPartnerId(null); setShowPartnerForm(v => !v); }}
                className="text-sm px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                + 파트너 추가
              </button>
            </div>

            {/* 파트너 추가/편집 폼 */}
            {showPartnerForm && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <p className="text-sm font-semibold text-slate-700">{editingPartnerId ? '파트너 수정' : '새 파트너 추가'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">파트너명 *</label>
                    <input
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 아야나 리조트"
                      value={partnerForm.name}
                      onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">유형</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={partnerForm.type}
                      onChange={e => setPartnerForm(f => ({ ...f, type: e.target.value }))}
                    >
                      {PARTNER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">담당자</label>
                    <input
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="담당자명"
                      value={partnerForm.contactPerson}
                      onChange={e => setPartnerForm(f => ({ ...f, contactPerson: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">연락처</label>
                    <input
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="이메일 또는 전화번호"
                      value={partnerForm.contactInfo}
                      onChange={e => setPartnerForm(f => ({ ...f, contactInfo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">계약 상태</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={partnerForm.contractStatus}
                      onChange={e => setPartnerForm(f => ({ ...f, contractStatus: e.target.value as Partner['contractStatus'] }))}
                    >
                      <option value="active">계약중</option>
                      <option value="negotiating">협의중</option>
                      <option value="inactive">미계약</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">메모</label>
                    <input
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="참고 사항"
                      value={partnerForm.memo}
                      onChange={e => setPartnerForm(f => ({ ...f, memo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={savePartner} className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">저장</button>
                  <button onClick={() => { setShowPartnerForm(false); setEditingPartnerId(null); }} className="text-sm px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
                </div>
              </div>
            )}

            {/* 파트너 테이블 */}
            {partners.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">파트너를 추가해주세요</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">파트너명</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">유형</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">담당자</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">연락처</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">상태</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">상품수</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">메모</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {partners.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.type}</td>
                        <td className="px-4 py-3 text-slate-600">{p.contactPerson || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.contactInfo || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_STATUS_COLOR[p.contractStatus]}`}>
                            {CONTRACT_STATUS_LABEL[p.contractStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-blue-600 font-medium">{products.filter(pr => pr.partnerId === p.id).length}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-32 truncate">{p.memo || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditPartner(p)}
                              className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            >수정</button>
                            <button
                              onClick={() => deletePartner(p.id)}
                              className="text-xs px-2 py-1 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
                            >삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 상품 관리 탭 ── */}
        {subTab === 'products' && (
          <div className="flex">
            {/* 파트너 선택 사이드바 */}
            <div className="w-48 border-r border-slate-100 p-3 space-y-1 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 pb-1">파트너 선택</p>
              {partners.length === 0 && (
                <p className="text-xs text-slate-400 px-2">파트너 없음</p>
              )}
              {partners.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPartnerId(p.id); setShowProductForm(false); setEditingProductId(null); }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    selectedPartnerId === p.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="ml-1 text-xs text-slate-400">({products.filter(pr => pr.partnerId === p.id).length})</span>
                </button>
              ))}
            </div>

            {/* 상품 목록 */}
            <div className="flex-1 p-5">
              {!selectedPartnerId ? (
                <div className="text-center py-12 text-slate-400 text-sm">왼쪽에서 파트너를 선택하세요</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-800">{selectedPartner?.name} 상품 목록</p>
                    <button
                      onClick={() => { setProductForm(EMPTY_PRODUCT); setEditingProductId(null); setShowProductForm(v => !v); }}
                      className="text-sm px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      + 상품 추가
                    </button>
                  </div>

                  {/* 상품 폼 */}
                  {showProductForm && (
                    <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-sm font-semibold text-slate-700">{editingProductId ? '상품 수정' : '새 상품 추가'}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">상품명 *</label>
                          <input
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="예: 오션뷰 풀빌라 디럭스"
                            value={productForm.name}
                            onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">카테고리</label>
                          <select
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={productForm.category}
                            onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}
                          >
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">가격대</label>
                          <input
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="예: 1박 50만~80만원"
                            value={productForm.priceRange}
                            onChange={e => setProductForm(f => ({ ...f, priceRange: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">타겟 고객층</label>
                          <input
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="예: 허니무너, 가족 여행객"
                            value={productForm.targetAudience}
                            onChange={e => setProductForm(f => ({ ...f, targetAudience: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">차별점 / USP</label>
                          <textarea
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="예: 전 객실 개인 수영장, 클리프 뷰, 버틀러 서비스 포함"
                            rows={2}
                            value={productForm.usp}
                            onChange={e => setProductForm(f => ({ ...f, usp: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">메모</label>
                          <input
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="참고 사항"
                            value={productForm.memo}
                            onChange={e => setProductForm(f => ({ ...f, memo: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="promotionable"
                            checked={productForm.promotionable}
                            onChange={e => setProductForm(f => ({ ...f, promotionable: e.target.checked }))}
                            className="rounded"
                          />
                          <label htmlFor="promotionable" className="text-sm text-slate-600">프로모션 가능</label>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={saveProduct} className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">저장</button>
                        <button onClick={() => { setShowProductForm(false); setEditingProductId(null); }} className="text-sm px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
                      </div>
                    </div>
                  )}

                  {/* 상품 카드 목록 */}
                  {partnerProducts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">등록된 상품이 없습니다</div>
                  ) : (
                    <div className="space-y-3">
                      {partnerProducts.map(pr => (
                        <div key={pr.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-800">{pr.name}</span>
                                <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded">{pr.category}</span>
                                {pr.promotionable && (
                                  <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-600 rounded">프로모션 가능</span>
                                )}
                              </div>
                              {pr.priceRange && <p className="text-sm text-slate-500 mt-1">💰 {pr.priceRange}</p>}
                              {pr.targetAudience && <p className="text-sm text-slate-500">👥 {pr.targetAudience}</p>}
                              {pr.usp && (
                                <p className="text-sm text-slate-600 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                  ✨ {pr.usp}
                                </p>
                              )}
                              {pr.memo && <p className="text-xs text-slate-400 mt-1.5">📝 {pr.memo}</p>}
                            </div>
                            <div className="flex gap-1 ml-3 flex-shrink-0">
                              <button onClick={() => startEditProduct(pr)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">수정</button>
                              <button onClick={() => deleteProduct(pr.id)} className="text-xs px-2 py-1 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-colors">삭제</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 비교 분석 탭 ── */}
        {subTab === 'comparison' && (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm font-medium text-slate-700">카테고리 선택</label>
              <select
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={compareCategory}
                onChange={e => setCompareCategory(e.target.value)}
              >
                <option value="">— 선택 —</option>
                {allCategories.map(c => (
                  <option key={c} value={c}>{c} ({products.filter(p => p.category === c).length}개 상품)</option>
                ))}
              </select>
            </div>

            {!compareCategory ? (
              <div className="text-center py-12 text-slate-400 text-sm">비교할 카테고리를 선택하세요</div>
            ) : compareProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">해당 카테고리에 상품이 없습니다</div>
            ) : (
              <div>
                <p className="text-sm text-slate-500 mb-3">{compareCategory} — {compareProducts.length}개 상품 비교</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">파트너</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">상품명</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">가격대</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">타겟</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">차별점 / USP</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">프로모션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {compareProducts.map(pr => {
                        const partner = partners.find(p => p.id === pr.partnerId);
                        return (
                          <tr key={pr.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-slate-700">{partner?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-800">{pr.name}</td>
                            <td className="px-4 py-3 text-slate-600">{pr.priceRange || '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{pr.targetAudience || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs">
                              {pr.usp ? (
                                <span className="bg-amber-50 border border-amber-100 rounded px-2 py-1 text-xs">{pr.usp}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {pr.promotionable
                                ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">가능</span>
                                : <span className="text-xs text-slate-400">—</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 프로모션 후보 요약 */}
                {compareProducts.filter(p => p.promotionable).length > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">프로모션 기획 후보</p>
                    <div className="space-y-1.5">
                      {compareProducts.filter(p => p.promotionable).map(pr => {
                        const partner = partners.find(p => p.id === pr.partnerId);
                        return (
                          <div key={pr.id} className="text-sm text-emerald-700">
                            • <span className="font-medium">{partner?.name}</span> — {pr.name}
                            {pr.usp && <span className="text-emerald-600 ml-1">({pr.usp})</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* ── BQ 상품 현황 탭 ── */}
        {subTab === 'bq-products' && (
          <div className="p-5">
            {/* 필터 */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">상태</label>
                <select
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bqStatusFilter}
                  onChange={e => setBqStatusFilter(e.target.value)}
                >
                  <option value="all">전체</option>
                  <option value="ON_SALE">ON_SALE</option>
                  <option value="HOLD">HOLD</option>
                  <option value="PREPARING">PREPARING</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">파트너</label>
                <select
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bqPartnerFilter === 'all' ? 'all' : String(bqPartnerFilter)}
                  onChange={e => setBqPartnerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">전체 파트너</option>
                  {PARTNER_IDS.map(pid => {
                    const bqName = bqProducts.find(p => p.partnerId === pid)?.partnerName;
                    return (
                      <option key={pid} value={pid}>
                        {bqName ? `${bqName} (${pid})` : String(pid)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                onClick={fetchBqProducts}
                disabled={bqLoading}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 ml-auto"
              >
                <span className={bqLoading ? 'animate-spin inline-block' : ''}>↻</span>
                {bqLoading ? '로딩 중...' : '새로고침'}
              </button>
            </div>

            {bqError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{bqError}</div>
            )}

            {bqLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">BigQuery에서 불러오는 중...</p>
                </div>
              </div>
            )}

            {!bqLoading && !bqError && (() => {
              const filtered = bqProducts.filter(p =>
                (bqStatusFilter === 'all' || p.propertyStatus === bqStatusFilter) &&
                (bqPartnerFilter === 'all' || p.partnerId === bqPartnerFilter)
              );

              // 파트너별 그룹핑
              const grouped = PARTNER_IDS.reduce<Record<number, BqProduct[]>>((acc, pid) => {
                const items = filtered.filter(p => p.partnerId === pid);
                if (items.length > 0) acc[pid] = items;
                return acc;
              }, {});

              if (filtered.length === 0) {
                return <div className="text-center py-12 text-slate-400 text-sm">조건에 맞는 상품이 없습니다</div>;
              }

              return (
                <div className="space-y-6">
                  <p className="text-xs text-slate-400">총 {filtered.length}개 상품</p>
                  {Object.entries(grouped).map(([pidStr, items]) => {
                    const pid = Number(pidStr);
                    const partnerName = items[0]?.partnerName ?? String(pid);
                    const onSaleCnt = items.filter(i => i.propertyStatus === 'ON_SALE').length;

                    return (
                      <div key={pid} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">{partnerName}</span>
                            <span className="text-xs text-slate-400 font-mono">#{pid}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                              ON_SALE {onSaleCnt}
                            </span>
                            <span className="text-slate-400">총 {items.length}개</span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-100">
                              <tr>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-28">GID</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">상품명</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-20">유형</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-16">별점</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-24">상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {items.map(item => {
                                const wtm = item.partnerId === 124209 ? getWtmInfo(item.propertyName) : null;
                                const expanded = expandedGids.has(item.gid);
                                return (
                                  <React.Fragment key={item.gid}>
                                    <tr
                                      className={`transition-colors ${wtm ? 'cursor-pointer hover:bg-indigo-50/60' : 'hover:bg-slate-50/80'}`}
                                      onClick={() => wtm && toggleGid(item.gid)}
                                    >
                                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{item.gid}</td>
                                      <td className="px-4 py-2.5 text-slate-800 font-medium">{item.propertyName}</td>
                                      <td className="px-4 py-2.5 text-slate-500 text-xs">{item.propertyType}</td>
                                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                                        {item.starRating != null ? `⭐${item.starRating}` : '—'}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-between">
                                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[item.propertyStatus] ?? 'bg-slate-100 text-slate-500'}`}>
                                            {item.propertyStatus}
                                          </span>
                                          {wtm && (
                                            <span className="text-slate-400 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                    {wtm && expanded && (
                                      <tr className="bg-indigo-50/40 border-t border-indigo-100">
                                        <td colSpan={5} className="px-6 py-3">
                                          <div className="flex items-start gap-6 text-xs">
                                            <div className="space-y-0.5 flex-shrink-0">
                                              {wtm.room && (
                                                <div className="text-slate-500"><span className="font-medium text-slate-600">객실</span> {wtm.room}</div>
                                              )}
                                              <div className="text-slate-500"><span className="font-medium text-slate-600">옵션</span> {wtm.option}</div>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              {wtm.benefits.map((b, i) => (
                                                <div key={i} className="text-slate-600 flex items-start gap-1.5">
                                                  <span className="text-indigo-400 mt-px flex-shrink-0">•</span>
                                                  {b}
                                                </div>
                                              ))}
                                              <div className="text-slate-400 mt-1.5 italic">※ {wtm.note}</div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
