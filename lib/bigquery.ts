/**
 * BigQuery 연동 - Redash Query #26250 구조 기반
 *
 * 주요 테이블:
 *   edw_fpna.MART_FPNA_LODGMENT_PROFIT_D  — 메인 매출/수익 데이터
 *   edw.DW_MRT_STAY_PROPERTY              — 숙소 property 정보
 *   edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION — 도시/국가 매핑
 *   edw.DW_MRT_STAY_RESERVATION           — 예약 상세 (TR 계산용)
 *
 * 지표 정의 (Redash #26250 기준):
 *   GMV    = SUM(SALES_KRW_PRICE) 전체
 *   CGMV   = SUM(SALES_KRW_PRICE) WHERE status IN ('confirm','finish')
 *   CFR    = CGMV / GMV * 100  ← GMV 기준 확정률
 *   CM     = CON_MARGIN = MRT_SALES_PRICE - 쿠폰/포인트/채널피/대행수수료
 *   CMR    = CM / CGMV * 100
 *   TR     = reservation_profit / total_payment_inclusive * 100
 *   ORDER_CNT  = COUNT(DISTINCT ORDER_ID)
 *   CORDER_CNT = COUNT(DISTINCT ORDER_ID) WHERE confirmed
 */

import { BigQuery } from '@google-cloud/bigquery';
import {
  City, CITIES, CITY_BQ_MAP, TOPSELLING_CITY_BQ_MAP, DashboardData, SummaryMetrics, HotelRow,
  TrendRow, ReservationRow, CfrDailyRow, PartnerSummary, HotelDailyRow,
  ComparisonData, CityPeriodRow, PeriodMetrics,
  MonthlyData, MonthlyMetrics, CityMonthRow, PartnerMonthRow,
  TopSellingRow, HotelNegativeCmRow, TrafficSourceRow, TrafficSourceDailyRow,
  CityDistributionRow, CityHotelFlatRow,
  FpnaMonthRow, FpnaMonthlyData,
  FpnaPeriodRow, FpnaPeriodData, FpnaPartnerData,
} from './types';

let bqClient: BigQuery | null = null;

function getBQClient(): BigQuery {
  if (!bqClient) {
    const projectId = process.env.BQ_PROJECT_ID ?? 'myrealtrip-data';
    const location = process.env.BQ_LOCATION ?? 'asia-northeast1';
    const credentialsJson = process.env.BIGQUERY_CREDENTIALS_JSON;
    if (credentialsJson) {
      bqClient = new BigQuery({ credentials: JSON.parse(credentialsJson), projectId, location });
    } else {
      bqClient = new BigQuery({ projectId, location });
    }
  }
  return bqClient;
}

/**
 * gid_list CTE — Redash #26250 기준
 * DW_MRT_STAY_PROPERTY + DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION
 */
function buildGidListCTE(city: City): string {
  const cityClause = city === '전체'
    ? ''
    : `AND r.city_key_name IN (${CITY_BQ_MAP[city].map(c => `'${c}'`).join(', ')})`;

  return `
  gid_list AS (
    SELECT DISTINCT
      CAST(sp.property_id AS STRING) AS GID,
      r.city_key_name                AS CITY_NM,
      r.country_key_name             AS COUNTRY_NM,
      sp.provider_code,
      sp.ko_name                     AS PRODUCT_TITLE,
      sp.represent_category           AS REPRESENT_CATEGORY
    FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
    JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
      ON sp.property_id = r.property_id
    WHERE r.country_key_name = 'Indonesia'
      AND LOWER(sp.ko_name) NOT LIKE '%[b2b%'
      AND LOWER(sp.ko_name) NOT LIKE '%[마이팩]%'
      AND LOWER(sp.ko_name) NOT LIKE '%[나연팩]%'
      ${cityClause}
  )`;
}

/** sales_raw CTE — 기간별 raw 매출 데이터 */
function buildSalesRawCTE(startDate: string, endDate: string): string {
  return `
  sales_raw AS (
    SELECT
      p.BASIS_DATE,
      g.CITY_NM,
      g.provider_code,
      g.GID,
      g.PRODUCT_TITLE,
      COUNT(DISTINCT p.ORDER_ID)                                                              AS ORDER_CNT,
      SUM(p.SALES_KRW_PRICE)                                                                 AS GMV,
      COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END)  AS CORDER_CNT,
      SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS CGMV,
      SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
        p.SALES_COMMISSION_PRICE
        - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
        - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
      ELSE 0 END)                                                                            AS CON_MARGIN,
      SUM(sr.reservation_profit)                                                             AS reservation_profit,
      SUM(sr.total_payment_inclusive)                                                        AS total_payment_inclusive
    FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` AS p
    JOIN gid_list AS g ON CAST(p.GID AS STRING) = g.GID
    LEFT JOIN \`edw.DW_MRT_STAY_RESERVATION\` AS sr ON sr.mrt_reservation_no = p.resve_id
    WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY 1, 2, 3, 4, 5
  )`;
}

function buildBaseCTEs(city: City, startDate: string, endDate: string): string {
  return `WITH ${buildGidListCTE(city)}, ${buildSalesRawCTE(startDate, endDate)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchDashboardData(basisMonth: string, city: City): Promise<DashboardData> {
  const bq = getBQClient();
  const [year, month] = basisMonth.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const [summaryRows, detailUvMap, partnerRows, hotelRows, trendRows, hotelDailyRows] = await Promise.all([
    fetchSummary(bq, startDate, endDate, city),
    fetchDetailUv(bq, startDate, endDate, city),
    fetchPartnerSummary(bq, startDate, endDate, city),
    fetchHotels(bq, startDate, endDate, city),
    fetchTrends(bq, startDate, endDate, city),
    fetchHotelDaily(bq, city),
  ]);

  // detailUv + purchaseCompleteUv를 summary에 병합
  const summaryWithUv = summaryRows.map(s => ({
    ...s,
    detailUv: detailUvMap[s.city]?.detailUv ?? 0,
    purchaseCompleteUv: detailUvMap[s.city]?.purchaseCompleteUv ?? 0,
  }));

  return {
    summary: summaryWithUv,
    partnerSummary: partnerRows,
    hotels: hotelRows,
    trends: trendRows,
    hotelDaily: hotelDailyRows,
    reservations: [],
    cfrDaily: [],
    basisMonth,
  };
}

// ---------------------------------------------------------------------------
// Summary — 도시별 집계
// ---------------------------------------------------------------------------

async function fetchSummary(
  bq: BigQuery, startDate: string, endDate: string, city: City
): Promise<SummaryMetrics[]> {
  // 역매핑 (BQ city_key_name → 한글)
  const reverseMap: Record<string, City> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP) as [City, string[]][]) {
    for (const eng of engList) reverseMap[eng] = kor;
  }

  if (city !== '전체') {
    // 단일 도시 쿼리
    const query = `
      ${buildBaseCTEs(city, startDate, endDate)},
      agg AS (
        SELECT
          SUM(GMV)        AS gmv,
          SUM(CGMV)       AS cgmv,
          SUM(CON_MARGIN) AS cm,
          SUM(ORDER_CNT)  AS order_cnt,
          SUM(CORDER_CNT) AS corder_cnt,
          SAFE_DIVIDE(SUM(reservation_profit), SUM(total_payment_inclusive)) * 100 AS tr
        FROM sales_raw
      )
      SELECT * FROM agg
    `;
    const [rows] = await bq.query({ query });
    const r = rows[0] ?? {};
    const gmv = Number(r.gmv ?? 0);
    const cgmv = Number(r.cgmv ?? 0);
    const cm = Number(r.cm ?? 0);
    return [{
      city,
      gmv, cgmv, cm,
      cmr: cgmv > 0 ? parseFloat(((cm / cgmv) * 100).toFixed(1)) : 0,
      cfr: gmv > 0 ? parseFloat(((cgmv / gmv) * 100).toFixed(1)) : 0,
      tr: parseFloat((Number(r.tr ?? 0)).toFixed(1)),
      rsvCnt: Number(r.order_cnt ?? 0),
      crsvCnt: Number(r.corder_cnt ?? 0),
      detailUv: 0,
    }];
  }

  // 전체: Japan 전체 한 번에 쿼리 → city_key_name 기준 그룹바이
  const query = `
    ${buildBaseCTEs('전체', startDate, endDate)},
    agg AS (
      SELECT
        CITY_NM,
        SUM(GMV)        AS gmv,
        SUM(CGMV)       AS cgmv,
        SUM(CON_MARGIN) AS cm,
        SUM(ORDER_CNT)  AS order_cnt,
        SUM(CORDER_CNT) AS corder_cnt,
        SAFE_DIVIDE(SUM(reservation_profit), SUM(total_payment_inclusive)) * 100 AS tr
      FROM sales_raw
      GROUP BY CITY_NM
    )
    SELECT * FROM agg
  `;
  const [rows] = await bq.query({ query });

  // 5대 도시별 집계
  const cityMap: Record<string, SummaryMetrics> = {};
  const total: SummaryMetrics = { city: '전체', gmv:0, cgmv:0, cm:0, cmr:0, cfr:0, tr:0, rsvCnt:0, crsvCnt:0, detailUv:0 };
  let trSum = 0; let trCount = 0;

  for (const r of rows) {
    const engCity = String(r.CITY_NM ?? '');
    const korCity = reverseMap[engCity];
    const gmv = Number(r.gmv ?? 0);
    const cgmv = Number(r.cgmv ?? 0);
    const cm = Number(r.cm ?? 0);
    const rsvCnt = Number(r.order_cnt ?? 0);
    const crsvCnt = Number(r.corder_cnt ?? 0);
    const tr = Number(r.tr ?? 0);

    // 전체 합산 (모든 Japan 도시)
    total.gmv += gmv; total.cgmv += cgmv; total.cm += cm;
    total.rsvCnt += rsvCnt; total.crsvCnt += crsvCnt;
    if (tr > 0) { trSum += tr; trCount++; }

    // 5대 도시만 개별 집계
    if (korCity) {
      if (!cityMap[korCity]) {
        cityMap[korCity] = { city: korCity, gmv:0, cgmv:0, cm:0, cmr:0, cfr:0, tr:0, rsvCnt:0, crsvCnt:0, detailUv:0 };
      }
      cityMap[korCity].gmv += gmv; cityMap[korCity].cgmv += cgmv; cityMap[korCity].cm += cm;
      cityMap[korCity].rsvCnt += rsvCnt; cityMap[korCity].crsvCnt += crsvCnt;
    }
  }

  total.cmr = total.cgmv > 0 ? parseFloat(((total.cm / total.cgmv) * 100).toFixed(1)) : 0;
  total.cfr = total.gmv > 0 ? parseFloat(((total.cgmv / total.gmv) * 100).toFixed(1)) : 0;
  total.tr = trCount > 0 ? parseFloat((trSum / trCount).toFixed(1)) : 0;

  const KOR_CITIES: City[] = ['발리'];
  const citySummaries = KOR_CITIES.map(c => {
    const s = cityMap[c] ?? { city: c, gmv:0, cgmv:0, cm:0, cmr:0, cfr:0, tr:0, rsvCnt:0, crsvCnt:0, detailUv:0 };
    s.cmr = s.cgmv > 0 ? parseFloat(((s.cm / s.cgmv) * 100).toFixed(1)) : 0;
    s.cfr = s.gmv > 0 ? parseFloat(((s.cgmv / s.gmv) * 100).toFixed(1)) : 0;
    return s;
  });

  return [total, ...citySummaries];
}

// ---------------------------------------------------------------------------
// Detail UV — 도시별 상세 페이지 UV (MART_BIZ_LOG_PID_CONVERSION_D)
// ---------------------------------------------------------------------------

async function fetchDetailUv(
  bq: BigQuery, startDate: string, endDate: string, city: City
): Promise<Record<string, { detailUv: number; purchaseCompleteUv: number }>> {
  const query = `
    ${buildBaseCTEs(city, startDate, endDate)}
    SELECT
      g.CITY_NM,
      COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                         AS detail_uv,
      COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)          AS purchase_complete_uv
    FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` AS c
    JOIN gid_list AS g ON CAST(c.ITEM_ID AS STRING) = g.GID
    WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY g.CITY_NM
  `;

  const bqToKorean: Record<string, City> = {};
  for (const [kor, bqCities] of Object.entries(CITY_BQ_MAP) as [City, string[]][]) {
    for (const bqCity of bqCities) {
      bqToKorean[bqCity] = kor;
    }
  }

  const [rows] = await bq.query({ query });
  const map: Record<string, { detailUv: number; purchaseCompleteUv: number }> = {};
  let totalDetailUv = 0;
  let totalPurchaseCompleteUv = 0;

  for (const r of rows) {
    const bqCity = String(r.CITY_NM ?? '');
    const duv = Number(r.detail_uv ?? 0);
    const pcuv = Number(r.purchase_complete_uv ?? 0);
    totalDetailUv += duv;
    totalPurchaseCompleteUv += pcuv;
    const korCity = bqToKorean[bqCity];
    if (korCity) {
      map[korCity] = {
        detailUv: (map[korCity]?.detailUv ?? 0) + duv,
        purchaseCompleteUv: (map[korCity]?.purchaseCompleteUv ?? 0) + pcuv,
      };
    }
  }
  map['전체'] = { detailUv: totalDetailUv, purchaseCompleteUv: totalPurchaseCompleteUv };
  return map;
}

