import { MonthlyData, MonthlyMetrics, CityMonthRow, PartnerMonthRow } from './types';

const PARTNERS = ['AGODA', 'EPS', 'HOTELBEDS', 'DH_MY_HOTEL', 'STAYNET'];
const CITIES = ['발리'];

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

function makeMetrics(baseGmv: number, scale = 1): MonthlyMetrics {
  const gmv = Math.round(baseGmv * scale * rand(0.85, 1.15));
  const cgmv = Math.round(gmv * rand(0.70, 0.88));
  const cm = Math.round(cgmv * rand(0.028, 0.065));
  const rsv = Math.round(gmv / rand(400_000, 900_000));
  const crsv = Math.round(rsv * rand(0.70, 0.92));
  const uv = Math.round(rsv * rand(15, 35));
  const purchaseCompleteUv = Math.round(uv * rand(0.02, 0.06));
  return {
    rsv, crsv, gmv, cgmv, cm, uv, purchaseCompleteUv,
    cmr: cgmv > 0 ? parseFloat(((cm / cgmv) * 100).toFixed(1)) : 0,
    cfr: gmv > 0 ? parseFloat(((cgmv / gmv) * 100).toFixed(1)) : 0,
    cvr: uv > 0 ? parseFloat(((purchaseCompleteUv / uv) * 100).toFixed(2)) : 0,
  };
}

function sumMetrics(list: MonthlyMetrics[]): MonthlyMetrics {
  const s = list.reduce((acc, m) => ({
    rsv: acc.rsv + m.rsv, crsv: acc.crsv + m.crsv,
    gmv: acc.gmv + m.gmv, cgmv: acc.cgmv + m.cgmv,
    cm: acc.cm + m.cm, uv: acc.uv + m.uv,
    purchaseCompleteUv: (acc.purchaseCompleteUv ?? 0) + (m.purchaseCompleteUv ?? 0),
    cmr: 0, cfr: 0, cvr: 0,
  }), { rsv:0,crsv:0,gmv:0,cgmv:0,cm:0,uv:0,purchaseCompleteUv:0,cmr:0,cfr:0,cvr:0 });
  s.cmr = s.cgmv > 0 ? parseFloat(((s.cm / s.cgmv) * 100).toFixed(1)) : 0;
  s.cfr = s.gmv > 0 ? parseFloat(((s.cgmv / s.gmv) * 100).toFixed(1)) : 0;
  s.cvr = s.uv > 0 ? parseFloat((((s.purchaseCompleteUv ?? 0) / s.uv) * 100).toFixed(2)) : 0;
  return s;
}

export function generateDailyDummy(): MonthlyData {
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(d1); d.setDate(d1.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  // 일별이므로 주별 대비 1/7 규모
  const cityBase: Record<string, number> = {
    발리: 80_000_000,
  };
  const partnerShare: Record<string, number> = {
    AGODA: 0.38, EPS: 0.30, HOTELBEDS: 0.14, DH_MY_HOTEL: 0.10, STAYNET: 0.08,
  };

  const rows: CityMonthRow[] = CITIES.map(city => {
    const base = cityBase[city];
    const partners: PartnerMonthRow[] = PARTNERS.map(partner => ({
      partner,
      months: Object.fromEntries(days.map((d, idx) => [d, makeMetrics(base * partnerShare[partner], 0.8 + idx * 0.007)])),
    }));
    return { city, total: Object.fromEntries(days.map(d => [d, sumMetrics(partners.map(p => p.months[d]))])), partners };
  });

  const totalRow: CityMonthRow = {
    city: '전체',
    total: Object.fromEntries(days.map(d => [d, sumMetrics(rows.map(r => r.total[d]))])),
    partners: PARTNERS.map(partner => ({
      partner,
      months: Object.fromEntries(days.map(d => [d, sumMetrics(rows.map(r => r.partners.find(p => p.partner === partner)!.months[d]))])),
    })),
  };

  return { months: days, rows: [totalRow, ...rows] };
}
