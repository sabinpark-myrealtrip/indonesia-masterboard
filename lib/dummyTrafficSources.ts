import { City, TrafficSourceRow, TrafficSourceDailyRow } from './types';

const UTM_SOURCES = ['naver', 'google', 'unknown', 'mktpartner', 'direct', 'kakao', 'instagram', 'braze'];
const KOR_CITIES = ['발리'];

// UTM 소스별 베이스 UV (도시마다 규모 차이)
const UTM_BASE: Record<string, number> = {
  naver: 1800, google: 900, unknown: 1200, mktpartner: 600,
  direct: 400, kakao: 350, instagram: 200, braze: 150,
};
const CITY_SCALE: Record<string, number> = {
  '발리': 1.0,
};

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function generateDummyTrafficSources(_s: string, _e: string, city: City): TrafficSourceRow[] {
  const cities = city === '전체' ? KOR_CITIES : [city];
  const rows: TrafficSourceRow[] = [];
  for (const c of cities) {
    const scale = CITY_SCALE[c] ?? 0.5;
    for (const utm of UTM_SOURCES) {
      const base = UTM_BASE[utm] ?? 200;
      const detailUv = Math.floor(base * scale * (0.8 + Math.random() * 0.4));
      const purchaseUv = Math.floor(detailUv * (0.005 + Math.random() * 0.025));
      rows.push({ city: c, utmSource: utm, detailUv, purchaseUv });
    }
  }
  return rows.sort((a, b) => {
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return b.detailUv - a.detailUv;
  });
}

export function generateDummyTrafficSourcesDaily(
  startDate: string,
  endDate: string,
  city: City,
): TrafficSourceDailyRow[] {
  const cities = city === '전체' ? KOR_CITIES : [city];
  const rows: TrafficSourceDailyRow[] = [];
  let cur = startDate;
  while (cur <= endDate) {
    for (const c of cities) {
      const scale = CITY_SCALE[c] ?? 0.5;
      for (const utm of UTM_SOURCES) {
        const base = UTM_BASE[utm] ?? 200;
        const detailUv = Math.floor((base / 14) * scale * (0.6 + Math.random() * 0.8));
        if (detailUv === 0) { cur = addDays(cur, 0); continue; }
        const purchaseUv = Math.floor(detailUv * (0.005 + Math.random() * 0.025));
        rows.push({ basisDate: cur, city: c, utmSource: utm, detailUv, purchaseUv });
      }
    }
    cur = addDays(cur, 1);
  }
  return rows;
}
