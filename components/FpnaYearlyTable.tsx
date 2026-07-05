'use client';

import FpnaPeriodTable from './FpnaPeriodTable';

function fmtYear(y: string) {
  return `${y}년`;
}

export default function FpnaYearlyTable({ month }: { month: string }) {
  const year = month.slice(0, 4);
  return (
    <FpnaPeriodTable
      title="성과 기준 연도별 현황"
      subtitle="최근 3년 누적 · 확정(CONFIRM_KST_DATE) + 취소(REFUND_DATE) 이벤트 합산"
      apiUrl={`/api/fpna-yearly?year=${year}`}
      fmtPeriod={fmtYear}
      currentPeriod={year}
    />
  );
}
