'use client';

import FpnaPeriodTable from './FpnaPeriodTable';

function fmtDay(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function FpnaDailyTable() {
  return (
    <FpnaPeriodTable
      title="성과 기준 일별 현황"
      subtitle="최근 30일 · 확정(CONFIRM_KST_DATE) + 취소(REFUND_DATE) 이벤트 합산"
      apiUrl="/api/fpna-daily"
      fmtPeriod={fmtDay}
      currentPeriod=""
    />
  );
}
