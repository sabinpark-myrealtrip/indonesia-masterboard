import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PromotionRow } from '@/lib/types';

const USE_DUMMY = process.env.USE_DUMMY !== 'false';

let bqClient: BigQuery | null = null;
function getBQClient(): BigQuery {
  if (!bqClient) {
    const projectId = process.env.BQ_PROJECT_ID ?? 'myrealtrip-data';
    const location = process.env.BQ_LOCATION ?? 'asia-northeast1';
    const credentialsJson = process.env.BIGQUERY_CREDENTIALS_JSON;
    bqClient = credentialsJson
      ? new BigQuery({ credentials: JSON.parse(credentialsJson), projectId, location })
      : new BigQuery({ projectId, location });
  }
  return bqClient;
}

const SALES_SELECT = `
    @campaign_id AS campaign_id,
    TIMESTAMP_TRUNC(TIMESTAMP(fp.BASIS_DATE), DAY) AS basis_hour,
    COUNT(DISTINCT fp.ORDER_ID) AS resve,
    SUM(fp.SALES_KRW_PRICE) AS gmv,
    COUNT(DISTINCT CASE WHEN fp.RECENT_STATUS IN ('confirm','finish') THEN fp.ORDER_ID END) AS cresve,
    SUM(CASE WHEN fp.RECENT_STATUS IN ('confirm','finish') THEN fp.SALES_KRW_PRICE ELSE 0 END) AS cgmv,
    SUM(CASE WHEN fp.RECENT_STATUS IN ('confirm','finish') THEN
        fp.MRT_SALES_PRICE
        - (fp.COUPON_PRICE + fp.POINT_PRICE - fp.EXCLUDED_POINT_PRICE + fp.DISCOUNT_PRICE)
        - (fp.CHANNEL_FEE_PRICE + fp.AGENCY_FEE + fp.MARKETING_PARTNER_FEE + fp.AFFILIATE_POINT_FEE)
    ELSE 0 END) AS cm
`;

function buildQueryByGid(): string {
  return `
WITH sales_data AS (
    SELECT ${SALES_SELECT}
    FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` AS fp
    WHERE fp.BASIS_DATE BETWEEN @start_date AND @end_date
    AND CAST(fp.GID AS STRING) IN UNNEST(@ids)
    GROUP BY 1, 2
)
SELECT s.*, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', CURRENT_TIMESTAMP()) AS last_updated_at
FROM sales_data s
ORDER BY basis_hour
  `;
}

function buildQueryByGpid(): string {
  return `
WITH gid_list AS (
    SELECT CAST(property_id AS STRING) AS gid
    FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY\`
    WHERE CAST(accommodation_id AS STRING) IN UNNEST(@ids)
)
, sales_data AS (
    SELECT ${SALES_SELECT}
    FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` AS fp
    WHERE fp.BASIS_DATE BETWEEN @start_date AND @end_date
    AND CAST(fp.GID AS STRING) IN (SELECT gid FROM gid_list)
    GROUP BY 1, 2
)
SELECT s.*, FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', CURRENT_TIMESTAMP()) AS last_updated_at
FROM sales_data s
ORDER BY basis_hour
  `;
}

function parseIds(raw: string): string[] {
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

function generateDummy(campaignId: string, startDate: string, endDate: string): PromotionRow[] {
  const rows: PromotionRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const lastUpdatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const gmv = Math.floor(Math.random() * 18_000_000 + 8_000_000);
    const cgmv = Math.floor(gmv * (0.78 + Math.random() * 0.12));
    const cm = Math.floor(cgmv * (0.04 + Math.random() * 0.04));
    const resve = Math.floor(Math.random() * 12 + 4);
    const cresve = Math.floor(resve * (0.7 + Math.random() * 0.2));
    rows.push({
      basisHour: d.toISOString().slice(0, 10),
      campaignId, resve, gmv, cresve, cgmv, cm, lastUpdatedAt,
    });
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaign_id')?.trim();
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const idType = searchParams.get('id_type') ?? 'gid';
  const idsRaw = searchParams.get('ids') ?? '';

  if (!campaignId || !startDate || !endDate) {
    return NextResponse.json({ error: 'campaign_id, start_date, end_date 필수' }, { status: 400 });
  }
  const ids = parseIds(idsRaw);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'GID 또는 GPID를 1개 이상 입력하세요' }, { status: 400 });
  }

  if (USE_DUMMY) {
    return NextResponse.json({ rows: generateDummy(campaignId, startDate, endDate) });
  }

  try {
    const bq = getBQClient();
    const query = idType === 'gpid' ? buildQueryByGpid() : buildQueryByGid();
    const [rows] = await bq.query({
      query,
      params: { campaign_id: campaignId, start_date: startDate, end_date: endDate, ids },
      types: {
        campaign_id: 'STRING', start_date: 'STRING', end_date: 'STRING', ids: ['STRING'],
      },
    });

    const result: PromotionRow[] = rows.map((r: any) => ({
      basisHour: r.basis_hour?.value?.slice(0, 10) ?? r.basis_hour?.slice(0, 10) ?? '',
      campaignId: r.campaign_id,
      resve: Number(r.resve ?? 0),
      gmv: Number(r.gmv ?? 0),
      cresve: Number(r.cresve ?? 0),
      cgmv: Number(r.cgmv ?? 0),
      cm: Number(r.cm ?? 0),
      lastUpdatedAt: r.last_updated_at ?? '',
    }));

    return NextResponse.json({ rows: result });
  } catch (err: any) {
    console.error('Promotion API error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to fetch data' }, { status: 500 });
  }
}
