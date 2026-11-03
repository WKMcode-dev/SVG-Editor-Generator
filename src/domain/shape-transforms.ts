import * as G from './geometry';
import type { Shape } from './models';

/** Bake a shear around the shape center into its geometry, so SVG needs no transform attribute. */
export function skewShape(shape: Shape, axis: 0 | 1, degrees: number): void {
  if (shape.media) throw Error('Skew está disponível para formas vetoriais.');
  if (!Number.isFinite(degrees) || Math.abs(degrees) > 80)
    throw Error('Use inclinação entre -80° e 80°.');
  if (!degrees) return;
  if (
    !shape.boolean &&
    G.vectorShape(shape) &&
    shape.type !== 'ellipse' &&
    (shape.radius || shape.cornerRadii)
  ) {
    const polygons = G.combine('flatten', [shape]);
    if (!polygons.length) return;
    shape.polygons = polygons;
    shape.points = polygons[0][0];
    shape.radius = 0;
    delete shape.cornerRadii;
  }
  const box = G.bounds(shape),
    center = axis === 0 ? box.y + box.height / 2 : box.x + box.width / 2;
  const tangent = Math.tan((degrees * Math.PI) / 180);
  const rounded = (value: number) => G.round(value) || 0;
  G.mapShape(shape, ([x, y]) =>
    axis === 0
      ? [rounded(x + (y - center) * tangent), y]
      : [x, rounded(y + (x - center) * tangent)],
  );
  if (!['ellipse', 'line', 'arrow'].includes(shape.type)) shape.type = 'custom';
  shape.cut = 0;
  delete shape.basePoints;
}
