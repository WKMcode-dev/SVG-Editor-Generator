import * as G from './geometry';
import type { Shape, ShapeType } from './models';
const names: Record<string, string> = {
  rectangle: 'Retângulo',
  triangle: 'Triângulo',
  hexagon: 'Hexágono',
  diamond: 'Losango',
};
export const make = (type: ShapeType): Shape => ({
  id: crypto.randomUUID(),
  type,
  name: names[type],
  points: G.points(type),
  fill: '#222427',
  stroke: '#ff9b20',
  strokeWidth: 2,
  opacity: 100,
  join: 'miter',
  cut: 0,
  noFill: false,
});
