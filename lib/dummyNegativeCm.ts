import { City, CITY_BQ_MAP, HotelNegativeCmRow } from './types';

const DUMMY_HOTELS: { gpid: string; hotelNm: string; city: string }[] = [
  { gpid: '1001', hotelNm: '발리 오션뷰 리조트', city: 'Bali' },
  { gpid: '1002', hotelNm: '신주쿠 그랜드 inn', city: 'Tokyo' },
  { gpid: '1003', hotelNm: '아사쿠사 료칸', city: 'Tokyo' },
  { gpid: '2001', hotelNm: '우붓 정글 빌라', city: 'Ubud' },
  { gpid: '2002', hotelNm: '도톤보리 스테이', city: 'Osaka' },
  { gpid: '3001', hotelNm: '꾸따 비치 호텔', city: 'Kuta' },


];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function generateDummyNegativeCm(
  startDate: string,
  endDate: string,
  city: City,
): HotelNegativeCmRow[] {
  const cityKeys = city !== '전체' ? CITY_BQ_MAP[city] : null;
  const hotels = cityKeys
    ? DUMMY_HOTELS.filter(h => cityKeys.includes(h.city))
    : DUMMY_HOTELS;

  const rows: HotelNegativeCmRow[] = [];
  let cur = startDate;
  while (cur <= endDate) {
    // 각 날짜마다 일부 호텔만 역마진 발생 (랜덤)
    const shuffle = [...hotels].sort(() => Math.random() - 0.5);
    const cnt = rand(1, Math.min(3, shuffle.length));
    for (let i = 0; i < cnt; i++) {
      const h = shuffle[i];
      const cgmv = rand(500_000, 5_000_000);
      const cm = -rand(50_000, 800_000);
      rows.push({
        basisDate: cur,
        gpid: h.gpid,
        hotelNm: h.hotelNm,
        city: h.city,
        crsvCnt: rand(1, 15),
        cgmv,
        cm,
        cmr: parseFloat(((cm / cgmv) * 100).toFixed(1)),
      });
    }
    cur = addDays(cur, 1);
  }

  return rows.sort((a, b) => {
    if (b.basisDate !== a.basisDate) return b.basisDate.localeCompare(a.basisDate);
    return a.cm - b.cm;
  });
}
