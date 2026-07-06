# 인도네시아 데이터 탭 통합 + UV·CVR 재구조화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "인도네시아 데이터" 탭의 예약기준/성과기준 토글을 없애고 성과기준(확정일 기준) 단일 뷰로 통합하면서, 발리 예약 시즌성 차트는 이관 + 6월 데이터 갱신하고, 성과기준 표에는 UV·CVR 지표를 추가한다.

**Architecture:** `Dashboard.tsx`의 뷰 토글 state와 예약기준 전용 컴포넌트를 제거하고 단일 렌더 경로로 합친다. FPNA 쿼리(`buildFpnaPartnerQuery`)에 `MART_BIZ_LOG_PID_CONVERSION_D` 조인을 추가해 기간+연동사 단위 UV를 산출하되, 파트너 합산 시 중복 카운트를 피하기 위해 "연동사별 UV"와 "전체 UV(파트너 무관 distinct)"를 별도 CTE로 분리해 조인하는 기존 코드베이스 컨벤션(`fetchPeriodData`의 `uv_by_partner`/`uv_all` 분리 패턴)을 그대로 따른다.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, BigQuery(`@google-cloud/bigquery`), Recharts. 테스트 프레임워크 없음 — 검증은 `npm run build`(타입체크) + 로컬 dev 서버 + BQ 스크립트 직접 실행으로 한다.

## Global Constraints
- 모든 BQ 쿼리는 `FPNA_DOMAIN_NM = 'LODGMENT'`, 인도네시아(`country_key_name = 'Indonesia'`) 필터 유지, B2B/마이팩/나연팩 상품 제외 (기존 `buildFpnaPartnerQuery`의 `gid_list` 조건 그대로 재사용)
- GMV/CM/주문건수는 확정일(`CONFIRM_KST_DATE`)/환불일(`REFUND_DATE`) 기준 (CLAUDE.md 지표 기준과 동일, 이번 작업에서 변경하지 않음)
- UV(`DETAIL_UV`, `PURCHASE_COMPLETE_UV`)는 `MART_BIZ_LOG_PID_CONVERSION_D.BASIS_DATE`(로그 발생일) 기준으로 같은 기간 포맷에 truncate — GMV와 날짜 개념이 다르지만 동일 캘린더 기간에 병렬 표시하는 기존 Redash #30757/`fetchPeriodData` 컨벤션을 따름
- 발리 예약 시즌성(`BaliSeasonality`)은 예약일(`BASIS_DATE`, RSV 발생 기준) 데이터 소스(`MART_FPNA_LODGMENT_PROFIT_D`)를 그대로 유지 — 다른 컴포넌트로 이관될 뿐 계산 기준은 안 바꿈

---

## Task 1: 탭 통합 — 예약기준 뷰 제거, 성과기준 단일 뷰로 병합

**Files:**
- Modify: `components/Dashboard.tsx`

**Interfaces:**
- Consumes: 기존 `BaliSeasonality`, `FpnaDailyTable`, `FpnaMonthlyTable`, `FpnaYearlyTable` (props 변경 없음)
- Produces: 없음 (UI 전용 변경, 이후 태스크와 독립적)

- [ ] **Step 1: import 정리**

`components/Dashboard.tsx` 상단 import 블록에서 다음 4줄을 삭제한다 (더 이상 쓰이지 않게 될 예정):

```ts
import MonthlyTable from './MonthlyTable';
import WeeklyTable from './WeeklyTable';
import YearlyTable from './YearlyTable';
```
와
```ts
import DailyTable from './DailyTable';
```

(파일 상단 import 목록에서 `MonthlyTable`, `WeeklyTable`, `YearlyTable`, `DailyTable` import 줄만 제거하고 `FpnaDailyTable`/`FpnaMonthlyTable`/`FpnaYearlyTable`/`BaliSeasonality` import는 유지)

- [ ] **Step 2: `DataViewMode` 타입과 토글 state 제거**

다음 줄을 찾아서:
```ts
type NavPage = City | 'indonesia-data' | 'topselling' | 'negative-cm' | 'traffic-sources' | 'city-distribution' | 'partner-management' | 'bali-catalog';
type DataViewMode = 'booking' | 'performance';
```
`type DataViewMode = 'booking' | 'performance';` 줄을 삭제한다.

다음 줄을 찾아서:
```ts
  const [page, setPage] = useState<NavPage>('전체');
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>('booking');
```
`const [dataViewMode, setDataViewMode] = useState<DataViewMode>('booking');` 줄을 삭제한다.

- [ ] **Step 3: "인도네시아 데이터" 탭 렌더링 블록을 단일 뷰로 교체**

아래 블록(토글 버튼 + `dataViewMode === 'booking'`/`'performance'` 분기)을 찾는다:

```tsx
          {/* ── 인도네시아 데이터 탭 ── */}
          {page === 'indonesia-data' && (
            <div className="space-y-5">
              {/* 뷰 토글 */}
              <div className="flex items-center gap-1 p-1 bg-slate-200 rounded-xl w-fit">
                <button
                  onClick={() => setDataViewMode('booking')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    dataViewMode === 'booking'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📅 예약 기준
                </button>
                <button
                  onClick={() => setDataViewMode('performance')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    dataViewMode === 'performance'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📊 성과 기준 (전사 KPI)
                </button>
              </div>

              {/* 예약 기준 뷰 */}
              {dataViewMode === 'booking' && (
                <>
                  <BaliSeasonality />
                  <DailyTable />
                  <WeeklyTable month={month} />
                  <MonthlyTable month={month} />
                  <YearlyTable month={month} />
                </>
              )}

              {/* 성과 기준 뷰 */}
              {dataViewMode === 'performance' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="text-sm font-bold text-indigo-900">성과 기준 (전사 KPI) vs 예약 기준의 차이</p>
                        <div className="text-xs text-indigo-700 mt-2 space-y-1">
                          <p><span className="font-semibold">예약 기준</span> — 해당 월에 예약이 들어온 건 기준. 이후에 취소돼도 GMV에 포함. CGMV는 현재 시점 확정 상태 기준.</p>
                          <p><span className="font-semibold">성과 기준 (현재 뷰)</span> — 해당 월에 확정된 GMV + 해당 월에 처리된 취소 GMV를 차감. 전사 CM/CMR 산정 기준과 동일.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <FpnaDailyTable />
                  <FpnaMonthlyTable month={month} />
                  <FpnaYearlyTable month={month} />
                </div>
              )}
            </div>
          )}
```

