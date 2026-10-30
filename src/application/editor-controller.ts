import { installPresets } from './presets';
import { installCanvasGestures } from '../ui/canvas-gestures';
import { createLayers } from '../ui/layers';
import { importMedia } from './media-import';
import type { DrawTool } from '../domain/models';
import {
  alignSelection,
  translateSelection,
  reorderSelection,
  selectionBounds,
  type Alignment,
} from './layout-commands';
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
  background: 'light' | 'dark' = 'light';
let selectedPoints = new Set<string>(),
  selectedSegments = new Set<string>();
let lastSelectedId: string | null = selected;
let view: View = { x: 0, y: 0, z: 1 },
  mode: Tool = 'select',
  space = false;
let drag: DragState | null = null;
let editingPoints = false,
  restoringLarge = false;
try {
  restoringLarge = storage.needsAsyncLoad();
} catch {}
if (restoringLarge) {
  document.body.classList.add('restoring');
  document.body.inert = true;
  document.body.setAttribute('aria-busy', 'true');
}
let grid: GridSettings = {
  visible: false,
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
let workspaceFiles: Workspace = { html: null, css: null, theme: 'vs', autoRepair: true };
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
  if (saved?.background === 'dark') background = 'dark';
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
    if (ref && !ref.shape.locked && !ref.shape.hidden) {
      ref.ring.points[ref.i] = ref.point.map((n, axis) => G.round(n + delta[axis])) as Point;
      touched.add(ref.shape);
    }
  });
  touched.forEach((s) => {
    G.normalize(s);
    dirty(s);
  });
}

