import { bounds, mapShape, round } from '../domain/geometry';
import type { Bounds, Shape } from '../domain/models';

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export function selectionBounds(shapes: Shape[]): Bounds | null {
  if (!shapes.length) return null;
  const boxes = shapes.map(bounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}
export function translateSelection(shapes: Shape[], dx: number, dy: number): void {
  shapes.forEach((shape) => mapShape(shape, ([x, y]) => [round(x + dx), round(y + dy)]));
}
export function alignSelection(shapes: Shape[], alignment: Alignment, target?: Bounds): void {
  const box = target || selectionBounds(shapes);
  if (!box) return;
  shapes.forEach((shape) => {
    const b = bounds(shape);
    const dx =
      alignment === 'left'
        ? box.x - b.x
        : alignment === 'center'
          ? box.x + (box.width - b.width) / 2 - b.x
          : alignment === 'right'
            ? box.x + box.width - b.width - b.x
            : 0;
    const dy =
      alignment === 'top'
        ? box.y - b.y
        : alignment === 'middle'
          ? box.y + (box.height - b.height) / 2 - b.y
          : alignment === 'bottom'
            ? box.y + box.height - b.height - b.y
            : 0;
    translateSelection([shape], dx, dy);
  });
}
/** Move the selected block one level, preserving the order within it. */
export function reorderSelection(shapes: Shape[], selected: Set<string>, direction: 1 | -1): void {
  if (direction === 1) {
    for (let i = shapes.length - 2; i >= 0; i--) {
      if (selected.has(shapes[i].id) && !selected.has(shapes[i + 1].id))
        [shapes[i], shapes[i + 1]] = [shapes[i + 1], shapes[i]];
    }
  } else {
    for (let i = 1; i < shapes.length; i++) {
      if (selected.has(shapes[i].id) && !selected.has(shapes[i - 1].id))
        [shapes[i], shapes[i - 1]] = [shapes[i - 1], shapes[i]];
    }
  }
}
