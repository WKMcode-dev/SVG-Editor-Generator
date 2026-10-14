import { createRenderer, el } from '../ui/editor-renderer';
import { parseCode as parseSvg } from './svg-parser';
import * as G from '../domain/geometry';
import type {
  Shape,
  ShapeType,
  Point,
  Ring,
  GridSettings,
  Workspace,
  Project,
  RadiusUnit,
  BooleanOperation,
  EdgeHit,
  RingReference,
  View,
  Tool,
} from '../domain/models';
import { element as $, errorMessage, formControl, trackFormEditing } from '../ui/dom';
import { ProjectStorage } from '../infrastructure/project-storage';
import { desktopBridge } from '../infrastructure/desktop-bridge';
import type { DragState } from './drag-state';
const storage = new ProjectStorage(localStorage);
trackFormEditing();
import { make } from '../domain/shape-factory';
let shapes: Shape[] = [make('rectangle')];
let selected: string | null = shapes[0].id,
  vertex = 0;
let history: string[] = [],
  future: string[] = [];
let selectedIds = new Set<string>([selected!]),
  selectedEdges = new Set<string>(),
  activeRing = { p: 0, r: 0 },
  background: 'light' | 'dark' = 'dark';
let selectedPoints = new Set<string>(),
  selectedSegments = new Set<string>();
let lastSelectedId: string | null = selected;
let view: View = { x: 0, y: 0, z: 1 },
  mode: Tool = 'select',
  space = false;
let drag: DragState | null = null;
let grid: GridSettings = {
  visible: true,
  magnet: true,
  type: 'lines',
  cell: 24,
  stepX: 1,
  stepY: 1,
  originX: 0,
  originY: 0,
};
let editingCode = false,
  codeTimer: ReturnType<typeof setTimeout> | null = null,
  codeInvalid = false,
  lastCodeGeometry = '';
let shiftHeld = false;
window.addEventListener('keydown', (e) => {
  shiftHeld = e.shiftKey;
});
window.addEventListener('keyup', (e) => {
  shiftHeld = e.shiftKey;
});
window.addEventListener('blur', () => {
  shiftHeld = false;
});
let workspaceFiles: Workspace = { html: null, css: null, theme: 'orange-night', autoRepair: true };
function restoreGrid(saved: GridSettings | undefined) {
  if (
    !saved ||
    !['lines', 'dots'].includes(saved.type) ||
    !(['cell', 'stepX', 'stepY'] as const).every(
      (k) => Number.isFinite(saved[k]) && saved[k] >= 0.1 && saved[k] <= 200,
    ) ||
    !(['originX', 'originY'] as const).every(
      (k) => Number.isFinite(saved[k]) && Math.abs(saved[k]) <= 1000,
    )
  )
    return;
  grid = {
    visible: saved.visible !== false,
    magnet: saved.magnet !== false,
    type: saved.type,
    cell: saved.cell,
    stepX: saved.stepX,
    stepY: saved.stepY,
    originX: saved.originX,
    originY: saved.originY,
  };
}
try {
  const saved = storage.load();
  if (G.valid(saved)) {
    shapes = saved.shapes.map(G.normalize);
    selected = shapes.find((s) => s.id === saved.lastSelectedId)?.id || shapes[0]?.id || null;
    lastSelectedId = selected;
    selectedIds = new Set(selected ? [selected] : []);
  }
  if (saved?.background === 'light') background = 'light';
  restoreGrid(saved?.grid);
  if (
    saved?.workspace &&
    typeof saved.workspace.html === 'string' &&
    typeof saved.workspace.css === 'string' &&
    saved.workspace.html.length < 2000000 &&
    saved.workspace.css.length < 2000000
  )
    workspaceFiles = saved.workspace;
} catch {}
document.querySelector('main')!.append($('dialog'));
const current = () => shapes.find((s) => s.id === selected);
const currentPoints = () =>
  G.rings(current()!).find((t) => t.p === activeRing.p && t.r === activeRing.r)?.points ||
  current()!.points;
const state = () =>
  JSON.stringify({
    shapes,
    selected,
    vertex,
    grid,
    background,
    lastSelectedId,
    selectedIds: [...selectedIds],
    selectedEdges: [...selectedEdges],
    selectedPoints: [...selectedPoints],
    selectedSegments: [...selectedSegments],
    activeRing,
  });
const project = (): Project => ({
  version: 1,
  shapes,
  grid,
  background,
  lastSelectedId,
  workspace: workspaceFiles,
});
const partKey = (id: string | null, p: number, r: number, i: number) =>
  JSON.stringify([id, p, r, i]);
