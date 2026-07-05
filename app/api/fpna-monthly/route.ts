import { NextRequest, NextResponse } from 'next/server';
import { fetchFpnaMonthlyDataWithPartners } from '@/lib/bigquery';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  try {
    const data = await fetchFpnaMonthlyDataWithPartners(month);
    return NextResponse.json(data);
  } catch (err) {
    console.error('FPNA Monthly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