이걸로 교체한다:

```tsx
          {/* ── 인도네시아 데이터 탭 ── */}
          {page === 'indonesia-data' && (
            <div className="space-y-5">
              <BaliSeasonality />
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <p className="text-sm font-bold text-indigo-900">확정일 기준 집계</p>
                    <p className="text-xs text-indigo-700 mt-2">
                      해당 기간에 확정된 GMV + 해당 기간에 처리된 취소 GMV를 차감한 순 CGMV/CM 기준. 전사 CM/CMR 산정 기준과 동일.
                    </p>
                  </div>
                </div>
              </div>
              <FpnaDailyTable />
              <FpnaMonthlyTable month={month} />
              <FpnaYearlyTable month={month} />
            </div>
          )}
```

- [ ] **Step 4: 타입체크로 미사용 import 확인**

Run: `cd /Users/sabin-park/indonesia-masterboard && npx tsc --noEmit`
Expected: `DailyTable`/`WeeklyTable`/`MonthlyTable`/`YearlyTable`/`dataViewMode`/`DataViewMode` 관련 에러 없음 (아직 파일 자체는 삭제 전이라 컴포넌트 파일들은 존재 — import를 지웠으니 "declared but never used" 에러가 뜨면 안 됨. 만약 뜬다면 Step1~3에서 지운 줄이 정확히 지워졌는지 재확인)

- [ ] **Step 5: 커밋**

```bash
git add components/Dashboard.tsx
git commit -m "Merge booking-basis view into performance-basis view for 인도네시아 데이터 tab"
```

---

## Task 2: 예약기준 전용 코드 삭제

Task 1에서 더 이상 렌더링되지 않게 된 컴포넌트/API/lib 함수를 삭제한다. 아래 항목들은 모두 `components/Dashboard.tsx`의 구 예약기준 분기 밖에서 import/호출되는 곳이 없음을 사전에 grep으로 확인했다.

**Files:**
- Delete: `components/DailyTable.tsx`, `components/WeeklyTable.tsx`, `components/MonthlyTable.tsx`, `components/YearlyTable.tsx`, `components/PeriodTable.tsx`
- Delete: `app/api/daily/route.ts`, `app/api/weekly/route.ts`, `app/api/monthly/route.ts`, `app/api/yearly/route.ts`
- Delete: `lib/dummyDaily.ts`, `lib/dummyWeekly.ts`, `lib/dummyMonthly.ts`, `lib/dummyYearly.ts`
- Modify: `lib/bigquery.ts` (함수 4개 + 헬퍼 1개 삭제)
- Modify: `lib/types.ts` (`MonthlyData` 인터페이스 삭제)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (순수 삭제)

- [ ] **Step 1: 컴포넌트/API/더미 파일 삭제**

```bash
cd /Users/sabin-park/indonesia-masterboard
git rm components/DailyTable.tsx components/WeeklyTable.tsx components/MonthlyTable.tsx components/YearlyTable.tsx components/PeriodTable.tsx
git rm app/api/daily/route.ts app/api/weekly/route.ts app/api/monthly/route.ts app/api/yearly/route.ts
rmdir app/api/daily app/api/weekly app/api/monthly app/api/yearly 2>/dev/null || true
git rm lib/dummyDaily.ts lib/dummyWeekly.ts lib/dummyMonthly.ts lib/dummyYearly.ts
```

- [ ] **Step 2: `lib/bigquery.ts`에서 예약기준 전용 함수 4개 삭제**

`lib/bigquery.ts`를 Read 도구로 열어 다음 4개 함수와 그 앞의 구분 주석 블록을 찾아 전체(함수 시그니처부터 닫는 `}`까지, 앞의 `// ---...` 주석 헤더 포함)를 삭제한다:

1. `export async function fetchMonthlyData(currentMonth: string): Promise<MonthlyData>` — 앞 주석 `// Monthly — 월별 도시×연동사 누적 성과`부터 시작해서, 다음 구분 주석(`// Negative CM Daily — 일별 역마진 호텔 목록`) 직전까지 삭제
2. `async function fetchPeriodData(...)` — 앞 주석 `// Shared helper — period aggregation (monthly/weekly/yearly 공통 로직)`부터, 다음 구분 주석(`// Weekly — 최근 8주 주별 누적`) 직전까지 삭제
3. `export async function fetchWeeklyData(currentMonth: string): Promise<MonthlyData>` — 앞 주석 `// Weekly — 최근 8주 주별 누적`부터, 다음 구분 주석(`// Daily — 최근 30일`, 만약 있다면 그 직전) 또는 `fetchDailyData` 함수 시작 직전까지 삭제. `fetchDailyData` 앞에 구분 주석이 있으면 그 주석은 남기고 함수 본문 전만 삭제
4. `export async function fetchDailyData(): Promise<MonthlyData>` — 함수 시그니처부터 닫는 `}`까지 삭제
5. `export async function fetchYearlyData(currentYear: string): Promise<MonthlyData>` — 앞 구분 주석부터(있다면), 다음 구분 주석(`// Top Selling — ...`) 직전까지 삭제

정확한 경계를 모르겠으면 다음 커맨드로 각 함수의 시작/끝 라인을 먼저 확인한 뒤 Edit 도구로 해당 구간을 지운다:

```bash
grep -n "^export async function fetchMonthlyData\|^async function fetchPeriodData\|^export async function fetchWeeklyData\|^export async function fetchDailyData\|^export async function fetchYearlyData\|^export async function fetchTopSelling\|^export async function fetchNegativeCmDaily" lib/bigquery.ts
```

