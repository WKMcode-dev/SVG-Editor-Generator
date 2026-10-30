const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const G = require('../.test-build/geometry.cjs');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '../.test-build/controller.js'), 'utf8');
async function editor(saved) {
  const { Window } = await import('happy-dom');
  const w = new Window({
    url: 'http://localhost:8080',
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  w.document.write(html);
  if (saved) w.localStorage.setItem('svg-editor-project', saved);
  // Happy DOM has no native layout or SVG pointer capture. Test geometry explicitly.
  w.structuredClone = structuredClone;
  let resize;
  w.ResizeObserver = class {
    constructor(callback) {
      resize = callback;
    }
    observe() {}
    disconnect() {}
  };
  w.Option = function (text, value) {
    const option = w.document.createElement('option');
    option.textContent = text;
    option.value = value;
    return option;
  };
  w.SVGElement.prototype.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 980,
    height: 700,
  });
  w.SVGElement.prototype.hasPointerCapture = () => false;
  w.SVGElement.prototype.setPointerCapture = () => {};
  w.SVGElement.prototype.releasePointerCapture = () => {};
  w.eval(controller);
  const $ = (id) => w.document.getElementById(id);
  $('editPoints').click();
  function screen(x, y) {
    const numbers = $('camera')
      .getAttribute('transform')
      .match(/[-\d.]+/g)
      .map(Number);
    return { clientX: numbers[0] + x * numbers[2], clientY: numbers[1] + y * numbers[2] };
  }
  function down(x, y, extra = {}) {
    const node = w.document.querySelector('.shape-hit');
    $('canvas').onpointerdown({
      button: 0,
      pointerId: 1,
      target: node,
      preventDefault() {},
      ...screen(x, y),
      ...extra,
    });
  }
  function up() {
    w.dispatchEvent(new w.PointerEvent('pointerup', { pointerId: 1 }));
  }
  return {
    w,
    $,
    down,
    up,
    click(x, y, extra) {
      down(x, y, extra);
      up();
    },
    move(x, y, extra = {}) {
      $('canvas').onpointermove({
        pointerId: 1,
        target: w.document.querySelector('.shape-hit'),
        ...screen(x, y),
        ...extra,
      });
    },
    resize: () => resize(),
    snapshot: () => w.localStorage.getItem('svg-editor-project'),
    points: () => G.parseContours(w.document.querySelector('.shape').getAttribute('d'))[0],
    close: () => w.happyDOM.close(),
  };
}
test('compiled controller boots and a near-point click selects only one point', async () => {
  const e = await editor();
  try {
    assert.equal(e.w.document.querySelectorAll('.shape').length, 1);
    e.click(203, 140);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 0);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 1);
  } finally {
    await e.close();
  }
});
test('point priority survives zoom; mid-edge clicks still select two endpoints', async () => {
  const e = await editor();
  try {
    for (let i = 0; i < 4; i++) e.$('minus').click();
    e.click(203, 140);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 1);
    e.click(400, 140);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 1);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 2);
    e.click(203, 140);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 0);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 1);
  } finally {
    await e.close();
  }
});
test('drag preserves endpoint group and undo restores the untouched vertices', async () => {
  const e = await editor();
  try {
    e.click(400, 140);
    e.down(206, 140);
    e.move(226, 160);
    e.up();
    assert.deepEqual(e.points(), [
      [220, 160],
      [620, 160],
      [600, 360],
      [200, 360],
    ]);
    e.$('undo').click();
    assert.deepEqual(e.points(), [
      [200, 140],
      [600, 140],
      [600, 360],
      [200, 360],
    ]);
    e.$('redo').click();
    assert.deepEqual(e.points()[0], [220, 160]);
  } finally {
    await e.close();
  }
});
test('Ctrl adds a single vertex and clicking a layer keeps rendering functional', async () => {
  const e = await editor();
  try {
    e.click(203, 140);
    e.click(597, 140, { ctrlKey: true });
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 2);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 0);
    e.w.document.querySelector('.layer').click();
    assert.equal(e.w.document.querySelectorAll('.handle').length, 0);
  } finally {
    await e.close();
  }
});
test('compiled autosave restores geometry, grid, background and workspace on restart', async () => {
  const e = await editor();
  let snapshot;
  try {
    e.$('shapeWidth').value = '640';
    e.$('shapeWidth').dispatchEvent(new e.w.Event('change'));
    e.$('background').click();
    e.w.VectorBridge.saveWorkspace({
      html: '<h1>Naki</h1>',
      css: 'h1{color:red}',
      theme: 'vs',
      autoRepair: false,
    });
    snapshot = e.snapshot();
  } finally {
    await e.close();
  }
  const restored = await editor(snapshot);
  try {
    assert.equal(restored.$('shapeWidth').value, '640');
    assert.equal(restored.$('background').textContent, '☀ Fundo claro');
    assert.equal(restored.w.VectorBridge.readWorkspace().html, '<h1>Naki</h1>');
    restored.$('delete').click();
    assert.equal(JSON.parse(restored.snapshot()).shapes.length, 0);
  } finally {
    await restored.close();
  }
});
test('lifecycle autosave applies a pending valid SVG edit before leaving', async () => {
  const e = await editor();
  try {
    e.$('code').click();
    e.$('source').value = e.w.VectorBridge.svg().replace('M 200 140', 'M 250 150');
    e.$('source').dispatchEvent(new e.w.Event('input'));
    e.w.dispatchEvent(new e.w.Event('pagehide'));
    assert.deepEqual(JSON.parse(e.snapshot()).shapes[0].points[0], [250, 150]);
  } finally {
    await e.close();
  }
});

