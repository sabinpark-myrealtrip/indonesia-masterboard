import { TrendRow, PartnerSummary, HotelRow, SummaryMetrics, City, HotelDailyRow } from './types';
import { format, subDays } from 'date-fns';

export type InsightLevel = 'critical' | 'warning' | 'positive' | 'info';

export interface Insight {
  level: InsightLevel;
  category: string;
  title: string;
  detail: string;
  action?: string;
}

export interface MetricDelta {
  label: string;
  d1: number;
  d2: number;
  fmt: 'krw' | 'count' | 'pct';
}

export interface DailyAnalysis {
  generatedAt: string;
  d1: string;
  d2: string;
  metrics: MetricDelta[];
  insights: Insight[];
  summary: string;
}

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function fmtPct(v: number) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function fmtKrw(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만원`;
  return `${n.toLocaleString()}원`;
}

export function analyzeDashboard(params: {
  trends: TrendRow[];
  partnerSummary: PartnerSummary[];
  hotels: HotelRow[];
  hotelDaily: HotelDailyRow[];
  summary: SummaryMetrics[];
  city: City;
}): DailyAnalysis {
  const { trends, partnerSummary, hotels, hotelDaily, summary, city } = params;
  const d1 = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const d2 = format(subDays(new Date(), 2), 'yyyy-MM-dd');
  const insights: Insight[] = [];

  // 전체 전일 지표 집계
  const allD1 = trends.filter(t => t.basisDate === d1 && (city === '전체' || t.cityGroup === city));
  const allD2 = trends.filter(t => t.basisDate === d2 && (city === '전체' || t.cityGroup === city));
  const sumF = (rows: TrendRow[], key: keyof TrendRow) => rows.reduce((s, t) => s + (t[key] as number), 0);

  const d1Uv = sumF(allD1, 'detailUv');
  const d2Uv = sumF(allD2, 'detailUv');
  const d1Rsv = sumF(allD1, 'rsvCnt');
  const d2Rsv = sumF(allD2, 'rsvCnt');
  // CVR = PURCHASE_COMPLETE_UV / DETAIL_UV (Redash #26250 기준)
  const d1Pcuv = sumF(allD1, 'purchaseCompleteUv');
  const d2Pcuv = sumF(allD2, 'purchaseCompleteUv');
  const d1Cvr = d1Uv > 0 ? parseFloat(((d1Pcuv / d1Uv) * 100).toFixed(2)) : 0;
  const d2Cvr = d2Uv > 0 ? parseFloat(((d2Pcuv / d2Uv) * 100).toFixed(2)) : 0;

  const metrics: MetricDelta[] = [
    { label: 'GMV',    d1: sumF(allD1, 'gmv'),      d2: sumF(allD2, 'gmv'),      fmt: 'krw' },
    { label: 'CM',     d1: sumF(allD1, 'cm'),       d2: sumF(allD2, 'cm'),       fmt: 'krw' },
    { label: '예약건수', d1: d1Rsv,                   d2: d2Rsv,                   fmt: 'count' },
    { label: '상세 UV', d1: d1Uv,                    d2: d2Uv,                    fmt: 'count' },
    { label: 'CVR',    d1: d1Cvr,                   d2: d2Cvr,                   fmt: 'pct' },
  ];

  // ────────────────────────────────────────────────
  // 1. 도시별 전일 대비 분석
  // ────────────────────────────────────────────────
  const cities: City[] = city === '전체'
    ? ['발리']
    : [city];

  for (const c of cities) {
    const d1Row = trends.filter(t => t.basisDate === d1 && t.cityGroup === c);
    const d2Row = trends.filter(t => t.basisDate === d2 && t.cityGroup === c);

    if (!d1Row.length || !d2Row.length) continue;

    const d1Gmv  = d1Row.reduce((s, t) => s + t.gmv, 0);
    const d2Gmv  = d2Row.reduce((s, t) => s + t.gmv, 0);
    const d1Cm   = d1Row.reduce((s, t) => s + t.cm, 0);
    const d2Cm   = d2Row.reduce((s, t) => s + t.cm, 0);
    const d1Rsv  = d1Row.reduce((s, t) => s + t.rsvCnt, 0);
    const d2Rsv  = d2Row.reduce((s, t) => s + t.rsvCnt, 0);
    const d1Cfr  = d1Row.reduce((s, t) => s + t.cfr, 0) / d1Row.length;
    const d2Cfr  = d2Row.reduce((s, t) => s + t.cfr, 0) / d2Row.length;
    const d1Uv   = d1Row.reduce((s, t) => s + t.detailUv, 0);
    const d2Uv   = d2Row.reduce((s, t) => s + t.detailUv, 0);

    const gmvDelta = pct(d1Gmv, d2Gmv);
    const rsvDelta = pct(d1Rsv, d2Rsv);
    const cfrDelta = pct(d1Cfr, d2Cfr);
    const uvDelta  = pct(d1Uv, d2Uv);

    // 7일 평균 GMV
    const last7 = trends.filter(t => t.cityGroup === c).slice(-7);
    const avg7Gmv = last7.length
      ? last7.reduce((s, t) => s + t.gmv, 0) / last7.length
      : d2Gmv;
    const vsAvg = pct(d1Gmv, avg7Gmv);

    // 예약 건당 평균 단가
    const d1Arpu = d1Rsv > 0 ? d1Gmv / d1Rsv : 0;
    const d2Arpu = d2Rsv > 0 ? d2Gmv / d2Rsv : 0;
    const arpuDelta = pct(d1Arpu, d2Arpu);

    // ── GMV 이상 탐지 + 심층 원인 분석 ──
    if (gmvDelta <= -15 || gmvDelta >= 20) {
      const isDown = gmvDelta < 0;
      const level: InsightLevel = Math.abs(gmvDelta) >= 30 ? 'critical' : isDown ? 'warning' : 'positive';

      // 원인 패턴 분류
      const causes: string[] = [];
      const hypotheses: string[] = [];
      const actions: string[] = [];

      // 패턴 1: UV 감소 → 유입 문제
      if (isDown && uvDelta <= -15) {
        causes.push(`상세 UV ${fmtPct(uvDelta)} 감소`);
        hypotheses.push('앱/웹 상세 페이지 유입 자체가 줄었습니다. 검색 노출 순위 하락 또는 광고 예산 소진일 가능성이 있습니다.');
        actions.push('앱 검색 발리 키워드 노출 순위 확인, 당일 광고 예산 소진 여부 점검');
      }

      // 패턴 2: UV 정상 + RSV 감소 → 전환 문제
      if (isDown && uvDelta > -15 && rsvDelta <= -20) {
        causes.push(`UV 유지에도 예약 전환 ${fmtPct(rsvDelta)}`);
        hypotheses.push('사람들은 들어오는데 예약을 안 했습니다. 경쟁사 가격 대비 ${c} 숙소 단가가 높아졌거나, 원하는 날짜의 재고가 소진됐을 수 있습니다.');
        actions.push('주요 호텔 가격 경쟁력 체크 (OTA 비교), 인기 날짜 재고 소진 여부 확인');
      }

      // 패턴 3: RSV 정상 + CFR 하락 → 확정 문제
      if (isDown && rsvDelta > -15 && cfrDelta <= -15) {
        causes.push(`예약 접수는 유지됐으나 CFR ${d2Cfr.toFixed(1)}%→${d1Cfr.toFixed(1)}%`);
        hypotheses.push('예약은 들어왔지만 파트너(호텔) 측에서 확정을 안 해주고 있습니다. 특정 연동사나 호텔의 시스템 오류, 또는 해당 호텔 오버부킹 가능성이 있습니다.');
        actions.push('미확정 예약 건 연동사별 내역 확인, 오버부킹 발생 호텔 CS 긴급 처리');
      }

      // 패턴 4: 단가 하락 → 고가 호텔 예약 없음
      if (isDown && rsvDelta > -15 && arpuDelta <= -15) {
        causes.push(`건당 평균 단가 ${fmtPct(arpuDelta)} 하락 (${fmtKrw(d2Arpu)}→${fmtKrw(d1Arpu)})`);
        hypotheses.push('예약 건수는 비슷한데 매출이 줄었다면, 고가 호텔 예약이 빠지고 저가 위주로만 예약이 들어온 것입니다. 상위 기여 호텔들의 당일 예약이 0건인지 확인이 필요합니다.');
        actions.push('CGMV 상위 5개 호텔 전일 예약 건수 확인, 해당 호텔 노출/가격 정상 여부 점검');
      }

      // 패턴 5: 전반적 복합 하락
      if (isDown && rsvDelta <= -20 && uvDelta <= -20) {
        hypotheses.push('UV·예약·매출이 함께 떨어졌습니다. 경쟁사 대비 노출 불리, 시즌 수요 감소, 또는 당일 앱 푸시/마케팅 부재가 복합적으로 작용했을 가능성이 있습니다.');
        actions.push('전날 대비 마케팅 채널별 유입 경로 비교, 경쟁사 프로모션 여부 확인');
      }

      // 7일 추세 판단
      const trendNote = vsAvg <= -20
        ? `⚠ 7일 평균(${fmtKrw(avg7Gmv)}) 대비로도 ${fmtPct(vsAvg)}로 단발성이 아닌 추세적 하락입니다.`
        : `7일 평균(${fmtKrw(avg7Gmv)}) 대비 ${fmtPct(vsAvg)}로, 어느 정도 일시적 변동일 수 있습니다.`;

      const causeSummary = causes.length > 0 ? `주요 이상 지표: ${causes.join(', ')}.` : '';

      insights.push({
        level,
        category: c,
        title: `${c} GMV 전일 대비 ${fmtPct(gmvDelta)} ${isDown ? '하락' : '급증'}`,
        detail: [
          `어제 GMV ${fmtKrw(d1Gmv)} / 그제 ${fmtKrw(d2Gmv)}.`,
          trendNote,
          causeSummary,
          ...hypotheses,
        ].filter(Boolean).join('\n\n'),
        action: actions.length > 0 ? actions.join('\n') : '원인 데이터 추가 분석 필요.',
      });
    }

    // UV 급락 (GMV 이상 없어도)
    if (gmvDelta > -15 && uvDelta <= -25) {
      insights.push({
        level: 'warning',
        category: c,
        title: `${c} 상세 UV ${fmtPct(uvDelta)} 선행 감소 — 향후 예약 감소 우려`,
        detail: `어제 상세 UV ${d1Uv.toLocaleString()}건 (그제 ${d2Uv.toLocaleString()}건). 아직 예약·매출엔 큰 영향이 없지만, UV 감소가 2~3일 지속되면 예약 건수도 따라 줄어듭니다.\n\n유입이 줄었다면 검색 키워드 경쟁 심화, 앱 알림 미발송, 또는 콘텐츠 품질 문제(리뷰·사진 업데이트 누락)를 의심할 수 있습니다.`,
        action: '검색 노출 순위, 최근 앱 푸시 발송 내역, 주요 호텔 콘텐츠 최신화 여부 확인.',
      });
    }

    // UV 증가 + CFR 하락 → 전환 품질 이슈
    if (uvDelta >= 10 && cfrDelta <= -15) {
      insights.push({
        level: 'warning',
        category: c,
        title: `${c} UV 늘었는데 CFR ${fmtPct(cfrDelta)} 하락 — 전환 품질 이슈`,
        detail: `상세 UV ${fmtPct(uvDelta)} 증가(${d2Uv.toLocaleString()}→${d1Uv.toLocaleString()}건)에도 CFR이 ${d2Cfr.toFixed(1)}%→${d1Cfr.toFixed(1)}%로 하락했습니다.\n\n사람은 들어오는데 예약 버튼을 안 누르는 상황입니다. 주로 ① 경쟁사 대비 가격이 높거나 ② 원하는 날짜 재고가 없거나 ③ 리뷰 점수가 최근 하락했을 때 이런 패턴이 나타납니다.`,
        action: '주요 호텔 가격 OTA 비교, 재고 가용 여부, 최근 리뷰 변동 점검.',
      });
    }

    // CFR 심각 하락
    if (d1Rsv >= 5 && d1Cfr < 60) {
      insights.push({
        level: 'critical',
        category: c,
        title: `${c} CFR ${d1Cfr.toFixed(1)}% — 미확정 예약 적체 심각`,
        detail: `어제 예약 ${d1Rsv}건 중 ${d1Cfr.toFixed(1)}%만 확정됐습니다. 정상 수준(80% 이상) 대비 크게 낮습니다.\n\n파트너 연동 오류, 특정 호텔의 오버부킹, 또는 호텔 측 응답 지연이 원인일 가능성이 높습니다. 미확정 상태가 길어지면 고객 CS 급증으로 이어집니다.`,
        action: '연동사별 미확정 건 내역 즉시 확인, 오버부킹 의심 호텔 담당자 직접 연락, 장기 미확정 고객 선제 안내.',
      });
    }
  }

  // ────────────────────────────────────────────────
  // 2. 호텔별 일별 심층 분석
  // ────────────────────────────────────────────────
  if (hotelDaily.length > 0) {
    // 호텔별로 그루핑
    const hotelMap = new Map<string, { nm: string; city: string; rows: HotelDailyRow[] }>();
    for (const r of hotelDaily) {
      if (!hotelMap.has(r.gpid)) hotelMap.set(r.gpid, { nm: r.hotelNm, city: r.city, rows: [] });
      hotelMap.get(r.gpid)!.rows.push(r);
    }

    // 호텔별 통계 계산
    type HotelStat = {
      gpid: string; nm: string; city: string;
      d1Rsv: number; d2Rsv: number; avgRsv: number;
      d1Cgmv: number; d2Cgmv: number; avgCgmv: number;
      d1Cfr: number; totalCgmv: number;
    };

    const stats: HotelStat[] = [];
    for (const [gpid, { nm, city: hCity, rows }] of hotelMap) {
      const byDate = new Map(rows.map(r => [r.basisDate, r]));
      const d1Row = byDate.get(d1);
      const d2Row = byDate.get(d2);
      if (!d1Row) continue;

      // 7일 평균 (D-1 제외 이전 7일)
      const past7 = rows.filter(r => r.basisDate < d1).slice(-7);
      const avgRsv = past7.length ? past7.reduce((s, r) => s + r.rsv, 0) / past7.length : d2Row?.rsv ?? 0;
      const avgCgmv = past7.length ? past7.reduce((s, r) => s + r.cgmv, 0) / past7.length : d2Row?.cgmv ?? 0;
      const totalCgmv = rows.reduce((s, r) => s + r.cgmv, 0);

      stats.push({
        gpid, nm, city: hCity,
        d1Rsv: d1Row.rsv,
        d2Rsv: d2Row?.rsv ?? 0,
        avgRsv,
        d1Cgmv: d1Row.cgmv,
        d2Cgmv: d2Row?.cgmv ?? 0,
        avgCgmv,
        d1Cfr: d1Row.cfr,
        totalCgmv,
      });
    }

    // 월간 CGMV 기여도 순 정렬
    stats.sort((a, b) => b.totalCgmv - a.totalCgmv);

    const totalD1Cgmv = stats.reduce((s, h) => s + h.d1Cgmv, 0);
    const totalAvgCgmv = stats.reduce((s, h) => s + h.avgCgmv, 0);

    // ① 이탈 호텔 — 평균 대비 80% 이상 급감 또는 0건
    const dropped = stats.filter(h => h.avgRsv >= 2 && h.d1Rsv < h.avgRsv * 0.3);
    if (dropped.length > 0) {
      const topDropped = dropped.slice(0, 4);
      const lostCgmv = topDropped.reduce((s, h) => s + (h.avgCgmv - h.d1Cgmv), 0);
      insights.push({
        level: dropped.some(h => h.totalCgmv > 50_000_000) ? 'critical' : 'warning',
        category: '호텔',
        title: `예약 급감 호텔 ${dropped.length}곳 — 어제 일 평균 대비 70%↓`,
        detail: [
          topDropped.map(h =>
            `• ${h.nm}(${h.city}): 어제 ${h.d1Rsv}건 / 일평균 ${h.avgRsv.toFixed(1)}건 (${h.d1Rsv === 0 ? '완전 이탈' : fmtPct(pct(h.d1Rsv, h.avgRsv))})`
          ).join('\n'),
          `\n이 호텔들의 어제 예상 CGMV 손실: 약 ${fmtKrw(lostCgmv)}`,
          dropped.some(h => h.d1Rsv === 0 && h.avgRsv >= 3)
            ? '\n0건 호텔은 연동 오류 또는 재고/가격 미노출 가능성이 있습니다. 파트너 콘솔에서 해당 호텔 상태 확인이 필요합니다.'
            : '',
        ].filter(Boolean).join(''),
        action: '해당 호텔 마이리얼트립 앱 직접 검색 → 노출/가격 정상 여부 확인\n파트너 콘솔에서 재고 가용 일자 점검\n전일 동시간대 예약 건수와 비교해 추세 확인',
      });
    }

    // ② 급증 호텔
    const surged = stats.filter(h => h.avgRsv >= 1 && h.d1Rsv > h.avgRsv * 2.5 && h.d1Rsv >= 5);
    if (surged.length > 0) {
      const top = surged.sort((a, b) => b.d1Rsv - a.d1Rsv).slice(0, 3);
      insights.push({
        level: 'positive',
        category: '호텔',
        title: `예약 급증 호텔 ${surged.length}곳 — 일평균 2.5배↑`,
        detail: [
          top.map(h =>
            `• ${h.nm}(${h.city}): 어제 ${h.d1Rsv}건 / 일평균 ${h.avgRsv.toFixed(1)}건 (${fmtPct(pct(h.d1Rsv, h.avgRsv))}), CGMV ${fmtKrw(h.d1Cgmv)}`
          ).join('\n'),
          '\n경쟁사 품절, 자체 노출 강화, 또는 SNS 입소문 효과일 수 있습니다. 원인 파악 후 유사 호텔에 동일 전략 적용을 고려하세요.',
        ].join(''),
        action: '급증 원인 분석 (프로모션·노출 변경 여부)\n재고 소진 전 유사 호텔에 선제적 노출 확대 검토',
      });
    }

    // ③ CGMV 상위 호텔 하락 — 매출 집중 리스크
    const topHotels = stats.slice(0, 5);
    const topD1Cgmv = topHotels.reduce((s, h) => s + h.d1Cgmv, 0);
    const topAvgCgmv = topHotels.reduce((s, h) => s + h.avgCgmv, 0);
    const topDelta = pct(topD1Cgmv, topAvgCgmv);
    if (topDelta <= -25 && topAvgCgmv > 0) {
      const shareOfTotal = totalAvgCgmv > 0 ? (topAvgCgmv / totalAvgCgmv) * 100 : 0;
      insights.push({
        level: 'critical',
        category: '호텔',
        title: `CGMV 상위 5개 호텔이 일평균 대비 ${fmtPct(topDelta)} 부진 — 전체 매출에 직격`,
        detail: [
          `상위 5개 호텔이 전체 CGMV의 ${shareOfTotal.toFixed(0)}%를 차지하는 상황에서, 이 호텔들의 어제 CGMV가 일평균 대비 ${fmtPct(topDelta)} 하락했습니다.`,
          '\n' + topHotels.map(h =>
            `• ${h.nm}: 어제 ${fmtKrw(h.d1Cgmv)} / 일평균 ${fmtKrw(h.avgCgmv)} (${fmtPct(pct(h.d1Cgmv, h.avgCgmv))})`
          ).join('\n'),
        ].join(''),
        action: '상위 호텔 각각 직접 앱 검색 → 가격/재고/노출 순위 이상 없는지 점검\n해당 호텔 파트너 담당자에게 전일 이슈 여부 문의',
      });
    }

    // ④ 3일 연속 하락 호텔 (추세적 이탈)
    const declineTrend = stats.filter(h => {
      const past3 = hotelDaily
        .filter(r => r.gpid === h.gpid && r.basisDate <= d1)
        .sort((a, b) => b.basisDate.localeCompare(a.basisDate))
        .slice(0, 3);
      if (past3.length < 3) return false;
      return past3[0].rsv < past3[1].rsv && past3[1].rsv < past3[2].rsv && past3[0].rsv < h.avgRsv * 0.6;
    }).slice(0, 3);

    if (declineTrend.length > 0) {
      insights.push({
        level: 'warning',
        category: '호텔',
        title: `3일 연속 예약 감소 호텔 ${declineTrend.length}곳 — 추세적 이탈 가능성`,
        detail: [
          '단발성이 아닌 지속적 하락세입니다.',
          '\n' + declineTrend.map(h => {
            const past3 = hotelDaily
              .filter(r => r.gpid === h.gpid && r.basisDate <= d1)
              .sort((a, b) => b.basisDate.localeCompare(a.basisDate))
              .slice(0, 3);
            return `• ${h.nm}(${h.city}): ${past3[2]?.rsv ?? '?'}건 → ${past3[1]?.rsv ?? '?'}건 → ${past3[0]?.rsv ?? '?'}건 (일평균 ${h.avgRsv.toFixed(1)}건)`;
          }).join('\n'),
          '\n가격 경쟁력 약화, 리뷰 하락, 또는 경쟁사 신규 호텔 등록이 원인일 수 있습니다.',
        ].join(''),
        action: '해당 호텔 최근 1주일 리뷰 변동 확인\n경쟁 플랫폼(아고다·부킹) 동일 호텔 가격 비교\n마케팅팀에 해당 호텔 노출 강화 요청 검토',
      });
    }
  }

  // ────────────────────────────────────────────────
  // 3. 파트너별 이상 탐지
  // ────────────────────────────────────────────────
  if (partnerSummary.length > 0) {
    const avgCfr = partnerSummary.reduce((s, p) => s + p.cfr, 0) / partnerSummary.length;
    for (const p of partnerSummary) {
      if (p.cfr < avgCfr - 15 && p.rsvCnt >= 10) {
        insights.push({
          level: 'warning',
          category: '연동사',
          title: `${p.partner} CFR ${p.cfr.toFixed(1)}% — 전체 평균 대비 낮음`,
          detail: `${p.partner}의 CFR ${p.cfr.toFixed(1)}%는 연동사 평균(${avgCfr.toFixed(1)}%) 대비 ${(avgCfr - p.cfr).toFixed(1)}%p 낮습니다. 예약 ${p.rsvCnt}건 중 확정 ${p.crsvCnt}건.`,
          action: `${p.partner} 담당자에게 미확정 원인 확인 요청. 장기 미확정 건 고객 안내 필요.`,
        });
      }
      if (p.cmr < 2 && p.cgmv > 50_000_000) {
        insights.push({
          level: 'warning',
          category: '연동사',
          title: `${p.partner} CMR ${p.cmr.toFixed(1)}% — 수익성 낮음`,
          detail: `${p.partner} CGMV ${fmtKrw(p.cgmv)} 대비 CM ${fmtKrw(p.cm)}으로 마진율이 ${p.cmr.toFixed(1)}%에 불과합니다.`,
          action: '계약 조건 재검토 또는 쿠폰/포인트 소진 비율 확인.',
        });
      }
    }
  }

  // ────────────────────────────────────────────────
  // 3. 호텔 이상 탐지 (월간 기준 이상치)
  // ────────────────────────────────────────────────
  if (hotels.length > 0) {
    const avgCfr = hotels.reduce((s, h) => s + h.cfr, 0) / hotels.length;
    const avgCmr = hotels.reduce((s, h) => s + h.cmr, 0) / hotels.length;

    const lowCfrHotels = hotels
      .filter(h => h.cfr < avgCfr - 20 && h.rsvCnt >= 10)
      .slice(0, 3);

    if (lowCfrHotels.length > 0) {
      insights.push({
        level: 'warning',
        category: '호텔',
        title: `CFR 저조 호텔 ${lowCfrHotels.length}곳 감지`,
        detail: lowCfrHotels.map(h =>
          `${h.hotelNm}(${h.city}): CFR ${h.cfr.toFixed(1)}%, 예약 ${h.rsvCnt}건`
        ).join(' / '),
        action: '해당 호텔 파트너 연동 상태 및 가격 정책 확인 필요.',
      });
    }

    const topHotels = [...hotels].sort((a, b) => b.cgmv - a.cgmv).slice(0, 3);
    const topShare = topHotels.reduce((s, h) => s + h.cgmv, 0) /
      (hotels.reduce((s, h) => s + h.cgmv, 0) || 1) * 100;

    if (topShare >= 50) {
      insights.push({
        level: 'info',
        category: '호텔',
        title: `상위 3개 호텔이 CGMV의 ${topShare.toFixed(0)}% 차지`,
        detail: topHotels.map(h => `${h.hotelNm}: ${fmtKrw(h.cgmv)}`).join(', '),
        action: '특정 호텔 의존도가 높아 해당 호텔 재고/가격 변동 모니터링 강화 권장.',
      });
    }
  }

  // ────────────────────────────────────────────────
  // 4. 월간 목표 달성률
  // ────────────────────────────────────────────────
  const targetRow = summary.find(s => s.city === city) ?? summary[0];
  if (targetRow?.targetGmv && targetRow.targetGmv > 0) {
    const achieveRate = (targetRow.cgmv / targetRow.targetGmv) * 100;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysPassed = today.getDate() - 1; // 어제 기준
    const expectedRate = (daysPassed / daysInMonth) * 100;
    const gap = achieveRate - expectedRate;

    if (gap <= -10) {
      insights.push({
        level: 'warning',
        category: '목표',
        title: `월간 GMV 목표 달성률 ${achieveRate.toFixed(1)}% — 기대치 대비 ${gap.toFixed(1)}%p 미달`,
        detail: `${daysPassed}일 경과 기준 예상 달성률 ${expectedRate.toFixed(1)}% 대비 ${Math.abs(gap).toFixed(1)}%p 뒤처지고 있습니다. 잔여 ${daysInMonth - daysPassed}일 동안 일평균 ${fmtKrw((targetRow.targetGmv - targetRow.cgmv) / Math.max(daysInMonth - daysPassed, 1))}이 필요합니다.`,
        action: '목표 gap 해소를 위한 프로모션 또는 노출 확대 검토.',
      });
    } else if (gap >= 5) {
      insights.push({
        level: 'positive',
        category: '목표',
        title: `월간 GMV 목표 순항 중 — 기대치 대비 ${gap.toFixed(1)}%p 초과`,
        detail: `현재 달성률 ${achieveRate.toFixed(1)}%로 ${daysPassed}일 경과 기준 예상치(${expectedRate.toFixed(1)}%)를 앞서고 있습니다.`,
      });
    }
  }

  // ────────────────────────────────────────────────
  // 인사이트 없으면 기본 메시지
  // ────────────────────────────────────────────────
  if (insights.length === 0) {
    insights.push({
      level: 'info',
      category: '전체',
      title: '특이사항 없음',
      detail: '전일 대비 모든 지표가 정상 범위 내에 있습니다.',
    });
  }

  // 심각도 순 정렬
  const order: Record<InsightLevel, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  insights.sort((a, b) => order[a.level] - order[b.level]);

  const critCount = insights.filter(i => i.level === 'critical').length;
  const warnCount = insights.filter(i => i.level === 'warning').length;
  const posCount  = insights.filter(i => i.level === 'positive').length;

  const summaryParts = [];
  if (critCount > 0) summaryParts.push(`긴급 ${critCount}건`);
  if (warnCount > 0) summaryParts.push(`주의 ${warnCount}건`);
  if (posCount  > 0) summaryParts.push(`긍정 ${posCount}건`);

  return {
    generatedAt: new Date().toISOString(),
    d1,
    d2,
    metrics,
    insights,
    summary: summaryParts.length > 0 ? summaryParts.join(' · ') : '특이사항 없음',
  };
}
