const { chromium, editorURL } = require('./browser-helper.cjs'),
  assert = require('node:assert/strict');
const rect = (id, x = 0) => ({
  id,
  name: id,
  type: 'rectangle',
  points: [
    [x, 0],
    [x + 100, 0],
    [x + 100, 80],
    [x, 80],
  ],
  fill: '#cccccc',
  stroke: '#737373',
  strokeWidth: 2,
  opacity: 100,
  join: 'miter',
  cut: 0,
});
const load = async (page, withLine = false) => {
  await page.setInputFiles('#file', {
    name: 'tools.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        shapes: [
          rect('A'),
          withLine
            ? {
                ...rect('B', 160),
                type: 'line',
                points: [
                  [160, 0],
                  [260, 80],
                ],
              }
            : rect('B', 160),
          rect('C', 320),
        ],
        lastSelectedId: 'A',
      }),
    ),
  });
  await page.waitForSelector('[data-key="A"]', { state: 'attached' });
};
const project = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('svg-editor-project')));
(async () => {
  const browser = await chromium.launch({ headless: true });
  let currentPage;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [];
    currentPage = page;
    page.on('pageerror', (e) => {
      if (e.message !== 'Canceled') errors.push(e.message);
    });
    await page.goto(editorURL);
    await page.waitForSelector('.shape');
    await load(page, true);
    await page.locator('[data-key="A"] .layer').click();
    await page.keyboard.press('Control+a');
    await page.click('#booleanMenu');
    assert.ok(await page.locator('[data-operation="union"]').isDisabled());
    assert.ok(await page.locator('[data-selection-action="group"]').isEnabled());
    await page.click('[data-selection-action="group"]');
    assert.equal(await page.locator('.group-row').count(), 1);
    const grouped = (await project(page)).shapes;
    assert.equal(new Set(grouped.map((s) => s.group.id)).size, 1);
    assert.equal(grouped.find((s) => s.id === 'B').type, 'line');
    await page.reload();
    await page.waitForSelector('.group-row');
    const canvasBox = await page.locator('#canvas').boundingBox();
    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    const memberBox = await page.locator('.shape[data-id="A"]').boundingBox();
    const startX = memberBox.x + memberBox.width / 2;
    const startY = memberBox.y + memberBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 35, startY + 25, { steps: 8 });
    await page.mouse.up();
    const movedGroup = (await project(page)).shapes;
    const dx = movedGroup[0].points[0][0] - grouped[0].points[0][0];
    const dy = movedGroup[0].points[0][1] - grouped[0].points[0][1];
    assert.ok(Math.abs(dx) + Math.abs(dy) > 1);
    for (let i = 0; i < grouped.length; i++) {
      assert.ok(Math.abs(movedGroup[i].points[0][0] - grouped[i].points[0][0] - dx) < 0.01);
      assert.ok(Math.abs(movedGroup[i].points[0][1] - grouped[i].points[0][1] - dy) < 0.01);
    }
    await page.click('#booleanMenu');
    await page.click('[data-selection-action="ungroup"]');
    assert.equal(await page.locator('.group-row').count(), 0);
    assert.ok((await project(page)).shapes.every((s) => !s.group));
    await page.click('#undo');
    assert.equal(await page.locator('.group-row').count(), 1);
    await load(page);
    await page.locator('[data-key="A"] .layer').click();
    // Rotation stays discoverable after entering point editing, without resize targets
    // stealing vertex hits. The actual pointer drag must change geometry and undo cleanly.
    assert.equal(await page.locator('[data-rotation-icon]').count(), 1);
    const selectedShape = page.locator('.shape[data-id="A"]');
    const shapeBox = await selectedShape.boundingBox();
    await page.mouse.dblclick(shapeBox.x + shapeBox.width / 2, shapeBox.y + shapeBox.height / 2);
    assert.ok(
      await page.locator('.stage').evaluate((el) => el.classList.contains('editing-points')),
    );
    assert.equal(await page.locator('[data-resize]').count(), 0);
    assert.ok(await page.locator('[data-rotate]').isVisible());
    const rotationBefore = (await project(page)).shapes[0].points;
    const rotateBox = await page.locator('[data-rotate]').boundingBox();
    await page.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(shapeBox.x + shapeBox.width + 40, shapeBox.y + shapeBox.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    assert.notDeepEqual((await project(page)).shapes[0].points, rotationBefore);
    await page.click('#undo');
    assert.deepEqual((await project(page)).shapes[0].points, rotationBefore);
    await page.click('#select');
    assert.equal(await page.locator('#lockRatio').getAttribute('type'), 'button');
    await page.click('#lockRatio');
    assert.equal(await page.locator('#lockRatio').getAttribute('aria-pressed'), 'true');
    await page.fill('#shapeWidth', '200');
    await page.locator('#shapeWidth').press('Tab');
    assert.equal(await page.locator('#shapeHeight').inputValue(), '160');
    await page.click('#lockRatio');
    await page.click('#toggleStroke');
    assert.equal(await page.locator('.shape[data-id="A"]').getAttribute('stroke'), 'none');
    assert.equal((await project(page)).shapes[0].strokeWidth, 2);
    await page.click('#toggleStroke');
    assert.equal(await page.locator('.shape[data-id="A"]').getAttribute('stroke'), '#737373');
    const before = (await project(page)).shapes[0].points;
    await page.fill('#skewX', '20');
    await page.locator('#skewX').press('Tab');
    assert.notDeepEqual((await project(page)).shapes[0].points, before);
    assert.equal(await page.locator('#skewX').inputValue(), '0');
    await page.click('#undo');
    assert.deepEqual((await project(page)).shapes[0].points, before);
    const target = await page.locator('[data-resize="2"]').boundingBox();
    assert.ok(target.width >= 27);
    await page.mouse.move(target.x + 2, target.y + 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 44, target.y + 34, { steps: 8 });
    await page.mouse.up();
    assert.ok(
      Number(await page.locator('#shapeWidth').inputValue()) > 200,
      'Corner can be grabbed away from its visible border',
    );
    await page
      .locator('[data-key="A"]')
      .dragTo(page.locator('[data-key="C"]'), { targetPosition: { x: 70, y: 3 } });
    assert.deepEqual(
      (await project(page)).shapes.map((s) => s.id),
      ['B', 'C', 'A'],
    );
    await page.click('#undo');
    assert.deepEqual(
      (await project(page)).shapes.map((s) => s.id),
      ['A', 'B', 'C'],
    );
    await page.click('#toggleStroke');
    await page.reload();
    await page.waitForSelector('.shape');
    assert.equal((await project(page)).shapes.find((s) => s.id === 'A').noStroke, true);
    assert.deepEqual(errors, []);
    await page.close();
    for (const width of [360, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const mobile = await context.newPage();
      currentPage = mobile;
      await mobile.goto(editorURL);
      await mobile.waitForSelector('.shape');
      await load(mobile);
      await mobile.evaluate(() => {
        window.testPanelEvents = [];
        for (const type of ['pointerdown', 'pointerup', 'click'])
          document.addEventListener(
            type,
            (event) => {
              if (event.target.closest?.('#toggleLeft'))
                window.testPanelEvents.push({
                  type,
                  detail: event.detail,
                  pointer: event.pointerType,
                  classes: document.body.className,
                });
            },
            true,
          );
      });
      assert.ok(
        await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'No horizontal page overflow',
      );
      const canvas = await mobile.locator('#canvas').boundingBox();
      assert.ok(canvas.width <= width && canvas.width > width - 10);
      await mobile.locator('#toggleRight').tap();
      await mobile.locator('#toggleStroke').tap();
      await mobile.locator('#lockRatio').tap();
      const right = await mobile.locator('.right').boundingBox();
      assert.ok(right.x >= 0 && right.x + right.width <= width + 1);
      await mobile.locator('#toggleRight').tap();
      await mobile.locator('#shapeTool').tap();
      const menu = await mobile.locator('#shapeOptions').boundingBox();
      assert.ok(menu.x >= 0 && menu.x + menu.width <= width);
      await mobile.locator('[data-draw="star"]').tap();
      await mobile.touchscreen.tap(width / 2, 230);
      await mobile.locator('#toggleLeft').tap();
      const left = await mobile.locator('.layers-panel').boundingBox();
      assert.ok(left.x >= -1 && left.x + left.width <= width + 1);
      // A grip handles native touch pointer events without turning a vertical drag into page scrolling.
      const a = await mobile.locator('[data-key="A"] .layer-grip').boundingBox(),
        c = await mobile.locator('[data-key="C"]').boundingBox();
      const session = await context.newCDPSession(mobile);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }],
      });
      for (let step = 1; step <= 8; step++)
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: a.x + a.width / 2,
              y: a.y + a.height / 2 + ((c.y + 3 - a.y - a.height / 2) * step) / 8,
            },
          ],
        });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const ids = (await project(mobile)).shapes.map((s) => s.id);
      assert.ok(ids.indexOf('A') > ids.indexOf('C'), 'Touch grip changes stacking');
      await mobile.locator('#toggleLeft').tap();
      await mobile.waitForFunction(
        () => document.getElementById('toggleLeft').getAttribute('aria-expanded') === 'false',
      );
      await mobile.locator('#toolbarCode').tap();
      await mobile.waitForFunction(() => !!window.CodeWorkbench);
      const code = await mobile.locator('#dialog').boundingBox();
      assert.ok(code.x >= 0 && code.width <= width);
      await mobile.locator('#close').tap();
      await mobile.screenshot({ path: 'tests/mobile-tools-' + width + '.png' });
      await context.close();
    }
    console.log(
      'PASS stroke, skew, chain ratio, generous corner hit regions, layer drag, and mobile 360/390',
    );
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      console.error(
        await currentPage.evaluate(() => ({
          width: innerWidth,
          classes: document.body.className,
          trace: window.testPanelEvents,
          left: document.getElementById('toggleLeft').getAttribute('aria-expanded'),
          right: document.getElementById('toggleRight').getAttribute('aria-expanded'),
        })),
      );
      await currentPage.screenshot({ path: 'tests/editor-tools-failure.png' }).catch(() => {});
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
