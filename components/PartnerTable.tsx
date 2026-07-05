'use client';

import { PartnerSummary } from '@/lib/types';

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toFixed(0);
}

const PARTNER_COLORS: Record<string, string> = {
  agoda: '#e11d48',
  booking: '#0369a1',
  expedia: '#eab308',
  airbnb: '#ec4899',
  hotels: '#16a34a',
};

interface Props {
  partnerSummary: PartnerSummary[];
}

export default function PartnerTable({ partnerSummary }: Props) {
  if (!partnerSummary?.length) return null;

  const total = partnerSummary.reduce(
    (acc, p) => ({
      rsvCnt: acc.rsvCnt + p.rsvCnt,
      crsvCnt: acc.crsvCnt + p.crsvCnt,
      cgmv: acc.cgmv + p.cgmv,
      cm: acc.cm + p.cm,
    }),
    { rsvCnt: 0, crsvCnt: 0, cgmv: 0, cm: 0 }
  );
  const totalCfr = total.rsvCnt > 0 ? (total.crsvCnt / total.rsvCnt) * 100 : 0;
  const totalCmr = total.cgmv > 0 ? (total.cm / total.cgmv) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">연동사별 지표</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">파트너</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">예약건수</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">확정건수</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">CFR</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">CGMV</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">CM</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">CMR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {partnerSummary.map(p => (
              <tr key={p.partner} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: PARTNER_COLORS[p.partner] ?? '#94a3b8' }}
                  >
                    {p.partner}
                  </span>
                </td>
                <td className="text-right px-5 py-3.5 text-slate-600">{p.rsvCnt.toLocaleString()}</td>
                <td className="text-right px-5 py-3.5 font-medium text-slate-800">{p.crsvCnt.toLocaleString()}</td>
                <td className="text-right px-5 py-3.5">
                  <span className={`font-semibold ${
                    p.cfr >= 85 ? 'text-emerald-600' :
                    p.cfr >= 70 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {p.cfr.toFixed(1)}%
                  </span>
                </td>
                <td className="text-right px-5 py-3.5 text-slate-700">{fmtKrw(p.cgmv)}원</td>
                <td className="text-right px-5 py-3.5 text-slate-700">{fmtKrw(p.cm)}원</td>
                <td className="text-right px-5 py-3.5">
                  <span className={p.cmr >= 3 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                    {p.cmr.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* 합계 행 */}
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td className="px-5 py-3 font-semibold text-slate-700 text-xs">합계</td>
              <td className="text-right px-5 py-3 font-semibold text-slate-700">{total.rsvCnt.toLocaleString()}</td>
              <td className="text-right px-5 py-3 font-semibold text-slate-700">{total.crsvCnt.toLocaleString()}</td>
              <td className="text-right px-5 py-3">
                <span className={`font-bold ${
                  totalCfr >= 85 ? 'text-emerald-600' :
                  totalCfr >= 70 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {totalCfr.toFixed(1)}%
                </span>
              </td>
              <td className="text-right px-5 py-3 font-semibold text-slate-700">{fmtKrw(total.cgmv)}원</td>
              <td className="text-right px-5 py-3 font-semibold text-slate-700">{fmtKrw(total.cm)}원</td>
              <td className="text-right px-5 py-3">
                <span className={`font-bold ${totalCmr >= 3 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totalCmr.toFixed(1)}%
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
