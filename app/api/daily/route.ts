import { NextResponse } from 'next/server';
import { generateDailyDummy } from '@/lib/dummyDaily';
import { fetchDailyData } from '@/lib/bigquery';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

export async function GET() {
  try {
    const data = USE_DUMMY ? generateDailyDummy() : await fetchDailyData();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Daily API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
