import { TopSellingRow, TOPSELLING_CITIES } from './types';

const CITY_LIST = TOPSELLING_CITIES.filter(c => c !== '전체');
const HOTEL_PREFIXES: Record<string, string[]> = {
  발리: ['우붓', '꾸따', '스미냑', '짐바란', '누사두아'],
  교토: ['기온', '아라시야마', '후시미', '니조', '히가시야마'],
  미야코지마: ['히라라', '마에하마', '이라부', '시모지', '우에노'],
  이시가키: ['이시가키항', '카비라만', '야에야마', '미나사', '오시마'],
  유후인: ['유노쓰보', '킨린코', '유후다케', '이케', '마부'],
};

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

export function generateTopSellingDummy(city?: string): TopSellingRow[] {
  const isAll = !city || city === '전체';
  const citiesToGenerate = isAll ? CITY_LIST : [city];
  const cityGmvBase: Record<string, number> = {
    발리: 24_000_000_000,
    교토: 5_000_000_000, 미야코지마: 2_000_000_000, 이시가키: 1_800_000_000, 유후인: 1_200_000_000,
  };

  const allRows: TopSellingRow[] = [];

  for (const c of citiesToGenerate) {
    const cityTotalGmv = cityGmvBase[c] ?? rand(1_000_000_000, 5_000_000_000);
    const prefixes = HOTEL_PREFIXES[c] ?? ['호텔'];

    for (let rank = 1; rank <= 100; rank++) {
      const share = rank === 1 ? rand(4, 8) : rand(0.1, 4 / rank);
      const gmv = Math.round(cityTotalGmv * (share / 100));
      const cm = Math.round(gmv * rand(0.025, 0.06));
      const prefix = prefixes[rank % prefixes.length];

      allRows.push({
        gpid: String(10000 + Math.floor(rand(1000, 99000))),
        hotelNm: `${prefix} ${['호텔', '리조트', 'inn', '스테이', '비즈니스호텔'][rank % 5]} ${rank}`,
        city: c,
        gmv,
        cm,
        gmvShare: parseFloat(share.toFixed(1)),
        rank: isAll ? 0 : rank,
        rsv: Math.round(rand(5, 200)),
        rn: Math.round(rand(10, 600)),
      });
    }
  }

  if (isAll) {
    // 전체: global GMV 기준 상위 100개 재랭킹
    allRows.sort((a, b) => b.gmv - a.gmv);
    return allRows.slice(0, 100).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  return allRows;
}
