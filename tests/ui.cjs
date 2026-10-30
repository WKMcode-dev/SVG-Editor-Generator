const { chromium } = require('./browser-helper.cjs');
const assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [],
      downloads = [];
    page.on('pageerror', (e) => e.message !== 'Canceled' && errors.push(e.message));
    page.on('download', (d) => downloads.push(d));
    await page.goto(require('./browser-helper.cjs').editorURL);
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
    const pointOnScreen = async (x, y) =>
      page.evaluate(
        ([x, y]) => {
          const svg = document.getElementById('canvas'),
            p = svg.createSVGPoint();
          p.x = x;
          p.y = y;
          const transformed = p.matrixTransform(document.getElementById('camera').getScreenCTM());
          return [transformed.x, transformed.y];
        },
        [x, y],
      );
    const clickAt = async (x, y, twice = false) => {
      const [cx, cy] = await pointOnScreen(x, y);
      if (twice && (await page.locator('.handle').count()) === 0) await page.mouse.dblclick(cx, cy);
      await page.mouse[twice ? 'dblclick' : 'click'](cx, cy);
    };
    const dragPoint = async (index, x, y) => {
      const b = await page.locator('.handle').nth(index).boundingBox();
      const [cx, cy] = await pointOnScreen(x, y);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(cx, cy, { steps: 5 });
      await page.mouse.up();
    };
    const firstX = async () => Number(await page.locator('.handle').first().getAttribute('cx'));
    await page.waitForSelector('.handle');
    assert.equal(await page.locator('.handle').count(), 4);
    await page.click('#delete');
    await page.waitForSelector('#emptyCanvas');
    await page.click('#save');
    await page.click('#export');
    assert.equal(downloads.length, 0);
    assert.match(await page.locator('#toast').innerText(), /ao menos uma forma/);
    await page.click('#assetsTab');
    await page.click('[data-type="rectangle"]');
    await page.click('#fileTab');
    await page.click('#editPoints');
    assert.equal(await page.locator('.handle').count(), 4);
    assert.equal(await firstX(), 200);
    const canvasBox = await page.locator('#canvas').boundingBox();
    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    assert.equal(await page.locator('.handle').count(), 0);
    assert.equal(await page.locator('.shape').count(), 1);
    await clickAt(400, 140, true);
    assert.equal(await page.locator('.handle').count(), 5);
    assert.equal(await page.locator('#px').inputValue(), '400');
    assert.equal(await page.locator('#py').inputValue(), '140');
    await page.click('#undo');
    assert.equal(await page.locator('.handle').count(), 4);
    await page.click('.layer');
    await page.click('#editPoints');
    assert.equal(await page.locator('.handle').count(), 4);
    await page.check('#noFill');
    await clickAt(600, 250, true);
    assert.equal(await page.locator('.handle').count(), 5);
    await page.click('#undo');
    assert.equal(await page.locator('.handle').count(), 4);
    await page.click('#gridSettings');
    await page.selectOption('#gridType', 'dots');
    await page.fill('#cellSize', '32');
    await page.locator('#cellSize').press('Tab');
    await page.fill('#stepX', '8');
    await page.locator('#stepX').press('Tab');
    await page.fill('#stepY', '4');
    await page.locator('#stepY').press('Tab');
    await page.click('#closeGrid');
    assert.equal(await page.locator('#dotPattern').getAttribute('width'), '32');
    assert.equal(await page.locator('#gridRect').getAttribute('fill'), 'url(#dotPattern)');
    await dragPoint(0, 205, 147);
    assert.equal(await firstX(), 208);
    assert.equal(await page.locator('.handle').first().getAttribute('cy'), '148');
    await page.keyboard.press('ArrowRight');
    assert.equal(await firstX(), 216);
    await page.keyboard.press('Shift+ArrowDown');
    assert.equal(await page.locator('.handle').first().getAttribute('cy'), '188');
    await page.click('#magnet');
    assert.equal(await page.locator('#magnet').getAttribute('aria-pressed'), 'false');
    await dragPoint(0, 213.3, 151.7);
    assert.ok(Math.abs((await firstX()) - 213.3) < 0.1);
    await page.click('#code');
    await page.waitForFunction(() => !!window.CodeWorkbench);
    await page.click('#fit');
    assert.equal(await page.locator('#source').getAttribute('readonly'), null);
    const source = await page.locator('#source').inputValue();
    assert.match(source, /\n            M/);
    await page.evaluate(
      (text) => window.CodeWorkbench.setValue('svg', text),
      source.replace(/M [^\n]+/, 'M 180 120').replace(/stroke="#[0-9a-f]{6}"/i, 'stroke="#00aaff"'),
    );
    await page.waitForFunction(() =>
      document.querySelector('#codeStatus').textContent.includes('mapa atualizado'),
    );
    assert.equal(await firstX(), 180);
    assert.equal(await page.locator('.shape').getAttribute('stroke'), '#00aaff');
    const good = await page.locator('#source').inputValue();
    await page.evaluate(
      (text) => window.CodeWorkbench.setValue('svg', text),
      good.replace('Z', 'C'),
    );
    await page.waitForSelector('#codeStatus.error');
    assert.equal(await firstX(), 180);
    await page.evaluate((text) => window.CodeWorkbench.setValue('svg', text), good);
    await page.waitForFunction(
      () => !document.querySelector('#codeStatus').classList.contains('error'),
    );
    await page.click('#format');
    assert.match(await page.locator('#source').inputValue(), /            M 180 120/);
    // Code panel stays beside the canvas; graphical changes synchronize back into the text.
    await dragPoint(0, 190, 130);
    const changed = [
      Number(await page.locator('.handle').first().getAttribute('cx')),
      Number(await page.locator('.handle').first().getAttribute('cy')),
    ];
    assert.ok(Math.abs(changed[0] - 190) < 1 && Math.abs(changed[1] - 130) < 1);
    const changedPattern = new RegExp('M ' + changed.join(' '));
    assert.match(await page.locator('#source').inputValue(), changedPattern);
    await page.screenshot({ path: 'tests/ui-preview.png' });
    await page.click('#close');
    const saved = page.waitForEvent('download');
    await page.click('#save');
    const json = JSON.parse(fs.readFileSync(await (await saved).path(), 'utf8'));
    assert.equal(json.grid.cell, 32);
    assert.equal(json.grid.stepX, 8);
    const exported = page.waitForEvent('download');
    await page.click('#export');
    const xml = fs.readFileSync(await (await exported).path(), 'utf8');
    assert.match(xml, changedPattern);
    assert.ok(!xml.includes('pattern'));
    await page.click('#delete');
    assert.equal(await page.locator('.shape').count(), 0);
    assert.equal(await page.locator('.handle').count(), 0);
    await page.reload();
    await page.waitForSelector('#emptyCanvas');
    assert.equal(await page.locator('.shape').count(), 0);
    await page.click('#gridSettings');
    await page.fill('#cellSize', '20');
    await page.locator('#cellSize').press('Tab');
    await page.fill('#stepX', '3');
    await page.locator('#stepX').press('Tab');
    await page.click('#closeGrid');
    await page.setInputFiles('#file', {
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json)),
    });
    await page.waitForSelector('.shape');
    await page.click('#editPoints');
    assert.equal(await firstX(), changed[0]);
    assert.equal(await page.locator('#dotPattern').getAttribute('width'), '32');
    assert.equal(await page.locator('#stepX').inputValue(), '8');
    assert.deepEqual(errors, []);
    console.log(
      'UI: projeto vazio, cantos normais, deseleção, duplo clique, ímã, passos, código ao vivo, erros, sincronização, arquivos e persistência passaram.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
