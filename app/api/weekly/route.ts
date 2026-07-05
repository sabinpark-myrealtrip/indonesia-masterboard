import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyDummy } from '@/lib/dummyWeekly';
import { fetchWeeklyData } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  try {
    const data = USE_DUMMY
      ? generateWeeklyDummy(month)
      : await fetchWeeklyData(month);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Weekly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
