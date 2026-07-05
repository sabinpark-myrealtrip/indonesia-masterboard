import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyDummy } from '@/lib/dummyMonthly';
import { fetchMonthlyData } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  try {
    const data = USE_DUMMY
      ? generateMonthlyDummy(month)
      : await fetchMonthlyData(month);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Monthly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