이 5개 함수를 삭제한 뒤 `MonthlyData`, `CityMonthRow`, `PartnerMonthRow`, `MonthlyMetrics` 타입 중 다른 곳에서 쓰이는지 아래로 확인:

```bash
grep -n "MonthlyData\b" lib/bigquery.ts lib/types.ts app/api/*/route.ts components/*.tsx
```

`fetchComparison`(`lib/bigquery.ts:549`)가 `MonthlyMetrics`, `CityMonthRow`가 아니라 자체 타입(`ComparisonData`, `CityPeriodRow`, `PeriodMetrics`)을 쓰는지 확인하고, `MonthlyData`를 참조하는 곳이 삭제 대상 4개 함수 시그니처 외에 없으면 안전하게 진행.

- [ ] **Step 3: `lib/types.ts`에서 `MonthlyData` 인터페이스 삭제**

```ts
export interface MonthlyData {
  months: string[];
  rows: CityMonthRow[];
}
```

이 블록만 삭제한다. `CityMonthRow`, `PartnerMonthRow`, `MonthlyMetrics`는 Step 2에서 확인한 결과에 따라 — 다른 곳에서 안 쓰이면 같이 삭제, 쓰이는 곳이 있으면 유지한다.

- [ ] **Step 4: 빌드로 검증**

Run: `cd /Users/sabin-park/indonesia-masterboard && npm run build`
Expected: 타입 에러 없이 빌드 성공. `Module not found` 또는 `Cannot find name` 에러가 나면 삭제 범위가 덜 되었거나 과했다는 뜻 — 에러 메시지의 파일/라인을 보고 누락된 참조를 마저 정리한다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "Remove unused booking-basis daily/weekly/monthly/yearly code"
```

---

## Task 3: 발리 시즌성 스크립트 확장 + 2026년 1~6월 데이터 반영

2026년 1~6월 실측치를 이미 조회했다 (BQ `mrtdata`, `edw_fpna.MART_FPNA_LODGMENT_PROFIT_D`, 발리 도시 목록 필터):

```
2026-01  rsv=435  crsv=283  cfr=65.1
2026-02  rsv=366  crsv=214  cfr=58.5
2026-03  rsv=600  crsv=355  cfr=59.2
2026-04  rsv=358  crsv=213  cfr=59.5
2026-05  rsv=234  crsv=153  cfr=65.4
2026-06  rsv=340  crsv=201  cfr=59.1
```

기존 하드코딩된 1~5월 값과 CRSV/CFR이 약간 다르다 (취소/재확정 반영으로 시간에 따라 변동). 이번에 6월 추가와 함께 2026년 1~6월 전체를 위 최신값으로 갱신한다 (2025년 값은 마감된 과거 데이터라 변경하지 않음).

**Files:**
- Modify: `scripts/bali-seasonality.mjs`
- Modify: `components/BaliSeasonality.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (표시용 컴포넌트, Task 1/4와 독립)

- [ ] **Step 1: `scripts/bali-seasonality.mjs`에 2026년 조회 쿼리 추가**

현재 스크립트는 2025년치만 조회한다 (`WHERE p.BASIS_DATE BETWEEN '2025-01-01' AND '2025-12-31'`). 앞으로도 재실행해서 최신값을 뽑을 수 있도록, 2026년(1월~현재까지)도 같이 조회하는 두 번째 쿼리를 추가한다.

`scripts/bali-seasonality.mjs` 전체를 다음으로 교체한다:

```js
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({
  projectId: 'mrtdata',
  location: 'asia-northeast1',
});

const BALI_CITIES = [
  'Bali','Canggu','Denpasar','Jimbaran','Kuta',
  'Lembongan Island','Nusa Dua','Penida Island','Sanur','Seminyak','Ubud'
];

function buildQuery(startDate, endDate) {
  return `
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
  WHERE p.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
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
}

async function printYear(label, startDate, endDate) {
  const [rows] = await bq.query({ query: buildQuery(startDate, endDate) });

  console.log(`\n발리 ${label} 월별 예약 시즌성 (RSV 기준)\n`);
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
}

await printYear('2025년', '2025-01-01', '2025-12-31');