// ---------------------------------------------------------------------------
// Partner Summary — provider_code별 집계
// ---------------------------------------------------------------------------

async function fetchPartnerSummary(
  bq: BigQuery, startDate: string, endDate: string, city: City
): Promise<PartnerSummary[]> {
  const query = `
    ${buildBaseCTEs(city, startDate, endDate)}
    SELECT
      provider_code                                                           AS partner,
      SUM(ORDER_CNT)                                                          AS rsv_cnt,
      SUM(CORDER_CNT)                                                         AS crsv_cnt,
      SUM(GMV)                                                                AS gmv,
      SUM(CGMV)                                                               AS cgmv,
      SUM(CON_MARGIN)                                                         AS cm,
      SAFE_DIVIDE(SUM(CGMV), SUM(GMV)) * 100                                 AS cfr,
      SAFE_DIVIDE(SUM(CON_MARGIN), SUM(CGMV)) * 100                          AS cmr
    FROM sales_raw
    WHERE provider_code IS NOT NULL
    GROUP BY provider_code
    ORDER BY cgmv DESC
    LIMIT 20
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    partner: String(r.partner ?? ''),
    rsvCnt: Number(r.rsv_cnt ?? 0),
    crsvCnt: Number(r.crsv_cnt ?? 0),
    cgmv: Number(r.cgmv ?? 0),
    cm: Number(r.cm ?? 0),
    cfr: parseFloat(Number(r.cfr ?? 0).toFixed(1)),
    cmr: parseFloat(Number(r.cmr ?? 0).toFixed(1)),
  }));
}

// ---------------------------------------------------------------------------
// Hotels — GPID별 순위
// ---------------------------------------------------------------------------

async function fetchHotels(
  bq: BigQuery, startDate: string, endDate: string, city: City
): Promise<HotelRow[]> {
  const query = `
    ${buildBaseCTEs(city, startDate, endDate)},
    hotel_uv AS (
      SELECT
        CAST(c.ITEM_ID AS STRING) AS GID,
        COUNT(DISTINCT c.pid)     AS uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` AS c
      JOIN gid_list AS g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND c.OFFER_DETAIL_FLAG = 1
      GROUP BY 1
    )
    SELECT
      s.GID,
      MAX(s.PRODUCT_TITLE)                                                    AS hotel_nm,
      MAX(s.CITY_NM)                                                          AS city_nm,
      MAX(mp.STANDARD_CATEGORY_LV_3_CD)                                      AS category_cd,
      SUM(s.ORDER_CNT)                                                        AS rsv_cnt,
      SUM(s.CORDER_CNT)                                                       AS crsv_cnt,
      SUM(s.GMV)                                                              AS gmv,
      SUM(s.CGMV)                                                             AS cgmv,
      SUM(s.CON_MARGIN)                                                       AS cm,
      SAFE_DIVIDE(SUM(s.CGMV), SUM(s.GMV)) * 100                             AS cfr,
      SAFE_DIVIDE(SUM(s.CON_MARGIN), SUM(s.CGMV)) * 100                      AS cmr,
      COALESCE(MAX(u.uv), 0)                                                  AS uv
    FROM sales_raw s
    LEFT JOIN \`edw_mart.MART_PRODUCT_D\` mp ON CAST(s.GID AS STRING) = CAST(mp.GID AS STRING)
    LEFT JOIN hotel_uv u ON CAST(s.GID AS STRING) = u.GID
    WHERE s.GID IS NOT NULL
    GROUP BY s.GID
    ORDER BY gmv DESC
    LIMIT 100
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    gpid: String(r.GID ?? ''),
    hotelNm: String(r.hotel_nm ?? ''),
    city: String(r.city_nm ?? ''),
    category: String(r.category_cd ?? ''),
    gmv: Number(r.gmv ?? 0),
    cgmv: Number(r.cgmv ?? 0),
    cm: Number(r.cm ?? 0),
    cmr: parseFloat(Number(r.cmr ?? 0).toFixed(1)),
    cfr: parseFloat(Number(r.cfr ?? 0).toFixed(1)),
    rsvCnt: Number(r.rsv_cnt ?? 0),
    crsvCnt: Number(r.crsv_cnt ?? 0),
    tr: 0,
    uv: Number(r.uv ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Trends — 일별 추이
// ---------------------------------------------------------------------------

async function fetchTrends(
  bq: BigQuery, startDate: string, endDate: string, city: City
): Promise<TrendRow[]> {
  const isAll = city === '전체';

  // 전체: 날짜별만 집계 (cityGroup = '전체') — 모든 Japan 도시 포함
  // 도시별: 날짜 × 도시 집계
  const groupBy = isAll ? '1' : '1, 2';
  const citySelect = isAll ? `'전체' AS city_nm` : `CITY_NM AS city_nm`;
  const uvCitySelect = isAll ? `'전체' AS city_nm` : `g.CITY_NM AS city_nm`;
  const uvGroupBy = isAll ? '1' : '1, 2';

  const query = `
    ${buildBaseCTEs(city, startDate, endDate)},
    daily_uv AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', c.BASIS_DATE)                                                   AS basis_date,
        ${uvCitySelect},
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                        AS detail_uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)        AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` AS c
      JOIN gid_list AS g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY ${uvGroupBy}
    ),
    daily_sales AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', BASIS_DATE) AS basis_date,
        ${citySelect},
        SUM(ORDER_CNT)                      AS rsv_cnt,
        SUM(CORDER_CNT)                     AS crsv_cnt,
        SUM(GMV)                            AS gmv,
        SUM(CGMV)                           AS cgmv,
        SUM(CON_MARGIN)                     AS cm,
        SAFE_DIVIDE(SUM(CGMV), SUM(GMV)) * 100 AS cfr
      FROM sales_raw
      GROUP BY ${groupBy}
    )
    SELECT
      s.basis_date,
      s.city_nm                           AS city_group,
      s.rsv_cnt,
      s.crsv_cnt,
      s.gmv,
      s.cgmv,
      s.cm,
      s.cfr,
      COALESCE(u.detail_uv, 0)            AS detail_uv,
      COALESCE(u.purchase_complete_uv, 0) AS purchase_complete_uv
    FROM daily_sales s
    LEFT JOIN daily_uv u ON s.basis_date = u.basis_date AND s.city_nm = u.city_nm
    ORDER BY 1, 2
  `;

  // BQ 영문 도시명 → 한글 역매핑 (도시별 조회 시 사용)
  const reverseMap: Record<string, City> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor as City;
  }

  const [rows] = await bq.query({ query });
  const mapped = rows
    .map((r: Record<string, unknown>) => {
      const rawCity = String(r.city_group ?? '');
      // 전체: rawCity = '전체' 그대로 / 도시별: 역매핑
      const cityGroup: City = isAll ? '전체' : (reverseMap[rawCity] ?? null as unknown as City);
      if (!cityGroup) return null;
      return {
        basisDate: String(r.basis_date ?? ''),
        cityGroup,
        gmv: Number(r.gmv ?? 0),
        cgmv: Number(r.cgmv ?? 0),
        cm: Number(r.cm ?? 0),
        rsvCnt: Number(r.rsv_cnt ?? 0),
        crsvCnt: Number(r.crsv_cnt ?? 0),
        cfr: parseFloat(Number(r.cfr ?? 0).toFixed(1)),
        detailUv: Number(r.detail_uv ?? 0),
        purchaseCompleteUv: Number(r.purchase_complete_uv ?? 0),
      };
    })
    .filter(Boolean) as TrendRow[];

  return mapped;
}

