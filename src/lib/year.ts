export const yearsDescending = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => last - i);

export function byMonth<T>(items: T[], month: (item: T) => number) {
  const months: T[][] = Array.from({ length: 12 }, () => []);
  for (const item of items) months[month(item)].push(item);
  return months;
}

export function peak<T>(rows: T[], value: (row: T) => number) {
  let best: T | undefined;
  for (const row of rows) if (value(row) > (best ? value(best) : 0)) best = row;
  return best;
}
