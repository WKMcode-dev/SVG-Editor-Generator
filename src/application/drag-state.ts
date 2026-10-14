import type { Point, Shape, View } from '../domain/models';
interface SelectionSnapshot {
  selected: string | null;
  lastSelectedId: string | null;
  selectedIds: string[];
  selectedPoints: string[];
  selectedSegments: string[];
  activeRing: { p: number; r: number };
  vertex: number;
}
interface DragBase {
  pointer?: number;
  screen?: Point;
  moved?: boolean;
  before?: string;
}
export type DragState = DragBase &
  (
    | { kind: 'pan'; start: Point; view: View; shapes?: Shape[] }
    | { kind: 'resize'; corner: number; start: Point; shapes: Shape[] }
    | {
        kind: 'parts';
        start: Point;
        anchor: string;
        keys: string[];
        shapes: Shape[];
        toggle?: { kind: 'point' | 'segment'; key: string } | null;
        clickPoint?: string | null;
      }
    | { kind: 'shape'; start: Point; shapes: Shape[] }
    | {
        kind: 'marquee';
        start: Point;
        add: boolean;
        initial: string[];
        original: SelectionSnapshot;
        shapes?: Shape[];
      }
  );
