import { NextRequest, NextResponse } from 'next/server';
import { generateTopSellingDummy } from '@/lib/dummyTopSelling';
import { getCached } from '@/lib/supabase-cache';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') ?? '전체';

  try {
    if (USE_DUMMY) return NextResponse.json(generateTopSellingDummy(city));
    const cached = await getCached(`topselling:${city}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('TopSelling API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
