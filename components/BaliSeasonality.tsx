'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const DATA = [
  { month: '1월',  rsv25: 283,  crsv25: 176, cfr25: 62.2, rsv26: 435,  crsv26: 283, cfr26: 65.1 },
  { month: '2월',  rsv25: 394,  crsv25: 251, cfr25: 63.7, rsv26: 366,  crsv26: 219, cfr26: 59.8 },
  { month: '3월',  rsv25: 400,  crsv25: 268, cfr25: 67.0, rsv26: 600,  crsv26: 371, cfr26: 61.8 },
  { month: '4월',  rsv25: 359,  crsv25: 248, cfr25: 69.1, rsv26: 358,  crsv26: 227, cfr26: 63.4 },
  { month: '5월',  rsv25: 518,  crsv25: 350, cfr25: 67.6, rsv26: 234,  crsv26: 159, cfr26: 67.9 },
  { month: '6월',  rsv25: 655,  crsv25: 412, cfr25: 62.9 },
  { month: '7월',  rsv25: 538,  crsv25: 381, cfr25: 70.8 },
  { month: '8월',  rsv25: 680,  crsv25: 369, cfr25: 54.3 },
  { month: '9월',  rsv25: 392,  crsv25: 264, cfr25: 67.3 },
  { month: '10월', rsv25: 408,  crsv25: 269, cfr25: 65.9 },
  { month: '11월', rsv25: 316,  crsv25: 215, cfr25: 68.0 },
  { month: '12월', rsv25: 418,  crsv25: 266, cfr25: 63.6 },
];

const data25 = DATA.filter(d => d.rsv25 !== undefined);
const data26 = DATA.filter(d => d.rsv26 !== undefined);

const totalRsv25  = data25.reduce((s, d) => s + d.rsv25, 0);
const totalRsv26  = data26.reduce((s, d) => s + (d.rsv26 ?? 0), 0);
const totalCrsv25 = data25.reduce((s, d) => s + d.crsv25, 0);
const totalCrsv26 = data26.reduce((s, d) => s + (d.crsv26 ?? 0), 0);

