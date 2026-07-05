'use client';

import PeriodTable from './PeriodTable';

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y.slice(2)}년 ${parseInt(mo)}월`;
}

export default function MonthlyTable({ month }: { month: string }) {
  return (
    <PeriodTable
      title="월별 성과 현황"
      subtitle="도시 클릭 시 연동사별 상세 확인"
      apiUrl={`/api/monthly?month=${month}`}
      fmtPeriod={fmtMonth}
      currentPeriod={month}
    />
  );
}
