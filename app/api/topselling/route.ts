import { NextRequest, NextResponse } from 'next/server';
import { generateTopSellingDummy } from '@/lib/dummyTopSelling';
import { fetchTopSelling } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') ?? '전체';

  try {
    const data = USE_DUMMY
      ? generateTopSellingDummy(city)
      : await fetchTopSelling(city);
    return NextResponse.json(data);
  } catch (err) {
    console.error('TopSelling API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
