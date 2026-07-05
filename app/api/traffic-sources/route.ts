import { NextRequest, NextResponse } from 'next/server';
import { City } from '@/lib/types';
import { fetchTrafficSources, fetchTrafficSourcesDaily } from '@/lib/bigquery';
import { generateDummyTrafficSources, generateDummyTrafficSourcesDaily } from '@/lib/dummyTrafficSources';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get('city') ?? '전체') as City;
  const days = Math.min(parseInt(searchParams.get('days') ?? '14'), 90);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const s = fmt(startDate);
  const e = fmt(endDate);

  try {
    const [rows, dailyRows] = USE_DUMMY
      ? [generateDummyTrafficSources(s, e, city), generateDummyTrafficSourcesDaily(s, e, city)]
      : await Promise.all([
          fetchTrafficSources(s, e, city),
          fetchTrafficSourcesDaily(s, e, city),
        ]);

    return NextResponse.json({ rows, dailyRows, startDate: s, endDate: e });
  } catch (err) {
    console.error('TrafficSources API error:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
