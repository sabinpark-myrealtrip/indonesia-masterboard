'use client';

import { useState } from 'react';
import { DailyAnalysis, InsightLevel, MetricDelta } from '@/lib/analyzer';

function fmtKrw(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtVal(m: MetricDelta, val: number) {
  if (m.fmt === 'krw') return `${fmtKrw(val)}원`;
  if (m.fmt === 'pct') return `${val.toFixed(1)}%`;
  return val.toLocaleString('ko-KR');
}

function deltaPct(d1: number, d2: number) {
  if (d2 === 0) return null;
  return ((d1 - d2) / d2) * 100;
}

function fmtDate(d: string) {
  return d.slice(5).replace('-', '/');
}

const LEVEL_CONFIG: Record<InsightLevel, {
  icon: string;
  bg: string;
  border: string;
  titleColor: string;
  badge: string;
  badgeText: string;
}> = {
  critical: {
    icon: '🚨',
    bg: 'bg-red-50',
    border: 'border-red-200',
    titleColor: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    badgeText: '긴급',
  },
  warning: {
    icon: '⚠️',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    titleColor: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    badgeText: '주의',
  },
  positive: {
    icon: '📈',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    titleColor: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeText: '긍정',
  },
  info: {
    icon: 'ℹ️',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    titleColor: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-600',
    badgeText: '참고',
  },
};

interface Props {
  analysis: DailyAnalysis;
}

export default function DailyInsights({ analysis }: Props) {
  const [open, setOpen] = useState(false);

  const critCount = analysis.insights.filter(i => i.level === 'critical').length;
  const warnCount = analysis.insights.filter(i => i.level === 'warning').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">🔍</span>
          <div className="text-left">
            <p className="font-semibold text-slate-800 text-sm">
              데이터 분석 리포트
              <span className="text-slate-400 font-normal ml-2">
                {fmtDate(analysis.d2)} → {fmtDate(analysis.d1)} 기준
              </span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {critCount > 0 && (
                <span className="text-[11px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                  🚨 긴급 {critCount}건
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  ⚠️ 주의 {warnCount}건
                </span>
              )}
              {critCount === 0 && warnCount === 0 && (
                <span className="text-[11px] text-slate-400">특이사항 없음</span>
              )}
            </div>
          </div>
        </div>
        <span className={`text-slate-400 text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">

          {/* 주요 지표 전일 대비 */}
          <div className="grid grid-cols-5 gap-3">
            {analysis.metrics.map(m => {
              const dp = deltaPct(m.d1, m.d2);
              const up = dp !== null && dp >= 0;
              return (
                <div key={m.label} className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-[11px] text-slate-400 mb-1">{m.label}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{fmtVal(m, m.d1)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {dp !== null ? (
                      <span className={`text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                        {up ? '▲' : '▼'} {Math.abs(dp).toFixed(1)}%
                      </span>
                    ) : null}
                    <span className="text-[10px] text-slate-400">vs 전일</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100" />

          {analysis.insights.map((insight, i) => {
            const cfg = LEVEL_CONFIG[insight.level];
            return (
              <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{cfg.icon}</span>
                    <p className={`font-semibold text-sm ${cfg.titleColor} leading-snug`}>
                      {insight.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                      {cfg.badgeText}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/70 px-1.5 py-0.5 rounded border border-slate-100">
                      {insight.category}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                  {insight.detail.split('\n\n').map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
                {insight.action && (
                  <div className="mt-3 bg-white/60 rounded-lg px-3 py-2 border border-white">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">액션 아이템</p>
                    <div className="space-y-0.5">
                      {insight.action.split('\n').map((line, j) => (
                        <p key={j} className="text-xs text-slate-600">· {line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-slate-300 text-right pt-1">
            분석 기준: {new Date(analysis.generatedAt).toLocaleString('ko-KR')}
          </p>
        </div>
      )}
    </div>
  );
}
