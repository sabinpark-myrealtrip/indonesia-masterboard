import { NextRequest, NextResponse } from 'next/server';
import { City } from '@/lib/types';
import { getCached } from '@/lib/supabase-cache';
import { daysAgoRange } from '@/lib/date-range';
import { generateDummyNegativeCm } from '@/lib/dummyNegativeCm';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get('city') ?? '전체') as City;
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90);

  const [startDate, endDate] = daysAgoRange(days);

  try {
    if (USE_DUMMY) {
      const rows = generateDummyNegativeCm(startDate, endDate, city);
      return NextResponse.json({ rows, startDate, endDate });
    }
    const cached = await getCached<unknown[]>(`negative_cm:${startDate}:${endDate}:${city}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요 (7/14/30일 프리셋만 캐싱됨)' }, { status: 503 });
    return NextResponse.json({ rows: cached.data, startDate, endDate });
  } catch (err) {
    console.error('NegativeCM API error:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
