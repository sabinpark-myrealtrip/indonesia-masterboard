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

export async function GET() {
  const bq = getBQClient();

  const query = `
    SELECT
      COALESCE(NULLIF(PROVIDER_CD, ''), '(없음)') AS provider_cd,
      COUNT(DISTINCT CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN ORDER_ID END) AS rsv,
      SUM(CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN TRAVEL_DAYS ELSE 0 END)  AS rn,
      ROUND(SUM(CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN SALES_KRW_PRICE ELSE 0 END)) AS gmv,
      ROUND(SAFE_DIVIDE(
        SUM(CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN SALES_KRW_PRICE ELSE 0 END),
        COUNT(DISTINCT CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN ORDER_ID END)
      )) AS asp_per_rsv,
      ROUND(SAFE_DIVIDE(
        SUM(CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN SALES_KRW_PRICE ELSE 0 END),
        SUM(CASE WHEN RECENT_STATUS IN ('confirm','finish') THEN TRAVEL_DAYS ELSE 0 END)
      )) AS asp_per_rn
    FROM \`mrtdata.edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\`
    WHERE BASIS_DATE BETWEEN '2026-01-01' AND DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
      AND COUNTRY_NM = 'Indonesia'
      AND SALE_FORM_CD = 'MRT'
      AND RECENT_STATUS IN ('confirm','finish')
    GROUP BY 1
    ORDER BY gmv DESC
  `;

  try {
    const [rows] = await bq.query({ query });
    const total = rows.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      acc.rsv += Number(r.rsv ?? 0);
      acc.rn  += Number(r.rn  ?? 0);
      acc.gmv += Number(r.gmv ?? 0);
      return acc;
    }, { rsv: 0, rn: 0, gmv: 0 });

    return NextResponse.json({
      by_provider: rows,
      total: {
        ...total,
        asp_per_rsv: Math.round(total.gmv / total.rsv),
        asp_per_rn:  Math.round(total.gmv / total.rn),
      }
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
