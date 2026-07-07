-- indonesia-masterboard BQ 데이터 캐시 테이블
--
-- sync 스크립트(scripts/sync.ts, GitHub Actions cron)가 Redash를 통해 BigQuery를
-- 조회한 결과를 여기 upsert 하고, 배포된 앱은 이 테이블만 읽는다.
-- Vercel 프로덕션에는 BQ/Redash 자격증명이 없어도 되고, 응답도 즉시 나온다.
--
-- service_role 키는 RLS를 우회하므로 sync 스크립트/앱 서버 라우트 모두 이 키로
-- 접근한다 (MRP 어드민과 동일한 패턴 - 브라우저에는 절대 노출되지 않고
-- Next.js Route Handler 안에서만 사용됨).
CREATE TABLE IF NOT EXISTS bq_cache (
  cache_key TEXT PRIMARY KEY,   -- e.g. 'fpna_daily', 'fpna_monthly:2026-07', 'dashboard:2026-07:발리'
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bq_cache ENABLE ROW LEVEL SECURITY;
-- 의도적으로 SELECT/INSERT 정책 없음: service_role만 접근 (RLS 우회), anon/authenticated는 전면 차단.
