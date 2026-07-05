import { NextRequest, NextResponse } from 'next/server';
import { fetchFpnaYearlyData } from '@/lib/bigquery';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());
  try {
    const data = await fetchFpnaYearlyData(year);
    return NextResponse.json(data);
  } catch (err) {
    console.error('FPNA Yearly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