function clearParts() {
  selectedEdges = new Set();
  selectedPoints.clear();
  selectedSegments.clear();
}
function pointRef(key: string, list: Shape[] = shapes) {
  const [id, p, r, i] = JSON.parse(key),
    shape = list.find((s) => s.id === id),
    ring = shape && G.rings(shape).find((t) => t.p === p && t.r === r);
  return ring && i >= 0 && i < ring.points.length
    ? { shape, ring, i, point: ring.points[i] }
    : null;
}
function partialIds() {
  selectedIds = new Set([...selectedPoints, ...selectedSegments].map((k) => JSON.parse(k)[0]));
  if (!selectedIds.has(selected!)) selected = [...selectedIds][0] || null;
  if (selected) {
    lastSelectedId = selected;
    const key = [...selectedPoints, ...selectedSegments].find((k) => JSON.parse(k)[0] === selected);
    if (key) {
      const [, p, r, i] = JSON.parse(key);
      activeRing = { p, r };
      vertex = i;
    }
  }
}
function allSelectedPoints() {
  const keys = new Set(selectedPoints);
  selectedSegments.forEach((key) => {
    const ref = pointRef(key);
    if (ref) {
      const [id, p, r, i] = JSON.parse(key);
      keys.add(key);
      keys.add(partKey(id, p, r, (i + 1) % ref.ring.points.length));
    }
  });
  return keys;
}
function moveParts(keys: Set<string>, delta: Point, list: Shape[] = shapes) {
  const touched = new Set<Shape>();
  keys.forEach((key) => {
    const ref = pointRef(key, list);
    if (ref) {
      ref.ring.points[ref.i] = ref.point.map((n, axis) => G.round(n + delta[axis])) as Point;
      touched.add(ref.shape);
    }
  });
  touched.forEach((s) => {
    G.normalize(s);
    dirty(s);
  });
}

const { render, camera, syncGrid } = createRenderer({
  get history() {
    return history;
  },
  get future() {
    return future;
  },
  selectShape,
  get shapes() {
    return shapes;
  },
  set shapes(value) {
    shapes = value;
  },
  get selected() {
    return selected;
  },
  set selected(value) {
    selected = value;
  },
  get vertex() {
    return vertex;
  },
  set vertex(value) {
    vertex = value;
  },
  get selectedIds() {
    return selectedIds;
  },
  set selectedIds(value) {
    selectedIds = value;
  },
  get selectedPoints() {
    return selectedPoints;
  },
  set selectedPoints(value) {
    selectedPoints = value;
  },
  get selectedSegments() {
    return selectedSegments;
  },
  set selectedSegments(value) {
    selectedSegments = value;
  },
  get selectedEdges() {
    return selectedEdges;
  },
  set selectedEdges(value) {
    selectedEdges = value;
  },
  get activeRing() {
    return activeRing;
  },
  set activeRing(value) {
    activeRing = value;
  },
  get background() {
    return background;
  },
  set background(value) {
    background = value;
  },
  get view() {
    return view;
  },
  set view(value) {
    view = value;
  },
  get grid() {
    return grid;
  },
  set grid(value) {
    grid = value;
  },
  get editingCode() {
    return editingCode;
  },
  set editingCode(value) {
    editingCode = value;
  },
  get codeInvalid() {
    return codeInvalid;
  },
  set codeInvalid(value) {
    codeInvalid = value;
  },
  get lastCodeGeometry() {
    return lastCodeGeometry;
  },
  set lastCodeGeometry(value) {
    lastCodeGeometry = value;
  },
  current,
  currentPoints,
  allSelectedPoints,
  pointRef,
  codeStatus,
  partKey,
});
function selectShape(id: string, multiple = false) {
  if (multiple) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
  } else selectedIds = new Set([id]);
  selected = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
  if (selected) lastSelectedId = selected;
  clearParts();
  activeRing = { p: 0, r: 0 };
  vertex = 0;
  persist();
}
function clearSelection() {
  selected = null;
  selectedIds.clear();
  clearParts();
  activeRing = { p: 0, r: 0 };
  vertex = 0;
}
function persist() {
  try {
    storage.save(project());
  } catch {
    toast('Armazenamento local indisponível. Salve o projeto.');
  }
}
function commit(before: string) {
  if (before !== state()) {
    history.push(before);
    if (history.length > 100) history.shift();
    future = [];
    persist();
  }
  render();
}
function change(fn: () => void) {
  const before = state();
  fn();
  commit(before);
}
function restore(stack: string[], other: string[]) {
  if (!stack.length) return;
  other.push(state());
  const d = JSON.parse(stack.pop()!);
  shapes = d.shapes.map(G.normalize);
  selected = d.selected;
  vertex = d.vertex;
  grid = d.grid;
  background = d.background || 'dark';
  lastSelectedId = d.lastSelectedId || selected;
  selectedIds = new Set(d.selectedIds || (selected ? [selected] : []));
  selectedEdges = new Set(d.selectedEdges || []);
  activeRing = d.activeRing || { p: 0, r: 0 };
  selectedPoints = new Set(d.selectedPoints || []);
  selectedSegments = new Set(d.selectedSegments || []);
  persist();
  render();
}