const layerView = createLayers($('layers'), $('layerFilter'), {
  getShapes: () => shapes,
  getSelected: () => selectedIds,
  select: (ids, multiple) => {
    editingPoints = false;
    if (!multiple) clearSelection();
    ids.forEach((id) => selectShape(id, true));
    render();
  },
  update: (ids, patch) =>
    change(() => {
      shapes.filter((s) => ids.includes(s.id)).forEach((s) => Object.assign(s, patch));
      if (patch.locked || patch.hidden) {
        editingPoints = false;
        clearParts();
      }
    }),
  renameGroup: (id, name) =>
    change(() => {
      shapes.filter((s) => s.group?.id === id).forEach((s) => (s.group!.name = name));
    }),
});
const { render, camera, syncGrid } = createRenderer({
  renderLayers: () => layerView.render(),
  get editingPoints() {
    return editingPoints;
  },
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
  if (id !== selected) editingPoints = false;
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
  editingPoints = false;
  selected = null;
  selectedIds.clear();
  clearParts();
  activeRing = { p: 0, r: 0 };
  vertex = 0;
}
function persist() {
  if (restoringLarge) return;
  try {
    storage.save(project());
    $('saveStatus').textContent =
      JSON.stringify(project()).length >= 1_500_000 ? 'Salvando mídia…' : 'Salvo neste dispositivo';
  } catch {
    $('saveStatus').textContent = 'Salvamento local indisponível';
    toast('Armazenamento local indisponível. Salve o projeto.');
  }
}
function commit(before: string) {
  if (!G.valid(project())) {
    const saved = JSON.parse(before);
    shapes = saved.shapes.map(G.normalize);
    selected = saved.selected;
    selectedIds = new Set(saved.selectedIds || []);
    vertex = saved.vertex;
    clearParts();
    render();
    toast('A alteração ultrapassa os limites de coordenadas ou dimensões.');
    return;
  }
  if (before !== state()) {
    history.push(before);
    while (
      history.length > 1 &&
      (history.length > 100 || history.reduce((n, s) => n + s.length, 0) > 48_000_000)
    )
      history.shift();
    future = [];
    if (!editingCode) window.dispatchEvent(new CustomEvent('vector-visual-change'));
    persist();
  }
  render();
}
function change(fn: () => void) {
  if (codeTimer && !editingCode) applyCode();
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
  window.dispatchEvent(new CustomEvent('vector-visual-change'));
  persist();
  render();
}

function fit() {
  const r = $('canvas').getBoundingClientRect(),
    b = G.exportBounds(shapes);
  view.z = Math.max(
    0.02,
    Math.min(
      1.5,
      (r.width - 100) / Math.max(b.width, 240),
      (r.height - 130) / Math.max(b.height, 180),
    ),
  );
  view.x = (r.width - b.width * view.z) / 2 - b.x * view.z;
  view.y = (r.height - b.height * view.z) / 2 - b.y * view.z;
  render();
}
function local(e: { clientX: number; clientY: number }) {
  const r = $('canvas').getBoundingClientRect();
  return [(e.clientX - r.left - view.x) / view.z, (e.clientY - r.top - view.y) / view.z] as Point;
}
// Guide tolerance stays constant on screen, independent of canvas zoom.
function smartDelta(moving: Point[], targets: Point[], raw: Point, alt: boolean): Point {
  const overlay = document.getElementById('alignmentGuides')!;
  overlay.replaceChildren();
  if (alt || !moving.length) return raw;
  const delta = [...raw] as Point;
  for (const axis of [0, 1]) {
    let best = 6 / view.z;
    let match: { source: Point; target: Point; correction: number } | undefined;
    for (const source of moving)
      for (const target of targets) {
        const correction = target[axis] - source[axis] - raw[axis];
        if (Math.abs(correction) < best) {
          best = Math.abs(correction);
          match = { source, target, correction };
        }
      }
    if (!match) continue;
    delta[axis] = raw[axis] + match.correction;
    const coordinate = match.target[axis];
    const other = 1 - axis;
    const a = Math.min(match.source[other] + raw[other], match.target[other]) - 18 / view.z;
    const b = Math.max(match.source[other] + raw[other], match.target[other]) + 18 / view.z;
    overlay.append(
      el('line', {
        x1: axis === 0 ? coordinate : a,
        y1: axis === 0 ? a : coordinate,
        x2: axis === 0 ? coordinate : b,
        y2: axis === 0 ? b : coordinate,
        stroke: '#e548a6',
        'stroke-width': 1 / view.z,
        'stroke-dasharray': `${4 / view.z} ${3 / view.z}`,
      }),
    );
    overlay.append(
      el('circle', {
        cx: match.target[0],
        cy: match.target[1],
        r: 4 / view.z,
        fill: '#e548a6',
        stroke: '#fff',
        'stroke-width': 1 / view.z,
      }),
    );
  }
  return delta;
}
function alignmentTargets(excluded: Set<string>, parts = false): Point[] {
  return shapes
    .filter((s) => !s.hidden && (parts || !excluded.has(s.id)))
    .flatMap((s) =>
      G.rings(s).flatMap((r) =>
        r.points.filter((_, i) => !parts || !excluded.has(partKey(s.id, r.p, r.r, i))),
      ),
    );
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
  if (s.type !== 'ellipse') s.type = 'custom';
}
function setCornerRadius(convert = false) {
  change(() => {
    const unit = $('radiusUnit').value as RadiusUnit,
      n = Number($('radius').value);
    if (!Number.isFinite(n)) return;
    if (!editingPoints) {
      selectedShapes()
        .filter(G.vectorShape)
        .forEach((s) => {
          s.radius = Math.max(0, Math.min(unit === '%' ? 50 : 10000, n));
          s.radiusUnit = unit;
          delete s.cornerRadii;
        });
      return;
    }
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
        if (!s || s.locked) return;
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
        if (!s || s.locked) return;
        const b = G.bounds(s),
          n = Number(formControl(id).value);
        const open = ['line', 'arrow'].includes(s.type);
        if (!Number.isFinite(n) || n < (open ? 0 : 1) || n > 10000) return;
        let w = id === 'shapeWidth' ? n : b.width,
          h = id === 'shapeHeight' ? n : b.height;
        if (($('lockRatio').checked || shiftHeld) && b.width > 0 && b.height > 0) {
          if (id === 'shapeWidth') h = G.round((b.height * n) / b.width);
          else w = G.round((b.width * n) / b.height);
        }
        if ((open ? w < 0 || h < 0 || !(w || h) : w < 1 || h < 1) || w > 10000 || h > 10000)
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
        if (s && !s.locked && Number.isFinite(n) && Math.abs(n) < 100000) {
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
    if (!selectedShapes().length || shapes.length + selectedShapes().length > 100) return;
    const copies = shapes
      .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
      .map((item) => {
        const s = G.normalize(structuredClone(item));
        s.id = crypto.randomUUID();
        s.name = (s.name + ' cópia').slice(0, 80);
        G.mapShape(s, (p) => p.map((n) => n + 24) as Point);
        return s;
      });
    const groups = new Map<string, string>();
    copies.forEach((s) => {
      if (s.group) {
        if (!groups.has(s.group.id)) groups.set(s.group.id, crypto.randomUUID());
        s.group = { id: groups.get(s.group.id)!, name: s.group.name + ' cópia' };
      }
    });
    shapes.push(...copies);
    selectShape(copies.at(-1)!.id);
    selectedIds = new Set(copies.map((s) => s.id));
  });
function deleteSelection(parts = true) {
  if (drag) return;
  change(() => {
    const keys = allSelectedPoints();
    if (parts && editingPoints && keys.size) {
      let limited = false;
      for (const shape of selectedShapes()) {
        for (const ring of G.rings(shape)) {
          const indexes = ring.points
            .map((_, i) => i)
            .filter((i) => keys.has(partKey(shape.id, ring.p, ring.r, i)));
          if (!indexes.length) continue;
          const minimum = shape.type === 'line' || shape.type === 'arrow' ? 2 : 3;
          if (ring.points.length - indexes.length < minimum) {
            limited = true;
            continue;
          }
          for (const i of indexes.reverse()) {
            shiftCornerIndexes(shape, ring.p, ring.r, i, true);
            ring.points.splice(i, 1);
          }
          dirty(shape);
        }
      }
      clearParts();
      vertex = 0;
      if (limited)
        toast(
          'Contornos precisam de pelo menos 3 pontos; linhas, 2. Esc volta à seleção da forma.',
        );
      return;
    }
    // In point mode, an empty point selection must not delete the whole shape.
    if (parts && editingPoints) return;
    shapes = shapes.filter((s) => !selectedIds.has(s.id) || s.locked || s.hidden);
    clearSelection();
  });
}
$('delete').onclick = () => deleteSelection(false);
$('undo').onclick = () => restore(history, future);
$('redo').onclick = () => restore(future, history);
function tool(v: Tool) {
  mode = v;
  $('select').classList.toggle('active', v === 'select');
  $('lineSelect').classList.toggle('active', v === 'lines');
  $('hand').classList.toggle('active', v === 'hand');
  if (v === 'lines') {
    enterPointMode();
    mode = 'lines';
  }
  if (v === 'select') editingPoints = false;
  $('canvas').style.cursor =
    v === 'hand' ? 'grab' : drawTools.includes(v as DrawTool) ? 'crosshair' : 'default';
  $('shapeTool').classList.toggle('active', drawTools.includes(v as DrawTool));
  $('modeStatus').textContent = drawTools.includes(v as DrawTool)
    ? 'Arraste para desenhar · Shift restringe proporções'
    : editingPoints
      ? 'Editando pontos · Esc para voltar'
      : 'Seleção · duplo clique para editar pontos';
  render();
}
const drawTools: DrawTool[] = [
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'triangle',
  'hexagon',
  'diamond',
  'star',
];
const selectedShapes = () => shapes.filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden);
(['shapeX', 'shapeY'] as const).forEach((id, axis) => {
  $(id).onchange = () => {
    const value = Number($(id).value),
      shape = current();
    if (
      !shape ||
      shape.locked ||
      shape.hidden ||
      selectedIds.size !== 1 ||
      !Number.isFinite(value) ||
      Math.abs(value) > 100000
    )
      return render();
    change(() => {
      const box = G.bounds(shape);
      translateSelection([shape], axis === 0 ? value - box.x : 0, axis === 1 ? value - box.y : 0);
      clearParts();
    });
  };
});
document.querySelectorAll<HTMLButtonElement>('[data-align]').forEach((button) => {
  button.onclick = () =>
    change(() => {
      const r = $('canvas').getBoundingClientRect();
      alignSelection(
        selectedShapes(),
        button.dataset.align as Alignment,
        selectedShapes().length === 1
          ? {
              x: -view.x / view.z,
              y: -view.y / view.z,
              width: r.width / view.z,
              height: r.height / view.z,
            }
          : undefined,
      );
      clearParts();
    });
});
$('layerUp').onclick = () => change(() => reorderSelection(shapes, selectedIds, 1));
$('layerDown').onclick = () => change(() => reorderSelection(shapes, selectedIds, -1));
$('layerFilter').oninput = () => render();
$('fitSelection').onclick = () => {
  const box = selectionBounds(selectedShapes());
  if (!box) return;
  const viewport = $('canvas').getBoundingClientRect();
  view.z = Math.max(
    0.15,
    Math.min(
      4,
      (viewport.width - 80) / Math.max(1, box.width),
      (viewport.height - 100) / Math.max(1, box.height),
    ),
  );
  view.x = (viewport.width - box.width * view.z) / 2 - box.x * view.z;
  view.y = (viewport.height - box.height * view.z) / 2 - box.y * view.z;
  render();
};
$('shortcuts').onclick = () => $('shortcutsDialog').showModal();
$('closeShortcuts').onclick = () => $('shortcutsDialog').close();
function enterPointMode() {
  const s = current();
  if (!s || s.locked || s.hidden || s.media) return;
  editingPoints = true;
  mode = 'select';
  $('pointSection').open = true;
  clearParts();
  render();
  $('modeStatus').textContent = 'Editando pontos · Esc para voltar';
}
$('editPoints').onclick = enterPointMode;
$('shapeTool').onclick = () => {
  const open = $('shapeOptions').hidden;
  $('shapeOptions').hidden = !open;
  $('shapeTool').setAttribute('aria-expanded', String(open));
};
document.querySelectorAll<HTMLButtonElement>('[data-draw]').forEach(
  (b) =>
    (b.onclick = () => {
      tool(b.dataset.draw as DrawTool);
      $('shapeOptions').hidden = true;
      $('shapeTool').setAttribute('aria-expanded', 'false');
    }),
);
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('.shape-control')) {
    $('shapeOptions').hidden = true;
    $('shapeTool').setAttribute('aria-expanded', 'false');
  }
});
$('toolbarCode').onclick = () => $('code').click();
$('insertMedia').onclick = () => {
  $('shapeOptions').hidden = true;
  $('mediaFile').click();
};
$('mediaFile').onchange = async () => {
  const files = [...($('mediaFile').files || [])];
  $('mediaFile').value = '';
  for (const file of files) {
    try {
      if (shapes.length >= 100) throw Error('Limite de 100 camadas.');
      const r = $('canvas').getBoundingClientRect(),
        center: Point = [(r.width / 2 - view.x) / view.z, (r.height / 2 - view.y) / view.z];
      const shape = await importMedia(file, center);
      if (
        shapes.reduce((n, s) => n + (s.media?.src.length || 0), 0) + shape.media!.src.length >
        32_000_000
      )
        throw Error('Limite de 24 MB de mídia por projeto.');
      change(() => {
        shapes.push(shape);
        selectShape(shape.id);
      });
      tool('select');
      toast('Mídia inserida. Use Salvar projeto para gerar um backup.');
    } catch (e) {
      toast(errorMessage(e));
    }
  }
};
$('toggleLock').onclick = () =>
  change(() => {
    const chosen = shapes.filter((s) => selectedIds.has(s.id)),
      locked = !chosen.every((s) => s.locked);
    chosen.forEach((s) => (s.locked = locked));
    editingPoints = false;
    clearParts();
  });