// 1~5월 기준 YoY 비교
const yoyRsv  = ((totalRsv26 - data25.slice(0,5).reduce((s,d) => s+d.rsv25, 0)) / data25.slice(0,5).reduce((s,d) => s+d.rsv25, 0) * 100).toFixed(1);
const yoyCrsv = ((totalCrsv26 - data25.slice(0,5).reduce((s,d) => s+d.crsv25, 0)) / data25.slice(0,5).reduce((s,d) => s+d.crsv25, 0) * 100).toFixed(1);
const avgCfr25_1to5 = parseFloat((data26.map((_,i) => DATA[i].cfr25).reduce((s,v) => s+v, 0) / data26.length).toFixed(1));
const avgCfr26      = parseFloat((data26.reduce((s,d) => s+(d.cfr26??0), 0) / data26.length).toFixed(1));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value;
  const rsv25 = get('rsv25'), crsv25 = get('crsv25'), cfr25 = get('cfr25');
  const rsv26 = get('rsv26'), crsv26 = get('crsv26'), cfr26 = get('cfr26');
  const yoy = rsv26 != null && rsv25 != null
    ? ((rsv26 - rsv25) / rsv25 * 100).toFixed(1)
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
        <span />
        <span className="text-center font-semibold text-blue-600">25년</span>
        <span className="text-center font-semibold text-orange-500">26년</span>

        <span className="text-slate-400">RSV</span>
        <span className="text-right">{rsv25 != null ? rsv25.toLocaleString() : '-'}</span>
        <span className="text-right">{rsv26 != null ? rsv26.toLocaleString() : '-'}</span>

        <span className="text-slate-400">CRSV</span>
        <span className="text-right">{crsv25 != null ? crsv25.toLocaleString() : '-'}</span>
        <span className="text-right">{crsv26 != null ? crsv26.toLocaleString() : '-'}</span>

        <span className="text-slate-400">CFR</span>
        <span className="text-right">{cfr25 != null ? `${cfr25}%` : '-'}</span>
        <span className="text-right">{cfr26 != null ? `${cfr26}%` : '-'}</span>
      </div>
      {yoy != null && (
        <div className={`mt-2 pt-2 border-t border-slate-100 text-center font-semibold ${Number(yoy) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          RSV YoY {Number(yoy) >= 0 ? '+' : ''}{yoy}%
        </div>
      )}
    </div>
  );
};

export default function BaliSeasonality() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-semibold text-slate-800">발리 예약 시즌성 · YoY 비교</h2>
          <p className="text-xs text-slate-400 mt-0.5">RSV 기준 · 발리 지역 전체 통합 · 26년은 1~5월 누적</p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 rounded px-2 py-1 font-semibold">2025 Full</span>
          <span className="text-[10px] bg-orange-50 border border-orange-100 text-orange-500 rounded px-2 py-1 font-semibold">2026 Jan~May</span>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          {
            label: 'RSV YoY (1~5월)',
            v25: `${data25.slice(0,5).reduce((s,d)=>s+d.rsv25,0).toLocaleString()}건`,
            v26: `${totalRsv26.toLocaleString()}건`,
            diff: yoyRsv,
          },
          {
            label: 'CRSV YoY (1~5월)',
            v25: `${data25.slice(0,5).reduce((s,d)=>s+d.crsv25,0).toLocaleString()}건`,
            v26: `${totalCrsv26.toLocaleString()}건`,
            diff: yoyCrsv,
          },
          {
            label: 'CFR 평균 (1~5월)',
            v25: `${avgCfr25_1to5}%`,
            v26: `${avgCfr26}%`,
            diff: (avgCfr26 - avgCfr25_1to5).toFixed(1),
          },
          {
            label: '26년 피크 (현재까지)',
            v25: '3월 400건',
            v26: '3월 600건',
            diff: '50.0',
          },
        ].map(({ label, v25, v26, diff }) => (
          <div key={label} className="rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">{label}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-blue-400">25년 {v25}</p>
                <p className="text-sm font-bold text-orange-500">26년 {v26}</p>
              </div>
              <span className={`text-sm font-bold ${Number(diff) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Number(diff) >= 0 ? '+' : ''}{diff}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={DATA} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="rsv"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={v => v.toLocaleString()}
          />
          <YAxis
            yAxisId="cfr"
            orientation="right"
            domain={[40, 80]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(val) =>
              val === 'rsv25'  ? 'RSV 2025' :
              val === 'rsv26'  ? 'RSV 2026' :
              val === 'cfr25'  ? 'CFR 2025' :
              val === 'cfr26'  ? 'CFR 2026' : val
            }
          />
          {/* 25년 RSV 바 */}
          <Bar yAxisId="rsv" dataKey="rsv25" fill="#bfdbfe" radius={[3,3,0,0]} barSize={14} />
          {/* 26년 RSV 바 */}
          <Bar yAxisId="rsv" dataKey="rsv26" fill="#f97316" radius={[3,3,0,0]} barSize={14} />
          {/* CFR 라인 */}
          <Line yAxisId="cfr" dataKey="cfr25" type="monotone" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 3 }} activeDot={{ r: 5 }} strokeDasharray="0" connectNulls />
          <Line yAxisId="cfr" dataKey="cfr26" type="monotone" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} activeDot={{ r: 5 }} strokeDasharray="5 3" connectNulls />
          <ReferenceLine yAxisId="rsv" x="5월" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '26년 집계 마감', position: 'top', fontSize: 9, fill: '#94a3b8' }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 인사이트 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          {
            tag: '26년 주목',
            color: 'orange',
            text: `3월 RSV 600건 (+50% YoY). 25년 3월 대비 급등. 이른 봄 수요 확대 또는 신규 물량 유입 확인 필요.`,
          },
          {
            tag: '5월 역전',
            color: 'red',
            text: `5월 26년 RSV 234건 vs 25년 518건. 큰 폭 감소(-54.8%). 황금연휴 구조 차이 또는 예약 시점 분산 가능성 검토.`,
          },
          {
            tag: '시즌 전망',
            color: 'blue',
            text: `25년 피크는 6~8월(655~680건). 26년 동 시기 데이터 확보 시 본격 시즌성 비교 가능. CFR은 비슷한 수준 유지.`,
          },
        ].map(({ tag, color, text }) => (
          <div key={tag} className={`rounded-lg bg-${color}-50 border border-${color}-100 px-3 py-2.5`}>
            <span className={`text-[10px] font-bold text-${color}-500 uppercase`}>{tag}</span>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
