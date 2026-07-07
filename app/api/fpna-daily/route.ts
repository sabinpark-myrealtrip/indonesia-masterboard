import { NextResponse } from 'next/server';
import { getCached } from '@/lib/supabase-cache';

export async function GET() {
  try {
    const cached = await getCached('fpna_daily');
    if (!cached) {
      return NextResponse.json({ error: '캐시된 데이터 없음 - sync 필요' }, { status: 503 });
    }
    return NextResponse.json(cached.data);
  } catch (err) {
    console.error('FPNA Daily API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
