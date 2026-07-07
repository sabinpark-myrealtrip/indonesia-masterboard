import { NextRequest, NextResponse } from 'next/server';
import { City } from '@/lib/types';
import { getCached } from '@/lib/supabase-cache';
import { daysAgoRange } from '@/lib/date-range';
import { generateDummyTrafficSources, generateDummyTrafficSourcesDaily } from '@/lib/dummyTrafficSources';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get('city') ?? '전체') as City;
  const days = Math.min(parseInt(searchParams.get('days') ?? '14'), 90);

  const [s, e] = daysAgoRange(days);

  try {
    if (USE_DUMMY) {
      const rows = generateDummyTrafficSources(s, e, city);
      const dailyRows = generateDummyTrafficSourcesDaily(s, e, city);
      return NextResponse.json({ rows, dailyRows, startDate: s, endDate: e });
    }
    const cached = await getCached(`traffic_sources:${s}:${e}:${city}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요 (7/14/30일 프리셋만 캐싱됨)' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('TrafficSources API error:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
