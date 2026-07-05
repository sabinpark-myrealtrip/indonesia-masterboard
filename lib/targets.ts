import { City } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 발리 목표값 설정
//
// monthly : 해당 월의 누적 목표 (KPI 카드 진척률 바에 표시)
// daily   : 하루 평균 목표     (일별 추이 차트에 기준선으로 표시)
//
// 단위: 원 (예: 1억 = 100_000_000)
// 미입력 필드는 undefined로 두면 대시보드에 표시되지 않음
// ─────────────────────────────────────────────────────────────────────────────

interface TargetValues {
  gmv?: number;
  cm?:  number;
}

interface CityTargets {
  monthly: TargetValues;
  daily:   TargetValues;
}

const TARGETS: Record<string, Partial<Record<City, CityTargets>>> = {

  // ── 2026년 ───────────────────────────────────────────────────────────────

  '2026-06': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-07': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-08': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-09': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-10': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-11': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

  '2026-12': {
    전체: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
    발리: {
      monthly: { gmv: undefined, cm: undefined },
      daily:   { gmv: undefined, cm: undefined },
    },
  },

};

/** KPI 카드 진척률 바용 — 월 누적 목표 */
export function getTargets(basisMonth: string, city: City): TargetValues {
  return TARGETS[basisMonth]?.[city]?.monthly ?? {};
}

/** 일별 추이 차트 기준선용 — 하루 평균 목표 */
export function getDailyTarget(basisMonth: string, city: City): TargetValues {
  return TARGETS[basisMonth]?.[city]?.daily ?? {};
}
