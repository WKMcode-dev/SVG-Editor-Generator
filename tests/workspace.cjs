const { chromium, editorURL } = require('./browser-helper.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(editorURL);
    await page.waitForSelector('.shape');
    await page.fill('#shapeX', '100');
    await page.locator('#shapeX').press('Tab');
    assert.equal(await page.locator('#shapeX').inputValue(), '100');
    await page.click('[data-align="right"]');
    assert.equal(await page.locator('#shapeX').inputValue(), '400');
    await page.click('#undo');
    assert.equal(await page.locator('#shapeX').inputValue(), '100');
    await page.click('[data-type="triangle"]');
    await page.locator('.layer').first().dblclick();
    await page.locator('#name').fill('Marca');
    await page.locator('#name').press('Tab');
    await page.fill('#layerFilter', 'marca');
    assert.equal(await page.locator('.layer').count(), 1);
    await page.fill('#layerFilter', '');
    await page.click('#fitSelection');
    await page.keyboard.press('Control+a');
    assert.equal(await page.locator('.layer[aria-pressed="true"]').count(), 2);
    await page.click('[data-align="left"]');
    await page.click('#fit');
    await page.screenshot({ path: 'tests/workspace-preview.png' });
    await page.click('#shortcuts');
    assert.equal(await page.locator('#shortcutsDialog').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#shortcutsDialog').isVisible(), false);
    await page.setViewportSize({ width: 980, height: 700 });
    await page.screenshot({ path: 'tests/workspace-compact.png' });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'The minimum desktop width must not overflow',
    );
    for (const id of ['fitSelection', 'booleanMenu', 'shortcuts', 'export']) {
      const box = await page.locator('#' + id).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 981, id + ' must remain accessible');
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS workspace: position, alignment, history, rename, search, selection, shortcuts and 980px layout',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
