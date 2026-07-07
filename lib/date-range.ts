/** sync 스크립트와 API 라우트가 동일한 캐시 키를 만들도록 공유하는 날짜 범위 계산. */
export function daysAgoRange(days: number): [string, string] {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return [fmt(start), fmt(end)];
}
