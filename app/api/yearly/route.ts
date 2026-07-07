import { NextRequest, NextResponse } from 'next/server';
import { generateYearlyDummy } from '@/lib/dummyYearly';
import { getCached } from '@/lib/supabase-cache';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  try {
    if (USE_DUMMY) return NextResponse.json(generateYearlyDummy(year));
    const cached = await getCached(`yearly:${year}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('Yearly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
