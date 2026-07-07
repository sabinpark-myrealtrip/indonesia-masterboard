import { NextRequest, NextResponse } from 'next/server';
import { getCached } from '@/lib/supabase-cache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? '';

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 });

  try {
    const cached = await getCached(`city_top_hotels:${month}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('CityTopHotels API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
