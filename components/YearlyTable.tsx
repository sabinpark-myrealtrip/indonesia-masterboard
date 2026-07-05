'use client';

import PeriodTable from './PeriodTable';

function fmtYear(y: string) {
  return `${y}년`;
}

export default function YearlyTable({ month }: { month: string }) {
  const year = month.slice(0, 4);
  return (
    <PeriodTable
      title="연도별 성과 현황"
      subtitle="연도 누적 기준 · 도시 클릭 시 연동사별 상세 확인"
      apiUrl={`/api/yearly?year=${year}`}
      fmtPeriod={fmtYear}
      currentPeriod={year}
    />
  );
}
