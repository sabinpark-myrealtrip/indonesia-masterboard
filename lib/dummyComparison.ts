import { ComparisonData, CityPeriodRow, PeriodMetrics } from './types';
import { format, subDays } from 'date-fns';

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function makeMetrics(base: Partial<PeriodMetrics>, scale = 1): PeriodMetrics {
  const gmv = (base.gmv ?? 50_000_000) * scale * rand(0.9, 1.1);
  const cgmv = gmv * rand(0.75, 0.88);
  const cm = cgmv * rand(0.03, 0.07);
  const rsv = Math.round((base.rsvCnt ?? 80) * scale * rand(0.85, 1.15));
  const uv = Math.round((base.detailUv ?? 3000) * scale * rand(0.85, 1.15));
  return {
    gmv: Math.round(gmv),
    cm: Math.round(cm),
    cmr: parseFloat(((cm / cgmv) * 100).toFixed(1)),
    cfr: parseFloat(((cgmv / gmv) * 100).toFixed(1)),
    cvr: uv > 0 ? parseFloat(((rsv / uv) * 100).toFixed(2)) : 0,
    rsvCnt: rsv,
    detailUv: uv,
  };
}

export function generateComparisonDummy(basisMonth: string): ComparisonData {
  const [y, m] = basisMonth.split('-').map(Number);
  const today = new Date();
  const d1 = subDays(today, 1);
  const daysMtd = d1.getDate();

  const momY = m === 1 ? y - 1 : y;
  const momM = m === 1 ? 12 : m - 1;
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const wowPrevStart = subDays(d1, 13);
  const wowPrevEnd = subDays(d1, 7);

  // 도시별 기준 수치
  const bases: Record<string, Partial<PeriodMetrics>> = {
    전체:   { gmv: 200_000_000, rsvCnt: 350, detailUv: 12000 },
    발리: { gmv:  65_000_000, rsvCnt: 95, detailUv: 3200  },
  };

  const cities = ['전체', '발리'];

  const rows: CityPeriodRow[] = cities.map(city => ({
    city,
    current: makeMetrics(bases[city], 1.0),
    wow:     makeMetrics(bases[city], rand(0.80, 0.95)),   // 지난주 (비교 기준)
    mom:     makeMetrics(bases[city], rand(0.85, 1.05)),   // 전월
    yoy:     makeMetrics(bases[city], rand(0.65, 0.85)),   // 전년 (성장 중)
  }));

  return {
    currentLabel: `${basisMonth}-01 ~ ${fmt(d1)} (MTD)`,
    wowLabel: `${fmt(wowPrevStart)} ~ ${fmt(wowPrevEnd)}`,
    momLabel: `${momY}-${String(momM).padStart(2,'0')}-01 ~ ${momY}-${String(momM).padStart(2,'0')}-${String(daysMtd).padStart(2,'0')}`,
    yoyLabel: `${y-1}-${String(m).padStart(2,'0')}-01 ~ ${y-1}-${String(m).padStart(2,'0')}-${String(daysMtd).padStart(2,'0')}`,
    rows,
  };
}