// ---------------------------------------------------------------------------
// Hotel Daily — 호텔별 최근 14일 일별 예약/매출 (전일 대비 분석용)
// ---------------------------------------------------------------------------

async function fetchHotelDaily(bq: BigQuery, city: City): Promise<HotelDailyRow[]> {
  const cityClause = city === '전체'
    ? ''
    : `AND g.CITY_NM IN (${CITY_BQ_MAP[city].map(c => `'${c}'`).join(', ')})`;

  const query = `
    WITH ${buildGidListCTE(city)},
    daily AS (
      SELECT
        g.GID                                                                                   AS gpid,
        COALESCE(g.PRODUCT_TITLE, CAST(g.GID AS STRING))                                       AS hotel_nm,
        g.CITY_NM                                                                               AS city,
        DATE(p.BASIS_DATE)                                                                      AS basis_date,
        COUNT(DISTINCT p.ORDER_ID)                                                              AS rsv,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END)  AS crsv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS cgmv
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
      WHERE DATE(p.BASIS_DATE) >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 14 DAY)
        ${cityClause}
      GROUP BY 1, 2, 3, 4
    )
    SELECT
      gpid,
      hotel_nm,
      city,
      FORMAT_DATE('%Y-%m-%d', basis_date) AS basis_date,
      rsv,
      crsv,
      cgmv,
      ROUND(SAFE_DIVIDE(cgmv, NULLIF(rsv * SAFE_DIVIDE(cgmv, NULLIF(crsv,0)), 0)) * 100, 1) AS cfr
    FROM daily
    ORDER BY basis_date DESC, cgmv DESC
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    gpid: String(r.gpid ?? ''),
    hotelNm: String(r.hotel_nm ?? ''),
    city: String(r.city ?? ''),
    basisDate: String(r.basis_date ?? ''),
    rsv: Number(r.rsv ?? 0),
    crsv: Number(r.crsv ?? 0),
    cgmv: Number(r.cgmv ?? 0),
    cfr: parseFloat(Number(r.cfr ?? 0).toFixed(1)),
  }));
}

// ---------------------------------------------------------------------------
// Comparison — YoY / MoM / WoW 비교
// ---------------------------------------------------------------------------

export async function fetchComparison(basisMonth: string): Promise<ComparisonData> {
  const bq = getBQClient();
  const [y, m] = basisMonth.split('-').map(Number);

  // 현재: 월 시작 ~ 어제(D-1)
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const currentEnd = d1.toISOString().split('T')[0];
  const currentStart = `${basisMonth}-01`;
  const daysMtd = d1.getDate(); // 경과 일수

  // MoM: 전월 동일 기간
  const momY = m === 1 ? y - 1 : y;
  const momM = m === 1 ? 12 : m - 1;
  const momStart = `${momY}-${String(momM).padStart(2,'0')}-01`;
  const momEnd = `${momY}-${String(momM).padStart(2,'0')}-${String(daysMtd).padStart(2,'0')}`;

  // YoY: 전년 동월 동일 기간
  const yoyStart = `${y-1}-${String(m).padStart(2,'0')}-01`;
  const yoyEnd = `${y-1}-${String(m).padStart(2,'0')}-${String(daysMtd).padStart(2,'0')}`;

  // WoW: 이번 주(D-7~D-1) vs 전주(D-14~D-8)
  const wowCurEnd = currentEnd;
  const wowCurStart = new Date(d1); wowCurStart.setDate(wowCurStart.getDate() - 6);
  const wowPrevEnd = new Date(d1); wowPrevEnd.setDate(wowPrevEnd.getDate() - 7);
  const wowPrevStart = new Date(d1); wowPrevStart.setDate(wowPrevStart.getDate() - 13);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const periods = {
    current: { start: currentStart, end: currentEnd },
    mom:     { start: momStart,     end: momEnd },
    yoy:     { start: yoyStart,     end: yoyEnd },
    wow_cur: { start: fmt(wowCurStart), end: wowCurEnd },
    wow_prev:{ start: fmt(wowPrevStart),end: fmt(wowPrevEnd) },
  };

  const KOR_CITIES: City[] = ['발리'];

  async function queryPeriod(start: string, end: string): Promise<Record<string, PeriodMetrics>> {
    // 도시별 집계 쿼리
    const cityRows: Record<string, PeriodMetrics> = {};
    const allMetrics: PeriodMetrics = { gmv:0, cm:0, cmr:0, cfr:0, cvr:0, rsvCnt:0, detailUv:0 };

    await Promise.all(KOR_CITIES.map(async (korCity) => {
      const cityClause = `AND r.city_key_name IN (${CITY_BQ_MAP[korCity].map(c=>`'${c}'`).join(',')})`;
      const query = `
        WITH gid_list AS (
          SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
          FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
          JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
            ON sp.property_id = r.property_id
          WHERE r.country_key_name = 'Indonesia'
            ${cityClause}
        ),
        sales AS (
          SELECT
            COUNT(DISTINCT p.ORDER_ID) AS rsv,
            COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END) AS crsv,
            SUM(p.SALES_KRW_PRICE) AS gmv,
            SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS cgmv,
            SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
              p.SALES_COMMISSION_PRICE
              - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
              - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
            ELSE 0 END) AS cm
          FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
          JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
          WHERE p.BASIS_DATE BETWEEN '${start}' AND '${end}'
        ),
        uv AS (
          SELECT COUNT(DISTINCT c.pid) AS detail_uv
          FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
          JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = g.GID
          WHERE c.BASIS_DATE BETWEEN '${start}' AND '${end}'
            AND c.OFFER_DETAIL_FLAG = 1
        )
        SELECT s.*, u.detail_uv FROM sales s, uv u
      `;
      const [rows] = await bq.query({ query });
      const r = rows[0] ?? {};
      const gmv = Number(r.gmv ?? 0);
      const cgmv = Number(r.cgmv ?? 0);
      const cm = Number(r.cm ?? 0);
      const rsv = Number(r.rsv ?? 0);
      const uv = Number(r.detail_uv ?? 0);
      const metrics: PeriodMetrics = {
        gmv, cm,
        cmr: cgmv > 0 ? parseFloat(((cm/cgmv)*100).toFixed(1)) : 0,
        cfr: gmv > 0 ? parseFloat(((cgmv/gmv)*100).toFixed(1)) : 0,
        cvr: uv > 0 ? parseFloat(((rsv/uv)*100).toFixed(2)) : 0,
        rsvCnt: rsv,
        detailUv: uv,
      };
      cityRows[korCity] = metrics;
      allMetrics.gmv += gmv;
      allMetrics.cm += cm;
      allMetrics.rsvCnt += rsv;
      allMetrics.detailUv += uv;
    }));

    const totalCgmv = cityRows ? Object.values(cityRows).reduce((s,r) => s + r.gmv * (r.cfr/100), 0) : 0;
    allMetrics.cmr = totalCgmv > 0 ? parseFloat(((allMetrics.cm / totalCgmv)*100).toFixed(1)) : 0;
    allMetrics.cfr = allMetrics.gmv > 0 ? parseFloat(((totalCgmv / allMetrics.gmv)*100).toFixed(1)) : 0;
    allMetrics.cvr = allMetrics.detailUv > 0 ? parseFloat(((allMetrics.rsvCnt / allMetrics.detailUv)*100).toFixed(2)) : 0;
    cityRows['전체'] = allMetrics;
    return cityRows;
  }

  const [cur, mom, yoy, wowCur, wowPrev] = await Promise.all([
    queryPeriod(periods.current.start, periods.current.end),
    queryPeriod(periods.mom.start, periods.mom.end),
    queryPeriod(periods.yoy.start, periods.yoy.end),
    queryPeriod(periods.wow_cur.start, periods.wow_cur.end),
    queryPeriod(periods.wow_prev.start, periods.wow_prev.end),
  ]);

  const allCities = ['전체', ...KOR_CITIES];
  const rows: CityPeriodRow[] = allCities.map(city => ({
    city,
    current: cur[city] ?? null,
    mom: mom[city] ?? null,
    yoy: yoy[city] ?? null,
    wow: wowPrev[city] ? {
      ...wowCur[city],
      // wow는 이번주 vs 지난주로 별도 저장 — current에 wow_cur, wow에 wow_prev
    } : null,
  }));

  // WoW는 current 대신 wow_cur을 current로 교체
  const wowRows: CityPeriodRow[] = allCities.map(city => ({
    city,
    current: wowCur[city] ?? null,
    mom: mom[city] ?? null,
    yoy: yoy[city] ?? null,
    wow: wowPrev[city] ?? null,
  }));

  return {
    currentLabel: `${currentStart} ~ ${currentEnd} (MTD)`,
    wowLabel: `${fmt(wowPrevStart)} ~ ${fmt(wowPrevEnd)}`,
    momLabel: `${momStart} ~ ${momEnd}`,
    yoyLabel: `${yoyStart} ~ ${yoyEnd}`,
    rows: wowRows,
  };
}

// ---------------------------------------------------------------------------
// Monthly — 월별 도시×연동사 누적 성과
// ---------------------------------------------------------------------------

export async function fetchMonthlyData(currentMonth: string): Promise<MonthlyData> {
  const bq = getBQClient();
  const [y, m] = currentMonth.split('-').map(Number);

  // 최근 6개월 범위 계산
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const startDate = `${months[0]}-01`;
  // 현재월은 D-1까지, 과거월은 말일까지
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const endDate = d1.toISOString().split('T')[0];

  const KOR_CITIES: City[] = ['발리'];

  // DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION city_key_name → 한국어 도시명 역매핑
  // CITY_BQ_MAP 기반 (정확한 city_key_name 값은 BQ 확인 필요)
  const reverseMap: Record<string, string> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor;
  }

  // Redash #26250 구조 — DW_MRT_STAY_PROPERTY + DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION
  // 전체 행은 일본 전체(city 필터 없음), 개별 도시 행은 city_key_name 필터
  const allCityKeys = Object.values(CITY_BQ_MAP).flat().map(c => `'${c}'`).join(', ');

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        sp.property_id        AS gid,
        r.city_key_name       AS city_nm,
        UPPER(TRIM(sp.provider_code)) AS partner
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
    ),
    sales AS (
      SELECT
        FORMAT_DATE('%Y-%m', p.BASIS_DATE)                                                        AS month,
        g.city_nm,
        COALESCE(g.partner, 'UNKNOWN')                                                            AS partner,
        COUNT(DISTINCT p.ORDER_ID)                                                                AS rsv,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END)     AS crsv,
        SUM(p.SALES_KRW_PRICE)                                                                    AS gmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END)  AS cgmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.SALES_COMMISSION_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                                                               AS cm
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = CAST(g.gid AS STRING)
      WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2, 3
    ),
    uv_partner AS (
      SELECT
        FORMAT_DATE('%Y-%m', c.BASIS_DATE)                                                AS month,
        g.city_nm,
        COALESCE(g.partner, 'UNKNOWN')                                                    AS partner,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                  AS uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)  AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = CAST(g.gid AS STRING)
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2, 3
    ),
    uv_city AS (
      SELECT
        FORMAT_DATE('%Y-%m', c.BASIS_DATE)                                                AS month,
        g.city_nm,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                  AS uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)  AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = CAST(g.gid AS STRING)
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    )
    SELECT
      s.month,
      s.city_nm,
      s.partner,
      s.rsv,
      s.crsv,
      s.gmv,
      s.cgmv,
      s.cm,
      COALESCE(up.uv, 0)                  AS uv,
      COALESCE(up.purchase_complete_uv, 0) AS purchase_complete_uv,
      COALESCE(uc.uv, 0)                  AS city_uv,
      COALESCE(uc.purchase_complete_uv, 0) AS city_purchase_complete_uv
    FROM sales s
    LEFT JOIN uv_partner up ON s.month = up.month AND s.city_nm = up.city_nm AND s.partner = up.partner
    LEFT JOIN uv_city uc ON s.month = uc.month AND s.city_nm = uc.city_nm
    ORDER BY 1, 2, 3
  `;

  const [rows] = await bq.query({ query });

  // 데이터 구조화: city × partner × month
  type RawKey = `${string}|${string}|${string}`; // korCity|partner|month
  const map = new Map<RawKey, MonthlyMetrics>();
  // cityUvMap: (engCity|month) → {uv, pcuv}  도시 합산 UV (파트너 합산 중복 방지용, fetchPeriodData의 uvMap과 동일 패턴)
  const cityUvMap = new Map<string, { uv: number; pcuv: number }>();

  function accumulate(m: MonthlyMetrics, gmv: number, cgmv: number, cm: number, rsv: number, crsv: number, uv: number, pcuv: number) {
    m.gmv += gmv; m.cgmv += cgmv; m.cm += cm;
    m.rsv += rsv; m.crsv += crsv; m.uv += uv;
    m.purchaseCompleteUv = (m.purchaseCompleteUv ?? 0) + pcuv;
    m.cmr = m.cgmv > 0 ? parseFloat(((m.cm / m.cgmv) * 100).toFixed(1)) : 0;
    m.cfr = m.gmv > 0 ? parseFloat(((m.cgmv / m.gmv) * 100).toFixed(1)) : 0;
    m.cvr = m.uv > 0 ? parseFloat((((m.purchaseCompleteUv) / m.uv) * 100).toFixed(2)) : 0;
  }

  function applyUv(m: MonthlyMetrics, uv: number, pcuv: number) {
    m.uv = uv;
    m.purchaseCompleteUv = pcuv;
    m.cvr = uv > 0 ? parseFloat(((pcuv / uv) * 100).toFixed(2)) : 0;
  }

  for (const r of rows) {
    const engCity = String(r.city_nm ?? '');
    const korCity = reverseMap[engCity];
    const mo = String(r.month ?? '');
    const partner = String(r.partner ?? 'UNKNOWN');

    const gmv = Number(r.gmv ?? 0);
    const cgmv = Number(r.cgmv ?? 0);
    const cm = Number(r.cm ?? 0);
    const rsv = Number(r.rsv ?? 0);
    const crsv = Number(r.crsv ?? 0);
    const uv = Number(r.uv ?? 0);
    const pcuv = Number(r.purchase_complete_uv ?? 0);
    const city_uv = Number(r.city_uv ?? 0);
    const city_pcuv = Number(r.city_purchase_complete_uv ?? 0);

    // 도시별 UV 저장 (engCity 기준, 첫 번째 row에서만 세팅하여 중복 방지)
    if (!cityUvMap.has(`${engCity}|${mo}`) && city_uv > 0) {
      cityUvMap.set(`${engCity}|${mo}`, { uv: city_uv, pcuv: city_pcuv });
    }

    // 5대 도시 개별 row
    if (korCity) {
      const key = `${korCity}|${partner}|${mo}` as RawKey;
      const existing = map.get(key);
      if (existing) {
        accumulate(existing, gmv, cgmv, cm, rsv, crsv, uv, pcuv);
      } else {
        map.set(key, {
          gmv, cgmv, cm, rsv, crsv, uv, purchaseCompleteUv: pcuv,
          cmr: cgmv > 0 ? parseFloat(((cm / cgmv) * 100).toFixed(1)) : 0,
          cfr: gmv > 0 ? parseFloat(((cgmv / gmv) * 100).toFixed(1)) : 0,
          cvr: uv > 0 ? parseFloat(((pcuv / uv) * 100).toFixed(2)) : 0,
        });
      }
    }

    // 전체 row — 인도네시아 모든 도시 포함
    const totalKey = `전체|${partner}|${mo}` as RawKey;
    const totalExisting = map.get(totalKey);
    if (totalExisting) {
      accumulate(totalExisting, gmv, cgmv, cm, rsv, crsv, uv, pcuv);
    } else {
      map.set(totalKey, {
        gmv, cgmv, cm, rsv, crsv, uv, purchaseCompleteUv: pcuv,
        cmr: cgmv > 0 ? parseFloat(((cm / cgmv) * 100).toFixed(1)) : 0,
        cfr: gmv > 0 ? parseFloat(((cgmv / gmv) * 100).toFixed(1)) : 0,
        cvr: uv > 0 ? parseFloat(((pcuv / uv) * 100).toFixed(2)) : 0,
      });
    }
  }

  function sumMetrics(list: MonthlyMetrics[]): MonthlyMetrics {
    const s = list.reduce((acc, mx) => ({
      rsv: acc.rsv + mx.rsv, crsv: acc.crsv + mx.crsv,
      gmv: acc.gmv + mx.gmv, cgmv: acc.cgmv + mx.cgmv,
      cm: acc.cm + mx.cm,
      // UV는 sumMetrics에서 합산하지 않음 — 도시 총 UV로 별도 덮어씀
      uv: 0, purchaseCompleteUv: 0,
      cmr: 0, cfr: 0, cvr: 0,
    }), { rsv:0,crsv:0,gmv:0,cgmv:0,cm:0,uv:0,purchaseCompleteUv:0,cmr:0,cfr:0,cvr:0 });
    s.cmr = s.cgmv > 0 ? parseFloat(((s.cm/s.cgmv)*100).toFixed(1)) : 0;
    s.cfr = s.gmv > 0 ? parseFloat(((s.cgmv/s.gmv)*100).toFixed(1)) : 0;
    return s;
  }

  const zero: MonthlyMetrics = { rsv:0,crsv:0,gmv:0,cgmv:0,cm:0,cmr:0,cfr:0,uv:0,purchaseCompleteUv:0,cvr:0 };

  // 파트너 목록 수집
  const partnerSet = new Set<string>();
  for (const key of map.keys()) {
    const [, partner] = key.split('|');
    partnerSet.add(partner);
  }
  const partners = Array.from(partnerSet).sort();

  const cityRows: CityMonthRow[] = KOR_CITIES.map(city => {
    const partnerRows: PartnerMonthRow[] = partners
      .map(partner => ({
        partner,
        months: Object.fromEntries(
          months.map(mo => [mo, map.get(`${city}|${partner}|${mo}` as RawKey) ?? { ...zero }])
        ),
      }))
      // 해당 도시에 실제 데이터가 있는 파트너만 포함
      .filter(pr => months.some(mo => {
        const mx = pr.months[mo];
        return mx.gmv > 0 || mx.cgmv > 0 || mx.cm > 0 || mx.rsv > 0 || mx.crsv > 0;
      }));

    const total: Record<string, MonthlyMetrics> = Object.fromEntries(
      months.map(mo => {
        const m = sumMetrics(partnerRows.map(p => p.months[mo]));
        // 도시 총 UV로 덮어씀 (파트너별 합산 시 중복 카운트 방지)
        const engCities = CITY_BQ_MAP[city as City] ?? [];
        let cityUv = 0, cityPcuv = 0;
        for (const ec of engCities) {
          const ent = cityUvMap.get(`${ec}|${mo}`);
          if (ent) { cityUv += ent.uv; cityPcuv += ent.pcuv; }
        }
        if (cityUv > 0) applyUv(m, cityUv, cityPcuv);
        return [mo, m];
      })
    );

    return { city, total, partners: partnerRows };
  });

  // 전체 합계 행 — map에서 직접 읽음 (인도네시아 전체 도시 포함)
  const totalRow: CityMonthRow = {
    city: '전체',
    total: Object.fromEntries(
      months.map(mo => {
        const m = sumMetrics(partners.map(p => map.get(`전체|${p}|${mo}` as RawKey) ?? { ...zero }));
        // 전체 UV: 인도네시아 전체 BQ 도시별 UV 합산 (사용자 중복 있을 수 있으나 최선의 근사값)
        let totalUv = 0, totalPcuv = 0;
        for (const [k, v] of cityUvMap.entries()) {
          if (k.endsWith(`|${mo}`)) { totalUv += v.uv; totalPcuv += v.pcuv; }
        }
        if (totalUv > 0) applyUv(m, totalUv, totalPcuv);
        return [mo, m];
      })
    ),
    partners: partners.map(partner => ({
      partner,
      months: Object.fromEntries(
        months.map(mo => [mo, map.get(`전체|${partner}|${mo}` as RawKey) ?? { ...zero }])
      ),
    })),
  };

  return { months, rows: [totalRow, ...cityRows] };
}

