// BigQuery 연결 전 개발용 더미 데이터
import { City, CITIES, DashboardData, SummaryMetrics, HotelRow, TrendRow, PartnerSummary, DailyInsight, HotelAnomaly, HotelDailyRow } from './types';
import { format, subDays, startOfMonth } from 'date-fns';

const PARTNERS = ['agoda', 'booking', 'expedia', 'airbnb', 'hotels'];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, dec = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

export function generateDummyData(basisMonth: string, city: City): DashboardData {
  const cities: City[] = city === '전체'
    ? ['발리']
    : [city];

  const summary: SummaryMetrics[] = cities.map(c => {
    const rsvCnt = rand(800, 3000);
    const crsvCnt = Math.floor(rsvCnt * randFloat(0.6, 0.92, 2));
    const cgmv = rand(300_000_000, 2_000_000_000);
    const gmv = Math.floor(cgmv * randFloat(1.05, 1.2, 2));
    const cm = Math.floor(cgmv * randFloat(0.03, 0.08, 3));
    return {
      city: c,
      gmv,
      cgmv,
      cm,
      cmr: parseFloat(((cm / cgmv) * 100).toFixed(1)),
      cfr: parseFloat(((cgmv / gmv) * 100).toFixed(1)),  // CFR = CGMV/GMV
      tr: randFloat(85, 98),
      rsvCnt,
      crsvCnt,
      detailUv: rand(5000, 50000),
      targetCgmv: Math.floor(cgmv * randFloat(0.9, 1.1, 2)),
      targetCfr: randFloat(80, 92),
    };
  });

  // 전체 집계
  if (city === '전체') {
    const totalSummary: SummaryMetrics = {
      city: '전체',
      gmv: summary.reduce((s, r) => s + r.gmv, 0),
      cgmv: summary.reduce((s, r) => s + r.cgmv, 0),
      cm: summary.reduce((s, r) => s + r.cm, 0),
      cmr: 0,
      cfr: 0,
      tr: 0,
      rsvCnt: summary.reduce((s, r) => s + r.rsvCnt, 0),
      crsvCnt: summary.reduce((s, r) => s + r.crsvCnt, 0),
      detailUv: summary.reduce((s, r) => s + r.detailUv, 0),
      targetCgmv: summary.reduce((s, r) => s + (r.targetCgmv ?? 0), 0),
      targetCfr: parseFloat((summary.reduce((s, r) => s + (r.targetCfr ?? 0), 0) / summary.length).toFixed(1)),
    };
    totalSummary.cmr = parseFloat(((totalSummary.cm / totalSummary.cgmv) * 100).toFixed(1));
    totalSummary.cfr = parseFloat(((totalSummary.cgmv / totalSummary.gmv) * 100).toFixed(1));  // CFR = CGMV/GMV
    totalSummary.tr = parseFloat((summary.reduce((s, r) => s + r.tr, 0) / summary.length).toFixed(1));
    summary.unshift(totalSummary);
  }

  // 파트너별 요약
  const totalRsv = summary.find(s => s.city === city)?.rsvCnt ?? summary[0].rsvCnt;
  const totalCgmv = summary.find(s => s.city === city)?.cgmv ?? summary[0].cgmv;

  const partnerSummary: PartnerSummary[] = PARTNERS.map(partner => {
    const rsvCnt = Math.floor(totalRsv * randFloat(0.1, 0.35, 2));
    const crsvCnt = Math.floor(rsvCnt * randFloat(0.6, 0.92, 2));
    const cgmv = Math.floor(totalCgmv * randFloat(0.1, 0.35, 2));
    const cm = Math.floor(cgmv * randFloat(0.03, 0.08, 3));
    return {
      partner,
      rsvCnt,
      crsvCnt,
      cfr: parseFloat(((crsvCnt / rsvCnt) * 100).toFixed(1)),
      cgmv,
      cm,
      cmr: parseFloat(((cm / cgmv) * 100).toFixed(1)),
    };
  }).sort((a, b) => b.cgmv - a.cgmv);

  const HOTEL_NAMES = [
    '더 리츠 칼튼', '만다린 오리엔탈', '파크 하얏트', '콘래드', '힐튼',
    '도큐 호텔', '게이오 플라자', '프린스 호텔', 'APA 호텔', '도미 인',
    '도요코 인', '루트 인', '수퍼 호텔', '스마일 호텔', '그린 호텔',
  ];

  const MINBAK_CATEGORIES = ['KOREAN_MINBAK', 'LOCAL_ACCOMMODATION_V2'];
  const HOTEL_CATEGORIES = ['LODGING_V2', 'LODGE_V2'];

  const hotels: HotelRow[] = Array.from({ length: 50 }, (_, i) => {
    const hotelCity = cities[i % cities.length];
    const rsvCnt = rand(50, 500);
    const crsvCnt = Math.floor(rsvCnt * randFloat(0.6, 0.92, 2));
    const cgmv = rand(10_000_000, 300_000_000);
    const cm = Math.floor(cgmv * randFloat(0.02, 0.08, 3));
    const isMinbak = i % 5 === 0;
    const categoryPool = isMinbak ? MINBAK_CATEGORIES : HOTEL_CATEGORIES;
    return {
      gpid: String(i + 1),
      hotelNm: `${HOTEL_NAMES[i % HOTEL_NAMES.length]} ${hotelCity}점`,
      city: hotelCity,
      category: categoryPool[i % categoryPool.length],
      gmv: Math.floor(cgmv * 1.1),
      cgmv,
      cm,
      cmr: parseFloat(((cm / cgmv) * 100).toFixed(1)),
      cfr: parseFloat(((crsvCnt / rsvCnt) * 100).toFixed(1)),
      rsvCnt,
      crsvCnt,
      tr: randFloat(85, 98),
      uv: rand(rsvCnt * 10, rsvCnt * 40),
    };
  }).sort((a, b) => b.gmv - a.gmv);

  const [year, month] = basisMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const today = new Date();
  const end = today < new Date(year, month, 0) ? today : new Date(year, month, 0);

  const trends: TrendRow[] = [];
  let d = new Date(start);
  while (d <= end) {
    for (const c of cities) {
      const rsvCnt = rand(20, 120);
      const crsvCnt = Math.floor(rsvCnt * randFloat(0.6, 0.92, 2));
      const cgmv = rand(5_000_000, 80_000_000);
      const detailUv = rand(500, 5000);
      trends.push({
        basisDate: format(d, 'yyyy-MM-dd'),
        cityGroup: c,
        gmv: Math.floor(cgmv * 1.1),
        cgmv,
        cm: Math.floor(cgmv * randFloat(0.03, 0.07, 3)),
        rsvCnt,
        crsvCnt,
        cfr: parseFloat(((crsvCnt / rsvCnt) * 100).toFixed(1)),
        detailUv,
        purchaseCompleteUv: Math.floor(detailUv * randFloat(0.01, 0.05, 3)),
      });
    }
    d = new Date(d.getTime() + 86400000);
  }

  const reservations = Array.from({ length: 100 }, (_, i) => {
    const daysAgo = rand(0, 89);
    const bookingDate = format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');
    const hotelCity = cities[i % cities.length];
    return {
      resveId: `JP${String(100000 + i).padStart(6, '0')}`,
      partner: PARTNERS[i % PARTNERS.length],
      hotelNm: `${HOTEL_NAMES[i % HOTEL_NAMES.length]} ${hotelCity}점`,
      bookingDate,
      elapsedDays: daysAgo,
      salesKrwPrice: rand(100_000, 2_000_000),
      status: i % 4 === 0 ? 'wait_confirm' : 'confirm',
      city: hotelCity,
    };
  });

  const cfrDaily = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
    return PARTNERS.map(partner => {
      const rsvCnt = rand(5, 50);
      const crsvCnt = Math.floor(rsvCnt * randFloat(0.55, 0.95, 2));
      return {
        basisDate: date,
        partner,
        cfrPct: parseFloat(((crsvCnt / rsvCnt) * 100).toFixed(1)),
        cancelPartner: rand(0, 5),
        cancelCustomer: rand(0, 10),
        rsvCnt,
        crsvCnt,
      };
    });
  }).flat();

  // 어제(D-1) vs 그제(D-2) 일별 인사이트
  const d1 = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const d2 = format(subDays(new Date(), 2), 'yyyy-MM-dd');

  const d1Trends = trends.filter(t => t.basisDate === d1);
  const d2Trends = trends.filter(t => t.basisDate === d2);

  const sum = (arr: typeof trends, key: keyof TrendRow) =>
    arr.reduce((s, t) => s + (t[key] as number), 0);

  // 호텔별 이상 탐지: 평균 예약건 대비 D-1 편차
  const HOTEL_NAMES_SHORT = [
    '더 리츠 칼튼', '만다린 오리엔탈', '파크 하얏트', '콘래드', '힐튼',
    '도큐 호텔', '게이오 플라자', '프린스 호텔', 'APA 호텔', '도미 인',
    '도요코 인', '루트 인', '수퍼 호텔', '스마일 호텔', '그린 호텔',
  ];

  const anomalies: HotelAnomaly[] = Array.from({ length: 20 }, (_, i) => {
    const hotelCity = cities[i % cities.length];
    const avgRsv = rand(4, 15);
    // 일부 호텔에 극단값 부여
    let d1Rsv: number;
    if (i < 3) d1Rsv = 0;                          // 어제 0건 (이탈)
    else if (i < 6) d1Rsv = avgRsv * rand(3, 5);   // 급증
    else d1Rsv = Math.max(0, rand(avgRsv - 3, avgRsv + 3));
    const d2Rsv = Math.max(0, rand(avgRsv - 2, avgRsv + 2));
    const d1Cgmv = d1Rsv * rand(300_000, 1_200_000);
    const d2Cgmv = d2Rsv * rand(300_000, 1_200_000);
    return {
      gpid: String(i + 1),
      hotelNm: `${HOTEL_NAMES_SHORT[i % HOTEL_NAMES_SHORT.length]} ${hotelCity}점`,
      city: hotelCity,
      d1Rsv,
      d2Rsv,
      d1Cgmv,
      d2Cgmv,
      avgRsv,
    };
  });

  const dailyInsight: DailyInsight = {
    d1,
    d2,
    d1Gmv: sum(d1Trends, 'gmv'),
    d2Gmv: sum(d2Trends, 'gmv'),
    d1Cm: sum(d1Trends, 'cm'),
    d2Cm: sum(d2Trends, 'cm'),
    d1Rsv: sum(d1Trends, 'rsvCnt'),
    d2Rsv: sum(d2Trends, 'rsvCnt'),
    anomalies: anomalies.sort((a, b) => {
      const da = Math.abs(a.d1Rsv - a.avgRsv) / (a.avgRsv || 1);
      const db = Math.abs(b.d1Rsv - b.avgRsv) / (b.avgRsv || 1);
      return db - da;
    }),
  };

  // 호텔별 최근 14일 일별 데이터 (전일 대비 분석용)
  const hotelDaily: HotelDailyRow[] = [];
  const hotelPool = hotels.slice(0, 20); // 상위 20개 호텔
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const dateStr = format(subDays(new Date(), dayOffset), 'yyyy-MM-dd');
    for (let hi = 0; hi < hotelPool.length; hi++) {
      const h = hotelPool[hi];
      const baseRsv = Math.max(1, Math.round(h.rsvCnt / 30));
      // 특정 호텔에 패턴 부여 (더미용)
      let rsv: number;
      if (hi < 2 && dayOffset <= 1) rsv = 0;                         // 최근 이틀 0건 (이탈)
      else if (hi === 2 && dayOffset === 1) rsv = baseRsv * rand(4, 6); // 어제 급증
      else rsv = Math.max(0, baseRsv + rand(-2, 2));
      const crsv = Math.floor(rsv * randFloat(0.7, 0.95, 2));
      const cgmv = rsv > 0 ? Math.round((h.cgmv / h.rsvCnt) * rsv) : 0;
      hotelDaily.push({
        gpid: h.gpid,
        hotelNm: h.hotelNm,
        city: String(h.city),
        basisDate: dateStr,
        rsv,
        crsv,
        cgmv,
        cfr: rsv > 0 ? parseFloat(((crsv / rsv) * 100).toFixed(1)) : 0,
      });
    }
  }

  return { summary, partnerSummary, hotels, trends, hotelDaily, reservations, cfrDaily, basisMonth, dailyInsight };
}