const today = new Date();
const currentMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
await printYear('2026년', '2026-01-01', currentMonthEnd);
```

- [ ] **Step 2: 스크립트 실행해서 출력 확인**

Run: `cd /Users/sabin-park/indonesia-masterboard && node scripts/bali-seasonality.mjs`
Expected: 2025년 표에 이어 2026년 표가 출력되고, 2026년 6월 행에 `rsv=340, crsv=201, cfr=59.1` 근처 값이 나온다 (오늘 이후 취소 반영으로 소폭 달라질 수 있음 — 실행 시점 값을 신뢰하고 Step 3에 반영).

- [ ] **Step 3: `components/BaliSeasonality.tsx`의 `DATA` 배열 갱신**

파일 상단의 `DATA` 배열에서 1~6월 항목을 다음으로 교체한다 (Step 2 실행 결과값 기준. 아래는 이번에 조회한 값):

```ts
const DATA = [
  { month: '1월',  rsv25: 283,  crsv25: 176, cfr25: 62.2, rsv26: 435,  crsv26: 283, cfr26: 65.1 },
  { month: '2월',  rsv25: 394,  crsv25: 251, cfr25: 63.7, rsv26: 366,  crsv26: 214, cfr26: 58.5 },
  { month: '3월',  rsv25: 400,  crsv25: 268, cfr25: 67.0, rsv26: 600,  crsv26: 355, cfr26: 59.2 },
  { month: '4월',  rsv25: 359,  crsv25: 248, cfr25: 69.1, rsv26: 358,  crsv26: 213, cfr26: 59.5 },
  { month: '5월',  rsv25: 518,  crsv25: 350, cfr25: 67.6, rsv26: 234,  crsv26: 153, cfr26: 65.4 },
  { month: '6월',  rsv25: 655,  crsv25: 412, cfr25: 62.9, rsv26: 340,  crsv26: 201, cfr26: 59.1 },
  { month: '7월',  rsv25: 538,  crsv25: 381, cfr25: 70.8 },
  { month: '8월',  rsv25: 680,  crsv25: 369, cfr25: 54.3 },
  { month: '9월',  rsv25: 392,  crsv25: 264, cfr25: 67.3 },
  { month: '10월', rsv25: 408,  crsv25: 269, cfr25: 65.9 },
  { month: '11월', rsv25: 316,  crsv25: 215, cfr25: 68.0 },
  { month: '12월', rsv25: 418,  crsv25: 266, cfr25: 63.6 },
];
```

- [ ] **Step 4: YoY 비교 슬라이스를 6개월 기준으로 일반화**

다음 줄을 찾는다:

```ts
// 1~5월 기준 YoY 비교
const yoyRsv  = ((totalRsv26 - data25.slice(0,5).reduce((s,d) => s+d.rsv25, 0)) / data25.slice(0,5).reduce((s,d) => s+d.rsv25, 0) * 100).toFixed(1);
const yoyCrsv = ((totalCrsv26 - data25.slice(0,5).reduce((s,d) => s+d.crsv25, 0)) / data25.slice(0,5).reduce((s,d) => s+d.crsv25, 0) * 100).toFixed(1);
```

다음으로 교체한다 (하드코딩된 `5`를 `data26.length`로 일반화해서 앞으로 달이 추가돼도 코드 수정 없이 맞게 계산되도록):

```ts
// N개월(data26 보유 개월수) 기준 YoY 비교
const yoyBaseRsv  = data25.slice(0, data26.length).reduce((s,d) => s+d.rsv25, 0);
const yoyBaseCrsv = data25.slice(0, data26.length).reduce((s,d) => s+d.crsv25, 0);
const yoyRsv  = ((totalRsv26  - yoyBaseRsv)  / yoyBaseRsv  * 100).toFixed(1);
const yoyCrsv = ((totalCrsv26 - yoyBaseCrsv) / yoyBaseCrsv * 100).toFixed(1);
```

- [ ] **Step 5: 헤더/뱃지/카드 라벨을 "1~6월"로 갱신**

다음 텍스트들을 찾아 교체한다:

- `<p className="text-xs text-slate-400 mt-0.5">RSV 기준 · 발리 지역 전체 통합 · 26년은 1~5월 누적</p>` → `26년은 1~6월 누적`
- `<span className="text-[10px] bg-orange-50 border border-orange-100 text-orange-500 rounded px-2 py-1 font-semibold">2026 Jan~May</span>` → `2026 Jan~Jun`
- 요약 카드 배열의 `label: 'RSV YoY (1~5월)'` → `'RSV YoY (1~6월)'`
- `label: 'CRSV YoY (1~5월)'` → `'CRSV YoY (1~6월)'`
- `label: 'CFR 평균 (1~5월)'` → `'CFR 평균 (1~6월)'`

- [ ] **Step 6: ReferenceLine 기준선을 6월로 이동**

다음 줄을 찾는다:

```tsx
          <ReferenceLine yAxisId="rsv" x="5월" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '26년 집계 마감', position: 'top', fontSize: 9, fill: '#94a3b8' }} />
