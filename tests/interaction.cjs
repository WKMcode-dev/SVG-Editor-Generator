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
    move(x, y) {
      $('canvas').onpointermove({
        pointerId: 1,
        target: w.document.querySelector('.shape-hit'),
        ...screen(x, y),
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
    e.click(206, 140);
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
    e.click(206, 140);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 1);
    e.click(400, 140);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 1);
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 2);
    e.click(206, 140);
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
    e.click(206, 140);
    e.click(594, 140, { ctrlKey: true });
    assert.equal(e.w.document.querySelectorAll('.handle.selected').length, 2);
    assert.equal(e.w.document.querySelectorAll('.selected-edge').length, 0);
    e.w.document.querySelector('.layer').click();
    assert.equal(e.w.document.querySelectorAll('.handle').length, 4);
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
    assert.equal(restored.$('background').textContent, '☾ Fundo escuro');
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