// ---------------------------------------------------------------------------
// Negative CM Daily — 일별 역마진 호텔 목록
// ---------------------------------------------------------------------------

export async function fetchNegativeCmDaily(
  startDate: string,
  endDate: string,
  city: City,
): Promise<HotelNegativeCmRow[]> {
  const bq = getBQClient();

  const cityClause = city === '전체'
    ? ''
    : `AND r.city_key_name IN (${CITY_BQ_MAP[city].map(c => `'${c}'`).join(', ')})`;

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING) AS GID,
        r.city_key_name                AS CITY_NM,
        sp.ko_name                     AS PRODUCT_TITLE
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        ${cityClause}
    ),
    daily AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', p.BASIS_DATE)                                                    AS basis_date,
        g.GID                                                                                     AS gpid,
        MAX(g.PRODUCT_TITLE)                                                                      AS hotel_nm,
        MAX(g.CITY_NM)                                                                            AS city_nm,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END)    AS crsv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS cgmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.SALES_COMMISSION_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                                                               AS cm
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
      WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    )
    SELECT
      basis_date,
      gpid,
      hotel_nm,
      city_nm,
      crsv,
      cgmv,
      cm,
      ROUND(SAFE_DIVIDE(cm, NULLIF(cgmv, 0)) * 100, 1) AS cmr
    FROM daily
    WHERE cm < 0
    ORDER BY basis_date DESC, cm ASC
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    basisDate: String(r.basis_date ?? ''),
    gpid: String(r.gpid ?? ''),
    hotelNm: String(r.hotel_nm ?? ''),
    city: String(r.city_nm ?? ''),
    crsvCnt: Number(r.crsv ?? 0),
    cgmv: Number(r.cgmv ?? 0),
    cm: Number(r.cm ?? 0),
    cmr: parseFloat(Number(r.cmr ?? 0).toFixed(1)),
  }));
}

