import { NextRequest, NextResponse } from 'next/server';
import { generateComparisonDummy } from '@/lib/dummyComparison';
import { fetchComparison } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const basisMonth = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  try {
    const data = USE_DUMMY
      ? generateComparisonDummy(basisMonth)
      : await fetchComparison(basisMonth);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Comparison API error:', err);
    return NextResponse.json({ error: 'Failed to fetch comparison data' }, { status: 500 });
  }
}
