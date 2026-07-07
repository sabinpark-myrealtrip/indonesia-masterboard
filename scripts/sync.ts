/**
 * Redash(→BigQuery) 조회 결과를 Supabase bq_cache 테이블에 채워 넣는다.
 *
 * 실행: node --env-file=.env.local -r tsx/cjs scripts/sync.ts   (로컬)
 *       또는 GitHub Actions cron에서 REDASH_API_KEY/SUPABASE_* 를 env로 주입해 실행.
 *
 * 이 스크립트는 REDASH_API_KEY를 설정한 채로 lib/bigquery.ts의 기존 fetch* 함수를
 * 그대로 호출한다 (getBQClient()가 자동으로 Redash 프록시로 전환됨 — lib/redash.ts).
 * 즉 SQL/집계 로직은 한 곳(lib/bigquery.ts)에만 존재하고, 여기서는 "언제/어떤 파라미터로
 * 실행해서 어떤 키로 캐싱할지"만 정의한다.
 */
import { setCached } from '../lib/supabase-cache';
import { daysAgoRange } from '../lib/date-range';
import { CITIES, TOPSELLING_CITIES, City } from '../lib/types';
import {
  fetchDashboardData,
  fetchMonthlyData,
  fetchWeeklyData,
  fetchYearlyData,
  fetchDailyData,
  fetchComparison,
  fetchTopSelling,
  fetchCityDistribution,
  fetchCityTopHotels,
  fetchNegativeCmDaily,
  fetchTrafficSources,
  fetchTrafficSourcesDaily,
  fetchFpnaDailyData,
  fetchFpnaMonthlyDataWithPartners,
  fetchFpnaYearlyData,
} from '../lib/bigquery';

if (!process.env.REDASH_API_KEY) {
  throw new Error('REDASH_API_KEY가 없습니다. sync는 Redash 프록시로만 실행합니다 (BQ 서비스 계정 불필요).');
}

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const currentYear = String(today.getFullYear());

// NegativeCmHotels/TrafficSources 컴포넌트의 기간 프리셋 버튼과 동일하게 맞춘다.
const NEGATIVE_CM_DAY_OPTIONS = [7, 14, 30];
const TRAFFIC_SOURCES_DAY_OPTIONS = [7, 14, 30];

interface Job {
  key: string;
  run: () => Promise<unknown>;
}

const jobs: Job[] = [
  { key: 'fpna_daily', run: () => fetchFpnaDailyData() },
  { key: `fpna_monthly:${currentMonth}`, run: () => fetchFpnaMonthlyDataWithPartners(currentMonth) },
  { key: `fpna_yearly:${currentYear}`, run: () => fetchFpnaYearlyData(currentYear) },

  { key: `monthly:${currentMonth}`, run: () => fetchMonthlyData(currentMonth) },
  { key: `weekly:${currentMonth}`, run: () => fetchWeeklyData(currentMonth) },
  { key: `yearly:${currentYear}`, run: () => fetchYearlyData(currentYear) },
  { key: 'daily', run: () => fetchDailyData() },
  { key: `comparison:${currentMonth}`, run: () => fetchComparison(currentMonth) },
  { key: `city_distribution:${currentMonth}`, run: () => fetchCityDistribution(currentMonth) },
  { key: `city_top_hotels:${currentMonth}`, run: () => fetchCityTopHotels(currentMonth) },

  ...CITIES.map((city: City): Job => ({
    key: `dashboard:${currentMonth}:${city}`,
    run: () => fetchDashboardData(currentMonth, city),
  })),
  ...CITIES.flatMap((city: City) => NEGATIVE_CM_DAY_OPTIONS.map((days): Job => {
    const [start, end] = daysAgoRange(days);
    return {
      key: `negative_cm:${start}:${end}:${city}`,
      run: () => fetchNegativeCmDaily(start, end, city),
    };
  })),
  ...CITIES.flatMap((city: City) => TRAFFIC_SOURCES_DAY_OPTIONS.map((days): Job => {
    const [start, end] = daysAgoRange(days);
    return {
      key: `traffic_sources:${start}:${end}:${city}`,
      run: async () => {
        const [rows, dailyRows] = await Promise.all([
          fetchTrafficSources(start, end, city),
          fetchTrafficSourcesDaily(start, end, city),
        ]);
        return { rows, dailyRows, startDate: start, endDate: end };
      },
    };
  })),
  ...TOPSELLING_CITIES.map((city): Job => ({
    key: `topselling:${city}`,
    run: () => fetchTopSelling(city),
  })),
];

async function main() {
  // 특정 job만 다시 돌리고 싶으면: npm run sync:local -- negative_cm
  const filter = process.argv[2];
  const targetJobs = filter ? jobs.filter((j) => j.key.includes(filter)) : jobs;
  if (filter && targetJobs.length === 0) {
    throw new Error(`"${filter}"에 매칭되는 job이 없습니다.`);
  }

  console.log(`sync 시작 — ${targetJobs.length}개 작업, ${new Date().toISOString()}`);
  let ok = 0;
  const failed: { key: string; error: string }[] = [];

  for (const job of targetJobs) {
    try {
      const data = await job.run();
      await setCached(job.key, data);
      ok++;
      console.log(`  ✓ ${job.key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ key: job.key, error: message });
      console.error(`  ✗ ${job.key}: ${message}`);
    }
  }

  console.log(`sync 종료 — 성공 ${ok}/${targetJobs.length}`);
  if (failed.length > 0) {
    console.error('실패 목록:', JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
}

main();
