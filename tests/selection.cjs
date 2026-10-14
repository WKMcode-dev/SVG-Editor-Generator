const { chromium } = require('./browser-helper.cjs');
const assert = require('node:assert/strict'),
  path = require('node:path');
const shape = (id, x, y, w, h) => ({
  id,
  name: id,
  type: 'rectangle',
  points: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
  fill: '#222427',
  stroke: '#ff9b20',
  strokeWidth: 2,
  opacity: 100,
  join: 'miter',
  cut: 0,
  noFill: false,
});
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(require('./browser-helper.cjs').editorURL);
    await page.waitForSelector('.handle');
    const screen = async (x, y) =>
      page.evaluate(
        ([x, y]) => {
          const svg = document.getElementById('canvas'),
            p = svg.createSVGPoint();
          p.x = x;
          p.y = y;
          const q = p.matrixTransform(document.getElementById('camera').getScreenCTM());
          return [q.x, q.y];
        },
        [x, y],
      );
    const click = async (x, y, modifier) => {
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.click(...(await screen(x, y)));
      if (modifier) await page.keyboard.up(modifier);
    };
    const drag = async (x, y, nx, ny, modifier) => {
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.move(...(await screen(x, y)));
      await page.mouse.down();
      await page.mouse.move(...(await screen(nx, ny)), { steps: 6 });
      await page.mouse.up();
      if (modifier) await page.keyboard.up(modifier);
    };
    const points = async (id) =>
      require('../.test-build/geometry.cjs').parseContours(
        await page.locator(`.shape[data-id="${id}"]`).getAttribute('d'),
      )[0];
    const load = async () => {
      await page.setInputFiles('#file', {
        name: 'selection.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            version: 1,
            shapes: [shape('A', 200, 140, 150, 100), shape('B', 450, 140, 150, 100)],
          }),
        ),
      });
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.shape').length === 2 &&
          document.getElementById('title').textContent === 'A',
      );
    };
    await load();
    await page.click('#lineSelect');
    await click(275, 140);
    await click(600, 190);
    assert.equal(await page.locator('.selected-edge').count(), 2);
    // No Shift is needed in the explicit line-selection tool; dragging must not drop an already selected line.
    await drag(275, 140, 295, 160);
    assert.equal(await page.locator('.selected-edge').count(), 2);
    assert.deepEqual(await points('A'), [
      [220, 160],
      [370, 160],
      [350, 240],
      [200, 240],
    ]);
    assert.deepEqual(await points('B'), [
      [450, 140],
      [620, 160],
      [620, 260],
      [450, 240],
    ]);
    await page.click('#undo');
    assert.deepEqual(await points('A'), [
      [200, 140],
      [350, 140],
      [350, 240],
      [200, 240],
    ]);
    await page.click('#redo');
    assert.deepEqual(await points('B'), [
      [450, 140],
      [620, 160],
      [620, 260],
      [450, 240],
    ]);
    await load();
    await page.click('#select');
    await click(275, 140);
    await click(350, 190, 'Control');
    assert.equal(await page.locator('.selected-edge').count(), 2);
    await drag(275, 140, 285, 150, 'Shift');
    assert.equal(await page.locator('.selected-edge').count(), 2);
    assert.deepEqual(await points('A'), [
      [210, 150],
      [360, 150],
      [360, 250],
      [200, 240],
    ]);
    await load();
    await page.click('#select');
    await page.mouse.move(...(await screen(150, 100)));
    await page.mouse.down();
    await page.mouse.move(...(await screen(380, 170)), { steps: 6 });
    assert.equal(await page.locator('#marquee rect').count(), 1);
    assert.equal(await page.locator('.handle.selected').count(), 2);
    await page.screenshot({ path: 'tests/preview-selection.png' });
    await page.mouse.up();
    assert.equal(await page.locator('#marquee rect').count(), 0);
    await drag(200, 140, 235, 175);
    assert.deepEqual(await points('A'), [
      [235, 175],
      [385, 175],
      [350, 240],
      [200, 240],
    ]);
    assert.deepEqual(await points('B'), [
      [450, 140],
      [600, 140],
      [600, 240],
      [450, 240],
    ]);
    await page.click('#undo');
    assert.equal(await page.locator('.handle.selected').count(), 2);
    await drag(430, 100, 620, 170, 'Shift');
    assert.equal(await page.locator('.handle.selected').count(), 4);
    await drag(450, 140, 460, 130);
    assert.deepEqual(await points('A'), [
      [210, 130],
      [360, 130],
      [350, 240],
      [200, 240],
    ]);
    assert.deepEqual(await points('B'), [
      [460, 130],
      [610, 130],
      [600, 240],
      [450, 240],
    ]);
    await page.click('#undo');
    await click(200, 140, 'Control');
    assert.equal(await page.locator('.handle.selected').count(), 3);
    // Reverse box direction after zoom/pan must use canvas coordinates, not screen coordinates.
    await load();
    await page.click('#plus');
    await page.click('#plus');
    const canvas = await page.locator('#canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.wheel(30, 20);
    await drag(380, 170, 150, 100);
    assert.equal(await page.locator('.handle.selected').count(), 2);
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await points('A'), [
      [201, 140],
      [351, 140],
      [350, 240],
      [200, 240],
    ]);
    await load();
    await page.mouse.move(...(await screen(150, 100)));
    await page.mouse.down();
    await page.mouse.move(...(await screen(380, 170)), { steps: 5 });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#marquee rect').count(), 0);
    await page.mouse.up();
    assert.deepEqual(await points('A'), [
      [200, 140],
      [350, 140],
      [350, 240],
      [200, 240],
    ]);
    await page.locator('.layer').filter({ hasText: 'A' }).click();
    await page.mouse.move(...(await screen(200, 140)));
    await page.mouse.down();
    await page.mouse.move(...(await screen(220, 160)), { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await points('A'), [
      [200, 140],
      [350, 140],
      [350, 240],
      [200, 240],
    ]);
    // Four selected vertices must remain selected when the drag starts on an edge, not just on a vertex.
    await load();
    await page.click('#fit');
    await drag(150, 100, 380, 270);
    assert.equal(await page.locator('.handle.selected').count(), 4);
    await drag(275, 140, 295, 160);
    assert.equal(await page.locator('.handle.selected').count(), 4);
    assert.deepEqual(await points('A'), [
      [220, 160],
      [370, 160],
      [370, 260],
      [220, 260],
    ]);
    assert.deepEqual(await points('B'), [
      [450, 140],
      [600, 140],
      [600, 240],
      [450, 240],
    ]);
    await load();
    await page.click('#lineSelect');
    await click(275, 140);
    await click(350, 190);
    assert.equal(await page.locator('.handle.selected').count(), 3);
    await drag(200, 140, 210, 150);
    assert.equal(await page.locator('.handle.selected').count(), 3);
    assert.deepEqual(await points('A'), [
      [210, 150],
      [360, 150],
      [360, 250],
      [200, 240],
    ]);
    const hex = {
      ...shape('Hex', 0, 0, 1, 1),
      type: 'hexagon',
      points: [
        [300, 140],
        [500, 140],
        [600, 250],
        [500, 360],
        [300, 360],
        [200, 250],
      ],
    };
    await page.setInputFiles('#file', {
      name: 'hex.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: 1, shapes: [hex] })),
    });
    await page.waitForFunction(() => document.getElementById('title').textContent === 'Hex');
    await page.click('#lineSelect');
    await drag(150, 100, 650, 280);
    assert.equal(await page.locator('.handle.selected').count(), 4);
    await drag(550, 305, 570, 325);
    assert.equal(await page.locator('.handle.selected').count(), 4);
    assert.deepEqual(await points('Hex'), [
      [320, 160],
      [520, 160],
      [620, 270],
      [500, 360],
      [300, 360],
      [220, 270],
    ]);
    assert.deepEqual(
      errors.filter((e) => e !== 'Canceled'),
      [],
    );
    console.log(
      'Seleção: quatro de seis pontos preservados ao arrastar pela borda; os dois não selecionados permanecem fixos.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
