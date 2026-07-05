'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendRow, City } from '@/lib/types';

function fmtKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtDate(d: string) {
  return d.slice(5);
}

interface Props {
  trends: TrendRow[];
  color: string;
  city: City;
  dailyTarget?: { gmv?: number; cm?: number };
}

function MiniChart({
  data,
  dataKey,
  color,
  formatter,
  label,
  unit,
  targetValue,
}: {
  data: any[];
  dataKey: string;
  color: string;
  formatter: (v: number) => string;
  label: string;
  unit: string;
  targetValue?: number;
}) {
  const values = data.map(d => d[dataKey]);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // displayData는 이미 오늘(D-0) 제외 → 마지막 = D-1, 그 앞 = D-2
  const latest = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? latest;
  const delta = latest - prev;
  const deltaSign = delta >= 0 ? '+' : '';

  const CustomTooltip = ({ active, payload, label: lbl }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="text-slate-500 mb-1">{lbl}</p>
        <p className="font-semibold text-slate-800">{formatter(payload[0].value)}{unit}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-w-0">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {deltaSign}{formatter(delta)}{unit}
        </span>
      </div>
      <p className="text-lg font-bold text-slate-800 mb-3">{formatter(latest)}{unit}</p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={38}
            domain={[
              Math.min(min * 0.9, targetValue != null ? targetValue * 0.9 : Infinity),
              Math.max(max * 1.1, targetValue != null ? targetValue * 1.1 : -Infinity),
            ]}
            tickFormatter={formatter}
            tickCount={4}
          />
          <Tooltip content={<CustomTooltip />} />
          {targetValue != null && (
            <ReferenceLine
              y={targetValue}
              stroke="#ef4444"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `목표 ${formatter(targetValue)}${unit}`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: '#ef4444',
                fontWeight: 600,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendCharts({ trends, color, city, dailyTarget }: Props) {
  // 도시 필터 적용
  const filtered = city === '전체' ? trends : trends.filter(t => t.cityGroup === city);

  const byDate = new Map<string, { gmv: number; cm: number; uv: number; pcuv: number }>();
  for (const t of filtered) {
    const prev = byDate.get(t.basisDate) ?? { gmv: 0, cm: 0, uv: 0, pcuv: 0 };
    byDate.set(t.basisDate, {
      gmv: prev.gmv + t.gmv,
      cm: prev.cm + t.cm,
      uv: prev.uv + t.detailUv,
      pcuv: prev.pcuv + (t.purchaseCompleteUv ?? 0),
    });
  }

  const chartData = [...byDate.keys()].sort().map(d => {
    const row = byDate.get(d)!;
    return {
      date: fmtDate(d),
      gmv: row.gmv,
      cm: row.cm,
      uv: row.uv,
      // CVR = PURCHASE_COMPLETE_UV / DETAIL_UV (Redash #26250 기준)
      cvr: row.uv > 0 ? parseFloat(((row.pcuv / row.uv) * 100).toFixed(2)) : 0,
    };
  });

  if (chartData.length === 0) return null;

  // 오늘 데이터는 집계 미완성 → 어제까지만 표시
  const displayData = chartData.length > 1 ? chartData.slice(0, -1) : chartData;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">일별 추이</h2>
        <p className="text-xs text-slate-400">전일 대비 증감 표기</p>
      </div>
      <div className="flex gap-4">
        <MiniChart
          data={displayData}
          dataKey="gmv"
          color={color}
          formatter={fmtKrw}
          label="GMV"
          unit="원"
          targetValue={dailyTarget?.gmv}
        />
        <MiniChart
          data={displayData}
          dataKey="cm"
          color="#f59e0b"
          formatter={fmtKrw}
          label="CM"
          unit="원"
          targetValue={dailyTarget?.cm}
        />
        <MiniChart
          data={displayData}
          dataKey="uv"
          color="#6366f1"
          formatter={v => v.toLocaleString('ko-KR')}
          label="상세 UV"
          unit=""
        />
        <MiniChart
          data={displayData}
          dataKey="cvr"
          color="#10b981"
          formatter={v => v.toFixed(2)}
          label="CVR"
          unit="%"
        />
      </div>
    </div>
  );
}
