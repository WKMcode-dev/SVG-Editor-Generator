const { chromium } = require('./browser-helper.cjs');
const assert = require('node:assert/strict'),
  path = require('node:path');
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
    await page.waitForSelector('.handle');
    const set = async (id, value) => {
      await page.locator('#' + id).fill(value);
      await page.locator('#' + id).dispatchEvent('change');
    };
    await set('radius', '20');
    assert.match(await page.locator('.shape').getAttribute('d'), /A 20 20/);
    assert.equal(await page.locator('.handle').count(), 4);
    await page.click('#undo');
    assert.ok(!(await page.locator('.shape').getAttribute('d')).includes('A '));
    await page.click('#redo');
    await page.selectOption('#radiusUnit', '%');
    assert.equal(Number(await page.locator('#radius').inputValue()), 9.091);
    await set('radius', '80');
    assert.equal(await page.locator('#radius').inputValue(), '50');
    assert.match(await page.locator('.shape').getAttribute('d'), /A 110 110/);
    await page.reload();
    await page.waitForSelector('.handle');
    assert.equal(await page.locator('#radius').inputValue(), '50');
    assert.equal(await page.locator('#radiusUnit').inputValue(), '%');
    const result = await page.evaluate(() => {
      const svg = VectorBridge.svg();
      const ok = VectorBridge.applySvg(svg);
      return { ok, svg, valid: VectorBridge.validate(svg) };
    });
    assert.equal(result.ok, true);
    assert.equal(result.valid.valid, true);
    assert.equal(await page.locator('#radius').inputValue(), '50');
    assert.equal(
      await page.evaluate(() => {
        const doc = new DOMParser().parseFromString(VectorBridge.svg(), 'application/xml');
        const path = doc.querySelector('path');
        const radii = JSON.parse(path.getAttribute('data-corner-radii'));
        Object.values(radii).forEach((radius) => (radius.value = 10));
        path.setAttribute('data-corner-radii', JSON.stringify(radii));
        return VectorBridge.applySvg(new XMLSerializer().serializeToString(doc));
      }),
      true,
    );
    assert.equal(await page.locator('#radius').inputValue(), '10');
    assert.match(await page.locator('.shape').getAttribute('d'), /A 22 22/);
    assert.match(await page.locator('#source').inputValue(), /A 22 22/);
    assert.equal(
      await page.evaluate(
        () => VectorBridge.validate(document.getElementById('source').value).valid,
      ),
      true,
    );
    await page.screenshot({ path: 'tests/radius-preview.png' });
    assert.deepEqual(errors, []);
    console.log('Corner radius: px, %, limite, histórico, restauração e edição SVG aprovados.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
