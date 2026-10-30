const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  G = require('../.test-build/geometry.cjs');
const s = {
  id: 'one',
  name: 'Teste <&"',
  type: 'rectangle',
  points: G.points('rectangle'),
  fill: '#222427',
  stroke: '#ff9b20',
  strokeWidth: 2,
  opacity: 100,
  join: 'miter',
  cut: 0,
};
test('formas padrão começam sem recortes', () => {
  assert.deepEqual(s.points, [
    [200, 140],
    [600, 140],
    [600, 360],
    [200, 360],
  ]);
  assert.equal(G.points('triangle').length, 3);
  assert.equal(G.points('hexagon').length, 6);
  assert.equal(G.points('diamond').length, 4);
});
test('recorte é opcional e respeita lados pequenos', () => {
  assert.deepEqual(G.bevel(s.points, 0), s.points);
  assert.equal(G.bevel(s.points, 20).length, 8);
  assert.deepEqual(G.bevel(s.points, 20)[0], [200, 160]);
});
test('SVG formatado preserva geometria e escapa atributos', () => {
  const svg = G.svg([{ ...s, noFill: true }]);
  assert.match(svg, /Teste &lt;&amp;&quot;/);
  assert.match(svg, /fill="none"/);
  assert.match(svg, /\n            M 200 140\n            L 600 140/);
  assert.match(svg, /viewBox="199 139 402 222"/);
  assert.deepEqual(G.parsePath(svg.match(/d="\n([\s\S]*?)"/)[1]), s.points);
});
test('projeto vazio é válido internamente; inválidos são rejeitados', () => {
  assert.ok(G.valid({ version: 1, shapes: [] }));
  assert.ok(G.valid({ version: 1, shapes: [s] }));
  for (const patch of [
    {
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    { stroke: 'url(fake)' },
    { opacity: 101 },
    { basePoints: ['bad'] },
    {
      points: [
        [0, 0],
        [1, Infinity],
        [2, 2],
      ],
    },
  ])
    assert.ok(!G.valid({ version: 1, shapes: [{ ...s, ...patch }] }));
  assert.ok(!G.valid({ version: 1, shapes: [s, s] }));
});
test('código aceita path relativo, H/V e coordenadas exponenciais', () => {
  assert.deepEqual(G.parsePath('m 10 10 h 100 v 100 h -100 z'), [
    [10, 10],
    [110, 10],
    [110, 110],
    [10, 110],
  ]);
  assert.deepEqual(G.parsePath('M0,0 1e2,0 100,100 Z'), [
    [0, 0],
    [100, 0],
    [100, 100],
  ]);
  for (const path of [
    'M0 0 L 2 Z',
    'M0 0 C0 2 3 4 5 6 Z',
    'M0 0 L20 0 L20 20',
    'M0 0 L20 0 L20 20 Z L2 2',
    'M0 0 L20 0 L20 20 @ Z',
  ])
    assert.throws(() => G.parsePath(path));
});
test('localização de borda projeta o ponto no segmento', () => {
  const hit = G.nearest(s.points, [350, 142]);
  assert.equal(hit.index, 1);
  assert.equal(hit.distance, 2);
  assert.deepEqual(hit.point, [350, 140]);
});
test('arraste de segmento move somente seus endpoints; vértices compartilhados movem uma vez', () => {
  const a = structuredClone(s);
  G.moveEdges(a, ['0:0:0'], [0, -20]);
  assert.deepEqual(a.points, [
    [200, 120],
    [600, 120],
    [600, 360],
    [200, 360],
  ]);
  const b = structuredClone(s);
  G.moveEdges(b, ['0:0:0', '0:0:1'], [3, 4]);
  assert.deepEqual(b.points, [
    [203, 144],
    [603, 144],
    [603, 364],
    [200, 360],
  ]);
});
test('largura/altura escalam a geometria mantendo o canto superior esquerdo', () => {
  const a = structuredClone(s);
  G.resize(a, 200, 110);
  assert.deepEqual(a.points, [
    [200, 140],
    [400, 140],
    [400, 250],
    [200, 250],
  ]);
  assert.deepEqual(G.bounds(a), { x: 200, y: 140, width: 200, height: 110 });
});
const area = (polygons) =>
  polygons.reduce(
    (sum, p) =>
      sum +
      p.reduce((n, r, i) => {
        const a = Math.abs(
          r.reduce((total, q, j) => {
            const next = r[(j + 1) % r.length];
            return total + q[0] * next[1] - next[0] * q[1];
          }, 0) / 2,
        );
        return n + (i ? -a : a);
      }, 0),
    0,
  );
test('corner radius usa arcos circulares, limita lados e acompanha percentuais', () => {
  const a = { ...s, radius: 20, radiusUnit: 'px' };
  assert.match(G.shapePath(a), /^M 200 160 A 20 20 0 0 1 220 140/);
  assert.deepEqual(a.points, s.points);
  assert.equal(G.shapePath({ ...a, radius: 0 }), G.path(s.points));
  const b = { ...a, radius: 50, radiusUnit: '%' };
  assert.ok(Math.abs(G.radiusPx(b) - 110) < 1e-9);
  G.resize(b, 200, 110);
  assert.ok(Math.abs(G.radiusPx(b) - 55) < 1e-9);
  assert.ok(G.valid({ version: 1, shapes: [b] }));
  assert.ok(!G.valid({ version: 1, shapes: [{ ...b, radius: 51 }] }));
  const huge = G.shapePath({ ...a, radius: 10000 });
  assert.match(huge, /A 110 110/);
  assert.ok(!/NaN|Infinity/.test(huge));
  const roundedArea = area(G.combine('flatten', [a]));
  assert.ok(Math.abs(roundedArea - (88000 - (4 - Math.PI) * 400)) < 15);
  assert.match(G.svg([a]), /data-corner-radius="20"/);
  assert.match(G.svg([a]), /\n            A 20 20/);
  const concave = {
    ...a,
    points: [
      [0, 0],
      [100, 0],
      [100, 100],
      [50, 50],
      [0, 100],
    ],
  };
  assert.ok(!/NaN|Infinity/.test(G.shapePath(concave)));
});
test('operações calculam áreas corretas, recortes e regiões separadas', () => {
  const a = { ...s, points: G.points('rectangle', 0, 0, 100, 100) },
    b = { ...s, id: 'two', points: G.points('rectangle', 50, 0, 100, 100) };
  for (const [op, expected] of [
    ['union', 15000],
    ['difference', 5000],
    ['intersection', 5000],
    ['xor', 10000],
    ['flatten', 15000],
  ])
    assert.equal(area(G.combine(op, [a, b])), expected);
  const inner = { ...b, points: G.points('rectangle', 25, 25, 50, 50) },
    hole = G.combine('difference', [a, inner]);
  assert.equal(area(hole), 7500);
  assert.equal(hole[0].length, 2);
  const compound = G.normalize({ ...a, polygons: hole });
  const svg = G.svg([compound]);
  assert.match(svg, /fill-rule="evenodd"/);
  const contours = G.parseContours(svg.match(/d="\n([\s\S]*?)"/)[1]);
  assert.equal(contours.length, 2);
  assert.equal(area(G.fromContours(contours)), 7500);
  const disjoint = { ...b, points: G.points('rectangle', 200, 0, 100, 100) };
  assert.deepEqual(G.combine('intersection', [a, disjoint]), []);
  assert.equal(G.combine('union', [a, disjoint]).length, 2);
  G.resize(compound, 200, 200);
  assert.equal(area(compound.polygons), 30000);
});

test('open lines, arrows and ellipses round-trip their intended geometric paths', () => {
  for (const type of ['line', 'arrow', 'ellipse', 'star']) {
    const shape = { ...s, type, points: G.points(type), noFill: ['line', 'arrow'].includes(type) };
    assert.ok(G.valid({ version: 1, shapes: [shape] }));
    if (type === 'line') assert.ok(!G.shapePath(shape).includes('Z'));
    if (type === 'arrow') assert.equal((G.shapePath(shape).match(/M /g) || []).length, 2);
    if (type === 'ellipse') assert.match(G.shapePath(shape), / A /);
    if (type === 'star') assert.equal(shape.points.length, 10);
  }
});
test('free-canvas export crops visible shapes and ignores hidden layers in its bounds', () => {
  const hidden = {
    ...s,
    id: 'hidden',
    hidden: true,
    points: G.points('rectangle', -5000, -5000, 2000, 2000),
  };
  assert.deepEqual(G.exportBounds([s, hidden]), { x: 199, y: 139, width: 402, height: 222 });
  assert.match(G.svg([s, hidden]), /display="none"/);
  assert.throws(
    () =>
      G.combine('union', [
        {
          ...s,
          type: 'line',
          points: [
            [0, 0],
            [50, 0],
          ],
        },
        s,
      ]),
    /vetoriais fechadas/,
  );
  assert.ok(
    !G.valid({
      version: 1,
      shapes: [
        { ...s, type: 'image', media: { mime: 'image/png', src: 'https://example.com/image.png' } },
      ],
    }),
  );
});
test('line resizing keeps zero-height horizontal lines usable in the inspector', () => {
  const line = {
    ...s,
    type: 'line',
    points: [
      [0, 0],
      [100, 0],
    ],
  };
  G.resize(line, 250, 0);
  assert.deepEqual(line.points, [
    [0, 0],
    [250, 0],
  ]);
  G.resize(line, 250, 80);
  assert.deepEqual(line.points, [
    [0, 0],
    [250, 80],
  ]);
});
test('ellipse uses four cardinal anchors and retains smooth curves when edited', () => {
  const shape = { ...s, type: 'ellipse', points: G.points('ellipse', 10, 20, 200, 200) };
  assert.deepEqual(shape.points, [
    [110, 20],
    [210, 120],
    [110, 220],
    [10, 120],
  ]);
  assert.match(G.shapePath(shape), / A 100 100 /);
  shape.points[0][0] += 15;
  assert.match(G.shapePath(shape), / C /);
  assert.equal(shape.points.length, 4);
  assert.match(G.svg([shape]), /C /);
  G.polygonize(shape);
  assert.equal(shape.points.length, 96);
  assert.deepEqual(shape.points[0], [125, 20]);
});
