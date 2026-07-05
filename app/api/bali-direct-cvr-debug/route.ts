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
  const TARGET = '2026-06-09';
  const results: Record<string, unknown> = {};

  // 1) 6/9 direct 구매 GID별 — 어떤 상품이 팔렸나
  try {
    const [rows] = await bq.query({ query: `
      WITH bali_gids AS (
        SELECT DISTINCT CAST(property_id AS STRING) AS gid
        FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
        WHERE country_key_name = 'Indonesia'
          AND city_key_name IN (
            'Bali','Ubud','Canggu','Seminyak','Jimbaran',
            'Nusa Dua','Sanur','Kuta','Uluwatu','Legian','Denpasar'
          )
      )
      SELECT
        c.ITEM_ID                                            AS gid,
        MAX(sp.ko_name)                                      AS hotel_nm,
        MAX(r.city_key_name)                                 AS city,
        SUM(c.OFFER_DETAIL_FLAG)                             AS detail_uv,
        SUM(c.CHECKOUT_FLAG)                                 AS checkout_uv,
        SUM(c.CHECKOUT_COMPLETE_FLAG)                        AS purchase_uv,
        ROUND(SAFE_DIVIDE(SUM(c.CHECKOUT_COMPLETE_FLAG), NULLIF(SUM(c.OFFER_DETAIL_FLAG),0))*100,1) AS cvr
      FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN bali_gids b ON c.ITEM_ID = b.gid
      JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY\` sp ON CAST(sp.property_id AS STRING) = c.ITEM_ID
      JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` r ON r.property_id = sp.property_id
      WHERE c.BASIS_DATE = '${TARGET}'
        AND (c.UTM_SOURCE IS NULL OR c.UTM_SOURCE = '')
        AND c.OFFER_DETAIL_FLAG = 1
      GROUP BY 1
      HAVING purchase_uv >= 1
      ORDER BY purchase_uv DESC, cvr DESC
      LIMIT 20
    `});
    results.direct_purchases_by_gid = rows;
  } catch (e) { results.direct_purchases_by_gid_error = String(e); }

  // 2) 같은 GID들의 6/3~6/8 CVR — 평소에도 잘 팔리던 상품인가?
  try {
    const [rows] = await bq.query({ query: `
      WITH bali_gids AS (
        SELECT DISTINCT CAST(property_id AS STRING) AS gid
        FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
        WHERE country_key_name = 'Indonesia'
          AND city_key_name IN (
            'Bali','Ubud','Canggu','Seminyak','Jimbaran',
            'Nusa Dua','Sanur','Kuta','Uluwatu','Legian','Denpasar'
          )
      ),
      target_gids AS (
        SELECT DISTINCT c.ITEM_ID AS gid
        FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
        JOIN bali_gids b ON c.ITEM_ID = b.gid
        WHERE c.BASIS_DATE = '${TARGET}'
          AND (c.UTM_SOURCE IS NULL OR c.UTM_SOURCE = '')
          AND c.CHECKOUT_COMPLETE_FLAG = 1
      )
      SELECT
        c.ITEM_ID                                                                     AS gid,
        MAX(sp.ko_name)                                                               AS hotel_nm,
        SUM(CASE WHEN c.BASIS_DATE = '${TARGET}' THEN c.OFFER_DETAIL_FLAG ELSE 0 END)           AS uv_0609,
        SUM(CASE WHEN c.BASIS_DATE = '${TARGET}' THEN c.CHECKOUT_COMPLETE_FLAG ELSE 0 END)      AS pur_0609,
        ROUND(SAFE_DIVIDE(
          SUM(CASE WHEN c.BASIS_DATE = '${TARGET}' THEN c.CHECKOUT_COMPLETE_FLAG ELSE 0 END),
          NULLIF(SUM(CASE WHEN c.BASIS_DATE = '${TARGET}' THEN c.OFFER_DETAIL_FLAG ELSE 0 END),0)
        )*100,1)                                                                      AS cvr_0609,
        ROUND(AVG(CASE WHEN c.BASIS_DATE < '${TARGET}' THEN c.OFFER_DETAIL_FLAG END),1)         AS uv_7d_avg,
        ROUND(AVG(CASE WHEN c.BASIS_DATE < '${TARGET}' THEN c.CHECKOUT_COMPLETE_FLAG END),1)    AS pur_7d_avg
      FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN target_gids t ON c.ITEM_ID = t.gid
      JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY\` sp ON CAST(sp.property_id AS STRING) = c.ITEM_ID
      WHERE c.BASIS_DATE BETWEEN DATE_SUB('${TARGET}', INTERVAL 7 DAY) AND '${TARGET}'
        AND (c.UTM_SOURCE IS NULL OR c.UTM_SOURCE = '')
      GROUP BY 1
      ORDER BY pur_0609 DESC
    `});
    results.purchased_gid_history = rows;
  } catch (e) { results.purchased_gid_history_error = String(e); }

  // 3) 6/5~6/11 날짜별 direct CVR 추이 — 6/9만 특이했나?
  try {
    const [rows] = await bq.query({ query: `
      WITH bali_gids AS (
        SELECT DISTINCT CAST(property_id AS STRING) AS gid
        FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
        WHERE country_key_name = 'Indonesia'
          AND city_key_name IN (
            'Bali','Ubud','Canggu','Seminyak','Jimbaran',
            'Nusa Dua','Sanur','Kuta','Uluwatu','Legian','Denpasar'
          )
      )
      SELECT
        c.BASIS_DATE,
        SUM(c.OFFER_DETAIL_FLAG)      AS detail_uv,
        SUM(c.CHECKOUT_FLAG)          AS checkout_uv,
        SUM(c.CHECKOUT_COMPLETE_FLAG) AS purchase_uv,
        ROUND(SAFE_DIVIDE(SUM(c.CHECKOUT_COMPLETE_FLAG), NULLIF(SUM(c.OFFER_DETAIL_FLAG),0))*100,1) AS cvr
      FROM \`mrtdata.edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` c
      JOIN bali_gids b ON c.ITEM_ID = b.gid
      WHERE c.BASIS_DATE BETWEEN '2026-06-03' AND '2026-06-11'
        AND (c.UTM_SOURCE IS NULL OR c.UTM_SOURCE = '')
        AND c.OFFER_DETAIL_FLAG = 1
      GROUP BY 1
      ORDER BY 1
    `});
    results.daily_direct_cvr_trend = rows;
  } catch (e) { results.daily_direct_cvr_trend_error = String(e); }

  // 4) 6/9 direct 구매자 ref_url — 어디서 왔나 (이벤트 로그)
  try {
    const [rows] = await bq.query({ query: `
      WITH bali_gids AS (
        SELECT DISTINCT CAST(property_id AS STRING) AS gid
        FROM \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\`
        WHERE country_key_name = 'Indonesia'
          AND city_key_name IN (
            'Bali','Ubud','Canggu','Seminyak','Jimbaran',
            'Nusa Dua','Sanur','Kuta','Uluwatu','Legian','Denpasar'
          )
      )
      SELECT
        COALESCE(NULLIF(e.ref_url,''), '(none)') AS ref_url,
        COUNT(DISTINCT e.pid)                     AS user_cnt,
        COUNTIF(e.event_name = 'view_item')       AS detail_view,
        COUNTIF(e.event_name = 'purchase')        AS purchase_cnt
      FROM \`mrtdata.edw.INT_BIZ_LOG_EVENT_D\` e
      JOIN bali_gids b ON CAST(e.item_id AS STRING) = b.gid
      WHERE e.BASIS_DATE = '${TARGET}'
        AND (e.utm_source IS NULL OR e.utm_source = '')
        AND e.event_name IN ('view_item','begin_checkout','purchase')
      GROUP BY 1
      HAVING detail_view >= 1
      ORDER BY purchase_cnt DESC, user_cnt DESC
      LIMIT 30
    `});
    results.ref_url_breakdown = rows;
  } catch (e) { results.ref_url_breakdown_error = String(e); }

  return NextResponse.json(results);
}
