const { chromium, editorURL } = require('./browser-helper.cjs'),
  assert = require('node:assert/strict');
const rect = (id, x, y, w, h) => ({
  id,
  name: id,
  type: 'rectangle',
  points: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
  fill: '#cccccc',
  stroke: '#737373',
  strokeWidth: 1,
  opacity: 100,
  join: 'miter',
  cut: 0,
});
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [];
    page.on('pageerror', (e) => {
      if (e.message !== 'Canceled') errors.push(e.message);
    });
    await page.goto(editorURL);
    await page.waitForSelector('.shape');
    const project = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('svg-editor-project')));
    const key = (id) => page.locator(`[data-key="${id}"] .layer`);
    async function load(shapes) {
      await page.setInputFiles('#file', {
        name: 'live.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ version: 1, shapes, lastSelectedId: shapes[0].id })),
      });
      await page.waitForFunction(
        (id) => document.querySelector(`[data-key="${id}"]`),
        shapes[0].id,
      );
    }
    async function screen(x, y) {
      return page.evaluate(
        ([x, y]) => {
          const c = document.getElementById('canvas'),
            p = c.createSVGPoint();
          p.x = x;
          p.y = y;
          const q = p.matrixTransform(document.getElementById('camera').getScreenCTM());
          return [q.x, q.y];
        },
        [x, y],
      );
    }
    await load([rect('Base', 0, 0, 200, 200), rect('Cutter', 60, 60, 50, 50)]);
    await key('Cutter').click({ modifiers: ['Shift'] });
    await page.click('#booleanMenu');
    await page.click('[data-operation="difference"]');
    let p = await project(),
      root = p.shapes.find((s) => s.boolean);
    assert.equal(root.boolean.operation, 'difference');
    assert.equal(p.shapes.length, 3);
    assert.equal(await page.locator('.boolean-group').count(), 1);
    assert.equal(await page.locator('.child-layer').count(), 2);
    const pathBefore = await page.locator('.shape').getAttribute('d');
    await key('Cutter').click();
    assert.equal(await page.locator('.boolean-source:visible').count(), 1);
    await page.mouse.move(...(await screen(85, 85)));
    await page.mouse.down();
    await page.keyboard.down('Alt');
    await page.mouse.move(...(await screen(105, 100)), { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    p = await project();
    assert.deepEqual(p.shapes.find((s) => s.id === 'Cutter').points[0], [80, 75]);
    assert.notEqual(await page.locator('.shape').getAttribute('d'), pathBefore);
    // Moving the result carries both source layers with it.
    await key(root.id).click();
    await page.fill('#shapeX', '30');
    await page.locator('#shapeX').press('Tab');
    p = await project();
    assert.equal(p.shapes.find((s) => s.id === 'Base').points[0][0], 30);
    assert.equal(p.shapes.find((s) => s.id === 'Cutter').points[0][0], 110);
    await page.click('#undo');
    p = await project();
    assert.equal(p.shapes.find((s) => s.id === 'Cutter').points[0][0], 80);
    await page.click('#duplicate');
    p = await project();
    assert.equal(p.shapes.length, 6);
    assert.equal(p.shapes.filter((s) => s.boolean).length, 2);
    for (const group of p.shapes.filter((s) => s.boolean))
      assert.ok(
        group.boolean.operands.every((id) =>
          p.shapes.some((s) => s.id === id && s.booleanParent === group.id),
        ),
      );
    await page.click('#undo');
    await page.reload();
    await page.waitForSelector('.boolean-group');
    assert.equal((await project()).shapes.length, 3);
    await key('Cutter').click();
    await page.keyboard.press('ArrowRight');
    assert.equal((await project()).shapes.find((s) => s.id === 'Cutter').points[0][0], 81);
    // Zoom uses a small bounded step; plain two-finger scrolling still pans.
    const zoom = () => page.locator('#zoom').innerText();
    const percent = async () => parseInt(await zoom());
    const z = await percent();
    await page
      .locator('#canvas')
      .dispatchEvent('wheel', { ctrlKey: true, deltaY: -100, clientX: 700, clientY: 400 });
    const after = await percent();
    assert.ok(after > z && after / z < 1.15);
    await page.locator('#canvas').dispatchEvent('wheel', { deltaY: 100 });
    assert.equal(await percent(), after);
    // A selected segment aligns to a fixed point even with a coarse grid.
    await load([rect('Moving', 0, 0, 80, 80), rect('Target', 200, 200, 60, 60)]);
    await key('Moving').click();
    await page.click('#editPoints');
    await page.click('#gridSettings');
    await page.fill('#stepY', '24');
    await page.locator('#stepY').press('Tab');
    await page.click('#closeGrid');
    await page.mouse.move(...(await screen(40, 0)));
    await page.mouse.down();
    await page.mouse.move(...(await screen(40, 198)), { steps: 10 });
    assert.ok(await page.locator('#alignmentGuides [data-alignment-axis="1"]').count());
    assert.equal(await page.locator('.handle.selected').first().getAttribute('cy'), '200');
    await page.screenshot({ path: 'tests/live-workspace-preview.png' });
    await page.mouse.up();
    assert.equal(await page.locator('#alignmentGuides').locator('line').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      'PASS live boolean sources, source drag, group transforms, duplication, reload, smooth zoom and segment alignment',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
