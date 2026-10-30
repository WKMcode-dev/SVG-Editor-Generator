import type { Point } from './models';
export interface AlignmentGuide {
  axis: number;
  source: Point;
  target: Point;
}
/** Distances are measured in screen pixels; candidate geometry is unsnapped. */
export function alignDelta(
  moving: Point[],
  targets: Point[],
  raw: Point,
  fallback: Point,
  zoom: number,
): { delta: Point; guides: AlignmentGuide[] } {
  const delta = [...fallback] as Point,
    guides: AlignmentGuide[] = [];
  for (const axis of [0, 1]) {
    let nearest = 6 / zoom,
      match: AlignmentGuide | undefined;
    const sorted = targets.slice().sort((a, b) => a[axis] - b[axis]);
    for (const source of moving) {
      const value = source[axis] + raw[axis];
      let low = 0,
        high = sorted.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (sorted[mid][axis] < value) low = mid + 1;
        else high = mid;
      }
      for (const index of [low - 1, low]) {
        const target = sorted[index];
        if (!target) continue;
        const distance = Math.abs(target[axis] - value);
        if (distance <= nearest) {
          nearest = distance;
          match = { axis, source, target };
        }
      }
    }
    if (match) {
      delta[axis] = match.target[axis] - match.source[axis];
      guides.push(match);
    }
  }
  return { delta, guides };
}
export function anchors(points: Point[]): Point[] {
  if (!points.length) return [];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return [
    ...points,
    [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
  ];
}
