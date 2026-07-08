import { BigQuery } from '@google-cloud/bigquery';
import { createRedashBQShim, type BQLike } from './redash';

let bqClient: BQLike | null = null;

/**
 * REDASH_API_KEY가 있으면 Redash(data_source_id=17=mrtdata BigQuery)를 프록시로
 * 사용한다 — GCP 서비스 계정 없이도 동작 (Vercel 프로덕션).
 * 없으면 로컬 gcloud ADC 또는 BIGQUERY_CREDENTIALS_JSON으로 BQ에 직접 붙는다.
 */
function getBQClient(): BQLike {
  if (!bqClient) {
    if (process.env.REDASH_API_KEY) {
      bqClient = createRedashBQShim();
    } else {
      const projectId = process.env.BQ_PROJECT_ID ?? 'mrtdata';
      const credentialsJson = process.env.BIGQUERY_CREDENTIALS_JSON;
      bqClient = (
        credentialsJson
          ? new BigQuery({ credentials: JSON.parse(credentialsJson), projectId })
          : new BigQuery({ projectId })
      ) as unknown as BQLike;
    }
  }
  return bqClient;
}

export interface BaliOptionRow {
  partnerId: string;
  partnerName: string;
  propertyId: number;
  propertyName: string;
  propertyStatus: string;
  propertyType: string;
  roomId: number | null;
  roomName: string | null;
  roomStatus: string | null;
  optionId: number | null;
  optionName: string | null;
  optionEnabled: boolean | null;
  applyPeriodType: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  inclusions: string[];
  descriptions: { title: string; text: string }[];
  minNights: number | null;
  partnerGmv: number;
}

function parseDescriptions(raw: string | null): { title: string; text: string }[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((d: unknown) => d && typeof d === 'object').map((d: Record<string, string>) => ({ title: d.title ?? '', text: d.description ?? '' }))
      : [];
  } catch {
    return [];
  }
}

function parseInclusions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s: unknown) => s && s !== 'NONE') : [];
  } catch {
    return [];
  }
}

