/**
 * Redash를 BigQuery 프록시로 사용하는 실행기.
 *
 * Vercel 프로덕션에는 BQ 서비스 계정이 없어 직접 BigQuery에 붙을 수 없다.
 * 대신 Redash(data_source_id=17 = mrtdata BigQuery)가 이미 갖고 있는 BQ 커넥션을
 * ad-hoc query 실행 API로 그대로 재사용한다. GCP IAM/서비스 계정 발급이 필요 없다.
 *
 * REDASH_API_KEY가 설정되어 있으면 lib/bigquery.ts의 모든 fetch* 함수가
 * 코드 변경 없이 이 경로를 타도록 getBQClient()에서 스위칭한다.
 */

const REDASH_BASE_URL = process.env.REDASH_BASE_URL ?? 'https://redash.myrealtrip.net';
const REDASH_DATA_SOURCE_ID = Number(process.env.REDASH_DATA_SOURCE_ID ?? 17);

interface RedashJob {
  job: {
    id: string;
    status: number; // 1=pending, 2=started, 3=success, 4=failed
    error: string;
    query_result_id: number | null;
  };
}

interface RedashQueryResultResponse {
  query_result: {
    data: {
      columns: { name: string }[];
      rows: Record<string, unknown>[];
    };
  };
}

function getRedashApiKey(): string {
  const key = process.env.REDASH_API_KEY;
  if (!key) throw new Error('REDASH_API_KEY가 설정되지 않았습니다.');
  return key;
}

async function redashFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${REDASH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${getRedashApiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Redash API ${path} 실패: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

async function pollJob(
  jobId: string,
  { intervalMs = 1500, timeoutMs = 240_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { job } = await redashFetch<RedashJob>(`/api/jobs/${jobId}`);
    if (job.status === 3 && job.query_result_id != null) return job.query_result_id;
    if (job.status === 4) throw new Error(`Redash 쿼리 실행 실패: ${job.error}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Redash job ${jobId} 폴링 타임아웃 (${timeoutMs}ms)`);
}

/** 임의의 SQL을 Redash의 BigQuery 데이터소스에 ad-hoc으로 실행하고 rows를 반환한다. */
export async function runRedashQuery(sql: string): Promise<Record<string, unknown>[]> {
  const submitted = await redashFetch<RedashJob>('/api/query_results', {
    method: 'POST',
    body: JSON.stringify({ query: sql, data_source_id: REDASH_DATA_SOURCE_ID, max_age: 0 }),
  });
  const resultId = await pollJob(submitted.job.id);
  const { query_result } = await redashFetch<RedashQueryResultResponse>(
    `/api/query_results/${resultId}.json`,
  );
  return query_result.data.rows;
}

/** @google-cloud/bigquery의 `bq.query({query})` 호출부와 동일한 인터페이스로 맞춘 shim. */
export interface BQLike {
  query(opts: { query: string }): Promise<[Record<string, unknown>[]]>;
}

export function createRedashBQShim(): BQLike {
  return {
    async query({ query }) {
      const rows = await runRedashQuery(query);
      return [rows];
    },
  };
}
