const { chromium } = require('./browser-helper.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}),
  });
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    await p.goto(require('./browser-helper.cjs').editorURL);
    await p.waitForSelector('.handle');
    const screen = async (x, y) =>
      p.evaluate(
        ([x, y]) => {
          const q = document.getElementById('canvas').createSVGPoint();
          q.x = x;
          q.y = y;
          const z = q.matrixTransform(document.getElementById('camera').getScreenCTM());
          return [z.x, z.y];
        },
        [x, y],
      );
    await p.mouse.click(...(await screen(200, 140)));
    await p.keyboard.down('Control');
    await p.mouse.click(...(await screen(600, 140)));
    await p.keyboard.up('Control');
    await p.locator('#radius').fill('20');
    await p.locator('#radius').dispatchEvent('change');
    let d = await p.locator('.shape').getAttribute('d');
    assert.equal((d.match(/A /g) || []).length, 2);
    assert.match(d, /L 600 360/);
    assert.equal(await p.evaluate(() => VectorBridge.applySvg(VectorBridge.svg())), true);
    await p.reload();
    await p.waitForSelector('.shape');
    assert.equal(((await p.locator('.shape').getAttribute('d')).match(/A /g) || []).length, 2);
    await p.locator('#strokeWidth').fill('20');
    await p.locator('#strokeWidth').dispatchEvent('change');
    for (const join of ['miter', 'round', 'bevel']) {
      await p.selectOption('#join', join);
      assert.equal(
        await p.locator('.shape').evaluate((e) => getComputedStyle(e).strokeLinejoin),
        join,
      );
      assert.ok(
        (await p.evaluate(() => VectorBridge.svg())).includes('stroke-linejoin="' + join + '"'),
      );
    }
    const handle = await p.locator('[data-resize="2"]').boundingBox();
    await p.mouse.move(handle.x + handle.width - 0.5, handle.y + handle.height / 2);
    await p.keyboard.down('Shift');
    await p.mouse.down();
    await p.mouse.move(...(await screen(700, 400)), { steps: 5 });
    await p.mouse.up();
    await p.keyboard.up('Shift');
    const w = Number(await p.locator('#shapeWidth').inputValue()),
      h = Number(await p.locator('#shapeHeight').inputValue());
    assert.ok(w > 400);
    assert.ok(Math.abs(w / h - 400 / 220) < 0.001);
    await p.click('#undo');
    assert.equal(await p.locator('#shapeWidth').inputValue(), '400');
    console.log(
      'Raio em 2 pontos, SVG, persistência, 3 junções e arraste proporcional Shift aprovados.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
