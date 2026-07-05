import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: '인도네시아 마스터보드',
  description: '마이리얼트립 인도네시아 숙소 성과 대시보드',
  icons: { icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🇮🇩</text></svg>' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
