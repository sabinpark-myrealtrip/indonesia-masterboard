# 인도네시아 데이터 탭 통합 + UV·CVR 재구조화

## 배경
"인도네시아 데이터" 탭은 `예약 기준`(RSV 발생일 기준) / `성과 기준 (전사 KPI)`(확정일 기준) 토글로 나뉘어 있었다. 두 뷰가 사실상 같은 정보(일/월/년 GMV·CM 집계)를 다른 기준으로 중복 제공하고 있어, 예약기준 뷰를 없애고 성과기준 뷰로 통합한다. 단, 발리 예약 시즌성·YoY 비교(BaliSeasonality)는 예약기준에만 있던 유일한 콘텐츠이므로 통합 뷰에 이관한다. 이관 전에 6월 실적 데이터도 채워 넣는다. 마지막으로 성과기준 표에는 없던 UV·CVR을 추가한다.

## 범위

### 1. 탭 통합 (`components/Dashboard.tsx`)
- `dataViewMode` state, 토글 버튼, `예약 기준`/`성과 기준` 분기 렌더링 제거
- "인도네시아 데이터" 탭 콘텐츠를 다음 순서의 단일 뷰로 통합:
  1. `BaliSeasonality`
  2. 기존 성과기준 안내 카드 (예약기준 대비 차이 설명 문구는 더 이상 토글이 없으므로 제거하거나 "확정일 기준 집계 안내"로 축약)
  3. `FpnaDailyTable`
  4. `FpnaMonthlyTable`
  5. `FpnaYearlyTable`

### 2. 예약기준 전용 코드 삭제
아래는 통합 후 더 이상 어디에서도 참조되지 않는 것을 확인했다 (`Dashboard.tsx`의 예약기준 분기 밖에서는 import/호출 없음):
- 컴포넌트: `DailyTable.tsx`, `WeeklyTable.tsx`, `MonthlyTable.tsx`, `YearlyTable.tsx`, `PeriodTable.tsx`
- API 라우트: `app/api/daily/route.ts`, `app/api/weekly/route.ts`, `app/api/monthly/route.ts`, `app/api/yearly/route.ts`
- `lib/bigquery.ts`: `fetchDailyData`, `fetchWeeklyData`, `fetchMonthlyData`, `fetchYearlyData`, `fetchPeriodData`
- `lib/types.ts`: `MonthlyData` 인터페이스
- `lib/dummyDaily.ts`, `lib/dummyWeekly.ts`, `lib/dummyMonthly.ts`, `lib/dummyYearly.ts`

### 3. 발리 시즌성 6월 데이터 반영 (`components/BaliSeasonality.tsx`, `scripts/bali-seasonality.mjs`)
- `scripts/bali-seasonality.mjs`의 BQ 쿼리 기간을 2026-01-01~06-30까지 포함하도록 확장 (기존엔 2025년치만 조회)
- 조회 결과로 `BaliSeasonality.tsx`의 하드코딩 `DATA` 배열 6월 행에 `rsv26`, `crsv26`, `cfr26` 채움
- 라벨/기준선/인사이트 텍스트를 "1~5월 누적" → "1~6월 누적" 기준으로 갱신 (뱃지 텍스트, ReferenceLine 위치, 요약 카드 문구, 인사이트 3종 코멘트)

### 4. 성과기준 표에 UV·CVR 추가
- `lib/bigquery.ts`의 `buildFpnaPartnerQuery`에 `MART_BIZ_LOG_PID_CONVERSION_D` 조인을 추가:
  - 기존 `gid_list`(인도네시아, B2B/마이팩/나연팩 제외), `provider_map` 그대로 재사용
  - `BASIS_DATE`를 동일한 `period` 표현식(일/월/년)으로 truncate
  - `COUNT(DISTINCT pid WHERE OFFER_DETAIL_FLAG=1)` → `detail_uv`
  - `COUNT(DISTINCT pid WHERE WITH_EVENT_CHECKOUT_COMPLETE_FLAG=1)` → `purchase_complete_uv`
  - period+partner 기준으로 confirm/refund 집계와 UNION/LEFT JOIN
- `lib/types.ts`: `FpnaPeriodRow`, `FpnaMonthRow`에 `detailUv: number`, `purchaseCompleteUv: number`, `cvr: number` 필드 추가
- `toFpnaPeriodRow` / `emptyFpnaRow` / `processFpnaPartnerRows`에 UV 합산 로직 추가, `cvr = purchaseCompleteUv > 0 ? purchaseCompleteUv/detailUv*100 : 0`
- `components/FpnaPeriodTable.tsx`의 `METRIC_TABS`에 `상세 UV`, `CVR` 항목 추가 (기존 표 구조 그대로, 지표 탭만 확장)
- `FpnaMonthlyData`(단일 월 요약, `fetchFpnaMonthlyData`)는 파트너별 표가 아니라 요약용이라 이번 범위에서는 변경하지 않음 (UV는 파트너별 상세표에서만 노출)

## 비범위
- BaliSeasonality의 예약기준 데이터 소스(`MART_FPNA_LODGMENT_PROFIT_D`, RSV 발생일 기준)는 그대로 유지 — CLAUDE.md 지표 기준(확정일/환불일 net)과는 다른 시즌성 전용 뷰이므로 변경하지 않음
- 도시별 예약 분포, 파트너 관리, 상품 카탈로그 등 다른 탭은 영향 없음

## 검증 계획
- `npm run build` 타입 체크 통과
- 로컬 dev 서버에서 "인도네시아 데이터" 탭 열어 토글이 사라지고 BaliSeasonality → Fpna 표 3종이 순서대로 보이는지 확인
- FpnaDailyTable/MonthlyTable/YearlyTable에서 "상세 UV", "CVR" 지표 탭 클릭 시 값이 나오는지, 연동사 확장 시에도 값이 나오는지 확인
- BaliSeasonality 차트에 6월 막대/라인이 추가로 그려지는지 확인
