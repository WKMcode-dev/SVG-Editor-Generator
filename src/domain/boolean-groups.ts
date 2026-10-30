import * as G from './geometry';
import type { BooleanOperation, Point, Shape } from './models';

export function descendants(shapes: Shape[], id: string): Shape[] {
  const result: Shape[] = [],
    seen = new Set([id]);
  const visit = (parent: string) => {
    for (const child of shapes.filter((s) => s.booleanParent === parent)) {
      if (seen.has(child.id)) throw Error('Grupo booleano cíclico.');
      seen.add(child.id);
      result.push(child);
      visit(child.id);
    }
  };
  visit(id);
  return result;
}
export function effectiveHidden(shapes: Shape[], shape: Shape): boolean {
  const seen = new Set<string>();
  let current: Shape | undefined = shape;
  while (current) {
    if (current.hidden || seen.has(current.id)) return true;
    seen.add(current.id);
    current = shapes.find((s) => s.id === current!.booleanParent);
  }
  return false;
}
export function effectiveLocked(shapes: Shape[], shape: Shape): boolean {
  return (
    shape.locked === true ||
    (shape.booleanParent !== undefined &&
      shapes.some((s) => s.id === shape.booleanParent && effectiveLocked(shapes, s)))
  );
}
export function recompute(shapes: Shape[]): void {
  const done = new Set<string>(),
    visiting = new Set<string>();
  function evaluate(shape: Shape) {
    if (!shape.boolean || done.has(shape.id)) return;
    if (visiting.has(shape.id)) throw Error('Grupo booleano cíclico.');
    visiting.add(shape.id);
    const operands = shape.boolean.operands
      .map((id) => shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s);
    shape.boolean.operands = operands.map((s) => s.id);
    operands.forEach(evaluate);
    const visible = operands.filter((s) => !s.hidden && !s.booleanEmpty);
    const result = G.combine(shape.boolean.operation, visible);
    shape.booleanEmpty = result.length === 0;
    if (result.length) {
      shape.polygons = result;
      shape.points = result[0][0];
    } else if (operands.length) {
      const boxes = operands.map(G.bounds),
        x = Math.min(...boxes.map((b) => b.x)),
        y = Math.min(...boxes.map((b) => b.y));
      const w = Math.max(...boxes.map((b) => b.x + b.width)) - x,
        h = Math.max(...boxes.map((b) => b.y + b.height)) - y;
      shape.points = G.points('rectangle', x, y, Math.max(w, 1), Math.max(h, 1));
      delete shape.polygons;
    }
    visiting.delete(shape.id);
    done.add(shape.id);
  }
  shapes.forEach(evaluate);
}
export function createBoolean(
  shapes: Shape[],
  ids: Set<string>,
  operation: BooleanOperation,
  name: string,
): Shape {
  const operands = shapes.filter((s) => ids.has(s.id));
  if (!operands.length || operands.some((s) => !G.vectorShape(s)))
    throw Error('Selecione formas vetoriais fechadas.');
  if (new Set(operands.map((s) => s.booleanParent)).size > 1)
    throw Error('Selecione formas do mesmo grupo.');
  const parent = operands[0].booleanParent;
  const shape: Shape = {
    ...structuredClone(operands[0]),
    id: crypto.randomUUID(),
    name,
    type: 'custom',
    cut: 0,
    radius: 0,
    boolean: { operation, operands: operands.map((s) => s.id) },
    booleanEmpty: false,
  };
  delete shape.basePoints;
  delete shape.cornerRadii;
  delete shape.group;
  operands.forEach((s) => {
    s.booleanParent = shape.id;
    delete s.group;
  });
  if (parent) {
    const owner = shapes.find((s) => s.id === parent)!;
    let inserted = false;
    owner.boolean!.operands = owner.boolean!.operands.flatMap((id) => {
      if (!ids.has(id)) return [id];
      if (inserted) return [];
      inserted = true;
      return [shape.id];
    });
  }
  shapes.splice(shapes.indexOf(operands.at(-1)!) + 1, 0, shape);
  recompute(shapes);
  return shape;
}
const geometryKey = (shape: Shape) => JSON.stringify(shape.polygons || [[shape.points]]);
// Infer the affine transform applied to a result, so its source layers follow
// translations, dimensions, rotation and flips through the existing inspector.
function affine(before: Shape, after: Shape): ((p: Point) => Point) | null {
  const a = G.rings(before).flatMap((r) => r.points),
    b = G.rings(after).flatMap((r) => r.points);
  if (a.length !== b.length) return null;
  const distance = (p: Point) => Math.hypot(p[0] - a[0][0], p[1] - a[0][1]);
  let i = 1;
  for (let k = 2; k < a.length; k++) if (distance(a[k]) > distance(a[i])) i = k;
  const u = [a[i][0] - a[0][0], a[i][1] - a[0][1]];
  let j = 0,
    det = 0;
  for (let k = 1; k < a.length; k++) {
    const cross = u[0] * (a[k][1] - a[0][1]) - u[1] * (a[k][0] - a[0][0]);
    if (Math.abs(cross) > Math.abs(det)) {
      j = k;
      det = cross;
    }
  }
  if (Math.abs(det) < 1e-6) return null;
  const v = [a[j][0] - a[0][0], a[j][1] - a[0][1]];
  return (p) => {
    const dx = p[0] - a[0][0],
      dy = p[1] - a[0][1],
      t = (dx * v[1] - dy * v[0]) / det,
      q = (u[0] * dy - u[1] * dx) / det;
    return [
      G.round(b[0][0] + t * (b[i][0] - b[0][0]) + q * (b[j][0] - b[0][0])),
      G.round(b[0][1] + t * (b[i][1] - b[0][1]) + q * (b[j][1] - b[0][1])),
    ];
  };
}
export function createBooleanSynchronizer() {
  let previous = new Map<string, Shape>(),
    signature = '';
  const key = (s: Shape) =>
    JSON.stringify([
      s.id,
      s.booleanParent,
      s.boolean,
      s.booleanEmpty,
      s.hidden,
      s.radius,
      s.radiusUnit,
      s.cornerRadii,
      s.cut,
      s.basePoints,
      s.polygons || s.points,
    ]);
  return (shapes: Shape[]) => {
    const relevant = shapes.filter((s) => s.boolean || s.booleanParent);
    const nextSignature = relevant.map(key).join('|');
    if (nextSignature === signature) return;
    const visit = (shape: Shape) => {
      if (!shape.boolean) return;
      const old = previous.get(shape.id),
        children = descendants(shapes, shape.id);
      if (
        old &&
        geometryKey(old) !== geometryKey(shape) &&
        children.every(
          (s) => previous.has(s.id) && geometryKey(previous.get(s.id)!) === geometryKey(s),
        )
      ) {
        const transform = affine(old, shape);
        if (transform) children.forEach((s) => G.mapShape(s, transform));
      }
      shapes.filter((s) => s.booleanParent === shape.id).forEach(visit);
    };
    shapes.filter((s) => !s.booleanParent).forEach(visit);
    recompute(shapes);
    previous = new Map(
      shapes.filter((s) => s.boolean || s.booleanParent).map((s) => [s.id, structuredClone(s)]),
    );
    signature = shapes
      .filter((s) => s.boolean || s.booleanParent)
      .map(key)
      .join('|');
  };
}
