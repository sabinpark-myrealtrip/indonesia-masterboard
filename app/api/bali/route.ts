import { NextResponse } from 'next/server';
import { fetchBaliCatalog } from '@/lib/bigquery-bali';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET() {
  if (USE_DUMMY) {
    return NextResponse.json([]);
  }
  try {
    const data = await fetchBaliCatalog();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Bali catalog API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