// ---------------------------------------------------------------------------
// Shared helper — period aggregation (monthly/weekly/yearly 공통 로직)
// ---------------------------------------------------------------------------

async function fetchPeriodData(
  bq: BigQuery,
  periods: string[],         // e.g. ['2026-W14', '2026-W13', ...]
  periodFmt: string,         // BQ FORMAT_DATE format string
  startDate: string,
  endDate: string,
): Promise<MonthlyData> {
  const KOR_CITIES: City[] = ['발리'];
  const reverseMap: Record<string, string> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor;
  }

  // sales와 uv를 UNION ALL로 분리: uv가 (city, partner) 단위로 복제되어 중복 합산되는 문제 방지
  // uv rows는 partner='__UV__'로 구분, 도시별 + '__ALL__'(일본 전체) 포함
  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING) AS GID,
        r.city_key_name                AS CITY_NM,
        UPPER(TRIM(sp.provider_code))  AS partner
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
    ),
    sales AS (
      SELECT
        FORMAT_DATE('${periodFmt}', p.BASIS_DATE)                                                 AS period,
        g.CITY_NM,
        COALESCE(g.partner, 'UNKNOWN')                                                            AS partner,
        COUNT(DISTINCT p.ORDER_ID)                                                                AS rsv,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END)     AS crsv,
        SUM(p.SALES_KRW_PRICE)                                                                    AS gmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END)  AS cgmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.SALES_COMMISSION_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                                                               AS cm
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
      WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2, 3
    ),
    uv_by_city AS (
      SELECT
        FORMAT_DATE('${periodFmt}', c.BASIS_DATE)                                          AS period,
        g.CITY_NM,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                   AS uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)   AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    ),
    uv_by_partner AS (
      SELECT
        FORMAT_DATE('${periodFmt}', c.BASIS_DATE)                                          AS period,
        g.CITY_NM,
        UPPER(TRIM(g.partner))                                                             AS partner,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                   AS uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)   AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2, 3
    ),
    uv_all AS (
      SELECT
        FORMAT_DATE('${periodFmt}', c.BASIS_DATE)                                          AS period,
        '__ALL__'                                                                           AS CITY_NM,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END)                   AS uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END)   AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN gid_list g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1
    )
    SELECT period, CITY_NM AS city_nm, partner,
           rsv, crsv, gmv, cgmv, cm, 0 AS uv, 0 AS purchase_complete_uv
    FROM sales
    UNION ALL
    SELECT period, CITY_NM AS city_nm, '__UV__' AS partner,
           0 AS rsv, 0 AS crsv, 0 AS gmv, 0 AS cgmv, 0 AS cm, uv, purchase_complete_uv
    FROM uv_by_city
    UNION ALL
    SELECT period, CITY_NM AS city_nm, CONCAT('__UVP__', partner) AS partner,
           0 AS rsv, 0 AS crsv, 0 AS gmv, 0 AS cgmv, 0 AS cm, uv, purchase_complete_uv
    FROM uv_by_partner
    UNION ALL
    SELECT period, CITY_NM AS city_nm, '__UV__' AS partner,
           0 AS rsv, 0 AS crsv, 0 AS gmv, 0 AS cgmv, 0 AS cm, uv, purchase_complete_uv
    FROM uv_all
    ORDER BY 1, 2, 3
  `;

  const [rows] = await bq.query({ query });

  type RawKey = `${string}|${string}|${string}`;
  const map = new Map<RawKey, MonthlyMetrics>();
  // uvMap: (engCity|period) → {uv, pcuv}  '__ALL__'은 인도네시아 전체 uv
  const uvMap = new Map<string, { uv: number; pcuv: number }>();
  // uvPartnerMap: (korCity|partner|period) → {uv, pcuv}  파트너별 uv
  const uvPartnerMap = new Map<string, { uv: number; pcuv: number }>();

  function accumulate(m: MonthlyMetrics, gmv: number, cgmv: number, cm: number, rsv: number, crsv: number) {
    m.gmv += gmv; m.cgmv += cgmv; m.cm += cm; m.rsv += rsv; m.crsv += crsv;
    m.cmr = m.cgmv > 0 ? parseFloat(((m.cm / m.cgmv) * 100).toFixed(1)) : 0;
    m.cfr = m.gmv > 0 ? parseFloat(((m.cgmv / m.gmv) * 100).toFixed(1)) : 0;
  }

  for (const r of rows) {
    const period = String(r.period ?? '');
    if (!periods.includes(period)) continue;
    const engCity = String(r.city_nm ?? '');
    const partner = String(r.partner ?? 'UNKNOWN');

    if (partner === '__UV__') {
      uvMap.set(`${engCity}|${period}`, {
        uv: Number(r.uv ?? 0),
        pcuv: Number(r.purchase_complete_uv ?? 0),
      });
      continue;
    }

    if (partner.startsWith('__UVP__')) {
      const realPartner = partner.slice(7); // '__UVP__' = 7 chars
      const uv = Number(r.uv ?? 0);
      const pcuv = Number(r.purchase_complete_uv ?? 0);
      const korCity = reverseMap[engCity];
      if (korCity) {
        const k = `${korCity}|${realPartner}|${period}`;
        const ex = uvPartnerMap.get(k) ?? { uv: 0, pcuv: 0 };
        uvPartnerMap.set(k, { uv: ex.uv + uv, pcuv: ex.pcuv + pcuv });
      }
      const tk = `전체|${realPartner}|${period}`;
      const tex = uvPartnerMap.get(tk) ?? { uv: 0, pcuv: 0 };
      uvPartnerMap.set(tk, { uv: tex.uv + uv, pcuv: tex.pcuv + pcuv });
      continue;
    }

    const korCity = reverseMap[engCity];
    const gmv = Number(r.gmv ?? 0), cgmv = Number(r.cgmv ?? 0), cm = Number(r.cm ?? 0);
    const rsv = Number(r.rsv ?? 0), crsv = Number(r.crsv ?? 0);
    const zero = (): MonthlyMetrics => ({ gmv:0,cgmv:0,cm:0,rsv:0,crsv:0,uv:0,purchaseCompleteUv:0,cmr:0,cfr:0,cvr:0 });

    if (korCity) {
      const k = `${korCity}|${partner}|${period}` as RawKey;
      if (!map.has(k)) map.set(k, zero());
      accumulate(map.get(k)!, gmv, cgmv, cm, rsv, crsv);
    }
    const tk = `전체|${partner}|${period}` as RawKey;
    if (!map.has(tk)) map.set(tk, zero());
    accumulate(map.get(tk)!, gmv, cgmv, cm, rsv, crsv);
  }

  function applyUv(m: MonthlyMetrics, uv: number, pcuv: number) {
    m.uv = uv;
    m.purchaseCompleteUv = pcuv;
    m.cvr = uv > 0 ? parseFloat(((pcuv / uv) * 100).toFixed(2)) : 0;
  }

  function sumMetrics(list: MonthlyMetrics[]): MonthlyMetrics {
    const s = list.reduce((acc, mx) => ({
      rsv: acc.rsv + mx.rsv, crsv: acc.crsv + mx.crsv,
      gmv: acc.gmv + mx.gmv, cgmv: acc.cgmv + mx.cgmv,
      cm: acc.cm + mx.cm, uv: 0, purchaseCompleteUv: 0,
      cmr:0, cfr:0, cvr:0,
    }), { rsv:0,crsv:0,gmv:0,cgmv:0,cm:0,uv:0,purchaseCompleteUv:0,cmr:0,cfr:0,cvr:0 });
    s.cmr = s.cgmv > 0 ? parseFloat(((s.cm/s.cgmv)*100).toFixed(1)) : 0;
    s.cfr = s.gmv > 0 ? parseFloat(((s.cgmv/s.gmv)*100).toFixed(1)) : 0;
    return s;
  }

  const zero = (): MonthlyMetrics => ({ gmv:0,cgmv:0,cm:0,rsv:0,crsv:0,uv:0,purchaseCompleteUv:0,cmr:0,cfr:0,cvr:0 });
  const partnerSet = new Set<string>();
  for (const k of map.keys()) partnerSet.add(k.split('|')[1]);
  const partners = Array.from(partnerSet).sort();

  const cityRows: CityMonthRow[] = KOR_CITIES.map(city => {
    const partnerRows: PartnerMonthRow[] = partners
      .map(p => ({
        partner: p,
        months: Object.fromEntries(periods.map(pe => {
          const base = map.get(`${city}|${p}|${pe}` as RawKey);
          const m: MonthlyMetrics = base ? { ...base } : zero();
          const uvEntry = uvPartnerMap.get(`${city}|${p}|${pe}`);
          if (uvEntry) applyUv(m, uvEntry.uv, uvEntry.pcuv);
          return [pe, m];
        })),
      }))
      // 해당 도시에 실제 데이터가 있는 파트너만 포함 (0-only 파트너 제거)
      .filter(pr => periods.some(pe => {
        const mx = pr.months[pe];
        return mx.gmv > 0 || mx.cgmv > 0 || mx.cm > 0 || mx.rsv > 0 || mx.crsv > 0;
      }));
    const total: Record<string, MonthlyMetrics> = Object.fromEntries(
      periods.map(pe => {
        const m = sumMetrics(partnerRows.map(p => p.months[pe]));
        // 도시별 uv: BQ city_key_name이 여러 개일 수 있으므로 합산
        const engCities = CITY_BQ_MAP[city as City] ?? [];
        let cityUv = 0, cityPcuv = 0;
        for (const ec of engCities) {
          const entry = uvMap.get(`${ec}|${pe}`);
          if (entry) { cityUv += entry.uv; cityPcuv += entry.pcuv; }
        }
        applyUv(m, cityUv, cityPcuv);
        return [pe, m];
      })
    );
    return { city, total, partners: partnerRows };
  });

  const totalRow: CityMonthRow = {
    city: '전체',
    total: Object.fromEntries(
      periods.map(pe => {
        const m = sumMetrics(partners.map(p => map.get(`전체|${p}|${pe}` as RawKey) ?? zero()));
        // 전체 uv: __ALL__ 키 사용 (도시별 합산 시 동일 pid 중복 카운트 방지)
        const allEntry = uvMap.get(`__ALL__|${pe}`);
        if (allEntry) applyUv(m, allEntry.uv, allEntry.pcuv);
        return [pe, m];
      })
    ),
    partners: partners.map(p => ({
      partner: p,
      months: Object.fromEntries(periods.map(pe => {
        const base = map.get(`전체|${p}|${pe}` as RawKey);
        const m: MonthlyMetrics = base ? { ...base } : zero();
        const uvEntry = uvPartnerMap.get(`전체|${p}|${pe}`);
        if (uvEntry) applyUv(m, uvEntry.uv, uvEntry.pcuv);
        return [pe, m];
      })),
    })),
  };

  return { months: periods, rows: [totalRow, ...cityRows] };
}

// ---------------------------------------------------------------------------
// Weekly — 최근 8주 주별 누적
// ---------------------------------------------------------------------------

export async function fetchWeeklyData(currentMonth: string): Promise<MonthlyData> {
  const bq = getBQClient();
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);

  // 최근 8주 ISO 주 목록 생성
  const getISOWeek = (d: Date): string => {
    const tmp = new Date(d.valueOf());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(d1);
    d.setDate(d1.getDate() - i * 7);
    const w = getISOWeek(d);
    if (!weeks.includes(w)) weeks.push(w);
  }

  // 8주 커버 날짜 범위
  const startMon = new Date(d1);
  startMon.setDate(d1.getDate() - 7 * 7 - ((d1.getDay() + 6) % 7));
  const startDate = startMon.toISOString().split('T')[0];
  const endDate = d1.toISOString().split('T')[0];

  return fetchPeriodData(bq, weeks, '%G-W%V', startDate, endDate);
}

// ---------------------------------------------------------------------------
// Daily — 최근 30일 일별 누적
// ---------------------------------------------------------------------------

export async function fetchDailyData(): Promise<MonthlyData> {
  const bq = getBQClient();
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);

  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(d1);
    d.setDate(d1.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const startDate = days[0];
  const endDate = days[days.length - 1];

  return fetchPeriodData(bq, days, '%Y-%m-%d', startDate, endDate);
}

// ---------------------------------------------------------------------------
// Yearly — 최근 3개년 연도별 누적
// ---------------------------------------------------------------------------

export async function fetchYearlyData(currentYear: string): Promise<MonthlyData> {
  const bq = getBQClient();
  const year = parseInt(currentYear);
  const years = [String(year - 2), String(year - 1), String(year)];

  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const endDate = d1.toISOString().split('T')[0];
  const startDate = `${year - 2}-01-01`;

  return fetchPeriodData(bq, years, '%Y', startDate, endDate);
}

// ---------------------------------------------------------------------------
// Top Selling — 2025년 기준 도시별 탑셀링 상품 (Redash #25954 구조)
// ---------------------------------------------------------------------------

export async function fetchTopSelling(city?: string): Promise<TopSellingRow[]> {
  const bq = getBQClient();
  const isAll = !city || city === '전체';

  const cityBqKeys = isAll ? [] : (TOPSELLING_CITY_BQ_MAP[city] ?? []);

  // 전체: city 필터 없음 (모든 Japan) / 도시별: city_key_name 필터
  const cityClause = isAll
    ? ''
    : `AND r.city_key_name IN (${cityBqKeys.map(c => `'${c}'`).join(', ')})`;

  // 전체: global GMV 랭킹 / 도시별: PARTITION BY city
  const rankExpr = isAll
    ? `ROW_NUMBER() OVER (ORDER BY s.gmv DESC) AS rnk`
    : `ROW_NUMBER() OVER (PARTITION BY s.city ORDER BY s.gmv DESC) AS rnk`;

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        ${cityClause}
    ),
    sales AS (
      SELECT
        COALESCE(CAST(p.GPID AS STRING), CAST(p.GID AS STRING)) AS gpid,
        MAX(p.CITY_NM)                                          AS city,
        COALESCE(
          MIN(CASE WHEN p.PRODUCT_TITLE NOT LIKE '[%' THEN p.PRODUCT_TITLE END),
          MIN(p.PRODUCT_TITLE)
        )                                                        AS hotel_nm,
        SUM(p.SALES_KRW_PRICE)                                  AS gmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.SALES_COMMISSION_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                              AS cm,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END) AS rsv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN COALESCE(p.TRAVEL_DAYS, 0) ELSE 0 END) AS rn
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
      WHERE p.BASIS_DATE BETWEEN '2025-01-01' AND '2025-12-31'
      GROUP BY 1
    ),
    city_total AS (
      SELECT city, SUM(gmv) AS city_gmv FROM sales GROUP BY city
    ),
    ranked AS (
      SELECT
        s.gpid, s.hotel_nm, s.city, s.gmv, s.cm, s.rsv, s.rn,
        ROUND(SAFE_DIVIDE(s.gmv, ct.city_gmv) * 100, 1) AS gmv_share,
        ${rankExpr}
      FROM sales s
      JOIN city_total ct ON s.city = ct.city
    )
    SELECT gpid, hotel_nm, city, gmv, cm, rsv, rn, gmv_share, rnk
    FROM ranked WHERE rnk <= 100
    ORDER BY rnk
  `;

  // 역매핑 (TOPSELLING_CITY_BQ_MAP 기준, 매핑 없는 도시는 영어 그대로)
  const reverseMap: Record<string, string> = {};
  for (const [kor, engList] of Object.entries(TOPSELLING_CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor;
  }
  // 전체 역매핑에 일반 CITY_BQ_MAP도 포함
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) if (!reverseMap[eng]) reverseMap[eng] = kor;
  }

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    gpid: String(r.gpid ?? ''),
    hotelNm: String(r.hotel_nm ?? ''),
    city: reverseMap[String(r.city ?? '')] ?? String(r.city ?? ''),
    gmv: Number(r.gmv ?? 0),
    cm: Number(r.cm ?? 0),
    gmvShare: parseFloat(Number(r.gmv_share ?? 0).toFixed(1)),
    rank: Number(r.rnk ?? 0),
    rsv: Number(r.rsv ?? 0),
    rn: Number(r.rn ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Traffic Sources — 도시별 UTM 유입 분석 (Redash #24426 구조)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// City Distribution — 인도네시아 도시별 예약 분포 (city_key_name 기준)
// ---------------------------------------------------------------------------

export async function fetchCityDistribution(basisMonth: string): Promise<CityDistributionRow[]> {
  const bq = getBQClient();
  const [year, month] = basisMonth.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING) AS GID,
        r.city_key_name                AS CITY_NM
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
    )
    SELECT
      g.CITY_NM                                                                              AS city,
      COUNT(DISTINCT p.ORDER_ID)                                                             AS rsv,
      COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END) AS crsv,
      SUM(p.SALES_KRW_PRICE)                                                                AS gmv,
      SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS cgmv,
      SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
        p.SALES_COMMISSION_PRICE
        - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
        - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
      ELSE 0 END)                                                                            AS cm
    FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
    JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
    WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY g.CITY_NM
    ORDER BY rsv DESC
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => {
    const rsv  = Number(r.rsv  ?? 0);
    const crsv = Number(r.crsv ?? 0);
    const gmv  = Number(r.gmv  ?? 0);
    const cgmv = Number(r.cgmv ?? 0);
    const cm   = Number(r.cm   ?? 0);
    return {
      city:  String(r.city ?? ''),
      rsv, crsv, gmv, cgmv, cm,
      cfr: gmv  > 0 ? parseFloat(((cgmv / gmv)  * 100).toFixed(1)) : 0,
      cmr: cgmv > 0 ? parseFloat(((cm   / cgmv) * 100).toFixed(1)) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// City Top Hotels — 도시별 탑 호텔 (부스팅 분석용)
// ---------------------------------------------------------------------------

export async function fetchCityTopHotels(basisMonth: string): Promise<CityHotelFlatRow[]> {
  const bq = getBQClient();
  const [year, month] = basisMonth.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const query = `
    WITH partner_map AS (
      SELECT DISTINCT
        CAST(sn.gid AS STRING)                                          AS gid,
        CAST(sn.partner_id AS STRING)                                   AS partner_id,
        COALESCE(pp.nickname, CAST(sn.partner_id AS STRING))            AS partner_name
      FROM \`edw.DW_MRT_STAYNET_PROPERTY\` sn
      LEFT JOIN \`edw.DW_MRT_PARTNERS_PARTNER\` pp ON pp.id = sn.partner_id
      WHERE sn.deleted_at IS NULL
    ),
    gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING)                              AS GID,
        r.city_key_name                                             AS CITY_NM,
        pm.partner_id,
        pm.partner_name,
        UPPER(TRIM(sp.provider_code))                               AS provider_code
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      LEFT JOIN partner_map pm ON pm.gid = CAST(sp.property_id AS STRING)
      WHERE r.country_key_name = 'Indonesia'
    ),
    sales AS (
      SELECT
        g.CITY_NM,
        CAST(p.GID  AS STRING)                                AS gid,
        COALESCE(CAST(p.GPID AS STRING), CAST(p.GID AS STRING)) AS gpid,
        COALESCE(
          MAX(CONCAT(g.partner_id, ' · ', g.partner_name)),
          MAX(g.provider_code)
        )                                                     AS partner,
        MAX(p.PRODUCT_TITLE)                                  AS hotel_nm,
        COUNT(DISTINCT p.ORDER_ID)                            AS rsv,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END) AS crsv,
        SUM(p.SALES_KRW_PRICE)                                AS gmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS cgmv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.SALES_COMMISSION_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                           AS cm
      FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN gid_list g ON CAST(p.GID AS STRING) = g.GID
      WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY g.CITY_NM, CAST(p.GID AS STRING), COALESCE(CAST(p.GPID AS STRING), CAST(p.GID AS STRING))
    ),
    gpid_rsv AS (
      SELECT gpid, CITY_NM, SUM(rsv) AS gpid_total_rsv
      FROM sales GROUP BY 1, 2
    )
    SELECT
      s.CITY_NM AS city,
      s.gpid,
      s.gid,
      s.partner,
      s.hotel_nm,
      s.rsv, s.crsv, s.gmv, s.cgmv, s.cm,
      ROUND(SAFE_DIVIDE(s.cgmv, NULLIF(s.gmv,  0)) * 100, 1) AS cfr,
      ROUND(SAFE_DIVIDE(s.cm,   NULLIF(s.cgmv, 0)) * 100, 1) AS cmr
    FROM sales s
    JOIN gpid_rsv gr ON s.gpid = gr.gpid AND s.CITY_NM = gr.CITY_NM
    ORDER BY s.CITY_NM, gr.gpid_total_rsv DESC, s.gpid, s.rsv DESC
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    city:    String(r.city     ?? ''),
    gpid:    String(r.gpid     ?? ''),
    gid:     String(r.gid      ?? ''),
    partner: String(r.partner  ?? ''),
    hotelNm: String(r.hotel_nm ?? ''),
    rsv:     Number(r.rsv      ?? 0),
    crsv:    Number(r.crsv     ?? 0),
    cfr:     parseFloat(Number(r.cfr  ?? 0).toFixed(1)),
    cgmv:    Number(r.cgmv     ?? 0),
    cm:      Number(r.cm       ?? 0),
    cmr:     parseFloat(Number(r.cmr  ?? 0).toFixed(1)),
  }));
}

export async function fetchTrafficSources(
  startDate: string,
  endDate: string,
  city: City,
): Promise<TrafficSourceRow[]> {
  const bq = getBQClient();

  const allFiveCityKeys = Object.entries(CITY_BQ_MAP)
    .filter(([k]) => k !== '전체')
    .flatMap(([, v]) => v)
    .map(c => `'${c}'`)
    .join(', ');

  const cityClause = city === '전체'
    ? `AND r.city_key_name IN (${allFiveCityKeys})`
    : `AND r.city_key_name IN (${CITY_BQ_MAP[city].map(c => `'${c}'`).join(', ')})`;

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING) AS GID,
        r.city_key_name                AS CITY_NM
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        ${cityClause}
    ),
    base_log AS (
      SELECT
        IFNULL(JSON_VALUE(utm, '$.recent_utm_source'), JSON_VALUE(utm, '$.utm_source')) AS utm_source,
        pid,
        event_name,
        event_type,
        item_id,
        event_timestamp_kst
      FROM \`edw.DW_BIZ_LOG\`
      WHERE basis_dt BETWEEN '${startDate}' AND '${endDate}'
        AND basis_dt < CURRENT_DATE

      UNION ALL

      SELECT
        IFNULL(JSON_VALUE(utm, '$.recent_utm_source'), JSON_VALUE(utm, '$.utm_source')) AS utm_source,
        pid,
        event_name,
        event_type,
        JSON_VALUE(data, '$.item_id')                                                    AS item_id,
        TIMESTAMP_ADD(event_timestamp, INTERVAL 9 HOUR)                                 AS event_timestamp_kst
      FROM \`edw_stream.biz_log\`
      WHERE basis_dt BETWEEN DATE_SUB('${startDate}', INTERVAL 1 DAY) AND '${endDate}'
        AND DATE(TIMESTAMP_ADD(event_timestamp, INTERVAL 9 HOUR)) = CURRENT_DATE
    ),
    detail_events AS (
      SELECT
        g.CITY_NM AS city,
        CASE
          WHEN l.utm_source IS NULL OR l.utm_source = '' THEN 'unknown'
          WHEN l.utm_source LIKE 'mktpartner%'           THEN 'mktpartner'
          ELSE l.utm_source
        END AS utm_source,
        l.pid,
        l.event_name
      FROM base_log l
      JOIN gid_list g ON l.item_id = g.GID
      WHERE l.event_type = 'pageview'
        AND l.event_name IN (
          'hotel_offer_detail', 'offer_detail', 'lodging_detail',
          'checkout_complete', 'package_detail'
        )
    )
    SELECT
      city,
      utm_source,
      COUNT(DISTINCT CASE WHEN event_name IN (
        'hotel_offer_detail', 'offer_detail', 'lodging_detail', 'package_detail'
      ) THEN pid END) AS detail_uv,
      COUNT(DISTINCT CASE WHEN event_name = 'checkout_complete' THEN pid END) AS purchase_uv
    FROM detail_events
    GROUP BY 1, 2
    ORDER BY city, detail_uv DESC
  `;

  const reverseMap: Record<string, string> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor;
  }

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    city: reverseMap[String(r.city ?? '')] ?? String(r.city ?? ''),
    utmSource: String(r.utm_source ?? 'unknown'),
    detailUv: Number(r.detail_uv ?? 0),
    purchaseUv: Number(r.purchase_uv ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// FPNA 성과 기준 — MART_FPNA_NONAIR_PROFIT_D (CONFIRM/REFUND 이벤트 기반)
// 전사 KPI 기준: 확정된 GMV - 해당 월에 취소된 GMV = Net CGMV
// ---------------------------------------------------------------------------

export async function fetchFpnaMonthlyData(currentMonth: string): Promise<FpnaMonthlyData> {
  const bq = getBQClient();
  const [y, m] = currentMonth.split('-').map(Number);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const startDate = `${months[0]}-01`;
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const endDate = d1.toISOString().split('T')[0];

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        AND LOWER(sp.ko_name) NOT LIKE '%[b2b%'
        AND LOWER(sp.ko_name) NOT LIKE '%[마이팩]%'
        AND LOWER(sp.ko_name) NOT LIKE '%[나연팩]%'
    ),
    confirm_by_month AS (
      SELECT
        FORMAT_DATE('%Y-%m', p.CONFIRM_KST_DATE) AS month,
        COUNT(DISTINCT p.ORDER_ID)               AS confirm_orders,
        SUM(p.GMV)                               AS confirm_gmv,
        SUM(p.CM)                                AS confirm_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.CONFIRM_KST_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1
    ),
    refund_by_month AS (
      SELECT
        FORMAT_DATE('%Y-%m', p.REFUND_DATE) AS month,
        COUNT(DISTINCT p.ORDER_ID)          AS refund_orders,
        SUM(p.REFUND_GMV)                   AS refund_gmv,
        SUM(p.REFUND_CM)                    AS refund_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.REFUND_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND (p.REFUND_GMV != 0 OR p.REFUND_CM != 0)
      GROUP BY 1
    )
    SELECT
      c.month,
      COALESCE(c.confirm_orders, 0) AS confirm_orders,
      COALESCE(c.confirm_gmv, 0)    AS confirm_gmv,
      COALESCE(c.confirm_cm, 0)     AS confirm_cm,
      COALESCE(r.refund_orders, 0)  AS refund_orders,
      COALESCE(r.refund_gmv, 0)     AS refund_gmv,
      COALESCE(r.refund_cm, 0)      AS refund_cm
    FROM (
      SELECT month FROM confirm_by_month
      UNION DISTINCT
      SELECT month FROM refund_by_month
    ) m
    LEFT JOIN confirm_by_month c ON m.month = c.month
    LEFT JOIN refund_by_month r ON m.month = r.month
    ORDER BY 1
  `;

  const [rows] = await bq.query({ query });

  const rowMap = new Map<string, FpnaMonthRow>();
  for (const r of rows) {
    const mo = String(r.month ?? '');
    const confirmGmv = Number(r.confirm_gmv ?? 0);
    const refundGmv = Number(r.refund_gmv ?? 0);
    const confirmCm = Number(r.confirm_cm ?? 0);
    const refundCm = Number(r.refund_cm ?? 0);
    const netCgmv = confirmGmv - refundGmv;
    const netCm = confirmCm - refundCm;
    rowMap.set(mo, {
      month: mo,
      confirmOrders: Number(r.confirm_orders ?? 0),
      confirmGmv,
      refundOrders: Number(r.refund_orders ?? 0),
      refundGmv,
      netCgmv,
      confirmCm,
      refundCm,
      netCm,
      cmr: netCgmv > 0 ? parseFloat(((netCm / netCgmv) * 100).toFixed(2)) : 0,
      cfr: confirmGmv > 0 ? parseFloat(((netCgmv / confirmGmv) * 100).toFixed(1)) : 0,
    });
  }

  return {
    months,
    rows: months.map(mo => rowMap.get(mo) ?? {
      month: mo, confirmOrders: 0, confirmGmv: 0, refundOrders: 0,
      refundGmv: 0, netCgmv: 0, confirmCm: 0, refundCm: 0, netCm: 0, cmr: 0, cfr: 0,
    }),
  };
}

// ---------------------------------------------------------------------------
// FPNA 공통 헬퍼 — gid_list + confirm/refund + provider_map CTE (파트너별)
// ---------------------------------------------------------------------------
function buildFpnaPartnerQuery(confirmDateExpr: string, refundDateExpr: string, startDate: string, endDate: string): string {
  return `
    WITH gid_list AS (
      SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        AND LOWER(sp.ko_name) NOT LIKE '%[b2b%'
        AND LOWER(sp.ko_name) NOT LIKE '%[마이팩]%'
        AND LOWER(sp.ko_name) NOT LIKE '%[나연팩]%'
    ),
    provider_map AS (
      SELECT CAST(sp.property_id AS STRING) AS GID,
        UPPER(TRIM(ANY_VALUE(sp.provider_code))) AS partner
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      WHERE CAST(sp.property_id AS STRING) IN (SELECT GID FROM gid_list)
      GROUP BY 1
    ),
    confirm_raw AS (
      SELECT
        ${confirmDateExpr} AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS confirm_orders,
        SUM(p.GMV)                 AS confirm_gmv,
        SUM(p.CM)                  AS confirm_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.CONFIRM_KST_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    ),
    refund_raw AS (
      SELECT
        ${refundDateExpr} AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS refund_orders,
        SUM(p.REFUND_GMV)          AS refund_gmv,
        SUM(p.REFUND_CM)           AS refund_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.REFUND_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND (p.REFUND_GMV != 0 OR p.REFUND_CM != 0)
      GROUP BY 1, 2
    )
    SELECT
      m.period,
      m.partner,
      COALESCE(c.confirm_orders, 0) AS confirm_orders,
      COALESCE(c.confirm_gmv,    0) AS confirm_gmv,
      COALESCE(c.confirm_cm,     0) AS confirm_cm,
      COALESCE(r.refund_orders,  0) AS refund_orders,
      COALESCE(r.refund_gmv,     0) AS refund_gmv,
      COALESCE(r.refund_cm,      0) AS refund_cm
    FROM (
      SELECT period, partner FROM confirm_raw
      UNION DISTINCT
      SELECT period, partner FROM refund_raw
    ) m
    LEFT JOIN confirm_raw c ON m.period = c.period AND m.partner = c.partner
    LEFT JOIN refund_raw  r ON m.period = r.period AND m.partner = r.partner
    ORDER BY 1, 2
  `;
}

function toFpnaPeriodRow(period: string, r: Record<string, unknown>): FpnaPeriodRow {
  const confirmGmv = Number(r.confirm_gmv ?? 0);
  const refundGmv  = Number(r.refund_gmv  ?? 0);
  const confirmCm  = Number(r.confirm_cm  ?? 0);
  const refundCm   = Number(r.refund_cm   ?? 0);
  const netCgmv    = confirmGmv - refundGmv;
  const netCm      = confirmCm  - refundCm;
  return {
    period,
    confirmOrders: Number(r.confirm_orders ?? 0),
    confirmGmv,
    refundOrders:  Number(r.refund_orders  ?? 0),
    refundGmv,
    netCgmv,
    confirmCm,
    refundCm,
    netCm,
    cmr: netCgmv > 0 ? parseFloat(((netCm  / netCgmv)      * 100).toFixed(2)) : 0,
    cfr: confirmGmv > 0 ? parseFloat(((netCgmv / confirmGmv) * 100).toFixed(1)) : 0,
  };
}

function emptyFpnaRow(period: string): FpnaPeriodRow {
  return { period, confirmOrders: 0, confirmGmv: 0, refundOrders: 0, refundGmv: 0, netCgmv: 0, confirmCm: 0, refundCm: 0, netCm: 0, cmr: 0, cfr: 0 };
}

function processFpnaPartnerRows(rawRows: Record<string, unknown>[], periods: string[]): FpnaPeriodData {
  // partner → period → accumulated partial sums
  type PSum = { co: number; cg: number; cc: number; ro: number; rg: number; rc: number };
  const partnerMap = new Map<string, Map<string, PSum>>();
  const periodMap  = new Map<string, PSum>();

  const acc = (s: PSum, r: Record<string, unknown>) => {
    s.co += Number(r.confirm_orders ?? 0);
    s.cg += Number(r.confirm_gmv   ?? 0);
    s.cc += Number(r.confirm_cm    ?? 0);
    s.ro += Number(r.refund_orders ?? 0);
    s.rg += Number(r.refund_gmv   ?? 0);
    s.rc += Number(r.refund_cm    ?? 0);
  };
  const newSum = (): PSum => ({ co: 0, cg: 0, cc: 0, ro: 0, rg: 0, rc: 0 });
  const toRow  = (period: string, s: PSum): FpnaPeriodRow => toFpnaPeriodRow(period, {
    confirm_orders: s.co, confirm_gmv: s.cg, confirm_cm: s.cc,
    refund_orders:  s.ro, refund_gmv:  s.rg, refund_cm:  s.rc,
  });

  for (const r of rawRows) {
    const period  = String(r.period  ?? '');
    const partner = String(r.partner ?? 'UNKNOWN');

    // period total
    if (!periodMap.has(period)) periodMap.set(period, newSum());
    acc(periodMap.get(period)!, r);

    // partner × period
    if (!partnerMap.has(partner)) partnerMap.set(partner, new Map());
    const pm = partnerMap.get(partner)!;
    if (!pm.has(period)) pm.set(period, newSum());
    acc(pm.get(period)!, r);
  }

  const rows = periods.map(p => periodMap.has(p) ? toRow(p, periodMap.get(p)!) : emptyFpnaRow(p));

  const partners: FpnaPartnerData[] = Array.from(partnerMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partner, pm]) => ({
      partner,
      rows: periods.map(p => pm.has(p) ? toRow(p, pm.get(p)!) : emptyFpnaRow(p)),
    }));

  return { periods, rows, partners };
}

// ---------------------------------------------------------------------------
// FPNA 일별 (최근 30일)
// ---------------------------------------------------------------------------
export async function fetchFpnaDailyData(): Promise<FpnaPeriodData> {
  const bq = getBQClient();
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  const endDate   = d1.toISOString().split('T')[0];
  const startDate = d30.toISOString().split('T')[0];

  const periods: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - 1 - i);
    periods.push(d.toISOString().split('T')[0]);
  }

  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y-%m-%d', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y-%m-%d', p.REFUND_DATE)`,
    startDate, endDate,
  );
  const [rows] = await bq.query({ query });
  return processFpnaPartnerRows(rows as Record<string, unknown>[], periods);
}

// ---------------------------------------------------------------------------
// FPNA 월별 (최근 6개월) — with partners
// ---------------------------------------------------------------------------
export async function fetchFpnaMonthlyDataWithPartners(currentMonth: string): Promise<FpnaPeriodData> {
  const bq = getBQClient();
  const [y, m] = currentMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const startDate = `${months[0]}-01`;
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const endDate = d1.toISOString().split('T')[0];

  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y-%m', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y-%m', p.REFUND_DATE)`,
    startDate, endDate,
  );
  const [rows] = await bq.query({ query });
  return processFpnaPartnerRows(rows as Record<string, unknown>[], months);
}

// ---------------------------------------------------------------------------
// FPNA 연도별 (최근 3년)
// ---------------------------------------------------------------------------
export async function fetchFpnaYearlyData(currentYear: string): Promise<FpnaPeriodData> {
  const bq = getBQClient();
  const year = parseInt(currentYear);
  const years = [String(year - 2), String(year - 1), String(year)];
  const startDate = `${year - 2}-01-01`;
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 1);
  const endDate = d1.toISOString().split('T')[0];

  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y', p.REFUND_DATE)`,
    startDate, endDate,
  );
  const [rows] = await bq.query({ query });
  return processFpnaPartnerRows(rows as Record<string, unknown>[], years);
}

