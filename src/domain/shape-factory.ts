import * as G from './geometry';
import type { Shape, ShapeType } from './models';
const names: Record<string, string> = {
  rectangle: 'Retângulo',
  ellipse: 'Elipse',
  line: 'Linha',
  arrow: 'Seta',
  star: 'Estrela',
  image: 'Imagem',
  video: 'Vídeo',
  triangle: 'Triângulo',
  hexagon: 'Hexágono',
  diamond: 'Losango',
};
export const make = (type: ShapeType): Shape => ({
  id: crypto.randomUUID(),
  type,
  name: names[type],
  points: G.points(
    type,
    200,
    140,
    type === 'rectangle' ? 400 : 200,
    type === 'line' || type === 'arrow' ? 0 : type === 'rectangle' ? 220 : 200,
  ),
  fill: '#d9d9d9',
  stroke: '#737373',
  strokeWidth: 1,
  opacity: 100,
  join: 'miter',
  cut: 0,
  noFill: type === 'line' || type === 'arrow',
});
