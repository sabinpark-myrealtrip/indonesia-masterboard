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
  try {
    const bq = getBQClient();

    const query = `
      WITH hk_gids AS (
        SELECT DISTINCT
          CAST(p.gid AS STRING) AS gid,
          p.property_name
        FROM \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` p
        JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` reg
          ON p.gid = reg.property_id
        JOIN \`mrtdata.edw.DW_MRT_PARTNERS_PARTNER\` n
          ON n.id = p.partner_id
        WHERE reg.country_name = '홍콩'
          AND p.deleted_at IS NULL
          AND NOT REGEXP_CONTAINS(p.property_name, r'\\[B2B|\\[마이팩\\]|\\[마이팩 |\\[한인민박\\]')
          AND NOT UPPER(n.nickname) LIKE '%DX%'
          AND NOT LOWER(n.nickname) LIKE '%리셀마켓%'
      )
      SELECT
        CAST(p.GID AS STRING)                                        AS gid,
        MAX(g.property_name)                                         AS hotel_nm,
        COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.ORDER_ID END) AS rsv,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.SALES_KRW_PRICE ELSE 0 END) AS gmv,
        COALESCE(SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN p.TRAVEL_DAYS ELSE 0 END), 0) AS rn,
        SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish') THEN
          p.MRT_SALES_PRICE
          - (p.COUPON_PRICE + p.POINT_PRICE - p.EXCLUDED_POINT_PRICE + p.DISCOUNT_PRICE)
          - (p.CHANNEL_FEE_PRICE + p.AGENCY_FEE + p.MARKETING_PARTNER_FEE + p.AFFILIATE_POINT_FEE)
        ELSE 0 END)                                                  AS cm
      FROM \`mrtdata.edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` p
      JOIN hk_gids g ON CAST(p.GID AS STRING) = g.gid
      WHERE p.BASIS_DATE BETWEEN '2025-01-01' AND '2025-12-31'
      GROUP BY CAST(p.GID AS STRING)
      ORDER BY gmv DESC
    `;

    const [rows] = await bq.query({ query });
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({
      gid:    String(r.gid     ?? ''),
      hotelNm: String(r.hotel_nm ?? ''),
      rsv:    Number(r.rsv     ?? 0),
      gmv:    Number(r.gmv     ?? 0),
      rn:     Number(r.rn      ?? 0),
      cm:     Number(r.cm      ?? 0),
      cmr:    r.gmv ? parseFloat(((Number(r.cm) / Number(r.gmv)) * 100).toFixed(1)) : 0,
    })));
  } catch (err) {
    console.error('HK sales API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
