'use client';

import PeriodTable from './PeriodTable';

// "2026-W14" → "4/1~4/7"
function fmtWeek(w: string) {
  // ISO week → 월요일 날짜 계산
  const [yearStr, weekStr] = w.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  // ISO week 1의 목요일이 해당 연도에 속함
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const mon = new Date(startOfWeek1);
  mon.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(mon)}~${fmt(sun)}`;
}

export default function WeeklyTable({ month }: { month: string }) {
  return (
    <PeriodTable
      title="주별 성과 현황"
      subtitle="최근 8주 누적 기준 · 도시 클릭 시 연동사별 상세 확인"
      apiUrl={`/api/weekly?month=${month}`}
      fmtPeriod={fmtWeek}
      currentPeriod=""
    />
  );
}