test('layout render preserves a focused pending field until its change is committed', async () => {
  const e = await editor();
  try {
    e.$('shapeWidth').focus();
    e.$('shapeWidth').value = '650';
    e.$('shapeWidth').dispatchEvent(new e.w.Event('input', { bubbles: true }));
    e.resize();
    assert.equal(e.$('shapeWidth').value, '650');
    e.$('shapeWidth').dispatchEvent(new e.w.Event('change', { bubbles: true }));
    assert.equal(e.$('shapeWidth').value, '650');
    assert.equal(
      Math.max(...e.points().map((p) => p[0])) - Math.min(...e.points().map((p) => p[0])),
      650,
    );
  } finally {
    await e.close();
  }
});

test('position and alignment preserve geometry and support undo plus autosave', async () => {
  const e = await editor();
  try {
    const initial = e.points();
    e.$('shapeX').value = '80';
    e.$('shapeX').dispatchEvent(new e.w.Event('change'));
    assert.equal(Math.min(...e.points().map((p) => p[0])), 80);
    assert.equal(e.$('shapeWidth').value, '400');
    e.w.document.querySelector('[data-align="right"]').click();
    const maxX = Math.max(...e.points().map((p) => p[0]));
    assert.ok(maxX > 600);
    assert.equal(e.$('shapeWidth').value, '400');
    e.$('undo').click();
    assert.equal(Math.min(...e.points().map((p) => p[0])), 80);
    e.$('undo').click();
    assert.deepEqual(e.points(), initial);
    assert.deepEqual(JSON.parse(e.snapshot()).shapes[0].points, initial);
  } finally {
    await e.close();
  }
});
test('layer order, multi-selection alignment, filtering and history work together', async () => {
  const e = await editor();
  try {
    const first = JSON.parse(e.snapshot()).shapes[0].id;
    e.w.document.querySelector('[data-type="triangle"]').click();
    const second = JSON.parse(e.snapshot()).shapes[1].id;
    e.$('layerDown').click();
    assert.deepEqual(
      JSON.parse(e.snapshot()).shapes.map((s) => s.id),
      [second, first],
    );
    e.$('undo').click();
    assert.deepEqual(
      JSON.parse(e.snapshot()).shapes.map((s) => s.id),
      [first, second],
    );
    e.w.document.body.dispatchEvent(
      new e.w.KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }),
    );
    e.w.document.querySelector('[data-align="left"]').click();
    const boxes = JSON.parse(e.snapshot()).shapes.map(G.bounds);
    assert.equal(boxes[0].x, boxes[1].x);
    e.$('layerFilter').value = 'Triângulo';
    e.$('layerFilter').dispatchEvent(new e.w.Event('input'));
    assert.equal(e.w.document.querySelectorAll('.layer').length, 1);
    assert.equal(JSON.parse(e.snapshot()).shapes.length, 2);
  } finally {
    await e.close();
  }
});

