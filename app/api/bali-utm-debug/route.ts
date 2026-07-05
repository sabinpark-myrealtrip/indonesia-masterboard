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
  const results: Record<string, unknown> = {};

  // 1) country_key_name 후보 확인
  try {
    const [rows] = await bq.query({ query: `
      SELECT DISTINCT country_key_name, COUNT(*) AS cnt
      FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
      GROUP BY 1 ORDER BY cnt DESC LIMIT 20
    `});
    results.countries = rows;
  } catch (e) { results.countries_error = String(e); }

  // 2) 인도네시아 city_key_name 목록 (country_name도 같이)
  try {
    const [rows] = await bq.query({ query: `
      SELECT DISTINCT country_key_name, country_name, city_key_name, city_name, COUNT(*) AS cnt
      FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
      WHERE LOWER(country_key_name) LIKE '%indonesia%'
         OR LOWER(country_name) LIKE '%인도네시아%'
         OR LOWER(country_name) LIKE '%indonesia%'
      GROUP BY 1,2,3,4 ORDER BY cnt DESC LIMIT 30
    `});
    results.indonesia_cities = rows;
  } catch (e) { results.indonesia_cities_error = String(e); }

  // 3) MART_BIZ_LOG_PID_CONVERSION_D 최신 파티션 날짜 (명시적 범위)
  try {
    const [rows] = await bq.query({ query: `
      SELECT BASIS_DATE, COUNT(*) AS cnt
      FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\`
      WHERE BASIS_DATE BETWEEN DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 3 DAY)
                           AND CURRENT_DATE('Asia/Seoul')
      GROUP BY 1 ORDER BY 1 DESC
    `});
    results.recent_dates = rows;
  } catch (e) { results.recent_dates_error = String(e); }

  // 4) MART_FPNA_LODGMENT_PROFIT_D COUNTRY_NM 샘플
  try {
    const [rows] = await bq.query({ query: `
      SELECT COUNTRY_NM, COUNT(*) AS cnt
      FROM \`mrtdata.edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\`
      WHERE BASIS_DATE BETWEEN '2026-01-01' AND '2026-06-10'
        AND RECENT_STATUS IN ('confirm','finish')
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 20
    `});
    results.fpna_countries = rows;
  } catch (e) { results.fpna_countries_error = String(e); }

  return NextResponse.json(results);
}
