export type Point = [number, number];
export type Ring = Point[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];
export type ShapeType =
  | 'rectangle'
  | 'triangle'
  | 'hexagon'
  | 'diamond'
  | 'custom'
  | 'panel'
  | 'tag';
export type RadiusUnit = 'px' | '%';
export type BooleanOperation = 'union' | 'difference' | 'intersection' | 'xor' | 'flatten';
export interface CornerRadius {
  value: number;
  unit: RadiusUnit;
}
export interface Shape {
  id: string;
  name: string;
  type: ShapeType;
  points: Ring;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  join: 'miter' | 'round' | 'bevel';
  cut: number;
  noFill?: boolean;
  polygons?: MultiPolygon;
  basePoints?: Ring;
  radius?: number;
  radiusUnit?: RadiusUnit;
  cornerRadii?: Record<string, CornerRadius>;
  regeneratePath?: boolean;
}
export interface RingReference {
  p: number;
  r: number;
  points: Ring;
}
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PointHit {
  distance: number;
  index: number;
  point: Point;
}
export interface EdgeHit extends PointHit {}
export interface GridSettings {
  visible: boolean;
  magnet: boolean;
  type: 'lines' | 'dots';
  cell: number;
  stepX: number;
  stepY: number;
  originX: number;
  originY: number;
}
export interface Workspace {
  html: string | null;
  css: string | null;
  theme: string;
  autoRepair: boolean;
}
export interface Project {
  version: 1;
  shapes: Shape[];
  grid?: GridSettings;
  background?: 'light' | 'dark';
  lastSelectedId?: string | null;
  workspace?: Workspace;
}
export interface ValidationResult {
  valid: boolean;
  message?: string;
  line?: number;
}
export type CodeTab = 'svg' | 'html' | 'css' | 'preview';
export type Tool = 'select' | 'lines' | 'hand';
export interface View {
  x: number;
  y: number;
  z: number;
}
