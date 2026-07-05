export type City = '전체' | '발리';

export const CITIES: City[] = ['전체', '발리'];

export const CITY_COLORS: Record<City, string> = {
  전체: '#6B7280',
  발리: '#059669',
};

// 발리 = Bali 지역 전체 도시 통합 (Canggu, Ubud, Seminyak 등 포함)
export const CITY_BQ_MAP: Record<City, string[]> = {
  전체: [],
  발리: ['Bali', 'Canggu', 'Denpasar', 'Jimbaran', 'Kuta', 'Lembongan Island', 'Nusa Dua', 'Penida Island', 'Sanur', 'Seminyak', 'Ubud'],
};

export const TOPSELLING_CITIES: string[] = ['전체', '발리'];

export const TOPSELLING_CITY_BQ_MAP: Record<string, string[]> = {
  전체: [],
  발리: ['Bali', 'Canggu', 'Denpasar', 'Jimbaran', 'Kuta', 'Lembongan Island', 'Nusa Dua', 'Penida Island', 'Sanur', 'Seminyak', 'Ubud'],
};

export interface SummaryMetrics {
  city: City;
  gmv: number;
  cgmv: number;
  cm: number;
  cmr: number;
  cfr: number;
  tr: number;
  rsvCnt: number;
  crsvCnt: number;
  detailUv: number;
  purchaseCompleteUv?: number;
  targetGmv?: number;
  targetCm?: number;
  targetCgmv?: number;
  targetCfr?: number;
}

export interface PartnerSummary {
  partner: string;
  rsvCnt: number;
  crsvCnt: number;
  cfr: number;
  cgmv: number;
  cm: number;
  cmr: number;
}

export interface HotelRow {
  gpid: string;
  hotelNm: string;
  city: City | string;
  category?: string;
  gmv: number;
  cgmv: number;
  cm: number;
  cmr: number;
  cfr: number;
  rsvCnt: number;
  crsvCnt: number;
  tr: number;
  uv: number;
}

export interface TrendRow {
  basisDate: string;
  cityGroup: City | string;
  gmv: number;
  cgmv: number;
  cm: number;
  rsvCnt: number;
  crsvCnt: number;
  cfr: number;
  detailUv: number;
  purchaseCompleteUv: number;
}

export interface ReservationRow {
  resveId: string;
  partner: string;
  hotelNm: string;
  bookingDate: string;
  elapsedDays: number;
  salesKrwPrice: number;
  status: string;
  city: string;
}

export interface CfrDailyRow {
  basisDate: string;
  partner: string;
  cfrPct: number;
  cancelPartner: number;
  cancelCustomer: number;
  rsvCnt: number;
  crsvCnt: number;
}

export interface MonthlyMetrics {
  rsv: number;
  crsv: number;
  gmv: number;
  cgmv: number;
  cm: number;
  cmr: number;
  cfr: number;
  uv: number;
  purchaseCompleteUv?: number;
  cvr: number;
}

export interface PartnerMonthRow {
  partner: string;
  months: Record<string, MonthlyMetrics>;
}

export interface CityMonthRow {
  city: string;
  total: Record<string, MonthlyMetrics>;
  partners: PartnerMonthRow[];
}

export interface MonthlyData {
  months: string[];
  rows: CityMonthRow[];
}

export interface PeriodMetrics {
  gmv: number;
  cm: number;
  cmr: number;
  cfr: number;
  cvr: number;   // rsvCnt / detailUv * 100
  rsvCnt: number;
  detailUv: number;
}

export interface CityPeriodRow {
  city: string;
  current: PeriodMetrics;
  wow: PeriodMetrics | null;
  mom: PeriodMetrics | null;
  yoy: PeriodMetrics | null;
}

export interface ComparisonData {
  currentLabel: string;
  wowLabel: string;
  momLabel: string;
  yoyLabel: string;
  rows: CityPeriodRow[];
}

