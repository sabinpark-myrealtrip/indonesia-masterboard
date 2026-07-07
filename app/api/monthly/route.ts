import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyDummy } from '@/lib/dummyMonthly';
import { getCached } from '@/lib/supabase-cache';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  try {
    if (USE_DUMMY) return NextResponse.json(generateMonthlyDummy(month));
    const cached = await getCached(`monthly:${month}`);
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('Monthly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
