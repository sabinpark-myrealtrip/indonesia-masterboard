import { NextResponse } from 'next/server';
import { getCached } from '@/lib/supabase-cache';
import { BaliOptionRow } from '@/lib/bigquery-bali';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET() {
  if (USE_DUMMY) {
    return NextResponse.json([]);
  }
  try {
    const cached = await getCached<BaliOptionRow[]>('bali_catalog');
    return NextResponse.json(cached?.data ?? []);
  } catch (err) {
    console.error('Bali catalog API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
