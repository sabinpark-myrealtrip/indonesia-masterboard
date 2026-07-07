import { NextRequest, NextResponse } from 'next/server';
import { getCached } from '@/lib/supabase-cache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());
  try {
    const cached = await getCached(`fpna_yearly:${year}`);
    if (!cached) {
      return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    }
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('FPNA Yearly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