function fit() {
  const r = $('canvas').getBoundingClientRect();
  view.z = Math.max(0.15, Math.min(1.5, (r.width - 80) / 800, (r.height - 100) / 500));
  view.x = (r.width - 800 * view.z) / 2;
  view.y = (r.height - 500 * view.z) / 2;
  render();
}
function local(e: { clientX: number; clientY: number }) {
  const r = $('canvas').getBoundingClientRect();
  return [(e.clientX - r.left - view.x) / view.z, (e.clientY - r.top - view.y) / view.z] as Point;
}
function snap(n: number, axis: number) {
  const step = axis ? grid.stepY : grid.stepX,
    origin = axis ? grid.originY : grid.originX;
  return G.round(grid.magnet ? origin + Math.round((n - origin) / step) * step : n);
}
function shiftCornerIndexes(s: Shape, p: number, r: number, index: number, remove: boolean) {
  if (!s.cornerRadii) return;
  const next: NonNullable<Shape['cornerRadii']> = {};
  Object.entries(s.cornerRadii).forEach(([key, value]) => {
    let [a, b, i] = key.split(':').map(Number);
    if (a === p && b === r) {
      if (remove && i === index) return;
      if (i >= index) i += remove ? -1 : 1;
    }
    next[[a, b, i].join(':')] = value;
  });
  s.cornerRadii = next;
}
function dirty(s: Shape) {
  delete s.basePoints;
  s.cut = 0;
  s.type = 'custom';
}
function setCornerRadius(convert = false) {
  change(() => {
    const unit = $('radiusUnit').value as RadiusUnit,
      n = Number($('radius').value);
    if (!Number.isFinite(n)) return;
    const keys = allSelectedPoints().size
      ? allSelectedPoints()
      : new Set(current() ? [partKey(selected, activeRing.p, activeRing.r, vertex)] : []);
    keys.forEach((key) => {
      const ref = pointRef(key);
      if (!ref) return;
      const s = ref.shape,
        k = JSON.parse(key).slice(1).join(':'),
        old = s.cornerRadii?.[k] || { value: s.radius || 0, unit: s.radiusUnit || 'px' },
        b = G.bounds(s),
        factor = Math.min(b.width, b.height) / 100 || 1;
      const value = convert
        ? (old.value * (old.unit === '%' ? factor : 1)) / (unit === '%' ? factor : 1)
        : n;
      s.cornerRadii ||= {};
      s.cornerRadii[k] = {
        value: G.round(Math.max(0, Math.min(unit === '%' ? 50 : 10000, value))),
        unit,
      };
    });
  });
}
$('radius').onchange = () => setCornerRadius();
$('radiusUnit').onchange = () => setCornerRadius(true);
document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(
  (b) =>
    (b.onclick = () =>
      change(() => {
        if (shapes.length >= 100) return toast('Limite de 100 formas.');
        const s = make(b.dataset.type as ShapeType);
        shapes.push(s);
        selectShape(s.id);
      })),
);
(['name', 'fill', 'stroke', 'strokeWidth', 'opacity', 'join', 'noFill'] as const).forEach(
  (k) =>
    ($(k).onchange = () =>
      change(() => {
        const s = current();
        if (!s) return;
        let v: string | boolean | number = k === 'noFill' ? $(k).checked : $(k).value;
        if (['opacity', 'strokeWidth'].includes(k))
          v = Math.max(0, Math.min(k === 'opacity' ? 100 : 30, Number(v) || 0));
        if (k === 'noFill') s.noFill = Boolean(v);
        else if (k === 'opacity' || k === 'strokeWidth') s[k] = Number(v);
        else if (k === 'join') s.join = String(v) as Shape['join'];
        else s[k] = String(v);
      })),
);
$('cut').onchange = () =>
  change(() => {
    const s = current();
    if (!s) return;
    if ((s.basePoints || s.points).length > 500 && +$('cut').value > 0) {
      toast('O recorte excederia o limite de 1.000 vértices.');
      return;
    }
    s.basePoints ||= structuredClone(s.points);
    s.cut = +$('cut').value;
    s.points = G.bevel(s.basePoints, s.cut);
    delete s.cornerRadii;
    vertex = 0;
    clearParts();
  });
$('point').onchange = () => {
  vertex = +$('point').value;
  clearParts();
  render();
};
$('contour').onchange = () => {
  const [p, r] = $('contour').value.split(':').map(Number);
  activeRing = { p, r };
  vertex = 0;
  clearParts();
  render();
};
(['shapeWidth', 'shapeHeight'] as const).forEach(
  (id) =>
    ($(id).onchange = () =>
      change(() => {
        const s = current();
        if (!s) return;
        const b = G.bounds(s),
          n = Number(formControl(id).value);
        if (!Number.isFinite(n) || n < 1 || n > 10000) return;
        let w = id === 'shapeWidth' ? n : b.width,
          h = id === 'shapeHeight' ? n : b.height;
        if ($('lockRatio').checked || shiftHeld) {
          if (id === 'shapeWidth') h = G.round((b.height * n) / b.width);
          else w = G.round((b.width * n) / b.height);
        }
        if (w < 1 || h < 1 || w > 10000 || h > 10000)
          return toast('Dimensões devem ficar entre 1 e 10.000 px.');
        G.resize(s, w, h);
        clearParts();
      })),
);
(['px', 'py'] as const).forEach(
  (id, axis) =>
    ($(id).onchange = () =>
      change(() => {
        const s = current(),
          n = Number(formControl(id).value);
        if (s && Number.isFinite(n) && Math.abs(n) < 100000) {
          currentPoints()[vertex][axis] = n;
          dirty(s);
        }
      })),
);
$('remove').onclick = () =>
  change(() => {
    const s = current();
    if (s && currentPoints().length > 3) {
      shiftCornerIndexes(s, activeRing.p, activeRing.r, vertex, true);
      currentPoints().splice(vertex, 1);
      clearParts();
      dirty(s);
    }
  });
