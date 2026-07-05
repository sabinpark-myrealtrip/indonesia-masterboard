import { NextRequest, NextResponse } from 'next/server';
import { fetchCityTopHotels } from '@/lib/bigquery';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? '';

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 });

  try {
    const data = await fetchCityTopHotels(month);
    return NextResponse.json(data);
  } catch (err) {
    console.error('CityTopHotels API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
