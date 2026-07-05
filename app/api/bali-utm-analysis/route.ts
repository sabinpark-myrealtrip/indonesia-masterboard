import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

function getBQClient() {
  const projectId = process.env.BQ_PROJECT_ID ?? 'mrtdata';
  const credentialsJson = process.env.BIGQUERY_CREDENTIALS_JSON;
  if (credentialsJson) {
    return new BigQuery({ credentials: JSON.parse(credentialsJson), projectId });
  }
  return new BigQuery({ projectId });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetDate = searchParams.get('date') ?? '2026-06-09';

  const bq = getBQClient();

  const query = `
    WITH bali_gids AS (
      SELECT DISTINCT CAST(property_id AS STRING) AS gid
      FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
      WHERE country_key_name = 'Indonesia'
        AND city_key_name IN (
          'Bali','Ubud','Canggu','Seminyak','Jimbaran',
          'Nusa Dua','Sanur','Kuta','Uluwatu','Legian','Denpasar','Legian'
        )
    ),
    base AS (
      SELECT
        c.BASIS_DATE,
        COALESCE(NULLIF(c.UTM_SOURCE,''),   '(direct)')  AS utm_source,
        COALESCE(NULLIF(c.UTM_MEDIUM,''),   '(none)')    AS utm_medium,
        COALESCE(NULLIF(c.UTM_CAMPAIGN,''), '(none)')    AS utm_campaign,
        SUM(c.OFFER_DETAIL_FLAG)      AS detail_uv,
        SUM(c.CHECKOUT_FLAG)          AS checkout_uv,
        SUM(c.CHECKOUT_COMPLETE_FLAG) AS purchase_uv
      FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN bali_gids b ON c.ITEM_ID = b.gid
      WHERE c.BASIS_DATE BETWEEN DATE_SUB('${targetDate}', INTERVAL 7 DAY) AND '${targetDate}'
        AND c.OFFER_DETAIL_FLAG = 1
      GROUP BY 1,2,3,4
    )
    SELECT
      utm_source,
      utm_medium,
      utm_campaign,
      SUM(CASE WHEN BASIS_DATE = '${targetDate}' THEN detail_uv   ELSE 0 END) AS detail_uv_target,
      SUM(CASE WHEN BASIS_DATE = '${targetDate}' THEN checkout_uv ELSE 0 END) AS checkout_uv_target,
      SUM(CASE WHEN BASIS_DATE = '${targetDate}' THEN purchase_uv ELSE 0 END) AS purchase_uv_target,
      ROUND(SAFE_DIVIDE(
        SUM(CASE WHEN BASIS_DATE = '${targetDate}' THEN purchase_uv ELSE 0 END),
        NULLIF(SUM(CASE WHEN BASIS_DATE = '${targetDate}' THEN detail_uv ELSE 0 END), 0)
      ) * 100, 1) AS cvr_target,
      ROUND(AVG(CASE WHEN BASIS_DATE < '${targetDate}' THEN detail_uv   END), 1) AS detail_uv_7d_avg,
      ROUND(AVG(CASE WHEN BASIS_DATE < '${targetDate}' THEN purchase_uv END), 1) AS purchase_uv_7d_avg,
      ROUND(SAFE_DIVIDE(
        AVG(CASE WHEN BASIS_DATE < '${targetDate}' THEN purchase_uv END),
        NULLIF(AVG(CASE WHEN BASIS_DATE < '${targetDate}' THEN detail_uv END), 0)
      ) * 100, 1) AS cvr_7d_avg
    FROM base
    GROUP BY 1,2,3
    HAVING detail_uv_target >= 5
    ORDER BY detail_uv_target DESC
    LIMIT 50
  `;

  try {
    const [rows] = await bq.query({ query });
    return NextResponse.json({ date: targetDate, rows });
  } catch (err) {
    console.error('bali-utm-analysis error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
