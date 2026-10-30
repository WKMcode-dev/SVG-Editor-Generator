const { test } = require('node:test'),
  assert = require('node:assert/strict');
const G = require('../.test-build/geometry.cjs'),
  B = require('../.test-build/boolean-groups.cjs'),
  A = require('../.test-build/alignment.cjs');
const rect = (id, x, y, w, h) => ({
  id,
  name: id,
  type: 'rectangle',
  points: G.points('rectangle', x, y, w, h),
  fill: '#cccccc',
  stroke: '#737373',
  strokeWidth: 1,
  opacity: 100,
  join: 'miter',
  cut: 0,
});
const area = (s) =>
  s.booleanEmpty
    ? 0
    : (s.polygons || [[s.points]]).reduce(
        (sum, p) =>
          sum +
          p.reduce(
            (v, r, i) =>
              v +
              (i ? -1 : 1) *
                Math.abs(
                  r.reduce((a, q, j) => {
                    const n = r[(j + 1) % r.length];
                    return a + q[0] * n[1] - q[1] * n[0];
                  }, 0) / 2,
                ),
            0,
          ),
        0,
      );
for (const [op, expected] of [
  ['union', 15000],
  ['difference', 5000],
  ['intersection', 5000],
  ['xor', 10000],
  ['flatten', 15000],
])
  test(op + ' retains editable operands and recomputes after moving a source', () => {
    const shapes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100)],
      ids = new Set(['a', 'b']);
    const root = B.createBoolean(shapes, ids, op, op),
      sync = B.createBooleanSynchronizer();
    sync(shapes);
    assert.equal(area(root), expected);
    assert.equal(root.boolean.operands.length, 2);
    assert.equal(shapes.length, 3);
    assert.ok(G.valid({ version: 1, shapes }));
    G.mapShape(shapes[1], ([x, y]) => [x + 100, y]);
    sync(shapes);
    assert.equal(area(root), op === 'difference' ? 10000 : op === 'intersection' ? 0 : 20000);
    assert.ok(G.svg(shapes).includes('data-boolean='));
    assert.equal((G.svg(shapes).match(/<path/g) || []).length, 1);
  });
test('group transform follows sources, undo restores them without double-transform, empty intersections remain editable', () => {
  const shapes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100)],
    root = B.createBoolean(shapes, new Set(['a', 'b']), 'intersection', 'Intersection'),
    sync = B.createBooleanSynchronizer();
  sync(shapes);
  const saved = structuredClone(shapes);
  G.mapShape(root, ([x, y]) => [x + 33, y + 19]);
  sync(shapes);
  assert.equal(G.bounds(shapes[0]).x, 33);
  assert.equal(G.bounds(shapes[1]).y, 19);
  const restored = structuredClone(saved);
  sync(restored);
  assert.equal(G.bounds(restored[0]).x, 0);
  assert.equal(area(restored[2]), 5000);
  G.mapShape(restored[1], ([x, y]) => [x + 300, y]);
  sync(restored);
  assert.equal(area(restored[2]), 0);
  assert.ok(G.valid({ version: 1, shapes: restored }));
  G.mapShape(restored[1], ([x, y]) => [x - 300, y]);
  sync(restored);
  assert.equal(area(restored[2]), 5000);
});
test('nested booleans update both levels and reject cycles', () => {
  const shapes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100)],
    inner = B.createBoolean(shapes, new Set(['a', 'b']), 'union', 'Inner');
  shapes.push(rect('c', 120, 0, 100, 100));
  const outer = B.createBoolean(shapes, new Set([inner.id, 'c']), 'difference', 'Outer');
  assert.ok(G.valid({ version: 1, shapes }));
  G.mapShape(shapes[1], ([x, y]) => [x + 20, y]);
  B.recompute(shapes);
  assert.equal(area(outer), 12000);
  const bad = structuredClone(shapes);
  bad.find((s) => s.id === outer.id).booleanParent = 'a';
  bad[0].boolean = { operation: 'union', operands: [outer.id] };
  assert.equal(G.valid({ version: 1, shapes: bad }), false);
});
test('guides use unsnapped geometry, segment centers and screen-space tolerance on both axes', () => {
  const moving = A.anchors([
      [10, 10],
      [50, 10],
    ]),
    targets = [[100, 40]];
  const aligned = A.alignDelta(moving, targets, [68, 28], [64, 32], 1);
  assert.deepEqual(aligned.delta, [70, 30]);
  assert.equal(aligned.guides.length, 2);
  const near = A.alignDelta([[0, 0]], [[100, 100]], [98, 98], [96, 96], 2);
  assert.deepEqual(near.delta, [100, 100]);
  const far = A.alignDelta([[0, 0]], [[100, 100]], [96, 96], [96, 96], 2);
  assert.equal(far.guides.length, 0);
});
test('SVG metadata round trip restores the editable hierarchy without drawing sources', async () => {
  const { Window } = await import('happy-dom'),
    w = new Window();
  global.DOMParser = w.DOMParser;
  try {
    const shapes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100)];
    const root = B.createBoolean(shapes, new Set(['a', 'b']), 'difference', 'Difference');
    const P = require('../.test-build/svg-parser.cjs');
    const restored = P.parseCode(G.svg(shapes));
    assert.equal(restored.length, 3);
    assert.ok(G.valid({ version: 1, shapes: restored }));
    const result = restored.find((s) => s.id === root.id);
    assert.deepEqual(result.boolean.operands, ['a', 'b']);
    G.mapShape(
      restored.find((s) => s.id === 'b'),
      ([x, y]) => [x + 100, y],
    );
    B.recompute(restored);
    assert.equal(area(result), 10000);
  } finally {
    delete global.DOMParser;
    await w.happyDOM.close();
  }
});
test('group resize, mirror and rotation transform the source geometry consistently', () => {
  const shapes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100)],
    root = B.createBoolean(shapes, new Set(['a', 'b']), 'union', 'Group'),
    sync = B.createBooleanSynchronizer();
  sync(shapes);
  G.resize(root, 300, 100);
  sync(shapes);
  assert.equal(G.bounds(shapes[0]).width, 200);
  assert.equal(G.bounds(shapes[1]).x, 100);
  G.mapShape(root, ([x, y]) => [-y, x]);
  sync(shapes);
  assert.equal(G.bounds(shapes[0]).x, -100);
  assert.equal(G.bounds(shapes[1]).y, 100);
  G.mapShape(root, ([x, y]) => [-x, y]);
  sync(shapes);
  assert.equal(G.bounds(shapes[0]).x, 0);
  assert.equal(G.bounds(shapes[0]).width, 100);
});
