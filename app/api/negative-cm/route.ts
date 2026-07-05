import { NextRequest, NextResponse } from 'next/server';
import { City } from '@/lib/types';
import { fetchNegativeCmDaily } from '@/lib/bigquery';
import { generateDummyNegativeCm } from '@/lib/dummyNegativeCm';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get('city') ?? '전체') as City;
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  try {
    const rows = USE_DUMMY
      ? generateDummyNegativeCm(fmt(startDate), fmt(endDate), city)
      : await fetchNegativeCmDaily(fmt(startDate), fmt(endDate), city);

    return NextResponse.json({ rows, startDate: fmt(startDate), endDate: fmt(endDate) });
  } catch (err) {
    console.error('NegativeCM API error:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