$('duplicate').onclick = () =>
  change(() => {
    if (!current() || shapes.length + selectedIds.size > 100) return;
    const copies = shapes
      .filter((s) => selectedIds.has(s.id))
      .map((item) => {
        const s = G.normalize(structuredClone(item));
        s.id = crypto.randomUUID();
        s.name = (s.name + ' cópia').slice(0, 80);
        G.mapShape(s, (p) => p.map((n) => n + 24) as Point);
        return s;
      });
    shapes.push(...copies);
    selectShape(copies.at(-1)!.id);
    selectedIds = new Set(copies.map((s) => s.id));
  });
$('delete').onclick = () =>
  change(() => {
    shapes = shapes.filter((s) => !selectedIds.has(s.id));
    clearSelection();
  });
$('undo').onclick = () => restore(history, future);
$('redo').onclick = () => restore(future, history);
function tool(v: Tool) {
  mode = v;
  $('select').classList.toggle('active', v === 'select');
  $('lineSelect').classList.toggle('active', v === 'lines');
  $('hand').classList.toggle('active', v === 'hand');
  $('canvas').style.cursor = v === 'hand' ? 'grab' : 'default';
}
$('select').onclick = () => tool('select');
$('hand').onclick = () => tool('hand');
$('lineSelect').onclick = () => tool('lines');
function nearestRing(s: Shape, p: Point) {
  let best: (EdgeHit & RingReference) | null = null;
  G.rings(s).forEach((ring) => {
    const edge = G.nearest(ring.points, p);
    if (!best || edge.distance < best.distance)
      best = { ...edge, p: ring.p, r: ring.r, points: ring.points };
  });
  return best!;
}
// Only visible point controls participate; do not pick a hidden point behind another shape.
function nearestHandle(p: Point) {
  const handles = [...$('handles').children];
  const hit = G.nearestPoint(
    handles.map((node) => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))]),
    p,
    8 / view.z,
  );
  return hit ? (handles[hit.index] as SVGCircleElement) : null;
}
$('canvas').onpointerdown = (e) => {
  const targetNode = e.target as SVGElement;
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  const p = local(e),
    add = e.shiftKey || e.ctrlKey || e.metaKey;
  const pointTarget = targetNode.hasAttribute('data-point')
    ? targetNode
    : !e.altKey
      ? nearestHandle(p)
      : null;
  if (mode === 'hand' || space || e.button === 1)
    drag = { kind: 'pan', start: [e.clientX, e.clientY], view: { ...view } };
  else if (targetNode.hasAttribute('data-resize') && current()) {
    const saved = G.normalize(structuredClone(current()!));
    drag = {
      kind: 'resize',
      corner: Number(targetNode.dataset.resize),
      start: p,
      shapes: [saved],
      before: state(),
    };
  } else if (pointTarget) {
    const id = pointTarget.dataset.shape!,
      [rp, rr] = pointTarget.dataset.ring!.split(':').map(Number),
      i = Number(pointTarget.dataset.point),
      key = partKey(id, rp, rr, i),
      was = allSelectedPoints().has(key);
    if (!was) {
      if (!add) clearParts();
      selectedPoints.add(key);
    }
    selected = id;
    activeRing = { p: rp, r: rr };
    vertex = i;
    partialIds();
    drag = {
      kind: 'parts',
      start: p,
      anchor: key,
      keys: [...allSelectedPoints()],
      shapes: shapes
        .filter((s) => selectedIds.has(s.id))
        .map((s) => G.normalize(structuredClone(s))),
      before: state(),
      toggle: add && was ? { kind: 'point', key } : null,
      clickPoint: !add ? key : null,
    };
  } else if (targetNode.hasAttribute('data-id')) {
    const id = targetNode.dataset.id!,
      target = shapes.find((s) => s.id === id)!,
      edge = nearestRing(target, p);
    if (!e.altKey && edge.distance <= Math.max(9 / view.z, target.strokeWidth / 2)) {
      const key = partKey(id, edge.p, edge.r, edge.index - 1),
        was = selectedSegments.has(key),
        extend = add || mode === 'lines';
      if (selectedPoints.size > 1 && selectedIds.has(id) && !add) {
        const keys = [...allSelectedPoints()],
          anchor = keys.find((k) => JSON.parse(k)[0] === id) || keys[0];
        selected = id;
        partialIds();
        drag = {
          kind: 'parts',
          start: p,
          anchor,
          keys,
          shapes: shapes
            .filter((s) => selectedIds.has(s.id))
            .map((s) => G.normalize(structuredClone(s))),
          before: state(),
        };
      } else {
        const endpoints = allSelectedPoints(),
          nextKey = partKey(id, edge.p, edge.r, edge.index % edge.points.length),
          insideSelection = endpoints.has(key) && endpoints.has(nextKey);
        if (!was) {
          if (!extend && !insideSelection) clearParts();
          selectedSegments.add(key);
        }
        selected = id;
        activeRing = { p: edge.p, r: edge.r };
        vertex = edge.index - 1;
        partialIds();
        drag = {
          kind: 'parts',
          start: p,
          anchor: key,
          keys: [...allSelectedPoints()],
          shapes: shapes
            .filter((s) => selectedIds.has(s.id))
            .map((s) => G.normalize(structuredClone(s))),
          before: state(),
          toggle: extend && was ? { kind: 'segment', key } : null,
        };
      }
    } else {
      if (!add && !e.altKey && selectedPoints.size > 1 && selectedIds.has(id)) {
        const keys = [...allSelectedPoints()],
          anchor = keys.find((k) => JSON.parse(k)[0] === id) || keys[0];
        drag = {
          kind: 'parts',
          start: p,
          anchor,
          keys,
          shapes: shapes
            .filter((s) => selectedIds.has(s.id))
            .map((s) => G.normalize(structuredClone(s))),
          before: state(),
        };
      } else {
        if (add) selectShape(id, true);
        else if (!selectedIds.has(id) || selectedPoints.size || selectedSegments.size)
          selectShape(id);
        if (!selectedIds.has(id)) {
          render();
          return;
        }
        clearParts();
        drag = {
          kind: 'shape',
          start: p,
          shapes: shapes
            .filter((s) => selectedIds.has(s.id))
            .map((s) => G.normalize(structuredClone(s))),
          before: state(),
        };
      }
    }
  } else {
    drag = {
      kind: 'marquee',
      start: p,
      add,
      initial: [...(add ? allSelectedPoints() : [])],
      original: {
        selected,
        lastSelectedId,
        selectedIds: [...selectedIds],
        selectedPoints: [...selectedPoints],
        selectedSegments: [...selectedSegments],
        activeRing: { ...activeRing },
        vertex,
      },
    };
  }
  drag.pointer = e.pointerId;
  drag.screen = [e.clientX, e.clientY];
  drag.moved = false;
  render();
};
function marqueeSelection(p: Point) {
  if (!drag || drag.kind !== 'marquee') return;
  const x = Math.min(drag.start[0], p[0]),
    y = Math.min(drag.start[1], p[1]),
    width = Math.abs(p[0] - drag.start[0]),
    height = Math.abs(p[1] - drag.start[1]);
  $('marquee').replaceChildren(
    el('rect', {
      x,
      y,
      width,
      height,
      class: 'marquee-box',
      'vector-effect': 'non-scaling-stroke',
    }),
  );
  selectedPoints = new Set(drag.initial);
  selectedSegments.clear();
  shapes.forEach((s) =>
    G.rings(s).forEach((ring) =>
      ring.points.forEach(([px, py], i) => {
        if (px >= x && px <= x + width && py >= y && py <= y + height)
          selectedPoints.add(partKey(s.id, ring.p, ring.r, i));
      }),
    ),
  );
  partialIds();
  render();
}
$('canvas').onpointermove = (e) => {
  const targetNode = e.target as SVGElement;
  const p = local(e);
  $('coords').textContent = `X ${G.round(p[0])} · Y ${G.round(p[1])}`;
  if (!drag) {
    if (mode === 'hand' || space) return;
    if (targetNode.hasAttribute('data-id')) {
      const s = shapes.find((s) => s.id === targetNode.dataset.id);
      if (s) targetNode.style.cursor = 'move';
    }
    return;
  }
  if (!drag.moved && Math.hypot(e.clientX - drag.screen![0], e.clientY - drag.screen![1]) < 3)
    return;
  if (!drag.moved) {
    drag.moved = true;
    $('canvas').setPointerCapture(e.pointerId);
  }
  if (drag.kind === 'marquee') {
    marqueeSelection(p);
    return;
  }
  if (drag.kind === 'pan') {
    view.x = drag.view.x + e.clientX - drag.start[0];
    view.y = drag.view.y + e.clientY - drag.start[1];
  } else if (drag.kind === 'resize') {
    const saved = drag.shapes[0],
      b = G.bounds(saved),
      i = drag.corner,
      ax = i === 0 || i === 3 ? b.x + b.width : b.x,
      ay = i < 2 ? b.y + b.height : b.y;
    let w = Math.max(1, Math.abs(snap(p[0], 0) - ax)),
      h = Math.max(1, Math.abs(snap(p[1], 1) - ay));
    if (e.shiftKey || $('lockRatio').checked) {
      const scale = Math.max(w / b.width, h / b.height);
      w = b.width * scale;
      h = b.height * scale;
    }
    if (w <= 10000 && h <= 10000) {
      const next = G.normalize(structuredClone(saved));
      G.resize(next, w, h);
      const dx = (i === 0 || i === 3 ? ax - w : ax) - b.x,
        dy = (i < 2 ? ay - h : ay) - b.y;
      G.mapShape(next, (q) => [G.round(q[0] + dx), G.round(q[1] + dy)]);
      shapes[shapes.findIndex((s) => s.id === next.id)] = next;
    }
  } else if (drag.kind === 'parts') {
    const start = drag.start,
      anchor = pointRef(drag.anchor, drag.shapes)!.point,
      delta = p.map(
        (n, axis) => snap(anchor[axis] + n - start[axis], axis) - anchor[axis],
      ) as Point;
    const next = drag.shapes.map((s) => G.normalize(structuredClone(s)));
    moveParts(new Set(drag.keys), delta, next);
    next.forEach((s) => (shapes[shapes.findIndex((item) => item.id === s.id)] = s));
  } else {
    const start = drag.start,
      anchor = drag.shapes[0].points[0],
      delta = p.map(
        (n, axis) => snap(anchor[axis] + n - start[axis], axis) - anchor[axis],
      ) as Point;
    drag.shapes.forEach((saved) => {
      const next = G.normalize(structuredClone(saved));
      G.mapShape(next, (q) => q.map((n, axis) => G.round(n + delta[axis])) as Point);
      shapes[shapes.findIndex((s) => s.id === next.id)] = next;
    });
  }
  render();
};
function end(e?: { type: string }) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if ($('canvas').hasPointerCapture(d.pointer!)) $('canvas').releasePointerCapture(d.pointer!);
  $('marquee').replaceChildren();
  if (d.kind === 'marquee') {
    if (e?.type === 'pointercancel') {
      selected = d.original.selected;
      lastSelectedId = d.original.lastSelectedId;
      selectedIds = new Set(d.original.selectedIds);
      selectedPoints = new Set(d.original.selectedPoints);
      selectedSegments = new Set(d.original.selectedSegments);
      activeRing = d.original.activeRing;
      vertex = d.original.vertex;
    } else if (!d.moved && !d.add) clearSelection();
    persist();
    render();
    return;
  }
  if (e?.type === 'pointercancel') {
    if (d.shapes)
      d.shapes.forEach(
        (s) =>
          (shapes[shapes.findIndex((item) => item.id === s.id)] = G.normalize(structuredClone(s))),
      );
    if (d.kind === 'pan') view = { ...d.view };
    persist();
    render();
    return;
  }
  if (d.moved && d.before) commit(d.before);
  else if (d.kind === 'parts' && d.clickPoint) {
    clearParts();
    selectedPoints.add(d.clickPoint);
    partialIds();
    persist();
    render();
  } else if (d.kind === 'parts' && d.toggle) {
    (d.toggle.kind === 'point' ? selectedPoints : selectedSegments).delete(d.toggle.key);
    partialIds();
    persist();
    render();
  } else {
    persist();
    render();
  }
}
window.addEventListener('pointerup', end);
$('canvas').onpointercancel = end;
$('canvas').ondblclick = (e) => {
  if (mode === 'hand' || space) return;
  const p = local(e);
  let target: Shape | null = null,
    edge: (EdgeHit & RingReference) | null = null;
  // Geometric hit testing works on thin strokes and no-fill shapes, even if a click target changes.
  for (const s of [...shapes].reverse()) {
    const hit = nearestRing(s, p);
    if (hit.distance <= Math.max(9 / view.z, s.strokeWidth / 2)) {
      target = s;
      edge = hit;
      break;
    }
  }
  if (
    !target ||
    !edge ||
    G.rings(target).some((ring) => G.nearestPoint(ring.points, p, 8 / view.z)) ||
    G.rings(target).reduce((n, r) => n + r.points.length, 0) >= 1000
  )
    return;
  const hit = edge,
    shape = target;
  change(() => {
    selectShape(shape.id);
    activeRing = { p: hit.p, r: hit.r };
    shiftCornerIndexes(shape, hit.p, hit.r, hit.index, false);
    hit.points.splice(hit.index, 0, hit.point.map(snap) as Point);
    vertex = hit.index;
    dirty(shape);
  });
};
function zoom(f: number, cx?: number, cy?: number) {
  const r = $('canvas').getBoundingClientRect();
  cx ??= r.width / 2;
  cy ??= r.height / 2;
  const z = Math.max(0.15, Math.min(4, view.z * f));
  view.x = cx - ((cx - view.x) * z) / view.z;
  view.y = cy - ((cy - view.y) * z) / view.z;
  view.z = z;
  render();
}
$('canvas').addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const r = $('canvas').getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      camera();
    }
  },
  { passive: false },
);
$('plus').onclick = () => zoom(1.2);
$('minus').onclick = () => zoom(1 / 1.2);
$('fit').onclick = fit;
$('grid').onchange = () => change(() => (grid.visible = $('grid').checked));
$('background').onclick = () =>
  change(() => (background = background === 'dark' ? 'light' : 'dark'));