$('toggleVisibility').onclick = () =>
  change(() => {
    const chosen = shapes.filter((s) => selectedIds.has(s.id)),
      hidden = !chosen.every((s) => s.hidden);
    chosen.forEach((s) => (s.hidden = hidden));
    editingPoints = false;
    clearParts();
  });
$('shadow').onchange = () =>
  change(() => selectedShapes().forEach((s) => (s.shadow = $('shadow').checked)));
(['flipX', 'flipY'] as const).forEach((id, axis) => {
  $(id).onclick = () =>
    change(() =>
      selectedShapes().forEach((s) => {
        const b = G.bounds(s);
        if (s.media) {
          const key = axis ? 'flipY' : 'flipX';
          s.media[key] = !s.media[key];
        } else {
          G.polygonize(s);
          G.mapShape(
            s,
            (p) =>
              p.map((n, i) =>
                i === axis ? G.round((axis ? 2 * b.y + b.height : 2 * b.x + b.width) - n) : n,
              ) as Point,
          );
        }
      }),
    );
});
$('rotation').onchange = () => {
  const degrees = Number($('rotation').value);
  if (!Number.isFinite(degrees)) return;
  change(() =>
    selectedShapes()
      .filter((s) => !s.media)
      .forEach((s) => {
        G.polygonize(s);
        const b = G.bounds(s),
          cx = b.x + b.width / 2,
          cy = b.y + b.height / 2,
          a = (degrees * Math.PI) / 180;
        G.mapShape(s, ([x, y]) => [
          G.round(cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a)),
          G.round(cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)),
        ]);
      }),
  );
  $('rotation').value = '0';
};
$('playMedia').onclick = () => {
  const node = [...$('shapes').children]
    .find((n) => (n as SVGGElement).dataset.id === selected)
    ?.querySelector<HTMLVideoElement>('video');
  if (node) {
    if (node.paused) {
      node.style.pointerEvents = 'auto';
      void node.play().catch(() => toast('Este navegador não conseguiu reproduzir o vídeo.'));
      $('playMedia').textContent = 'Ⅱ Pausar vídeo';
    } else {
      node.pause();
      node.style.pointerEvents = 'none';
      $('playMedia').textContent = '▶ Reproduzir vídeo';
    }
  }
};
$('groupSelection').onclick = () => {
  if (!selectedShapes().length) return;
  change(() => {
    const group = { id: crypto.randomUUID(), name: 'Grupo' };
    selectedShapes().forEach((s) => (s.group = { ...group }));
  });
};
$('ungroupSelection').onclick = () => change(() => selectedShapes().forEach((s) => delete s.group));
installPresets({
  getSelected: selectedShapes,
  notify: toast,
  center: () => {
    const r = $('canvas').getBoundingClientRect();
    return [(r.width / 2 - view.x) / view.z, (r.height / 2 - view.y) / view.z];
  },
  insert: (copies) => {
    if (shapes.length + copies.length > 100) return toast('Limite de 100 camadas.');
    change(() => {
      shapes.push(...copies);
      selectShape(copies[0].id);
      selectedIds = new Set(copies.map((s) => s.id));
    });
  },
});
$('fileTab').onclick = () => {
  $('layersPanel').hidden = false;
  $('presetsPanel').hidden = true;
  $('fileTab').classList.add('active');
  $('assetsTab').classList.remove('active');
};
$('assetsTab').onclick = () => {
  $('layersPanel').hidden = true;
  $('presetsPanel').hidden = false;
  $('assetsTab').classList.add('active');
  $('fileTab').classList.remove('active');
};
$('toggleLeft').onclick = () => document.body.classList.toggle('left-collapsed');
$('toggleRight').onclick = () => document.body.classList.toggle('right-collapsed');
window.addEventListener('vector-storage-error', () => {
  $('saveStatus').textContent = 'Falha ao salvar mídia';
  toast('Não foi possível salvar automaticamente. Exporte um backup JSON.');
});
window.addEventListener('vector-storage-saved', () => {
  $('saveStatus').textContent = 'Salvo neste dispositivo';
});
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
  if (codeTimer && !editingCode) applyCode();
  const targetNode = e.target as SVGElement;
  if (targetNode.closest('video')) return;
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  const p = local(e),
    add = e.shiftKey || e.ctrlKey || e.metaKey;
  const pointTarget = !editingPoints
    ? null
    : targetNode.hasAttribute('data-point')
      ? targetNode
      : !e.altKey
        ? nearestHandle(p)
        : null;
  if (drawTools.includes(mode as DrawTool) && !space && e.button === 0) {
    if (shapes.length >= 100) return toast('Limite de 100 camadas.');
    const before = state(),
      s = make(mode as ShapeType);
    s.points = G.points(s.type, snap(p[0], 0), snap(p[1], 1), 1, 1);
    shapes.push(s);
    const shapeType = mode as DrawTool;
    selectShape(s.id);
    drag = { kind: 'draw', start: p, shapeType, shapeId: s.id, shapes: [], before };
  } else if (mode === 'hand' || space || e.button === 1)
    drag = { kind: 'pan', start: [e.clientX, e.clientY], view: { ...view } };
  else if (targetNode.hasAttribute('data-resize') && current() && !current()!.locked) {
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
        .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
        .map((s) => G.normalize(structuredClone(s))),
      before: state(),
      toggle: add && was ? { kind: 'point', key } : null,
      clickPoint: !add ? key : null,
    };
  } else if (targetNode.hasAttribute('data-id')) {
    const id = targetNode.dataset.id!;
    if (add && !selectedIds.has(id)) {
      editingPoints = false;
      clearParts();
    }
    const target = shapes.find((s) => s.id === id)!,
      edge = nearestRing(target, p);
    if (target.locked || target.hidden) return;
    if (
      editingPoints &&
      !target.media &&
      !e.altKey &&
      edge.distance <= Math.max(9 / view.z, target.strokeWidth / 2)
    ) {
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
            .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
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
            .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
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
            .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
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
            .filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden)
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
  if (!editingPoints) {
    const ids = shapes
      .filter((s) => !s.locked && !s.hidden)
      .filter((s) => {
        const b = G.bounds(s);
        return b.x <= x + width && b.y <= y + height && b.x + b.width >= x && b.y + b.height >= y;
      })
      .map((s) => s.id);
    selectedIds = new Set([...(drag.add ? drag.original.selectedIds : []), ...ids]);
    selected = [...selectedIds].at(-1) || null;
    clearParts();
    render();
    return;
  }
  selectedPoints = new Set(drag.initial);
  selectedSegments.clear();
  shapes
    .filter((s) => !s.locked && !s.hidden)
    .forEach((s) =>
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
  if (drag.kind === 'draw') {
    const s = shapes.find((s) => s.id === (drag as Extract<DragState, { kind: 'draw' }>).shapeId)!;
    let dx = snap(p[0], 0) - snap(drag.start[0], 0),
      dy = snap(p[1], 1) - snap(drag.start[1], 1);
    if (e.shiftKey) {
      if (s.type === 'line' || s.type === 'arrow') {
        const length = Math.hypot(dx, dy),
          angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
        dx = G.round(Math.cos(angle) * length);
        dy = G.round(Math.sin(angle) * length);
      } else {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * size;
        dy = Math.sign(dy || 1) * size;
      }
    }
    const x = snap(drag.start[0], 0),
      y = snap(drag.start[1], 1);
    s.points =
      s.type === 'line' || s.type === 'arrow'
        ? [
            [x, y],
            [x + dx, y + dy],
          ]
        : G.points(
            s.type,
            Math.min(x, x + dx),
            Math.min(y, y + dy),
            Math.max(1, Math.abs(dx)),
            Math.max(1, Math.abs(dy)),
          );
  } else if (drag.kind === 'pan') {
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
      delta = smartDelta(
        drag.keys.map((key) => pointRef(key, drag!.kind === 'parts' ? drag!.shapes : [])!.point),
        alignmentTargets(new Set(drag.keys), true),
        p.map((n, axis) => snap(anchor[axis] + n - start[axis], axis) - anchor[axis]) as Point,
        e.altKey,
      );
    const next = drag.shapes.map((s) => G.normalize(structuredClone(s)));
    moveParts(new Set(drag.keys), delta, next);
    next.forEach((s) => (shapes[shapes.findIndex((item) => item.id === s.id)] = s));
  } else {
    const start = drag.start,
      anchor = drag.shapes[0].points[0],
      delta = smartDelta(
        drag.shapes.flatMap((s) => G.rings(s).flatMap((r) => r.points)),
        alignmentTargets(new Set(drag.shapes.map((s) => s.id))),
        p.map((n, axis) => snap(anchor[axis] + n - start[axis], axis) - anchor[axis]) as Point,
        e.altKey,
      );
    drag.shapes.forEach((saved) => {
      const next = G.normalize(structuredClone(saved));
      G.mapShape(next, (q) => q.map((n, axis) => G.round(n + delta[axis])) as Point);
      shapes[shapes.findIndex((s) => s.id === next.id)] = next;
    });
  }
  render();
};
function end(e?: { type: string }) {
  document.getElementById('alignmentGuides')!.replaceChildren();
  if (!drag) return;
  const d = drag;
  drag = null;
  if ($('canvas').hasPointerCapture(d.pointer!)) $('canvas').releasePointerCapture(d.pointer!);
  $('marquee').replaceChildren();
  if (d.kind === 'draw') {
    if (e?.type === 'pointercancel') {
      shapes = shapes.filter((s) => s.id !== d.shapeId);
      clearSelection();
      render();
      return;
    }
    if (!d.moved) {
      const s = shapes.find((s) => s.id === d.shapeId)!;
      s.points = G.points(
        s.type,
        d.start[0],
        d.start[1],
        160,
        s.type === 'line' || s.type === 'arrow' ? 0 : s.type === 'rectangle' ? 120 : 160,
      );
    }
    if (d.before) commit(d.before);
    tool('select');
    return;
  }
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
  if (!editingPoints) {
    const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id');
    const s = shapes.find((s) => s.id === id && !s.locked && !s.hidden);
    if (s) {
      selectShape(s.id);
      enterPointMode();
    }
    return;
  }
  if (current()?.media || ['ellipse', 'line', 'arrow'].includes(current()?.type || '')) return;
  let target: Shape | null = null,
    edge: (EdgeHit & RingReference) | null = null;
  // Geometric hit testing works on thin strokes and no-fill shapes, even if a click target changes.
  for (const s of [...shapes].reverse().filter((s) => !s.locked && !s.hidden && !s.media)) {
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
  const z = Math.max(0.02, Math.min(64, view.z * f));
  view.x = cx - ((cx - view.x) * z) / view.z;
  view.y = cy - ((cy - view.y) * z) / view.z;
  view.z = z;
  render();
}
installCanvasGestures($('canvas'), {
  zoom: (f, x, y) => zoom(f, x, y),
  pan: (dx, dy) => {
    view.x += dx;
    view.y += dy;
    camera();
  },
  cancel: () => end({ type: 'pointercancel' }),
});
$('plus').onclick = () => zoom(1.2);
$('minus').onclick = () => zoom(1 / 1.2);
$('fit').onclick = fit;
$('grid').onchange = () => change(() => (grid.visible = $('grid').checked));
$('background').onclick = () =>
  change(() => (background = background === 'dark' ? 'light' : 'dark'));
function combineShapes(op: BooleanOperation) {
  if (selectedIds.size < (op === 'flatten' ? 1 : 2)) return;
  try {
    const operands = shapes.filter((s) => selectedIds.has(s.id) && !s.locked && !s.hidden),
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
    if (f.size > 100_000_000) throw Error();
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
  if (restoringLarge) return;
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetNode.tagName) ||
    targetNode.isContentEditable ||
    targetNode.closest('[contenteditable]:not([contenteditable="false"])') ||
    targetNode.closest('.monaco-editor') ||
    $('gridDialog').open ||
    $('shortcutsDialog').open
  )
    return;
  const command = e.ctrlKey || e.metaKey;
  if (command && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    editingPoints = false;
    clearParts();
    selectedIds = new Set(shapes.filter((s) => !s.locked && !s.hidden).map((s) => s.id));
    selected = shapes.at(-1)?.id || null;
    render();
    return;
  }
  if (command && ['[', ']'].includes(e.key)) {
    e.preventDefault();
    (e.key === ']' ? $('layerUp') : $('layerDown')).click();
    return;
  }
  if (e.shiftKey && ['Digit1', 'Digit2'].includes(e.code) && !command && !e.altKey) {
    e.preventDefault();
    (e.code === 'Digit1' ? $('fit') : $('fitSelection')).click();
    return;
  }
  if (!command && !e.altKey && e.key === '?') {
    e.preventDefault();
    $('shortcuts').click();
    return;
  }
  if (command && e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('mediaFile').click();
    return;
  }
  if (command && e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    $('toggleLock').click();
    return;
  }
  if (command && e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    $('toggleVisibility').click();
    return;
  }
  if (command && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    (e.shiftKey ? $('ungroupSelection') : $('groupSelection')).click();
    return;
  }
  if (!command && !e.altKey && e.key === 'Enter') {
    e.preventDefault();
    enterPointMode();
    return;
  }
  if (!command && !e.altKey && ['r', 'o', 'l'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    const key = e.key.toLowerCase();
    tool(key === 'r' ? 'rectangle' : key === 'o' ? 'ellipse' : e.shiftKey ? 'arrow' : 'line');
    return;
  }
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
  if (!command && !e.altKey && !e.isComposing && ['Delete', 'Backspace'].includes(e.key)) {
    e.preventDefault();
    deleteSelection();
    return;
  }
  if (e.key === 'Escape') {
    if (drag) end({ type: 'pointercancel' });
    if (editingPoints) {
      editingPoints = false;
      clearParts();
      tool('select');
      return;
    }
    tool('select');
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
  if (!command && !e.altKey && e.key.toLowerCase() === 'v') tool(e.shiftKey ? 'lines' : 'select');
  if (e.key.toLowerCase() === 'h') tool('hand');
  if (e.key.toLowerCase() === 'm') $('magnet').click();
  if (
    current() &&
    !current()!.locked &&
    !current()!.hidden &&
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
  ) {
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
      const delta: Point = [0, 0];
      delta[axis] = step;
      translateSelection(selectedShapes(), delta[0], delta[1]);
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
let previousSize: { width: number; height: number } | null = null;
new ResizeObserver(() => {
  const r = $('canvas').getBoundingClientRect();
  if (previousSize) {
    view.x += (r.width - previousSize.width) / 2;
    view.y += (r.height - previousSize.height) / 2;
    camera();
  }
  previousSize = { width: r.width, height: r.height };
}).observe($('canvas'));
fit();
if (restoringLarge) {
  void storage
    .loadLarge()
    .then((saved) => {
      if (saved) {
        shapes = saved.shapes.map(G.normalize);
        selected = shapes.find((s) => s.id === saved.lastSelectedId)?.id || null;
        selectedIds = new Set(selected ? [selected] : []);
        restoreGrid(saved.grid);
        background = saved.background || 'light';
        if (saved.workspace) workspaceFiles = saved.workspace;
        window.CodeWorkbench?.loadWorkspace(workspaceFiles);
      } else toast('Salvamento com mídia indisponível. Abra seu backup JSON.');
    })
    .catch(() => toast('Não foi possível restaurar o salvamento. Abra seu backup JSON.'))
    .finally(() => {
      restoringLarge = false;
      document.body.classList.remove('restoring');
      document.body.inert = false;
      document.body.removeAttribute('aria-busy');
      fit();
    });
} else persist();
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
