import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PARTNER_IDS = [159133, 159164, 158637, 157933, 131403, 140457, 124209];

function getBQClient() {
  const projectId = process.env.BQ_PROJECT_ID ?? 'mrtdata';
  const location = process.env.BQ_LOCATION ?? 'asia-northeast1';
  const credentialsJson = process.env.BIGQUERY_CREDENTIALS_JSON;
  if (credentialsJson) {
    return new BigQuery({ credentials: JSON.parse(credentialsJson), projectId, location });
  }
  return new BigQuery({ projectId, location });
}

export async function GET() {
  try {
    const bq = getBQClient();

    const query = `
      SELECT
        p.partner_id,
        p.gid,
        p.property_id,
        p.property_name,
        p.property_type,
        CAST(p.star_rating AS FLOAT64) AS star_rating,
        p.property_status,
        COALESCE(pt.nickname, CAST(p.partner_id AS STRING)) AS partner_name
      FROM \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` p
      LEFT JOIN \`mrtdata.edw.DW_MRT_PARTNERS_PARTNER\` pt ON pt.id = p.partner_id
      WHERE p.partner_id IN (${PARTNER_IDS.join(', ')})
        AND NOT REGEXP_CONTAINS(LOWER(p.property_name), r'\\[b2b')
        AND p.property_name NOT LIKE '[마이팩]%'
        AND p.property_name NOT LIKE '[나연팩]%'
        AND p.property_name NOT LIKE '%공항 픽업%'
        AND p.property_name NOT LIKE '%투어%'
      ORDER BY p.partner_id, p.property_status, p.property_name
    `;

    const [rows] = await bq.query({ query });

    const data = rows.map((r: Record<string, unknown>) => ({
      partnerId: Number(r.partner_id),
      partnerName: String(r.partner_name ?? '').trim(),
      gid: String(r.gid),
      propertyId: String(r.property_id),
      propertyName: String(r.property_name ?? '').trim(),
      propertyType: String(r.property_type ?? ''),
      starRating: r.star_rating != null ? Number(r.star_rating) : null,
      propertyStatus: String(r.property_status ?? ''),
    }));

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