function combineShapes(op: BooleanOperation) {
  if (selectedIds.size < (op === 'flatten' ? 1 : 2)) return;
  try {
    const operands = shapes.filter((s) => selectedIds.has(s.id)),
      result = G.combine(op, operands),
      label = {
        union: 'União',
        difference: 'Subtração',
        intersection: 'Interseção',
        xor: 'Exclusão',
        flatten: 'Caminho achatado',
      }[op];
    const merged = result.length
      ? G.normalize({
          ...structuredClone(operands[0]),
          id: crypto.randomUUID(),
          name: label,
          type: 'custom' as ShapeType,
          cut: 0,
          radius: 0,
          cornerRadii: undefined,
          polygons: result,
          points: result[0][0],
        })
      : null;
    if (merged) {
      delete merged.basePoints;
      if (!G.valid({ version: 1, shapes: [merged] }))
        throw Error('O resultado excedeu o limite de vértices.');
    }
    change(() => {
      const last = shapes.findIndex((s) => s.id === operands.at(-1)!.id);
      const next: Shape[] = [];
      shapes.forEach((s, i) => {
        if (!selectedIds.has(s.id)) next.push(s);
        if (i === last && merged) next.push(merged);
      });
      shapes = next;
      clearSelection();
      if (merged) selectShape(merged.id);
    });
    if (!merged)
      toast(
        'A operação não gerou área. As formas selecionadas foram removidas; use Desfazer para restaurar.',
      );
  } catch (e) {
    toast('Não foi possível combinar: ' + errorMessage(e));
  }
  $('booleanOptions').hidden = true;
  $('booleanMenu').setAttribute('aria-expanded', String('false'));
}
$('booleanMenu').onclick = () => {
  const open = $('booleanOptions').hidden;
  $('booleanOptions').hidden = !open;
  $('booleanMenu').setAttribute('aria-expanded', String(String(open)));
};
document
  .querySelectorAll<HTMLButtonElement>('[data-operation]')
  .forEach((b) => (b.onclick = () => combineShapes(b.dataset.operation as BooleanOperation)));
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('.boolean-control')) {
    $('booleanOptions').hidden = true;
    $('booleanMenu').setAttribute('aria-expanded', String('false'));
  }
});
$('magnet').onclick = () => change(() => (grid.magnet = !grid.magnet));
$('gridSettings').onclick = () => $('gridDialog').showModal();
$('closeGrid').onclick = () => $('gridDialog').close();
$('gridType').onchange = () =>
  change(() => (grid.type = $('gridType').value as GridSettings['type']));
