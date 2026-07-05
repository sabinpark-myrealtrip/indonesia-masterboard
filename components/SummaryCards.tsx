'use client';

import { SummaryMetrics, City, CITY_COLORS } from '@/lib/types';

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  target?: string;
}

function MetricCard({ label, value, sub, status = 'neutral', target }: MetricCardProps) {
  const statusColors = {
    good: 'text-emerald-600',
    warn: 'text-amber-500',
    bad: 'text-red-500',
    neutral: 'text-slate-800',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${statusColors[status]}`}>{value}</p>
      {target && <p className="text-xs text-slate-400 mt-0.5">목표 {target}</p>}
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const achvPct = target > 0 ? ((value / target) * 100).toFixed(1) : '0';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>달성률 {achvPct}%</span>
        <span>목표 {fmtKrw(target)}원</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface Props {
  metrics: SummaryMetrics;
  city: City;
}

export default function SummaryCards({ metrics, city }: Props) {
  const color = CITY_COLORS[city];

  const cfrStatus = metrics.cfr >= 85 ? 'good' : metrics.cfr >= 70 ? 'warn' : 'bad';
  const cmrStatus = metrics.cmr >= 5 ? 'good' : metrics.cmr >= 3 ? 'warn' : 'bad';

  return (
    <div className="space-y-4">
      {/* 달성률 프로그레스 */}
      {metrics.targetCgmv && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            {city} CGMV 달성 현황
          </p>
          <ProgressBar value={metrics.cgmv} target={metrics.targetCgmv} color={color} />
          <p className="text-right text-sm font-bold mt-2" style={{ color }}>
            {fmtKrw(metrics.cgmv)}원
          </p>
        </div>
      )}

      {/* KPI 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="GMV"
          value={`${fmtKrw(metrics.gmv)}원`}
          sub="취소 포함"
        />
        <MetricCard
          label="CGMV"
          value={`${fmtKrw(metrics.cgmv)}원`}
          sub="확정거래액"
          target={metrics.targetCgmv ? `${fmtKrw(metrics.targetCgmv)}원` : undefined}
        />
        <MetricCard
          label="CM"
          value={`${fmtKrw(metrics.cm)}원`}
          sub="공헌이익"
        />
        <MetricCard
          label="CMR"
          value={`${metrics.cmr.toFixed(1)}%`}
          sub="CM/CGMV"
          status={cmrStatus}
        />
        <MetricCard
          label="CFR"
          value={`${metrics.cfr.toFixed(1)}%`}
          sub={`${fmt(metrics.crsvCnt)}/${fmt(metrics.rsvCnt)}건`}
          status={cfrStatus}
          target={metrics.targetCfr ? `${metrics.targetCfr.toFixed(1)}%` : undefined}
        />
        <MetricCard
          label="TR"
          value={`${metrics.tr.toFixed(1)}%`}
          sub="기술 비율"
        />
      </div>

      {/* 예약/확정 현황 바 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">예약 → 확정 현황</span>
          <span className="text-sm text-slate-500">
            확정 <span className="font-bold text-slate-800">{fmt(metrics.crsvCnt)}</span>건 / 예약 {fmt(metrics.rsvCnt)}건
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((metrics.crsvCnt / Math.max(metrics.rsvCnt, 1)) * 100, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>CFR {metrics.cfr.toFixed(1)}%</span>
          <span className={metrics.cfr < 70 ? 'text-red-500 font-semibold' : ''}>
            {metrics.cfr < 70 ? '⚠ CFR 위험' : metrics.cfr >= 85 ? '✓ 양호' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