```

`x="5월"`을 `x="6월"`로 바꾼다.

- [ ] **Step 7: 인사이트 카드 3종 텍스트를 6월 데이터 포함해서 갱신**

다음 블록을 찾는다:

```tsx
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          {
            tag: '26년 주목',
            color: 'orange',
            text: `3월 RSV 600건 (+50% YoY). 25년 3월 대비 급등. 이른 봄 수요 확대 또는 신규 물량 유입 확인 필요.`,
          },
          {
            tag: '5월 역전',
            color: 'red',
            text: `5월 26년 RSV 234건 vs 25년 518건. 큰 폭 감소(-54.8%). 황금연휴 구조 차이 또는 예약 시점 분산 가능성 검토.`,
          },
          {
            tag: '시즌 전망',
            color: 'blue',
            text: `25년 피크는 6~8월(655~680건). 26년 동 시기 데이터 확보 시 본격 시즌성 비교 가능. CFR은 비슷한 수준 유지.`,
          },
        ].map(({ tag, color, text }) => (
```

이걸로 교체한다:

```tsx
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          {
            tag: '26년 주목',
            color: 'orange',
            text: `3월 RSV 600건 (+50% YoY). 25년 3월 대비 급등. 이른 봄 수요 확대 또는 신규 물량 유입 확인 필요.`,
          },
          {
            tag: '5~6월 둔화',
            color: 'red',
            text: `5월 234건(-54.8%), 6월 340건(-48.1%) 모두 25년 대비 큰 폭 감소. 두 달 연속 예약 둔화 — 원인 파악 필요.`,
          },
          {
            tag: '시즌 전망',
            color: 'blue',
            text: `25년 피크는 6~8월(655~680건). 26년 6월은 340건으로 성수기 진입 시점에도 YoY -48.1% 감소세 지속. 7~8월 추이 주시 필요.`,
          },
        ].map(({ tag, color, text }) => (
```

- [ ] **Step 8: 빌드 + 브라우저 확인**

Run: `cd /Users/sabin-park/indonesia-masterboard && npx tsc --noEmit`
Expected: 에러 없음

dev 서버(이미 3002 포트에서 실행 중)가 살아있으면 브라우저에서 "인도네시아 데이터" 탭을 열어 발리 시즌성 차트에 6월 막대/라인이 그려지고 카드 라벨이 "1~6월"로 보이는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add scripts/bali-seasonality.mjs components/BaliSeasonality.tsx
git commit -m "Refresh Bali seasonality with 2026 H1 actuals through June"
```

---

## Task 4: FPNA 쿼리에 UV·CVR 추가 (백엔드)

**Files:**
- Modify: `lib/bigquery.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: 없음 (기존 `buildFpnaPartnerQuery` 호출부 3곳 시그니처 변경)
- Produces: `FpnaPeriodRow`에 `detailUv: number`, `purchaseCompleteUv: number`, `cvr: number` 필드 추가 — Task 5(`FpnaPeriodTable.tsx`)가 이 필드명을 그대로 사용

- [ ] **Step 1: `lib/types.ts`의 `FpnaPeriodRow`에 필드 추가**

```ts
export interface FpnaPeriodRow {
  period: string;   // "2026-06-27" | "2026-06" | "2026"
  confirmOrders: number;
  confirmGmv: number;
  refundOrders: number;
  refundGmv: number;
  netCgmv: number;
  confirmCm: number;
  refundCm: number;
  netCm: number;
  cmr: number;
  cfr: number;
  detailUv: number;
  purchaseCompleteUv: number;
  cvr: number;
}
```

(`confirmOrders`부터 `cfr`까지는 기존 그대로, `detailUv`/`purchaseCompleteUv`/`cvr` 3줄만 추가)

- [ ] **Step 2: `buildFpnaPartnerQuery` 시그니처를 `periodFmt` 하나로 통일하고 UV 조인 추가**

`lib/bigquery.ts`에서 다음 함수 전체를 찾는다:

```ts
function buildFpnaPartnerQuery(confirmDateExpr: string, refundDateExpr: string, startDate: string, endDate: string): string {
  return `
    WITH gid_list AS (
      SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        AND LOWER(sp.ko_name) NOT LIKE '%[b2b%'
        AND LOWER(sp.ko_name) NOT LIKE '%[마이팩]%'
        AND LOWER(sp.ko_name) NOT LIKE '%[나연팩]%'
    ),
    provider_map AS (
      SELECT CAST(sp.property_id AS STRING) AS GID,
        UPPER(TRIM(ANY_VALUE(sp.provider_code))) AS partner
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      WHERE CAST(sp.property_id AS STRING) IN (SELECT GID FROM gid_list)
      GROUP BY 1
    ),
    confirm_raw AS (
      SELECT
        ${confirmDateExpr} AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS confirm_orders,
        SUM(p.GMV)                 AS confirm_gmv,
        SUM(p.CM)                  AS confirm_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.CONFIRM_KST_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    ),
    refund_raw AS (
      SELECT
        ${refundDateExpr} AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS refund_orders,
        SUM(p.REFUND_GMV)          AS refund_gmv,
        SUM(p.REFUND_CM)           AS refund_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.REFUND_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND (p.REFUND_GMV != 0 OR p.REFUND_CM != 0)
      GROUP BY 1, 2
    )
    SELECT
      m.period,
      m.partner,
      COALESCE(c.confirm_orders, 0) AS confirm_orders,
      COALESCE(c.confirm_gmv,    0) AS confirm_gmv,
      COALESCE(c.confirm_cm,     0) AS confirm_cm,
      COALESCE(r.refund_orders,  0) AS refund_orders,
      COALESCE(r.refund_gmv,     0) AS refund_gmv,
      COALESCE(r.refund_cm,      0) AS refund_cm
    FROM (
      SELECT period, partner FROM confirm_raw
      UNION DISTINCT
      SELECT period, partner FROM refund_raw
    ) m
    LEFT JOIN confirm_raw c ON m.period = c.period AND m.partner = c.partner
    LEFT JOIN refund_raw  r ON m.period = r.period AND m.partner = r.partner
    ORDER BY 1, 2
  `;
}
```

이 함수 전체를 다음으로 교체한다 (시그니처가 `(confirmDateExpr, refundDateExpr, startDate, endDate)`에서 `(periodFmt, startDate, endDate)`로 바뀜에 유의 — Step 3에서 호출부 3곳도 같이 고친다):

```ts
function buildFpnaPartnerQuery(periodFmt: string, startDate: string, endDate: string): string {
  return `
    WITH gid_list AS (
      SELECT DISTINCT CAST(sp.property_id AS STRING) AS GID
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      JOIN \`edw.DW_MRT_STAY_PROPERTY_REPRESENT_MRT_REGION\` AS r
        ON sp.property_id = r.property_id
      WHERE r.country_key_name = 'Indonesia'
        AND LOWER(sp.ko_name) NOT LIKE '%[b2b%'
        AND LOWER(sp.ko_name) NOT LIKE '%[마이팩]%'
        AND LOWER(sp.ko_name) NOT LIKE '%[나연팩]%'
    ),
    provider_map AS (
      SELECT CAST(sp.property_id AS STRING) AS GID,
        UPPER(TRIM(ANY_VALUE(sp.provider_code))) AS partner
      FROM \`edw.DW_MRT_STAY_PROPERTY\` AS sp
      WHERE CAST(sp.property_id AS STRING) IN (SELECT GID FROM gid_list)
      GROUP BY 1
    ),
    confirm_raw AS (
      SELECT
        FORMAT_DATE('${periodFmt}', p.CONFIRM_KST_DATE) AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS confirm_orders,
        SUM(p.GMV)                 AS confirm_gmv,
        SUM(p.CM)                  AS confirm_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.CONFIRM_KST_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    ),
    refund_raw AS (
      SELECT
        FORMAT_DATE('${periodFmt}', p.REFUND_DATE) AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT p.ORDER_ID) AS refund_orders,
        SUM(p.REFUND_GMV)          AS refund_gmv,
        SUM(p.REFUND_CM)           AS refund_cm
      FROM \`edw_fpna.MART_FPNA_NONAIR_PROFIT_D\` AS p
      JOIN gid_list AS g ON p.GID = g.GID
      LEFT JOIN provider_map AS pm ON p.GID = pm.GID
      WHERE p.FPNA_DOMAIN_NM = 'LODGMENT'
        AND p.REFUND_DATE BETWEEN '${startDate}' AND '${endDate}'
        AND (p.REFUND_GMV != 0 OR p.REFUND_CM != 0)
      GROUP BY 1, 2
    ),
    uv_partner_raw AS (
      SELECT
        FORMAT_DATE('${periodFmt}', c.BASIS_DATE) AS period,
        COALESCE(pm.partner, 'UNKNOWN') AS partner,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END) AS detail_uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END) AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` AS c
      JOIN gid_list AS g ON CAST(c.ITEM_ID AS STRING) = g.GID
      LEFT JOIN provider_map AS pm ON CAST(c.ITEM_ID AS STRING) = pm.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1, 2
    ),
    uv_total_raw AS (
      SELECT
        FORMAT_DATE('${periodFmt}', c.BASIS_DATE) AS period,
        COUNT(DISTINCT CASE WHEN c.OFFER_DETAIL_FLAG = 1 THEN c.pid END) AS detail_uv,
        COUNT(DISTINCT CASE WHEN c.WITH_EVENT_CHECKOUT_COMPLETE_FLAG = 1 THEN c.pid END) AS purchase_complete_uv
      FROM \`edw_mart.MART_BIZ_LOG_PID_CONVERSION_D\` AS c
      JOIN gid_list AS g ON CAST(c.ITEM_ID AS STRING) = g.GID
      WHERE c.BASIS_DATE BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY 1
    )
    SELECT
      m.period,
      m.partner,
      COALESCE(c.confirm_orders, 0) AS confirm_orders,
      COALESCE(c.confirm_gmv,    0) AS confirm_gmv,
      COALESCE(c.confirm_cm,     0) AS confirm_cm,
      COALESCE(r.refund_orders,  0) AS refund_orders,
      COALESCE(r.refund_gmv,     0) AS refund_gmv,
      COALESCE(r.refund_cm,      0) AS refund_cm,
      COALESCE(up.detail_uv,             0) AS partner_detail_uv,
      COALESCE(up.purchase_complete_uv,  0) AS partner_purchase_complete_uv,
      COALESCE(ut.detail_uv,             0) AS total_detail_uv,
      COALESCE(ut.purchase_complete_uv,  0) AS total_purchase_complete_uv
    FROM (
      SELECT period, partner FROM confirm_raw
      UNION DISTINCT
      SELECT period, partner FROM refund_raw
      UNION DISTINCT
      SELECT period, partner FROM uv_partner_raw
    ) m
    LEFT JOIN confirm_raw    c  ON m.period = c.period  AND m.partner = c.partner
    LEFT JOIN refund_raw     r  ON m.period = r.period  AND m.partner = r.partner
    LEFT JOIN uv_partner_raw up ON m.period = up.period AND m.partner = up.partner
    LEFT JOIN uv_total_raw   ut ON m.period = ut.period
    ORDER BY 1, 2
  `;
}
```

**왜 `uv_partner_raw`/`uv_total_raw`를 분리했는가**: `pid`(방문 세션)는 서로 다른 연동사 상품을 함께 조회할 수 있어, 연동사별 distinct UV를 단순히 더하면 전체 distinct UV보다 커질 수 있다. `fetchPeriodData`(기존 예약기준 UV 집계, `lib/bigquery.ts` 내 도시별 UV 처리 부분)에서 이미 같은 문제를 파트너별/전체용 쿼리를 분리해서 해결한 전례가 있어 그 패턴을 그대로 따른다. `confirm_orders`/`refund_orders`는 주문 하나가 정확히 하나의 연동사에 속하므로 이런 분리가 필요 없다.

- [ ] **Step 3: `buildFpnaPartnerQuery` 호출부 3곳 수정**

`fetchFpnaDailyData` 안에서:
```ts
  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y-%m-%d', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y-%m-%d', p.REFUND_DATE)`,
    startDate, endDate,
  );
```
을
```ts
  const query = buildFpnaPartnerQuery('%Y-%m-%d', startDate, endDate);
```
로 교체.

`fetchFpnaMonthlyDataWithPartners` 안에서:
```ts
  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y-%m', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y-%m', p.REFUND_DATE)`,
    startDate, endDate,
  );
```
을
```ts
  const query = buildFpnaPartnerQuery('%Y-%m', startDate, endDate);
```
로 교체.

`fetchFpnaYearlyData` 안에서:
```ts
  const query = buildFpnaPartnerQuery(
    `FORMAT_DATE('%Y', p.CONFIRM_KST_DATE)`,
    `FORMAT_DATE('%Y', p.REFUND_DATE)`,
    startDate, endDate,
  );
```
을
```ts
  const query = buildFpnaPartnerQuery('%Y', startDate, endDate);
```
로 교체.

- [ ] **Step 4: `toFpnaPeriodRow` / `emptyFpnaRow`에 UV·CVR 계산 추가**

다음 두 함수를 찾는다:

```ts
function toFpnaPeriodRow(period: string, r: Record<string, unknown>): FpnaPeriodRow {
  const confirmGmv = Number(r.confirm_gmv ?? 0);
  const refundGmv  = Number(r.refund_gmv  ?? 0);
  const confirmCm  = Number(r.confirm_cm  ?? 0);
  const refundCm   = Number(r.refund_cm   ?? 0);
  const netCgmv    = confirmGmv - refundGmv;
  const netCm      = confirmCm  - refundCm;
  return {
    period,
    confirmOrders: Number(r.confirm_orders ?? 0),
    confirmGmv,
    refundOrders:  Number(r.refund_orders  ?? 0),
    refundGmv,
    netCgmv,
    confirmCm,
    refundCm,
    netCm,
    cmr: netCgmv > 0 ? parseFloat(((netCm  / netCgmv)      * 100).toFixed(2)) : 0,
    cfr: confirmGmv > 0 ? parseFloat(((netCgmv / confirmGmv) * 100).toFixed(1)) : 0,
  };
}

function emptyFpnaRow(period: string): FpnaPeriodRow {
  return { period, confirmOrders: 0, confirmGmv: 0, refundOrders: 0, refundGmv: 0, netCgmv: 0, confirmCm: 0, refundCm: 0, netCm: 0, cmr: 0, cfr: 0 };
}
```

이걸로 교체한다:

```ts
function toFpnaPeriodRow(period: string, r: Record<string, unknown>): FpnaPeriodRow {
  const confirmGmv = Number(r.confirm_gmv ?? 0);
  const refundGmv  = Number(r.refund_gmv  ?? 0);
  const confirmCm  = Number(r.confirm_cm  ?? 0);
  const refundCm   = Number(r.refund_cm   ?? 0);
  const detailUv           = Number(r.detail_uv ?? 0);
  const purchaseCompleteUv = Number(r.purchase_complete_uv ?? 0);
  const netCgmv    = confirmGmv - refundGmv;
  const netCm      = confirmCm  - refundCm;
  return {
    period,
    confirmOrders: Number(r.confirm_orders ?? 0),
    confirmGmv,
    refundOrders:  Number(r.refund_orders  ?? 0),
    refundGmv,
    netCgmv,
    confirmCm,
    refundCm,
    netCm,
    cmr: netCgmv > 0 ? parseFloat(((netCm  / netCgmv)      * 100).toFixed(2)) : 0,
    cfr: confirmGmv > 0 ? parseFloat(((netCgmv / confirmGmv) * 100).toFixed(1)) : 0,
    detailUv,
    purchaseCompleteUv,
    cvr: detailUv > 0 ? parseFloat(((purchaseCompleteUv / detailUv) * 100).toFixed(2)) : 0,
  };
}

function emptyFpnaRow(period: string): FpnaPeriodRow {
  return { period, confirmOrders: 0, confirmGmv: 0, refundOrders: 0, refundGmv: 0, netCgmv: 0, confirmCm: 0, refundCm: 0, netCm: 0, cmr: 0, cfr: 0, detailUv: 0, purchaseCompleteUv: 0, cvr: 0 };
}
```

- [ ] **Step 5: `processFpnaPartnerRows`에서 UV 합산 로직 수정**

다음 함수 전체를 찾는다:

```ts
function processFpnaPartnerRows(rawRows: Record<string, unknown>[], periods: string[]): FpnaPeriodData {
  // partner → period → accumulated partial sums
  type PSum = { co: number; cg: number; cc: number; ro: number; rg: number; rc: number };
  const partnerMap = new Map<string, Map<string, PSum>>();
  const periodMap  = new Map<string, PSum>();

  const acc = (s: PSum, r: Record<string, unknown>) => {
    s.co += Number(r.confirm_orders ?? 0);
    s.cg += Number(r.confirm_gmv   ?? 0);
    s.cc += Number(r.confirm_cm    ?? 0);
    s.ro += Number(r.refund_orders ?? 0);
    s.rg += Number(r.refund_gmv   ?? 0);
    s.rc += Number(r.refund_cm    ?? 0);
  };
  const newSum = (): PSum => ({ co: 0, cg: 0, cc: 0, ro: 0, rg: 0, rc: 0 });
  const toRow  = (period: string, s: PSum): FpnaPeriodRow => toFpnaPeriodRow(period, {
    confirm_orders: s.co, confirm_gmv: s.cg, confirm_cm: s.cc,
    refund_orders:  s.ro, refund_gmv:  s.rg, refund_cm:  s.rc,
  });

  for (const r of rawRows) {
    const period  = String(r.period  ?? '');
    const partner = String(r.partner ?? 'UNKNOWN');

    // period total
    if (!periodMap.has(period)) periodMap.set(period, newSum());
    acc(periodMap.get(period)!, r);

    // partner × period
    if (!partnerMap.has(partner)) partnerMap.set(partner, new Map());
    const pm = partnerMap.get(partner)!;
    if (!pm.has(period)) pm.set(period, newSum());
    acc(pm.get(period)!, r);
  }

  const rows = periods.map(p => periodMap.has(p) ? toRow(p, periodMap.get(p)!) : emptyFpnaRow(p));

  const partners: FpnaPartnerData[] = Array.from(partnerMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partner, pm]) => ({
      partner,
      rows: periods.map(p => pm.has(p) ? toRow(p, pm.get(p)!) : emptyFpnaRow(p)),
    }));

  return { periods, rows, partners };
}
```

이걸로 교체한다 (period 합계 행의 UV는 파트너별 합산이 아니라 `total_detail_uv`/`total_purchase_complete_uv`를 그대로 덮어써서 pid 중복 카운트를 피한다):

```ts
function processFpnaPartnerRows(rawRows: Record<string, unknown>[], periods: string[]): FpnaPeriodData {
  // partner → period → accumulated partial sums
  type PSum = { co: number; cg: number; cc: number; ro: number; rg: number; rc: number; du: number; pu: number };
  const partnerMap = new Map<string, Map<string, PSum>>();
  const periodMap  = new Map<string, PSum>();

  const accGmv = (s: PSum, r: Record<string, unknown>) => {
    s.co += Number(r.confirm_orders ?? 0);
    s.cg += Number(r.confirm_gmv   ?? 0);
    s.cc += Number(r.confirm_cm    ?? 0);
    s.ro += Number(r.refund_orders ?? 0);
    s.rg += Number(r.refund_gmv   ?? 0);
    s.rc += Number(r.refund_cm    ?? 0);
  };
  const newSum = (): PSum => ({ co: 0, cg: 0, cc: 0, ro: 0, rg: 0, rc: 0, du: 0, pu: 0 });
  const toRow  = (period: string, s: PSum): FpnaPeriodRow => toFpnaPeriodRow(period, {
    confirm_orders: s.co, confirm_gmv: s.cg, confirm_cm: s.cc,
    refund_orders:  s.ro, refund_gmv:  s.rg, refund_cm:  s.rc,
    detail_uv: s.du, purchase_complete_uv: s.pu,
  });

  for (const r of rawRows) {
    const period  = String(r.period  ?? '');
    const partner = String(r.partner ?? 'UNKNOWN');

    // period total — GMV/CM은 연동사별로 합산, UV는 파트너 무관 distinct 값을 그대로 사용(덮어쓰기)
    if (!periodMap.has(period)) periodMap.set(period, newSum());
    const ps = periodMap.get(period)!;
    accGmv(ps, r);
    ps.du = Number(r.total_detail_uv ?? 0);
    ps.pu = Number(r.total_purchase_complete_uv ?? 0);

    // partner × period — UV는 해당 연동사 GID들만의 distinct 값
    if (!partnerMap.has(partner)) partnerMap.set(partner, new Map());
    const pm = partnerMap.get(partner)!;
    if (!pm.has(period)) pm.set(period, newSum());
    const pps = pm.get(period)!;
    accGmv(pps, r);
    pps.du += Number(r.partner_detail_uv ?? 0);
    pps.pu += Number(r.partner_purchase_complete_uv ?? 0);
  }

  const rows = periods.map(p => periodMap.has(p) ? toRow(p, periodMap.get(p)!) : emptyFpnaRow(p));

  const partners: FpnaPartnerData[] = Array.from(partnerMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partner, pm]) => ({
      partner,
      rows: periods.map(p => pm.has(p) ? toRow(p, pm.get(p)!) : emptyFpnaRow(p)),
    }));

  return { periods, rows, partners };
}
```

- [ ] **Step 6: 타입체크**

Run: `cd /Users/sabin-park/indonesia-masterboard && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 실제 API로 UV·CVR 값 검증**

