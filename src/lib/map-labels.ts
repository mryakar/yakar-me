export interface Spot {
  x: number;
  y: number;
  weight: number;
  width: number;
  height: number;
}

export interface Arrangement {
  leader: number;
  side: 'right' | 'left' | null;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const MERGE_PX = 28;
export const LABEL_OFFSET = 20;
const DOT = 16;

const box = (x: number, y: number, width: number, height: number): Box => ({ left: x, top: y, right: x + width, bottom: y + height });
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function arrange(spots: Spot[], width: number): Arrangement[] {
  const result: Arrangement[] = spots.map((_, i) => ({ leader: i, side: null }));
  const leaders: number[] = [];
  for (const i of spots.map((_, i) => i).sort((a, b) => spots[b].weight - spots[a].weight)) {
    const near = leaders.find((l) => Math.hypot(spots[l].x - spots[i].x, spots[l].y - spots[i].y) < MERGE_PX);
    if (near === undefined) leaders.push(i);
    else result[i].leader = near;
  }
  const taken = leaders.map((l) => box(spots[l].x - DOT / 2, spots[l].y - DOT / 2, DOT, DOT));
  const free = (b: Box) => b.left >= 0 && b.right <= width && !taken.some((t) => overlaps(t, b));
  for (const l of leaders) {
    const { x, y, width: w, height: h } = spots[l];
    const sides = { right: box(x + LABEL_OFFSET, y - h / 2, w, h), left: box(x - LABEL_OFFSET - w, y - h / 2, w, h) };
    const side = free(sides.right) ? 'right' : free(sides.left) ? 'left' : null;
    result[l].side = side;
    if (side) taken.push(sides[side]);
  }
  return result;
}
