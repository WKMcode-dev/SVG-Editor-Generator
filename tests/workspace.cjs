const { chromium, editorURL } = require('./browser-helper.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(editorURL);
    await page.waitForSelector('.shape');
    await page.fill('#shapeX', '100');
    await page.locator('#shapeX').press('Tab');
    assert.equal(await page.locator('#shapeX').inputValue(), '100');
    await page.click('[data-align="right"]');
    assert.ok(Number(await page.locator('#shapeX').inputValue()) > 100);
    await page.click('#undo');
    assert.equal(await page.locator('#shapeX').inputValue(), '100');
    await page.click('#assetsTab');
    await page.click('[data-type="triangle"]');
    await page.click('#fileTab');
    await page.locator('.layer-name').first().dblclick();
    await page.locator('.layer-name-input').fill('Marca');
    await page.locator('.layer-name-input').press('Enter');
    await page.fill('#layerFilter', 'marca');
    assert.equal(await page.locator('.layer').count(), 1);
    await page.fill('#layerFilter', '');
    await page.locator('.layer').first().click();
    await page.keyboard.press('Control+a');
    assert.equal(await page.locator('.layer[aria-pressed="true"]').count(), 2);
    await page.click('[data-align="left"]');
    await page.click('#fit');
    await page.click('#shortcuts');
    assert.equal(await page.locator('#shortcutsDialog').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.click('#toggleLeft');
    assert.equal(await page.locator('.layers-panel').isVisible(), false);
    await page.click('#toggleLeft');
    await page.setViewportSize({ width: 980, height: 700 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log(
      'PASS inspector, position, alignment, layer rename/search, keyboard selection, panels and compact layout',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
