import { NextRequest, NextResponse } from 'next/server';
import { generateYearlyDummy } from '@/lib/dummyYearly';
import { fetchYearlyData } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());

  try {
    const data = USE_DUMMY
      ? generateYearlyDummy(year)
      : await fetchYearlyData(year);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Yearly API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
