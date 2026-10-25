export interface Neighbours<T> {
  previous?: T;
  next?: T;
}

export function neighbours<T>(newestFirst: T[], isCurrent: (item: T) => boolean): Neighbours<T> {
  const i = newestFirst.findIndex(isCurrent);
  if (i === -1) return {};
  return { previous: newestFirst[i + 1], next: i > 0 ? newestFirst[i - 1] : undefined };
}

export const others = <T>(items: T[], shown: (item: T) => boolean, limit: number) =>
  items.filter((item) => !shown(item)).slice(0, limit);
