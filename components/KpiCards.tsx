'use client';

import { SummaryMetrics } from '@/lib/types';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  const achv = ((value / target) * 100).toFixed(1);
  return (
    <div className="mt-2.5">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>진척률 <span className="font-semibold text-slate-600">{achv}%</span></span>
        <span>목표 {fmtKrw(target)}원</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface Props {
  metrics: SummaryMetrics;
  color: string;
}

export default function KpiCards({ metrics, color }: Props) {
  const cfrColor =
    metrics.cfr >= 85 ? '#059669' :
    metrics.cfr >= 70 ? '#D97706' : '#DC2626';

  const cfrLabel =
    metrics.cfr >= 85 ? '✓ 목표 달성' :
    metrics.cfr >= 70 ? '△ 주의 필요' : '⚠ 위험';

  const cmrColor =
    metrics.cmr >= 5 ? '#059669' :
    metrics.cmr >= 3 ? '#D97706' : '#DC2626';

  // CVR = PURCHASE_COMPLETE_UV / DETAIL_UV (Redash #26250 기준)
  const cvr = metrics.detailUv > 0 ? ((metrics.purchaseCompleteUv ?? 0) / metrics.detailUv) * 100 : 0;

  return (
    <div className="grid grid-cols-6 gap-4">
      {/* GMV */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">GMV</p>
        <p className="text-3xl font-bold text-slate-900 leading-none">{fmtKrw(metrics.gmv)}원</p>
        <p className="text-xs text-slate-400 mt-2">총 거래액 (취소 포함)</p>
        {metrics.targetGmv && (
          <ProgressBar value={metrics.gmv} target={metrics.targetGmv} color={color} />
        )}
      </div>

      {/* CM */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">CM</p>
        <p className="text-3xl font-bold text-slate-900 leading-none">{fmtKrw(metrics.cm)}원</p>
        <p className="text-xs text-slate-400 mt-2">공헌이익</p>
        {metrics.targetCm && (
          <ProgressBar value={metrics.cm} target={metrics.targetCm} color={color} />
        )}
      </div>

      {/* CMR */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">CMR</p>
        <p className="text-3xl font-bold leading-none" style={{ color: cmrColor }}>
          {metrics.cmr.toFixed(1)}%
        </p>
        <p className="text-xs mt-2 text-slate-400">CM / CGMV</p>
      </div>

      {/* CFR */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">CFR</p>
        <p className="text-3xl font-bold leading-none" style={{ color: cfrColor }}>
          {metrics.cfr.toFixed(1)}%
        </p>
        <p className="text-xs mt-2" style={{ color: cfrColor }}>{cfrLabel}</p>
      </div>

      {/* 상세 UV */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">상세 UV</p>
        <p className="text-3xl font-bold text-slate-900 leading-none">
          {metrics.detailUv.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-2">상세 페이지 방문자</p>
      </div>

      {/* CVR */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">CVR</p>
        <p className="text-3xl font-bold text-slate-900 leading-none">
          {cvr.toFixed(2)}%
        </p>
        <p className="text-xs text-slate-400 mt-2">예약건수 / 상세UV</p>
      </div>
    </div>
  );
}
