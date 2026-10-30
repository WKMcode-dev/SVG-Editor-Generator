const { chromium, editorURL } = require('./browser-helper.cjs');
const assert = require('node:assert/strict');
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
    assert.equal(await page.locator('.handle').count(), 0, 'points are hidden before editing');
    const hit = page.locator('.shape-hit').first();
    await hit.dblclick();
    assert.equal(await page.locator('.handle').count(), 4, 'double click enters point editing');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.handle').count(), 0);
    const box = await page.locator('#canvas').boundingBox();
    async function draw(key, shift = false) {
      await page.keyboard.press(key);
      await page.mouse.move(box.x + 90, box.y + 110);
      await page.mouse.down();
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(box.x + 220, box.y + 200, { steps: 8 });
      await page.mouse.up();
      if (shift) await page.keyboard.up('Shift');
    }
    await draw('r', true);
    let p = await project();
    assert.equal(p.shapes.at(-1).type, 'rectangle');
    let pts = p.shapes.at(-1).points;
    assert.ok(Math.abs(pts[1][0] - pts[0][0] - (pts[2][1] - pts[1][1])) < 0.01);
    await draw('o', true);
    assert.equal((await project()).shapes.at(-1).type, 'ellipse');
    await draw('l');
    assert.equal((await project()).shapes.at(-1).points.length, 2);
    await draw('Shift+l');
    assert.equal((await project()).shapes.at(-1).type, 'arrow');
    await page.click('#shapeTool');
    await page.click('[data-draw="star"]');
    await page.mouse.move(box.x + 300, box.y + 140);
    await page.mouse.down();
    await page.mouse.move(box.x + 420, box.y + 270, { steps: 5 });
    await page.mouse.up();
    p = await project();
    const star = p.shapes.at(-1);
    assert.equal(star.type, 'star');
    assert.equal(star.points.length, 10);
    const starRow = page.locator(`[data-key="${star.id}"]`);
    await starRow.locator('.layer-name').dblclick();
    await starRow.locator('input').fill('Minha estrela');
    await starRow.locator('input').press('Enter');
    assert.equal((await project()).shapes.at(-1).name, 'Minha estrela');
    await starRow.locator('.layer-lock').click();
    assert.equal((await project()).shapes.at(-1).locked, true);
    const before = (await project()).shapes.at(-1).points;
    await page.keyboard.press('ArrowRight');
    assert.deepEqual((await project()).shapes.at(-1).points, before);
    await starRow.locator('.layer-lock').click();
    await starRow.locator('.layer-eye').click();
    assert.equal((await project()).shapes.at(-1).hidden, true);
    assert.equal(await page.locator(`g[data-id="${star.id}"]`).isVisible(), false);
    await starRow.locator('.layer-eye').click();
    await page.locator('.layer').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+g');
    assert.equal(await page.locator('.group-row').count(), 1);
    await page.keyboard.press('Control+Shift+g');
    assert.equal(await page.locator('.group-row').count(), 0);
    await page.locator('.layer').first().click();
    await page.click('#assetsTab');
    await page.click('#savePreset');
    assert.equal(await page.locator('.saved-preset').count(), 1);
    const count = (await project()).shapes.length;
    await page.locator('.saved-preset button').first().click();
    assert.equal((await project()).shapes.length, count + 1);
    await page.click('#fileTab');
    const z = () => page.locator('#zoom').innerText();
    const old = await z();
    await page.locator('#canvas').dispatchEvent('wheel', {
      deltaY: -40,
      ctrlKey: true,
      clientX: box.x + 400,
      clientY: box.y + 350,
    });
    assert.notEqual(await z(), old, 'trackpad ctrl-wheel zooms');
    const zoomed = await z();
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.waitForTimeout(60);
    assert.equal(await z(), zoomed, 'resize must preserve zoom');
    const oldTouch = await z();
    await page.locator('#canvas').dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 21,
      clientX: box.x + 200,
      clientY: box.y + 300,
    });
    await page.locator('#canvas').dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 22,
      clientX: box.x + 300,
      clientY: box.y + 300,
    });
    await page.locator('#canvas').dispatchEvent('pointermove', {
      pointerType: 'touch',
      pointerId: 22,
      clientX: box.x + 350,
      clientY: box.y + 300,
    });
    await page
      .locator('#canvas')
      .dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 22 });
    await page
      .locator('#canvas')
      .dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 21 });
    assert.notEqual(await z(), oldTouch, 'two touch pointers pinch the camera');
    await page.setViewportSize({ width: 1440, height: 940 });
    await page.click('#fit');
    const svg = await page.evaluate(() => window.VectorBridge.svg());
    assert.ok(!svg.includes('viewBox="0 0 800 500"'));
    assert.equal(
      await page.locator('#camera > rect:not(#gridRect)').count(),
      0,
      'there is no artboard rectangle',
    );
    await page.click('#code');
    await page.waitForFunction(() => !!window.CodeWorkbench);
    await page.evaluate(() => window.CodeWorkbench.setValue('svg', window.VectorBridge.svg()));
    await page.waitForFunction(
      () => !document.querySelector('#codeStatus').classList.contains('error'),
    );
    await page.click('#close');
    // Import an actual encoded video, then a large raster to exercise IndexedDB autosave.
    const video = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1a90ff';
      ctx.fillRect(0, 0, 64, 48);
      const stream = c.captureStream(10),
        chunks = [],
        rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      return await new Promise((resolve) => {
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(',')[1]);
          r.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
        };
        rec.start();
        setTimeout(() => rec.stop(), 400);
      });
    });
    await page.locator('#mediaFile').setInputFiles({
      name: 'demo.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from(video, 'base64'),
    });
    await page.waitForSelector('.media-content video');
    await page.click('#playMedia');
    await page.waitForFunction(() => !document.querySelector('.media-content video').paused);
    assert.equal(
      await page.locator('.media-content video').evaluate((el) =>
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 10,
            clientY: 10,
          }),
        ),
      ),
      true,
      'native video controls keep their pointer events',
    );
    await page.click('#playMedia');
    const image = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 1000;
      const ctx = c.getContext('2d'),
        data = ctx.createImageData(1200, 1000);
      let n = 7;
      for (let i = 0; i < data.data.length; i += 4) {
        n = (Math.imul(n, 1664525) + 1013904223) | 0;
        data.data[i] = n & 255;
        data.data[i + 1] = (n >>> 8) & 255;
        data.data[i + 2] = (n >>> 16) & 255;
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#mediaFile').setInputFiles({
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
    await page.waitForSelector('.media-content image');
    await page.waitForFunction(
      () => localStorage.getItem('svg-editor-project') === '{"storage":"indexeddb"}',
    );
    await page.reload();
    await page.waitForSelector('.media-content image');
    await page.waitForSelector('.media-content video');
    assert.ok(await page.locator('#saveStatus').innerText());
    const roundtrip = await page.evaluate(() =>
      window.VectorBridge.validate(window.VectorBridge.svg()),
    );
    assert.equal(roundtrip.valid, true, roundtrip.message);
    await page.click('#fit');
    await page.screenshot({ path: 'tests/figma-workspace-preview.png' });
    await page.setViewportSize({ width: 980, height: 700 });
    await page.screenshot({ path: 'tests/figma-workspace-compact.png' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const id of ['shapeTool', 'editPoints', 'booleanMenu', 'export']) {
      const b = await page.locator('#' + id).boundingBox();
      assert.ok(b && b.x >= 0 && b.x + b.width <= 981, id + ' remains reachable');
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS 2.0 workspace: shortcuts, draw tools, point mode, layers, groups, presets, pinch, media, IndexedDB and SVG round trip',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
