import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaign_id')?.trim();
  if (!campaignId) return NextResponse.json({ error: 'campaign_id 필수' }, { status: 400 });

  try {
    const bq = getBQClient();
    const [rows] = await bq.query({
      query: `
        SELECT 'promotion_master_sheet' AS source, campaign_id, COUNT(*) AS cnt
        FROM \`mrtdata.business.promotion_master_sheet\`
        WHERE LOWER(campaign_id) = LOWER(@campaign_id)
        GROUP BY 1, 2

        UNION ALL

        SELECT 'acm_searchresult' AS source, promo_key_name AS campaign_id, COUNT(*) AS cnt
        FROM \`mrtdata.business.promotion_master_sheet_acm_searchresult\`
        WHERE LOWER(promo_key_name) = LOWER(@campaign_id)
        GROUP BY 1, 2
      `,
      params: { campaign_id: campaignId },
      types: { campaign_id: 'STRING' },
    });
    return NextResponse.json({ found: rows.length > 0, rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
