import { NextRequest, NextResponse } from 'next/server';
import { City, DailyInsight, TrendRow, DashboardData } from '@/lib/types';
import { generateDummyData } from '@/lib/dummy';
import { getCached } from '@/lib/supabase-cache';
import { getTargets } from '@/lib/targets';
import { format, subDays } from 'date-fns';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

function buildDailyInsight(trends: TrendRow[]): DailyInsight {
  const d1 = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const d2 = format(subDays(new Date(), 2), 'yyyy-MM-dd');

  const d1Rows = trends.filter(t => t.basisDate === d1);
  const d2Rows = trends.filter(t => t.basisDate === d2);

  const sum = (rows: TrendRow[], key: keyof TrendRow) =>
    rows.reduce((s, t) => s + (t[key] as number), 0);

  return {
    d1,
    d2,
    d1Gmv: sum(d1Rows, 'gmv'),
    d2Gmv: sum(d2Rows, 'gmv'),
    d1Cm: sum(d1Rows, 'cm'),
    d2Cm: sum(d2Rows, 'cm'),
    d1Rsv: sum(d1Rows, 'rsvCnt'),
    d2Rsv: sum(d2Rows, 'rsvCnt'),
    anomalies: [], // 호텔별 일별 데이터는 별도 BQ 쿼리 필요
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const basisMonth = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const city = (searchParams.get('city') ?? '전체') as City;

  try {
    let data: DashboardData;
    if (USE_DUMMY) {
      data = generateDummyData(basisMonth, city);
    } else {
      const cached = await getCached<DashboardData>(`dashboard:${basisMonth}:${city}`);
      if (!cached) {
        return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
      }
      data = cached.data;
    }

    // 목표치 주입
    data.summary = data.summary.map(s => {
      const t = getTargets(basisMonth, s.city);
      return { ...s, targetGmv: t.gmv, targetCm: t.cm };
    });

    // dailyInsight가 없으면 trends에서 계산
    if (!data.dailyInsight) {
      data.dailyInsight = buildDailyInsight(data.trends);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
