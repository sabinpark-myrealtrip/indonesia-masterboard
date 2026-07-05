'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { CityDetailUVData, Granularity } from '@/app/api/city-detail-uv/route';

const UTM_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'da',         label: 'DA (facebook·google)', color: '#2563EB' },
  { key: 'crm',        label: 'CRM (braze·kakao)',     color: '#059669' },
  { key: 'mktp',       label: 'MKT파트너',              color: '#D97706' },
  { key: 'instagram',  label: 'Instagram',              color: '#EC4899' },
  { key: 'naver_cafe', label: 'Naver Cafe',             color: '#10B981' },
  { key: 'sa',         label: 'SA',                     color: '#F97316' },
  { key: 'other',      label: '기타',                   color: '#7C3AED' },
  { key: 'unknown',    label: 'Unknown',                color: '#94A3B8' },
];

const TABS: { key: Granularity; label: string }[] = [
  { key: 'city',    label: '도시별' },
  { key: 'weekly',  label: '주별' },
  { key: 'monthly', label: '월별' },
];

function fmtNum(n: number) {
  return n.toLocaleString('ko-KR');
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-500">{p.name}</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-slate-800">{fmtNum(p.value)}</span>
            <span className="text-slate-400 ml-1">
              ({total > 0 ? ((p.value / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-400">합계</span>
        <span className="font-mono font-semibold text-slate-800">{fmtNum(total)}</span>
      </div>
    </div>
  );
};

export default function CityDetailUV({ month }: { month: string }) {
  const [granularity, setGranularity] = useState<Granularity>('city');
  const [data, setData] = useState<CityDetailUVData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/city-detail-uv?month=${month}&granularity=${granularity}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, granularity]);

  const rows = data?.cityRows ?? data?.periodRows ?? [];

  const chartData = rows.map((row: any) => ({
    name: row.city ?? row.label,
    'DA (facebook·google)': row.da,
    'CRM (braze·kakao)': row.crm,
    'MKT파트너': row.mktp,
    'Instagram': row.instagram,
    'Naver Cafe': row.naver_cafe,
    'SA': row.sa,
    '기타': row.other,
    'Unknown': row.unknown,
  }));

  const subtitle =
    granularity === 'city'    ? `${month} 누적 · 도시별` :
    granularity === 'weekly'  ? '최근 8주' :
                                '최근 6개월';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-slate-800">상세 UV · UTM 유입 비중</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {subtitle} · 프로퍼티 상세 페이지 방문 UV 기준
          </p>
        </div>
        {/* 토글 */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setGranularity(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                granularity === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              {UTM_CONFIG.map(u => (
                <Bar
                  key={u.key}
                  dataKey={u.label}
                  stackId="utm"
                  fill={u.color}
                  fillOpacity={0.85}
                  maxBarSize={60}
                  radius={u.key === 'unknown' ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
