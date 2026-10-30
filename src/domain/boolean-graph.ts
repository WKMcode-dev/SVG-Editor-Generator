import type { Shape } from './models';
export function booleanSources(shapes: Shape[], parent: string): Shape[] {
  const result: Shape[] = [],
    seen = new Set([parent]);
  const visit = (id: string) =>
    shapes
      .filter((s) => s.booleanParent === id)
      .forEach((s) => {
        if (seen.has(s.id)) return;
        seen.add(s.id);
        result.push(s);
        visit(s.id);
      });
  visit(parent);
  return result;
}
export function validBooleanGraph(shapes: Shape[]): boolean {
  if (shapes.some((s) => !s || typeof s !== 'object' || typeof s.id !== 'string')) return false;
  const ids = new Map(shapes.map((s) => [s.id, s]));
  for (const shape of shapes) {
    if (shape.booleanEmpty !== undefined && typeof shape.booleanEmpty !== 'boolean') return false;
    if (
      shape.booleanParent !== undefined &&
      (typeof shape.booleanParent !== 'string' ||
        !ids.get(shape.booleanParent)?.boolean?.operands?.includes(shape.id))
    )
      return false;
    if (shape.boolean) {
      const b = shape.boolean;
      if (
        !['union', 'difference', 'intersection', 'xor', 'flatten'].includes(b.operation) ||
        !Array.isArray(b.operands) ||
        b.operands.length > 100 ||
        new Set(b.operands).size !== b.operands.length
      )
        return false;
      if (
        b.operands.some((id) => typeof id !== 'string' || ids.get(id)?.booleanParent !== shape.id)
      )
        return false;
    }
    const seen = new Set<string>();
    let current: Shape | undefined = shape;
    while (current?.booleanParent) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      current = ids.get(current.booleanParent);
    }
  }
  return true;
}