export async function fetchBaliCatalog(): Promise<BaliOptionRow[]> {
  const bq = getBQClient();

  const query = `
    WITH bali_props AS (
      SELECT DISTINCT p.property_id
      FROM \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` p
      JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` reg
        ON p.gid = reg.property_id
      WHERE reg.country_name = '인도네시아'
        AND p.deleted_at IS NULL
        AND p.property_status != 'PREPARING'
        AND NOT REGEXP_CONTAINS(LOWER(p.property_name), r'\\[b2b|\\[테스트\\]|\\[마이팩\\]|\\[나연팩\\]|리셀마켓')
    ),
    partner_gmv AS (
      SELECT
        prop.partner_id,
        COALESCE(SUM(res.user_sale_price), 0) AS total_gmv
      FROM \`mrtdata.edw.DW_MRT_STAYNET_RESERVATION\` res
      JOIN \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` prop
        ON prop.property_id = res.property_id AND prop.deleted_at IS NULL
      JOIN bali_props bp2 ON prop.property_id = bp2.property_id
      WHERE res.reservation_status = 'RESERVE_CONFIRM'
        AND res.deleted_at IS NULL
      GROUP BY prop.partner_id
    )
    SELECT
      CAST(p.partner_id AS STRING)                                            AS partner_id,
      COALESCE(n.nickname, CAST(p.partner_id AS STRING))                      AS partner_name,
      p.property_id,
      p.property_name,
      p.property_status,
      p.property_type,
      r.room_id,
      r.room_name,
      r.room_status,
      o.option_id,
      o.option_name,
      o.enabled                                                               AS option_enabled,
      o.apply_period_type,
      CAST(o.apply_start_date AS STRING)                                      AS apply_start_date,
      CAST(o.apply_end_date AS STRING)                                        AS apply_end_date,
      o.represent_inclusions,
      o.descriptions,
      o.min_nights,
      COALESCE(pg.total_gmv, 0)                                               AS partner_gmv
    FROM \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` p
    JOIN bali_props bp ON p.property_id = bp.property_id
    JOIN \`mrtdata.edw.DW_MRT_PARTNERS_PARTNER\` n
      ON n.id = p.partner_id
      AND n.nickname IS NOT NULL
      AND NOT LOWER(n.nickname) LIKE '%리셀마켓%'
      AND NOT UPPER(n.nickname) LIKE '%DX%'
    LEFT JOIN partner_gmv pg ON pg.partner_id = p.partner_id
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_ROOM\` r
      ON r.property_id = p.property_id AND r.deleted_at IS NULL
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_RATE\` rt
      ON rt.property_id = p.property_id
      AND rt.room_id = r.room_id
      AND rt.active = true
      AND rt.deleted_at IS NULL
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_STAY_OPTION\` o
      ON o.option_id = rt.option_id
      AND o.deleted_at IS NULL
    ORDER BY COALESCE(pg.total_gmv, 0) DESC, partner_name, p.property_name, r.room_id, o.priority
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    partnerId: String(r.partner_id ?? ''),
    partnerName: String(r.partner_name ?? ''),
    propertyId: Number(r.property_id ?? 0),
    propertyName: String(r.property_name ?? ''),
    propertyStatus: String(r.property_status ?? ''),
    propertyType: String(r.property_type ?? ''),
    roomId: r.room_id != null ? Number(r.room_id) : null,
    roomName: r.room_name != null ? String(r.room_name) : null,
    roomStatus: r.room_status != null ? String(r.room_status) : null,
    optionId: r.option_id != null ? Number(r.option_id) : null,
    optionName: r.option_name != null ? String(r.option_name) : null,
    optionEnabled: r.option_enabled != null ? Boolean(r.option_enabled) : null,
    applyPeriodType: r.apply_period_type != null ? String(r.apply_period_type) : null,
    applyStartDate: r.apply_start_date != null ? String(r.apply_start_date) : null,
    applyEndDate: r.apply_end_date != null ? String(r.apply_end_date) : null,
    inclusions: parseInclusions(r.represent_inclusions as string | null),
    descriptions: parseDescriptions(r.descriptions as string | null),
    minNights: r.min_nights != null ? Number(r.min_nights) : null,
    partnerGmv: Number(r.partner_gmv ?? 0),
  }));
}

export interface HKPropertyRow {
  partnerId: string;
  partnerName: string;
  gid: number;
  gpid: string;
  propertyName: string;
  propertyStatus: string;
  propertyType: string;
  roomCnt: number;
  optionCnt: number;
  hasEarlyCheckin: boolean;
}

export async function fetchHKCatalog(): Promise<HKPropertyRow[]> {
  const bq = getBQClient();

  const query = `
    SELECT
      CAST(p.partner_id AS STRING)                               AS partner_id,
      COALESCE(n.nickname, CAST(p.partner_id AS STRING))         AS partner_name,
      p.gid                                                      AS gid,
      CONCAT('ACM', CAST(p.gid AS STRING))                       AS gpid,
      p.property_name,
      p.property_status,
      p.property_type,
      COUNT(DISTINCT r.room_id)                                  AS room_cnt,
      COUNT(DISTINCT o.option_id)                                AS option_cnt,
      MAX(CASE
        WHEN LOWER(o.represent_inclusions) LIKE '%early check%'
          OR LOWER(o.represent_inclusions) LIKE '%얼리%'
          OR LOWER(o.descriptions)         LIKE '%early check%'
          OR LOWER(o.descriptions)         LIKE '%얼리%'
        THEN 1 ELSE 0
      END)                                                       AS has_early_checkin
    FROM \`mrtdata.edw.DW_MRT_STAYNET_PROPERTY\` p
    JOIN \`mrtdata.edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` reg
      ON p.gid = reg.property_id
    JOIN \`mrtdata.edw.DW_MRT_PARTNERS_PARTNER\` n
      ON n.id = p.partner_id
      AND NOT UPPER(n.nickname) LIKE '%DX%'
      AND NOT LOWER(n.nickname) LIKE '%리셀마켓%'
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_ROOM\` r
      ON r.property_id = p.property_id AND r.deleted_at IS NULL
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_RATE\` rt
      ON rt.property_id = p.property_id AND rt.room_id = r.room_id
      AND rt.active = true AND rt.deleted_at IS NULL
    LEFT JOIN \`mrtdata.edw.DW_MRT_STAYNET_STAY_OPTION\` o
      ON o.option_id = rt.option_id AND o.deleted_at IS NULL
    WHERE reg.country_name = '홍콩'
      AND p.deleted_at IS NULL
      AND p.property_status != 'PREPARING'
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    ORDER BY partner_name, p.property_name
  `;

  const [rows] = await bq.query({ query });
  return rows.map((r: Record<string, unknown>) => ({
    partnerId:      String(r.partner_id      ?? ''),
    partnerName:    String(r.partner_name    ?? ''),
    gid:            Number(r.gid             ?? 0),
    gpid:           String(r.gpid            ?? ''),
    propertyName:   String(r.property_name   ?? ''),
    propertyStatus: String(r.property_status ?? ''),
    propertyType:   String(r.property_type   ?? ''),
    roomCnt:        Number(r.room_cnt        ?? 0),
    optionCnt:      Number(r.option_cnt      ?? 0),
    hasEarlyCheckin: Number(r.has_early_checkin ?? 0) === 1,
  }));
}
