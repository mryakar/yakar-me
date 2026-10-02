export type Axis = 'x' | 'y';
export type Step = -1 | 0 | 1;

export const AXIS_PX = 10;
export const STEP_SHARE = 0.2;
export const STEP_SPEED = 0.4;
export const SLIDE_MS = 240;

export function swipeAxis(dx: number, dy: number): Axis | null {
  if (Math.hypot(dx, dy) < AXIS_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

export function swipeStep(dx: number, ms: number, width: number): Step {
  const far = Math.abs(dx) > width * STEP_SHARE;
  const fast = ms > 0 && Math.abs(dx) / ms > STEP_SPEED;
  if (dx === 0 || !(far || fast)) return 0;
  return dx < 0 ? 1 : -1;
}
