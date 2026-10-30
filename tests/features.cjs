const { chromium } = require('./browser-helper.cjs');
const assert = require('node:assert/strict'),
  path = require('node:path');
const fixture = (name, x, y, w, h) => ({
  id: name,
  name,
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
    page.on('pageerror', (e) => e.message !== 'Canceled' && errors.push(e.message));
    await page.goto(require('./browser-helper.cjs').editorURL);
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
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
    const click = async (x, y, modifiers = []) => {
      for (const k of modifiers) await page.keyboard.down(k);
      await page.mouse.click(...(await screen(x, y)));
      for (const k of modifiers) await page.keyboard.up(k);
    };
    const drag = async (x, y, nx, ny) => {
      await page.mouse.move(...(await screen(x, y)));
      await page.mouse.down();
      await page.mouse.move(...(await screen(nx, ny)), { steps: 6 });
      await page.mouse.up();
    };
    const contours = async () =>
      require('../.test-build/geometry.cjs').parseContours(
        await page.locator('.shape').getAttribute('d'),
      );
    const area = async () =>
      Math.abs(
        (await contours()).reduce(
          (total, ring) =>
            total +
            ring.reduce((n, p, i) => {
              const q = ring[(i + 1) % ring.length];
              return n + p[0] * q[1] - q[0] * p[1];
            }, 0) /
              2,
          0,
        ),
      );
    const load = async (shapes) => {
      await page.setInputFiles('#file', {
        name: 'fixture.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ version: 1, shapes, background: 'dark' })),
      });
      await page.waitForFunction(
        (expected) =>
          [...document.querySelectorAll('.layer-name')].map((b) => b.textContent).join('|') ===
          expected,
        shapes
          .map((s) => s.name)
          .reverse()
          .join('|'),
      );
      await page.click('#editPoints');
    };
    assert.equal(await page.locator('#shapeWidth').inputValue(), '400');
    assert.equal(await page.locator('#shapeHeight').inputValue(), '220');
    await page.mouse.move(...(await screen(400, 140)));
    assert.equal(await page.locator('.shape-hit').evaluate((e) => e.style.cursor), 'move');
    await drag(400, 140, 440, 110);
    assert.deepEqual((await contours())[0], [
      [240, 110],
      [640, 110],
      [600, 360],
      [200, 360],
    ]);
    assert.equal(await page.locator('.selected-edge').count(), 1);
    await page.click('#undo');
    assert.deepEqual((await contours())[0], [
      [200, 140],
      [600, 140],
      [600, 360],
      [200, 360],
    ]);
    await page.click('.layer');
    await page.click('#editPoints');
    await click(400, 140);
    await click(600, 250, ['Shift']);
    assert.equal(await page.locator('.selected-edge').count(), 2);
    await drag(400, 140, 410, 150);
    assert.deepEqual((await contours())[0], [
      [210, 150],
      [610, 150],
      [610, 370],
      [200, 360],
    ]);
    await page.click('#undo');
    await page.click('.layer');
    await page.click('#editPoints');
    await page.fill('#shapeWidth', '500');
    await page.locator('#shapeWidth').press('Tab');
    await page.fill('#shapeHeight', '300');
    await page.locator('#shapeHeight').press('Tab');
    assert.deepEqual((await contours())[0], [
      [200, 140],
      [700, 140],
      [700, 440],
      [200, 440],
    ]);
    await page.check('#lockRatio');
    await page.fill('#shapeWidth', '250');
    await page.locator('#shapeWidth').press('Tab');
    assert.equal(await page.locator('#shapeHeight').inputValue(), '150');
    await page.click('#background');
    assert.ok(await page.locator('.stage').evaluate((e) => !e.classList.contains('map-light')));
    await page.reload();
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
    await page.waitForSelector('.handle');
    assert.equal(await page.locator('#shapeWidth').inputValue(), '250');
    assert.equal(await page.locator('#shapeHeight').inputValue(), '150');
    assert.ok(await page.locator('.stage').evaluate((e) => !e.classList.contains('map-light')));
    const a = fixture('A', 200, 140, 100, 100),
      b = fixture('B', 250, 140, 100, 100);
    await load([a, b]);
    await page.locator('.layer').filter({ hasText: 'B' }).click();
    await page.fill('#shapeWidth', '140');
    await page.locator('#shapeWidth').press('Tab');
    await page.reload();
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
    await page.waitForSelector('.handle');
    assert.equal(await page.locator('#title').innerText(), 'B');
    assert.equal(await page.locator('#shapeWidth').inputValue(), '140');
    for (const [op, expected] of [
      ['union', 15000],
      ['difference', 5000],
      ['intersection', 5000],
      ['xor', 10000],
      ['flatten', 15000],
    ]) {
      await load([a, b]);
      await page
        .locator('.layer')
        .filter({ hasText: 'B' })
        .click({ modifiers: ['Shift'] });
      assert.equal(await page.locator('.layer.active').count(), 2);
      await page.click('#booleanMenu');
      await page.click(`[data-operation="${op}"]`);
      assert.equal(await page.locator('.shape').count(), 1);
      assert.equal(await area(), expected);
      await page.click('#undo');
      assert.equal(await page.locator('.shape').count(), 2);
      await page.click('#redo');
      assert.equal(await area(), expected);
    }
    await load([fixture('Exterior', 200, 140, 200, 200), fixture('Recorte', 250, 190, 50, 50)]);
    await page
      .locator('.layer')
      .filter({ hasText: 'Recorte' })
      .click({ modifiers: ['Shift'] });
    await page.click('#booleanMenu');
    await page.click('[data-operation="difference"]');
    assert.equal(await area(), 37500);
    assert.equal((await contours()).length, 2);
    await click(275, 215);
    assert.equal(await page.locator('.handle').count(), 0);
    await page.click('.layer');
    await page.click('#editPoints');
    assert.equal(await page.locator('#contour option').count(), 2);
    await page.click('#code');
    const text = await page.locator('#source').inputValue();
    assert.equal((text.match(/            M /g) || []).length, 2);
    await page.evaluate(
      (text) => window.CodeWorkbench.setValue('svg', text),
      text.replace('stroke="#ff9b20"', 'stroke="#40bf80"'),
    );
    await page.waitForFunction(() =>
      document.getElementById('codeStatus').textContent.includes('mapa atualizado'),
    );
    assert.equal(await area(), 37500);
    assert.equal(await page.locator('.shape').getAttribute('stroke'), '#40bf80');
    await page.click('#close');
    await page.fill('#shapeWidth', '400');
    await page.locator('#shapeWidth').press('Tab');
    await page.waitForFunction(() => {
      const s = JSON.parse(localStorage.getItem('svg-editor-project')).shapes[0],
        xs = s.polygons.flat(2).map((p) => p[0]);
      return Math.max(...xs) - Math.min(...xs) === 400;
    });
    assert.equal(await area(), 75000);
    await page.reload();
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
    await page.waitForSelector('.shape');
    assert.equal(await area(), 75000);
    assert.equal((await contours()).length, 2);
    const outer = (await contours())[0];
    await drag(350, 190, 350, 180);
    assert.deepEqual((await contours())[0], outer);
    assert.equal(await area(), 74000);
    await page.click('#undo');
    assert.equal(await area(), 75000);
    await page.click('#background');
    await page.click('#booleanMenu');
    await page.screenshot({ path: 'tests/preview-v1.2.png' });
    assert.deepEqual(errors, []);
    console.log(
      'v1.2: bordas isoladas, múltiplos segmentos, dimensões, proporção, tema, persistência, cinco operações, vazados, histórico e código composto passaram.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