dev 서버가 3002 포트에서 이미 떠 있다 (수정한 `lib/bigquery.ts`는 Next dev가 자동으로 다시 컴파일한다). 아래로 응답을 확인한다:

Run: `curl -s "http://localhost:3002/api/fpna-monthly?month=2026-07" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d.rows.map(r=>({period:r.period, detailUv:r.detailUv, purchaseCompleteUv:r.purchaseCompleteUv, cvr:r.cvr})), null, 2))"`

Expected: 각 period마다 `detailUv > 0`, `cvr`이 0~100 사이 숫자로 나옴 (0건인 미래 월 제외). 만약 전부 0이면 `uv_total_raw`/`uv_partner_raw` 조인 조건(GID 캐스팅, BASIS_DATE 범위)을 다시 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add lib/bigquery.ts lib/types.ts
git commit -m "Add UV/CVR aggregation to FPNA period queries"
```

---

## Task 5: FpnaPeriodTable에 UV·CVR 지표 탭 추가 (프론트)

**Files:**
- Modify: `components/FpnaPeriodTable.tsx`

**Interfaces:**
- Consumes: `FpnaPeriodRow.detailUv`, `FpnaPeriodRow.purchaseCompleteUv`, `FpnaPeriodRow.cvr` (Task 4에서 추가됨)
- Produces: 없음 (최종 UI 태스크)

- [ ] **Step 1: `MetricKey` 유니온 타입에 `detailUv`, `cvr` 추가**

다음 줄을 찾는다:
```ts
type MetricKey = 'confirmGmv' | 'refundGmv' | 'netCgmv' | 'netCm' | 'cmr' | 'cfr' | 'confirmOrders' | 'refundOrders';
```
이걸로 교체:
```ts
type MetricKey = 'confirmGmv' | 'refundGmv' | 'netCgmv' | 'netCm' | 'cmr' | 'cfr' | 'confirmOrders' | 'refundOrders' | 'detailUv' | 'cvr';
```

- [ ] **Step 2: `METRIC_TABS`에 두 항목 추가**

다음 블록을 찾는다:
```ts
const METRIC_TABS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'confirmGmv',    label: '확정 GMV',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'refundGmv',     label: '취소 CGMV', fmt: v => v > 0 ? '-' + Math.round(v).toLocaleString('ko-KR') + '원' : '-' },
  { key: 'netCgmv',       label: '순 CGMV',   fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'netCm',         label: '순 CM',     fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cmr',           label: 'CMR',       fmt: v => v.toFixed(2) + '%' },
  { key: 'cfr',           label: 'CFR',       fmt: v => v.toFixed(1) + '%' },
  { key: 'confirmOrders', label: '확정 건수',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'refundOrders',  label: '취소 건수',  fmt: v => v > 0 ? Math.round(v).toLocaleString('ko-KR') + '건' : '-' },
];
```
이걸로 교체:
```ts
const METRIC_TABS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'confirmGmv',    label: '확정 GMV',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'refundGmv',     label: '취소 CGMV', fmt: v => v > 0 ? '-' + Math.round(v).toLocaleString('ko-KR') + '원' : '-' },
  { key: 'netCgmv',       label: '순 CGMV',   fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'netCm',         label: '순 CM',     fmt: v => Math.round(v).toLocaleString('ko-KR') + '원' },
  { key: 'cmr',           label: 'CMR',       fmt: v => v.toFixed(2) + '%' },
  { key: 'cfr',           label: 'CFR',       fmt: v => v.toFixed(1) + '%' },
  { key: 'confirmOrders', label: '확정 건수',  fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'refundOrders',  label: '취소 건수',  fmt: v => v > 0 ? Math.round(v).toLocaleString('ko-KR') + '건' : '-' },
  { key: 'detailUv',      label: '상세 UV',   fmt: v => Math.round(v).toLocaleString('ko-KR') + '건' },
  { key: 'cvr',           label: 'CVR',       fmt: v => v.toFixed(2) + '%' },
];
```

`getVal(r, key)`는 이미 `return r[key] as number;`로 범용 구현돼 있어 수정 불필요 — `FpnaPeriodRow`에 `detailUv`/`cvr` 필드가 있으므로 그대로 동작한다.

- [ ] **Step 3: 빌드**

Run: `cd /Users/sabin-park/indonesia-masterboard && npm run build`
Expected: 빌드 성공, 타입 에러 없음

- [ ] **Step 4: 브라우저에서 최종 확인**

`http://localhost:3002` 접속 → "인도네시아 데이터" 탭 → 예약기준 토글이 사라지고 발리 시즌성(6월 포함) → 안내카드 → 일/월/년 성과표 순서로 보이는지 확인. `FpnaDailyTable`/`FpnaMonthlyTable`/`FpnaYearlyTable`에서 "상세 UV", "CVR" 탭을 클릭해 숫자가 나오는지, 전체 행 클릭 시 연동사별 확장 행에도 값이 나오는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/FpnaPeriodTable.tsx
git commit -m "Add UV/CVR metric tabs to FPNA period tables"
```
