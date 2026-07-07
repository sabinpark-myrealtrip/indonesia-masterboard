import { NextResponse } from 'next/server';
import { generateDailyDummy } from '@/lib/dummyDaily';
import { getCached } from '@/lib/supabase-cache';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET() {
  try {
    if (USE_DUMMY) return NextResponse.json(generateDailyDummy());
    const cached = await getCached('daily');
    if (!cached) return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('Daily API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
