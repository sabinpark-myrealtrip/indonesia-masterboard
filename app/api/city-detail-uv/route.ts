import { NextRequest, NextResponse } from 'next/server';
import { format, subWeeks, startOfISOWeek, endOfISOWeek, subMonths, startOfMonth } from 'date-fns';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export type Granularity = 'city' | 'weekly' | 'monthly';

interface UTMFields {
  da: number;
  crm: number;
  mktp: number;
  instagram: number;
  naver_cafe: number;
  sa: number;
  unknown: number;
  other: number;
  total: number;
}

export interface CityUTMRow extends UTMFields {
  city: string;
}

export interface PeriodUTMRow extends UTMFields {
  period: string;   // "2026-W14" | "2026-04"
  label: string;    // "4/1~4/7"  | "26년 4월"
}

export interface CityDetailUVData {
  granularity: Granularity;
  month: string;
  cityRows?: CityUTMRow[];
  periodRows?: PeriodUTMRow[];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeUTM(total: number): UTMFields {
  const da        = Math.floor(total * (0.25 + Math.random() * 0.15));
  const crm       = Math.floor(total * (0.15 + Math.random() * 0.10));
  const mktp      = Math.floor(total * (0.10 + Math.random() * 0.10));
  const instagram = Math.floor(total * (0.03 + Math.random() * 0.04));
  const naver_cafe= Math.floor(total * (0.02 + Math.random() * 0.03));
  const sa        = Math.floor(total * (0.03 + Math.random() * 0.04));
  const unknown   = Math.floor(total * (0.15 + Math.random() * 0.10));
  const other     = Math.max(0, total - da - crm - mktp - instagram - naver_cafe - sa - unknown);
  return { da, crm, mktp, instagram, naver_cafe, sa, unknown, other, total };
}

function generateCityRows(): CityUTMRow[] {
  const cities = ['발리'];
  const baseTotals: Record<string, number> = {
    발리: rand(30000, 60000),
  };
  return cities.map(city => ({ city, ...makeUTM(baseTotals[city]) }));
}

function generateWeeklyRows(month: string): PeriodUTMRow[] {
  const base = new Date(`${month}-01`);
  return Array.from({ length: 8 }, (_, i) => {
    const monday = startOfISOWeek(subWeeks(base, 7 - i));
    const sunday = endOfISOWeek(monday);
    const period = format(monday, "yyyy-'W'II");
    const label  = `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`;
    const total  = rand(60000, 130000);
    return { period, label, ...makeUTM(total) };
  });
}

function generateMonthlyRows(month: string): PeriodUTMRow[] {
  const base = new Date(`${month}-01`);
  return Array.from({ length: 6 }, (_, i) => {
    const d      = subMonths(startOfMonth(base), 5 - i);
    const period = format(d, 'yyyy-MM');
    const label  = `${String(d.getFullYear()).slice(2)}년 ${d.getMonth() + 1}월`;
    const total  = rand(200000, 500000);
    return { period, label, ...makeUTM(total) };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month       = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const granularity = (searchParams.get('granularity') ?? 'city') as Granularity;

  try {
    if (USE_DUMMY) {
      if (granularity === 'weekly') {
        return NextResponse.json({ granularity, month, periodRows: generateWeeklyRows(month) });
      }
      if (granularity === 'monthly') {
        return NextResponse.json({ granularity, month, periodRows: generateMonthlyRows(month) });
      }
      return NextResponse.json({ granularity, month, cityRows: generateCityRows() });
    }

    // TODO: BigQuery 쿼리 구현 전까지 더미 데이터로 폴백
    // (구현 시 granularity에 따라 GROUP BY 조건 변경)
    if (granularity === 'weekly') {
      return NextResponse.json({ granularity, month, periodRows: generateWeeklyRows(month) });
    }
    if (granularity === 'monthly') {
      return NextResponse.json({ granularity, month, periodRows: generateMonthlyRows(month) });
    }
    return NextResponse.json({ granularity, month, cityRows: generateCityRows() });
  } catch (e) {
    console.error('[city-detail-uv]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
