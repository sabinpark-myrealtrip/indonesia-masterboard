'use client';

import PeriodTable from './PeriodTable';

function fmtDay(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function DailyTable() {
  return (
    <PeriodTable
      title="일별 성과 현황"
      subtitle="최근 30일 기준 · 도시 클릭 시 연동사별 상세 확인"
      apiUrl="/api/daily"
      fmtPeriod={fmtDay}
      currentPeriod=""
    />
  );
}
