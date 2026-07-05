'use client';

import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { CityDistributionRow } from '@/lib/types';

const CITY_COORDS: Record<string, [number, number]> = {
  'Bali':             [-8.409,  115.188],
  'Canggu':           [-8.647,  115.131],
  'Denpasar':         [-8.670,  115.213],
  'Jimbaran':         [-8.782,  115.156],
  'Kuta':             [-8.722,  115.177],
  'Lembongan Island': [-8.688,  115.453],
  'Nusa Dua':         [-8.801,  115.232],
  'Penida Island':    [-8.746,  115.543],
  'Sanur':            [-8.690,  115.263],
  'Seminyak':         [-8.691,  115.161],
  'Ubud':             [-8.506,  115.263],
};

function fmtKrw(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

function markerColor(cmr: number): string {
  if (cmr >= 8)  return '#059669'; // 우수
  if (cmr >= 3)  return '#d97706'; // 보통
  if (cmr >= 0)  return '#9ca3af'; // 낮음
  return '#dc2626';                 // 역마진
}

interface Props {
  data: CityDistributionRow[];
  selectedCity: string | null;
  onSelectCity: (city: string) => void;
}

export default function BaliMap({ data, selectedCity, onSelectCity }: Props) {
  const maxRsv = Math.max(...data.map(d => d.rsv), 1);

  const mapped = data
    .filter(d => CITY_COORDS[d.city])
    .map(d => ({ ...d, coords: CITY_COORDS[d.city] }));

  return (
    <MapContainer
      center={[-8.65, 115.22]}
      zoom={10}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {mapped.map(d => {
        const radius = 10 + (d.rsv / maxRsv) * 32;
        const isSelected = selectedCity === d.city;
        const color = markerColor(d.cmr);

        return (
          <CircleMarker
            key={d.city}
            center={d.coords}
            radius={radius}
            pathOptions={{
              color:       isSelected ? '#1e40af' : color,
              fillColor:   color,
              fillOpacity: 0.65,
              weight:      isSelected ? 3 : 1.5,
              opacity:     1,
            }}
            eventHandlers={{ click: () => onSelectCity(d.city) }}
          >
            <Tooltip permanent={d.rsv > maxRsv * 0.15} direction="top" offset={[0, -radius]}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{d.city}</span>
              <br />
              <span style={{ fontSize: 11 }}>RSV {d.rsv.toLocaleString()}건</span>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180, fontSize: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{d.city}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['RSV',  `${d.rsv.toLocaleString()}건`],
                      ['CRSV', `${d.crsv.toLocaleString()}건`],
                      ['CFR',  `${d.cfr}%`],
                      ['CGMV', `${fmtKrw(d.cgmv)}원`],
                      ['CM',   `${fmtKrw(d.cm)}원`],
                      ['CMR',  `${d.cmr}%`],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 2 }}>{k}</td>
                        <td style={{ fontWeight: 600, textAlign: 'right' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => onSelectCity(d.city)}
                  style={{
                    marginTop: 8, width: '100%', padding: '4px 0',
                    background: '#059669', color: '#fff', border: 'none',
                    borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  }}
                >
                  탑 호텔 보기 →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
