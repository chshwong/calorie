export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
};

export const arcPath = (
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  sweepFlag: 0 | 1 = 1
) => {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweepFlag} ${e.x} ${e.y}`;
};

export const cubicPoint = (
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
};
