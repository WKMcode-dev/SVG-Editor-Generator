import { descendants, effectiveLocked } from './boolean-groups';
import type { Shape } from './models';

/** Reorder sibling packets without reparenting regular or boolean groups. */
export function reorderLayers(
  shapes: Shape[],
  sourceIds: string[],
  targetIds: string[],
  above: boolean,
): Shape[] {
  let sources = shapes.filter((shape) => sourceIds.includes(shape.id));
  let targets = shapes.filter((shape) => targetIds.includes(shape.id));
  if (!sources.length || !targets.length || sources.some((shape) => effectiveLocked(shapes, shape)))
    return shapes;
  const parent = sources[0].booleanParent;
  if ([...sources, ...targets].some((shape) => shape.booleanParent !== parent)) return shapes;
  // Between regular groups, move the full packet so the layer tree and paint order agree.
  const sourceGroup = sources[0].group?.id,
    targetGroup = targets[0].group?.id;
  if (!parent && sourceGroup !== targetGroup) {
    if (sourceGroup)
      sources = shapes.filter((shape) => shape.group?.id === sourceGroup && !shape.booleanParent);
    if (targetGroup)
      targets = shapes.filter((shape) => shape.group?.id === targetGroup && !shape.booleanParent);
  }
  if (sources.some((shape) => effectiveLocked(shapes, shape))) return shapes;
  const moving = new Set(
    sources.flatMap((shape) => [
      shape.id,
      ...descendants(shapes, shape.id).map((child) => child.id),
    ]),
  );
  const targetPacket = new Set(
    targets.flatMap((shape) => [
      shape.id,
      ...descendants(shapes, shape.id).map((child) => child.id),
    ]),
  );
  if ([...targetPacket].some((id) => moving.has(id))) return shapes;
  const remainder = shapes.filter((shape) => !moving.has(shape.id));
  const positions = remainder.flatMap((shape, index) =>
    targetPacket.has(shape.id) ? [index] : [],
  );
  if (!positions.length) return shapes;
  const insertion = above ? Math.max(...positions) + 1 : Math.min(...positions);
  const result = [
    ...remainder.slice(0, insertion),
    ...shapes.filter((shape) => moving.has(shape.id)),
    ...remainder.slice(insertion),
  ];
  if (parent) {
    const owner = result.find((shape) => shape.id === parent);
    if (owner?.boolean)
      owner.boolean.operands = result
        .filter((shape) => shape.booleanParent === parent)
        .map((shape) => shape.id);
  }
  return result;
}
