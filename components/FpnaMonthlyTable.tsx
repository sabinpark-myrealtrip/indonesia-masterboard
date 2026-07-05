'use client';

import FpnaPeriodTable from './FpnaPeriodTable';

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y.slice(2)}년 ${parseInt(mo)}월`;
}

export default function FpnaMonthlyTable({ month }: { month: string }) {
  return (
    <FpnaPeriodTable
      title="성과 기준 월별 현황"
      subtitle="확정(CONFIRM_KST_DATE) + 취소(REFUND_DATE) 이벤트 합산 · 전사 KPI 기준"
      apiUrl={`/api/fpna-monthly?month=${month}`}
      fmtPeriod={fmtMonth}
      currentPeriod={month}
    />
  );
}
