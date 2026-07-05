import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({
  projectId: 'mrtdata',
  location: 'asia-northeast1',
});

const BALI_CITIES = [
  'Bali','Canggu','Denpasar','Jimbaran','Kuta',
  'Lembongan Island','Nusa Dua','Penida Island','Sanur','Seminyak','Ubud'
];

const query = `
WITH gid_list AS (
  SELECT DISTINCT
    CAST(sp.property_id AS STRING) AS GID
  FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
  JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
    ON sp.property_id = r.property_id
  WHERE r.country_key_name = 'Indonesia'
    AND r.city_key_name IN (${BALI_CITIES.map(c => `'${c}'`).join(', ')})
),
monthly AS (
  SELECT
    FORMAT_DATE('%Y-%m', p.BASIS_DATE)                                          AS month,
    COUNT(DISTINCT p.ORDER_ID)                                                  AS rsv,
    COUNT(DISTINCT CASE WHEN p.RECENT_STATUS IN ('confirm','finish')
                        THEN p.ORDER_ID END)                                    AS crsv,
    SUM(p.SALES_KRW_PRICE)                                                      AS gmv,
    SUM(CASE WHEN p.RECENT_STATUS IN ('confirm','finish')
             THEN p.SALES_KRW_PRICE ELSE 0 END)                                 AS cgmv
  FROM \`edw_fpna.MART_FPNA_LODGMENT_PROFIT_D\` AS p
  JOIN gid_list AS g ON CAST(p.GID AS STRING) = g.GID
  WHERE p.BASIS_DATE BETWEEN '2025-01-01' AND '2025-12-31'
  GROUP BY 1
)
SELECT
  month,
  rsv,
  crsv,
  ROUND(SAFE_DIVIDE(crsv, rsv) * 100, 1) AS cfr,
  ROUND(gmv  / 1e8, 2)                   AS gmv_100m,
  ROUND(cgmv / 1e8, 2)                   AS cgmv_100m
FROM monthly
ORDER BY month
`;

const [rows] = await bq.query({ query });

console.log('\n발리 2025년 월별 예약 시즌성 (RSV 기준)\n');
console.log('월        RSV    CRSV   CFR     GMV(억)  CGMV(억)');
console.log('─'.repeat(55));
let totalRsv = 0, totalCrsv = 0, totalGmv = 0, totalCgmv = 0;
for (const r of rows) {
  totalRsv  += Number(r.rsv);
  totalCrsv += Number(r.crsv);
  totalGmv  += Number(r.gmv_100m);
  totalCgmv += Number(r.cgmv_100m);
  const bar = '█'.repeat(Math.round(Number(r.rsv) / 50));
  console.log(
    `${r.month}  ${String(r.rsv).padStart(6)}  ${String(r.crsv).padStart(5)}  ${String(r.cfr).padStart(5)}%  ${String(r.gmv_100m).padStart(7)}  ${String(r.cgmv_100m).padStart(7)}  ${bar}`
  );
}
console.log('─'.repeat(55));
console.log(`합계      ${String(totalRsv).padStart(6)}  ${String(totalCrsv).padStart(5)}  ${(totalCrsv/totalRsv*100).toFixed(1).padStart(5)}%  ${totalGmv.toFixed(2).padStart(7)}  ${totalCgmv.toFixed(2).padStart(7)}`);
