const { chromium, editorURL } = require('./browser-helper.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    const errors = [];
    page.on('pageerror', (e) => e.message !== 'Canceled' && errors.push(e.message));
    await page.goto(editorURL + '/SVG-Editor-Generator/');
    await page.waitForSelector('.handle');
    async function corner() {
      return page
        .locator('.handle')
        .first()
        .evaluate((node) => {
          const p = document.getElementById('canvas').createSVGPoint();
          p.x = Number(node.getAttribute('cx'));
          p.y = Number(node.getAttribute('cy'));
          const q = p.matrixTransform(document.getElementById('camera').getScreenCTM());
          return { x: q.x, y: q.y };
        });
    }
    for (const zoom of ['minus', 'plus', 'plus']) {
      await page.click('#' + zoom);
      const p = await corner();
      await page.mouse.click(p.x + 6, p.y);
      assert.equal(await page.locator('.selected-edge').count(), 0);
      assert.equal(await page.locator('.handle.selected').count(), 1);
    }
    const p = await corner();
    await page.mouse.dblclick(p.x + 6, p.y);
    assert.equal(await page.locator('.handle').count(), 4);
    const saved = await page.evaluate(() => localStorage.getItem('svg-editor-project'));
    await page.reload();
    await page.waitForSelector('.handle');
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('svg-editor-project')).shapes.length,
      ),
      JSON.parse(saved).shapes.length,
    );
    await page.click('#code');
    await page.waitForFunction(() => !!window.CodeWorkbench);
    await page.click('[data-code-tab="html"]');
    await page.evaluate(() => window.CodeWorkbench.setValue('html', ''));
    await page.reload();
    await page.waitForFunction(() => !!window.CodeWorkbench);
    assert.equal(await page.evaluate(() => window.CodeWorkbench.getValue('html')), '');
    assert.deepEqual(errors, []);
    console.log(
      'Pontos: clique real perto do vértice, zoom, duplo clique, caminho Pages e autosave de HTML vazio aprovados.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
