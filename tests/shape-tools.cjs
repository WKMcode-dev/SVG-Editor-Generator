const { test } = require('node:test'),
  assert = require('node:assert/strict');
const G = require('../.test-build/geometry.cjs');
const { skewShape } = require('../.test-build/shape-transforms.cjs');
const { reorderLayers } = require('../.test-build/layer-order.cjs');
const B = require('../.test-build/boolean-groups.cjs');
const rect = (id, x = 0, y = 0, w = 100, h = 100) => ({
  id,
  name: id,
  type: 'rectangle',
  points: G.points('rectangle', x, y, w, h),
  fill: '#cccccc',
  stroke: '#737373',
  strokeWidth: 4,
  opacity: 100,
  join: 'miter',
  cut: 0,
});
test('Skew X/Y bakes geometry, supports inverses and keeps ellipse anchors', () => {
  const shape = rect('a'),
    original = structuredClone(shape.points);
  skewShape(shape, 0, 45);
  assert.deepEqual(shape.points, [
    [-50, 0],
    [50, 0],
    [150, 100],
    [50, 100],
  ]);
  skewShape(shape, 0, -45);
  assert.deepEqual(shape.points, original);
  skewShape(shape, 1, 45);
  assert.deepEqual(shape.points, [
    [0, -50],
    [100, 50],
    [100, 150],
    [0, 50],
  ]);
  const ellipse = { ...rect('e'), type: 'ellipse', points: G.points('ellipse', 0, 0, 100, 100) };
  skewShape(ellipse, 0, 20);
  assert.equal(ellipse.type, 'ellipse');
  assert.equal(ellipse.points.length, 4);
  assert.match(G.shapePath(ellipse), / C /);
  assert.throws(() => skewShape(shape, 0, 90));
  assert.throws(() => skewShape(shape, 0, NaN));
  assert.ok(G.valid({ version: 1, shapes: [shape, ellipse] }));
});
test('Skew carries the source layers of live boolean groups', () => {
  const shapes = [rect('a'), rect('b', 50)],
    root = B.createBoolean(shapes, new Set(['a', 'b']), 'union', 'Group');
  const sync = B.createBooleanSynchronizer();
  sync(shapes);
  skewShape(root, 0, 45);
  sync(shapes);
  assert.deepEqual(shapes[0].points[0], [-50, 0]);
  assert.ok(G.valid({ version: 1, shapes }));
});
test('Layer order follows visual above/below and keeps boolean source packets intact', () => {
  const shapes = [rect('a'), rect('b'), rect('c')];
  const moved = reorderLayers(shapes, ['a'], ['c'], true);
  assert.deepEqual(
    moved.map((s) => s.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    reorderLayers(moved, ['a'], ['b'], false).map((s) => s.id),
    ['a', 'b', 'c'],
  );
  const root = B.createBoolean(shapes, new Set(['a', 'b']), 'union', 'Union');
  const grouped = reorderLayers(shapes, [root.id], ['c'], true);
  assert.ok(grouped.indexOf(root) > grouped.findIndex((s) => s.id === 'c'));
  assert.ok(G.valid({ version: 1, shapes: grouped }));
  assert.equal(reorderLayers(grouped, ['a'], ['c'], true), grouped, 'No implicit reparenting');
});
test('Reordering a boolean sibling updates operand order while regular groups stay together', () => {
  const shapes = [rect('a', 0, 0, 200, 100), rect('b', 40, 0, 50, 100)],
    root = B.createBoolean(shapes, new Set(['a', 'b']), 'difference', 'Difference');
  const moved = reorderLayers(shapes, ['a'], ['b'], true);
  B.recompute(moved);
  assert.deepEqual(root.boolean.operands, ['b', 'a']);
  assert.equal(root.booleanEmpty, true);
  const regular = [rect('x'), rect('y'), rect('z')];
  regular[0].group = regular[1].group = { id: 'g', name: 'Group' };
  assert.deepEqual(
    reorderLayers(regular, ['x'], ['z'], true).map((s) => s.id),
    ['z', 'x', 'y'],
  );
  regular[0].locked = true;
  assert.equal(reorderLayers(regular, ['x'], ['z'], true), regular);
});
test('Disabled stroke survives SVG/JSON without losing its color and width', async () => {
  const { Window } = await import('happy-dom'),
    w = new Window();
  global.DOMParser = w.DOMParser;
  try {
    const shape = { ...rect('a'), noStroke: true };
    const svg = G.svg([shape]);
    assert.match(svg, /stroke="none"/);
    assert.match(svg, /data-stroke-color="#737373"/);
    const { parseCode } = require('../.test-build/svg-parser.cjs'),
      parsed = parseCode(svg)[0];
    assert.equal(parsed.noStroke, true);
    assert.equal(parsed.strokeWidth, 4);
    assert.equal(parsed.stroke, '#737373');
    assert.equal(G.exportBounds([parsed]).width, 100);
    assert.ok(G.valid({ version: 1, shapes: [parsed] }));
    parsed.noStroke = false;
    assert.equal(G.exportBounds([parsed]).width, 104);
  } finally {
    delete global.DOMParser;
    await w.happyDOM.close();
  }
});
