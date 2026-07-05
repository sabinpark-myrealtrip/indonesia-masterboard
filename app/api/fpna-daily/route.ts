import { NextResponse } from 'next/server';
import { fetchFpnaDailyData } from '@/lib/bigquery';

export async function GET() {
  try {
    const data = await fetchFpnaDailyData();
    return NextResponse.json(data);
  } catch (err) {
    console.error('FPNA Daily API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
