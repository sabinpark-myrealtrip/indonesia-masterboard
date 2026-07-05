import { NextResponse } from 'next/server';
import { fetchHKCatalog } from '@/lib/bigquery-bali';

export async function GET() {
  try {
    const data = await fetchHKCatalog();
    return NextResponse.json(data);
  } catch (err) {
    console.error('HK catalog API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