export interface HotelDailyRow {
  gpid: string;
  hotelNm: string;
  city: string;
  basisDate: string;
  rsv: number;
  crsv: number;
  cgmv: number;
  cfr: number;
}

export interface HotelAnomaly {
  gpid: string;
  hotelNm: string;
  city: string;
  d1Rsv: number;
  d2Rsv: number;
  d1Cgmv: number;
  d2Cgmv: number;
  avgRsv: number;  // 7일 평균
}

export interface DailyInsight {
  d1: string;
  d2: string;
  d1Gmv: number;
  d2Gmv: number;
  d1Cm: number;
  d2Cm: number;
  d1Rsv: number;
  d2Rsv: number;
  anomalies: HotelAnomaly[];
}

// ── FPNA 성과 기준 (MART_FPNA_NONAIR_PROFIT_D, CONFIRM/REFUND 이벤트 기반) ──

export interface FpnaMonthRow {
  month: string;
  confirmOrders: number;
  confirmGmv: number;
  refundOrders: number;
  refundGmv: number;
  netCgmv: number;
  confirmCm: number;
  refundCm: number;
  netCm: number;
  cmr: number;
  cfr: number;
}

export interface FpnaMonthlyData {
  months: string[];
  rows: FpnaMonthRow[];
}

// 일별/월별/연도별 공통 — period 필드만 다름
export interface FpnaPeriodRow {
  period: string;   // "2026-06-27" | "2026-06" | "2026"
  confirmOrders: number;
  confirmGmv: number;
  refundOrders: number;
  refundGmv: number;
  netCgmv: number;
  confirmCm: number;
  refundCm: number;
  netCm: number;
  cmr: number;
  cfr: number;
}

export interface FpnaPartnerData {
  partner: string;
  rows: FpnaPeriodRow[];  // same order as FpnaPeriodData.periods
}

export interface FpnaPeriodData {
  periods: string[];
  rows: FpnaPeriodRow[];         // period-level aggregates
  partners: FpnaPartnerData[];   // per-partner breakdown
}

export interface TopSellingRow {
  gpid: string;
  hotelNm: string;
  city: string;
  gmv: number;
  cm: number;
  gmvShare: number;
  rank: number;
  rsv: number;
  rn: number;
}

export interface HotelNegativeCmRow {
  basisDate: string;
  gpid: string;
  hotelNm: string;
  city: string;
  crsvCnt: number;
  cgmv: number;
  cm: number;
  cmr: number;
}

export interface DashboardData {
  summary: SummaryMetrics[];
  partnerSummary: PartnerSummary[];
  hotels: HotelRow[];
  trends: TrendRow[];
  hotelDaily: HotelDailyRow[];
  reservations: ReservationRow[];
  cfrDaily: CfrDailyRow[];
  basisMonth: string;
  dailyInsight?: DailyInsight;
}

export interface CityDistributionRow {
  city: string;
  rsv: number;
  crsv: number;
  cfr: number;
  gmv: number;
  cgmv: number;
  cm: number;
  cmr: number;
}

// GPID 하위 개별 GID 행 (flat으로 반환, 프론트에서 GPID 기준으로 그룹핑)
export interface CityHotelFlatRow {
  city: string;
  gpid: string;   // 그룹 속성 ID (집계 키)
  gid: string;    // 개별 상품 ID
  partner: string;
  hotelNm: string;
  rsv: number;
  crsv: number;
  cfr: number;
  cgmv: number;
  cm: number;
  cmr: number;
}

export interface TrafficSourceRow {
  city: string;
  utmSource: string;
  detailUv: number;
  purchaseUv: number;
}

export interface TrafficSourceDailyRow {
  basisDate: string;
  city: string;
  utmSource: string;
  detailUv: number;
  purchaseUv: number;
}

export interface PromotionRow {
  basisHour: string;
  campaignId: string;
  resve: number;
  gmv: number;
  cresve: number;
  cgmv: number;
  cm: number;
  lastUpdatedAt: string;
}