for (const [id, key] of Object.entries({
  cellSize: 'cell',
  stepX: 'stepX',
  stepY: 'stepY',
  originX: 'originX',
  originY: 'originY',
} as const))
  $(id).onchange = () =>
    change(() => {
      const origin = key.startsWith('origin'),
        n = Number(formControl(id).value);
      if (Number.isFinite(n))
        grid[key] = Math.max(origin ? -1000 : 0.1, Math.min(origin ? 1000 : 200, n));
    });
for (const [id, factor] of [
  ['stepCell', 1],
  ['stepHalf', 0.5],
  ['stepPixel', 0],
] as const)
  $(id).onclick = () =>
    change(() => {
      grid.stepX = grid.stepY = factor ? grid.cell * factor : 1;
    });
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string) {
  $('toast').textContent = msg;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
async function download(text: string, name: string, type: string) {
  try {
    return await desktopBridge.save(text, name, type);
  } catch (error) {
    toast('Não foi possível salvar: ' + errorMessage(error));
    return false;
  }
}
function canSave() {
  if (codeTimer && !$('dialog').hidden) applyCode();
  if (codeInvalid && !$('dialog').hidden) {
    toast('Corrija o código antes de salvar ou exportar.');
    return false;
  }
  if (!shapes.length) {
    toast('Adicione ao menos uma forma para salvar ou exportar.');
    return false;
  }
  return true;
}
$('export').onclick = async () => {
  if (!canSave()) return;
  if (await download(G.svg(shapes), 'svg-design.svg', 'image/svg+xml'))
    toast('SVG exportado com fundo transparente.');
};
$('save').onclick = async () => {
  if (!canSave()) return;
  if (await download(JSON.stringify(project(), null, 2), 'svg-projeto.json', 'application/json'))
    toast('Projeto salvo.');
};
$('open').onclick = () => $('file').click();
$('file').onchange = async () => {
  try {
    const f = $('file').files?.[0];
    if (!f) return;
    if (f.size > 2000000) throw Error();
    const d = JSON.parse(await f.text());
    if (!G.valid(d)) throw Error();
    change(() => {
      shapes = d.shapes.map(G.normalize);
      clearSelection();
      lastSelectedId = null;
      const first = shapes.find((s) => s.id === d.lastSelectedId) || shapes[0];
      if (first) selectShape(first.id);
      restoreGrid(d.grid);
      background = d.background === 'light' ? 'light' : 'dark';
      if (
        d.workspace &&
        typeof d.workspace.html === 'string' &&
        typeof d.workspace.css === 'string' &&
        d.workspace.html.length < 2000000 &&
        d.workspace.css.length < 2000000
      )
        workspaceFiles = d.workspace;
      else
        workspaceFiles = {
          html: null,
          css: null,
          theme: workspaceFiles.theme,
          autoRepair: workspaceFiles.autoRepair,
        };
    });
    window.CodeWorkbench?.loadWorkspace(workspaceFiles);
    fit();
    toast('Projeto aberto.');
  } catch {
    toast('Projeto inválido. Escolha um JSON do editor.');
  } finally {
    $('file').value = String('');
  }
};
function codeStatus(text: string, error = false) {
  $('codeStatus').textContent = text;
  $('codeStatus').classList.toggle('error', error);
  window.dispatchEvent(new CustomEvent('vector-code-status', { detail: { text, error } }));
}
function applyCode() {
  clearTimeout(codeTimer ?? undefined);
  codeTimer = null;
  try {
    const next = parseSvg($('source').value, shapes);
    if (!G.valid({ version: 1, shapes: next }))
      throw Error('Verifique os pontos, identificadores, borda (0–30) e opacidade (0–1).');
    editingCode = true;
    change(() => {
      shapes = next.map(G.normalize);
      if (!current()) {
        clearSelection();
        if (shapes[0]) selectShape(shapes[0].id);
      } else {
        selectedIds = new Set<string>(selected ? [selected] : []);
        clearParts();
        activeRing = { p: 0, r: 0 };
      }
      vertex = 0;
    });
    lastCodeGeometry = G.svg(shapes);
    if (next.some((s) => s.regeneratePath)) $('source').value = String(lastCodeGeometry);
    codeInvalid = false;
    codeStatus('✓ Código válido · mapa atualizado.');
    return true;
  } catch (e) {
    codeInvalid = true;
    codeStatus(errorMessage(e) + ' A última forma válida foi mantida.', true);
    return false;
  } finally {
    editingCode = false;
  }
}
$('code').onclick = () => {
  $('dialog').hidden = false;
  document.body.classList.add('code-open');
  $('source').value = String(G.svg(shapes));
  lastCodeGeometry = $('source').value;
  codeInvalid = false;
  codeStatus('Edite o código; a atualização é automática.');
};
$('close').onclick = () => {
  if (codeTimer) applyCode();
  $('dialog').hidden = true;
  document.body.classList.remove('code-open');
  codeInvalid = false;
};
$('source').addEventListener('input', () => {
  clearTimeout(codeTimer ?? undefined);
  codeStatus('Validando código…');
  codeTimer = setTimeout(applyCode, 250);
});
$('source').addEventListener('keydown', (e) => {
  const targetNode = e.target as HTMLTextAreaElement;
  if (e.key === 'Tab') {
    e.preventDefault();
    const a = targetNode.selectionStart,
      b = targetNode.selectionEnd;
    targetNode.setRangeText('    ', a, b, 'end');
    targetNode.dispatchEvent(new Event('input'));
  }
});
$('format').onclick = () => {
  if (applyCode()) {
    $('source').value = String(G.svg(shapes));
    codeStatus('Código formatado.');
  }
};
$('copy').onclick = async () => {
  try {
    await desktopBridge.copy($('source').value);
    toast('Código copiado.');
  } catch {
    $('source').select();
    toast('Selecione o código e use Ctrl+C.');
  }
};
document.addEventListener('keydown', (e) => {
  const targetNode = e.target as HTMLElement;
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetNode.tagName) ||
    targetNode.closest('.monaco-editor') ||
    $('gridDialog').open
  )
    return;
  if (e.code === 'Space') {
    e.preventDefault();
    space = true;
  }
  if ((e.ctrlKey || e.metaKey) && ['z', 'y', 's', 'd'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    const k = e.key.toLowerCase();
    if (k === 'z') (e.shiftKey ? $('redo') : $('undo')).click();
    if (k === 'y') $('redo').click();
    if (k === 's') $('save').click();
    if (k === 'd') $('duplicate').click();
    return;
  }
  if (e.key === 'Delete') $('delete').click();
  if (e.key === 'Escape') {
    if (drag) end({ type: 'pointercancel' });
    clearSelection();
    render();
  }
  if (e.altKey && e.shiftKey) {
    const op = (
      { u: 'union', s: 'difference', i: 'intersection', e: 'xor', f: 'flatten' } as Record<
        string,
        BooleanOperation
      >
    )[e.key.toLowerCase()];
    if (op) {
      e.preventDefault();
      combineShapes(op as BooleanOperation);
      return;
    }
  }
  if (e.key.toLowerCase() === 'v') tool('select');
  if (e.key.toLowerCase() === 'l') tool('lines');
  if (e.key.toLowerCase() === 'h') tool('hand');
  if (e.key.toLowerCase() === 'm') $('magnet').click();
  if (current() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    change(() => {
      const axis = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 0 : 1,
        sign = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1,
        step = sign * (axis ? grid.stepY : grid.stepX) * (e.shiftKey ? 10 : 1);
      if (selectedPoints.size || selectedSegments.size) {
        const delta: Point = [0, 0];
        delta[axis] = step;
        moveParts(allSelectedPoints(), delta as Point);
        return;
      }
      if (selectedIds.size > 1) {
        shapes
          .filter((s) => selectedIds.has(s.id))
          .forEach((s) =>
            G.mapShape(s, (p) => p.map((n, i) => G.round(n + (i === axis ? step : 0))) as Point),
          );
        return;
      }
      currentPoints()[vertex][axis] = G.round(currentPoints()[vertex][axis] + step);
      dirty(current()!);
    });
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') space = false;
});
window.addEventListener('blur', () => {
  space = false;
  end();
});
function flushAutosave() {
  if (codeTimer) applyCode();
  persist();
}
window.addEventListener('pagehide', flushAutosave);
window.addEventListener('beforeunload', flushAutosave);
window.addEventListener('blur', flushAutosave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushAutosave();
});
new ResizeObserver(() => fit()).observe($('canvas'));
fit();
persist();
window.VectorBridge = {
  svg: () => G.svg(shapes),
  readWorkspace: () => workspaceFiles,
  saveWorkspace: (files) => {
    workspaceFiles = files;
    persist();
  },
  validate: (text) => {
    try {
      const next = parseSvg(text, shapes);
      if (!G.valid({ version: 1, shapes: next }))
        throw Error('Verifique pontos, borda e opacidade.');
      return { valid: true };
    } catch (e) {
      return {
        valid: false,
        message: errorMessage(e),
        line: e instanceof Error && 'line' in e ? Number(e.line) || 1 : 1,
      };
    }
  },
  applySvg: (text) => {
    $('source').value = String(text);
    return applyCode();
  },
  formatSvg: () => {
    applyCode();
    return G.svg(shapes);
  },
  notify: toast,
  download,
  saveProject: () => $('save').click(),
};
