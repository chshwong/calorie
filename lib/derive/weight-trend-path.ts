/**
 * Build Fitbit-style path commands from a calendar-slot array of points.
 * - Ignores missing days (null entries)
 * - Connects consecutive measurement events (M then L...L)
 */
export function buildFitbitPathD(pointsByIndex: Array<{ x: number; y: number } | null>): string {
  const parts: string[] = [];
  for (const p of pointsByIndex) {
    if (!p) continue;
    const cmd = parts.length === 0 ? 'M' : 'L';
    parts.push(`${cmd} ${p.x} ${p.y}`);
  }
  return parts.join(' ');
}