test('arrow keys move the selected layer without deforming a single vertex', async () => {
  const e = await editor();
  try {
    const initial = e.points();
    e.w.document.querySelector('.layer').click();
    e.w.document.body.dispatchEvent(
      new e.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    assert.deepEqual(
      e.points(),
      initial.map(([x, y]) => [x + 1, y]),
    );
    e.$('undo').click();
    assert.deepEqual(e.points(), initial);
  } finally {
    await e.close();
  }
});
test('grade subdivide com zoom e guias encaixam pontos sem mover os demais', async () => {
  const e = await editor();
  try {
    e.$('grid').click();
    const initialCell = Number(e.$('gridRect').getAttribute('data-cell'));
    for (let i = 0; i < 5; i++) e.$('plus').click();
    assert.ok(Number(e.$('gridRect').getAttribute('data-cell')) < initialCell);
    const before = e.points();
    const [x, y] = before[0];
    // Move close to the X coordinate of the opposite corner.
    e.down(x, y);
    e.move(before[1][0] - 1, y + 15);
    assert.ok(e.$('alignmentGuides').querySelectorAll('line').length > 0);
    assert.equal(e.points()[0][0], before[1][0]);
    assert.deepEqual(e.points().slice(1), before.slice(1));
    e.up();
    assert.equal(e.$('alignmentGuides').children.length, 0);
    e.$('undo').click();
    assert.deepEqual(e.points(), before);
    e.down(x, y);
    e.move(before[1][0] - 1, y + 15, { altKey: true });
    assert.equal(e.$('alignmentGuides').children.length, 0);
    assert.equal(e.points()[0][0], before[1][0] - 1);
    e.up();
  } finally {
    await e.close();
  }
});
test('Backspace deletes selected points or shapes, supports undo and leaves text editing alone', async () => {
  const e = await editor();
  const key = (target, value = 'Backspace') => {
    const event = new e.w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  try {
    const before = e.points();
    e.click(...before[0]);
    assert.equal(key(e.w.document.body).defaultPrevented, true);
    assert.equal(e.points().length, 3);
    e.$('undo').click();
    assert.deepEqual(e.points(), before);
    key(e.w.document.body, 'Escape');
    for (const id of ['shapeX', 'source', 'layerFilter']) {
      assert.equal(key(e.$(id)).defaultPrevented, false);
      assert.equal(e.w.document.querySelectorAll('.shape').length, 1);
    }
    const text = e.w.document.createElement('div');
    text.setAttribute('contenteditable', 'true');
    e.w.document.body.append(text);
    assert.equal(key(text).defaultPrevented, false);
    key(e.w.document.body);
    assert.equal(e.w.document.querySelectorAll('.shape').length, 0);
    e.$('undo').click();
    assert.deepEqual(e.points(), before);
  } finally {
    await e.close();
  }
});
test('ellipse starts circular with four editable anchors; Shift selects another whole shape', async () => {
  const e = await editor();
  try {
    e.w.document.querySelector('[data-type="ellipse"]').click();
    e.$('editPoints').click();
    assert.equal(e.w.document.querySelectorAll('.handle').length, 4);
    const ellipse = JSON.parse(e.snapshot()).shapes.at(-1);
    assert.equal(G.bounds(ellipse).width, G.bounds(ellipse).height);
    e.down(...ellipse.points[0], { target: e.w.document.querySelectorAll('.shape-hit')[1] });
    e.move(ellipse.points[0][0] + 20, ellipse.points[0][1] + 15);
    e.up();
    assert.equal(JSON.parse(e.snapshot()).shapes.at(-1).type, 'ellipse');
    assert.match(e.w.document.querySelectorAll('.shape')[1].getAttribute('d'), / C /);
    e.down(220, 180, { shiftKey: true });
    e.up();
    assert.equal(e.w.document.querySelectorAll('.selection-outline').length, 2);
    assert.equal(e.w.document.querySelectorAll('.handle').length, 0);
  } finally {
    await e.close();
  }
});