export async function fetchTrafficSourcesDaily(
  startDate: string,
  endDate: string,
  city: City,
): Promise<TrafficSourceDailyRow[]> {
  const bq = getBQClient();

  const allFiveCityKeys = Object.entries(CITY_BQ_MAP)
    .filter(([k]) => k !== '전체')
    .flatMap(([, v]) => v)
    .map(c => `'${c}'`)
    .join(', ');

  const cityClause = city === '전체'
    ? `AND r.city_key_name IN (${allFiveCityKeys})`
    : `AND r.city_key_name IN (${CITY_BQ_MAP[city].map(c => `'${c}'`).join(', ')})`;

  const query = `
    WITH gid_list AS (
      SELECT DISTINCT
        CAST(sp.property_id AS STRING) AS GID,
        r.city_key_name                AS CITY_NM
      FROM \`edw.DW_MRT_STAY_PROPERTY\` sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        ${cityClause}
    ),
    base_log AS (
      SELECT
        IFNULL(JSON_VALUE(utm, '$.recent_utm_source'), JSON_VALUE(utm, '$.utm_source')) AS utm_source,
        pid,
        event_name,
        event_type,
        item_id,
        event_timestamp_kst
      FROM \`edw.DW_BIZ_LOG\`
      WHERE basis_dt BETWEEN '${startDate}' AND '${endDate}'
        AND basis_dt < CURRENT_DATE

      UNION ALL

      SELECT
        IFNULL(JSON_VALUE(utm, '$.recent_utm_source'), JSON_VALUE(utm, '$.utm_source')) AS utm_source,
        pid,
        event_name,
        event_type,
        JSON_VALUE(data, '$.item_id')                                                    AS item_id,
        TIMESTAMP_ADD(event_timestamp, INTERVAL 9 HOUR)                                 AS event_timestamp_kst
      FROM \`edw_stream.biz_log\`
      WHERE basis_dt BETWEEN DATE_SUB('${startDate}', INTERVAL 1 DAY) AND '${endDate}'
        AND DATE(TIMESTAMP_ADD(event_timestamp, INTERVAL 9 HOUR)) = CURRENT_DATE
    ),
    detail_events AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(l.event_timestamp_kst))                           AS basis_date,
        g.CITY_NM                                                                       AS city,
        CASE
          WHEN l.utm_source IS NULL OR l.utm_source = '' THEN 'unknown'
          WHEN l.utm_source LIKE 'mktpartner%'           THEN 'mktpartner'
          ELSE l.utm_source
        END AS utm_source,
        l.pid,
        l.event_name
      FROM base_log l
      JOIN gid_list g ON l.item_id = g.GID
      WHERE l.event_type = 'pageview'
        AND l.event_name IN (
          'hotel_offer_detail', 'offer_detail', 'lodging_detail',
          'checkout_complete', 'package_detail'
        )
    )
    SELECT
      basis_date,
      city,
      utm_source,
      COUNT(DISTINCT CASE WHEN event_name IN (
        'hotel_offer_detail', 'offer_detail', 'lodging_detail', 'package_detail'
      ) THEN pid END) AS detail_uv,
      COUNT(DISTINCT CASE WHEN event_name = 'checkout_complete' THEN pid END) AS purchase_uv
    FROM detail_events
    WHERE basis_date BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY 1, 2, 3
    ORDER BY basis_date, detail_uv DESC
  `;

  const reverseMap: Record<string, string> = {};
  for (const [kor, engList] of Object.entries(CITY_BQ_MAP)) {
    for (const eng of engList) reverseMap[eng] = kor;
  }

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    basisDate: String(r.basis_date ?? ''),
    city: reverseMap[String(r.city ?? '')] ?? String(r.city ?? ''),
    utmSource: String(r.utm_source ?? 'unknown'),
    detailUv: Number(r.detail_uv ?? 0),
    purchaseUv: Number(r.purchase_uv ?? 0),
  }));
}

