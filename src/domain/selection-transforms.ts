import * as G from './geometry';
import type { Bounds, Point, Shape } from './models';

export function selectionBounds(shapes: Shape[]): Bounds | null {
  if (!shapes.length) return null;
  const boxes = shapes.map(G.bounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/** Scale members and their spacing using one common selection box. */
export function resizeSelection(
  shapes: Shape[],
  width: number,
  height: number,
  origin?: Point,
): void {
  const box = selectionBounds(shapes);
  if (!box || !Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0)
    return;
  if (shapes.length === 1) {
    G.resize(shapes[0], width, height);
    if (origin)
      G.mapShape(shapes[0], ([x, y]) => [
        G.round(x + origin[0] - box.x),
        G.round(y + origin[1] - box.y),
      ]);
    return;
  }
  const sx = box.width ? width / box.width : 1;
  const sy = box.height ? height / box.height : 1;
  const [x, y] = origin || [box.x, box.y];
  for (const shape of shapes) {
    const b = G.bounds(shape);
    G.resize(shape, b.width * sx, b.height * sy);
    G.mapShape(shape, ([px, py]) => [
      G.round(px + x + (b.x - box.x) * sx - b.x),
      G.round(py + y + (b.y - box.y) * sy - b.y),
    ]);
  }
}

/** Rotate around a shared pivot while retaining ellipse's four editable anchors. */
export function rotateSelection(shapes: Shape[], degrees: number, pivot?: Point): void {
  if (!Number.isFinite(degrees) || shapes.some((s) => s.media)) return;
  const box = selectionBounds(shapes);
  if (!box) return;
  const [cx, cy] = pivot || [box.x + box.width / 2, box.y + box.height / 2];
  const angle = (degrees * Math.PI) / 180;
  for (const shape of shapes)
    G.mapShape(shape, ([x, y]) => [
      G.round(cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle)),
      G.round(cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle)),
    ]);
}

export function flipSelection(shapes: Shape[], axis: 0 | 1): void {
  const box = selectionBounds(shapes);
  if (!box) return;
  for (const shape of shapes) {
    G.mapShape(shape, ([x, y]) =>
      axis === 0
        ? [G.round(2 * box.x + box.width - x), y]
        : [x, G.round(2 * box.y + box.height - y)],
    );
    if (shape.media) {
      const key = axis === 0 ? 'flipX' : 'flipY';
      shape.media[key] = !shape.media[key];
    }
  }
}
