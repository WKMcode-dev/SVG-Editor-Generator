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
      errors = [],
      consoleErrors = [];
    page.on('pageerror', (e) => e.message !== 'Canceled' && errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await page.goto(require('./browser-helper.cjs').editorURL);
    await page.waitForFunction(() => !!window.CodeWorkbench);
    await page.click('#code');
    await page.waitForSelector('.monaco-editor');
    assert.equal(await page.locator('#editorTheme').inputValue(), 'vs');
    await page.selectOption('#editorTheme', 'quiet-paper');
    assert.ok(
      await page
        .locator('.monaco-editor')
        .evaluate((e) => getComputedStyle(e).backgroundColor === 'rgb(222, 216, 206)'),
    );
    // Real HTML/CSS language workers must answer; a textarea imitation is insufficient.
    const initialHtml = await page.evaluate(() => window.CodeWorkbench.getValue('html'));
    await page.click('[data-code-tab="html"]');
    await page.evaluate(() => {
      const w = window.CodeWorkbench;
      w.setValue('html', '<d');
      w.editor.setPosition({ lineNumber: 1, column: 3 });
      w.editor.focus();
      w.editor.trigger('test', 'editor.action.triggerSuggest', {});
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.suggest-widget .monaco-list-row')].some((e) =>
        /\bdiv\b/.test(e.textContent),
      ),
    );
    await page.keyboard.press('Escape');
    await page.evaluate((text) => window.CodeWorkbench.setValue('html', text), initialHtml);
    await page.click('[data-code-tab="css"]');
    await page.evaluate(() =>
      window.CodeWorkbench.setValue(
        'css',
        'body { background: #c9c1b5; }\n.card-forma path { stroke: #b46f39; fill: #636761; }',
      ),
    );
    await page.waitForFunction(
      () => document.querySelector('.shape').getAttribute('stroke') === '#b46f39',
    );
    await page.evaluate(() => window.CodeWorkbench.setValue('css', 'body { colr: #37352f;'));
    await page.waitForFunction(
      () =>
        window.CodeWorkbench.getValue('css').includes('color:') &&
        window.CodeWorkbench.getValue('css').includes('}'),
    );
    await page.evaluate(() =>
      window.CodeWorkbench.setValue('css', 'body { made-up-property: red; }'),
    );
    await page.waitForFunction(() =>
      window.CodeWorkbench.getMarkers('css').some((m) => /Unknown property/i.test(m.message)),
    );
    await page.evaluate(() => window.CodeWorkbench.setValue('css', 'body { color: #37352f; }'));
    await page.click('[data-code-tab="svg"]');
    const svg = await page.evaluate(() => window.CodeWorkbench.getValue('svg'));
    await page.evaluate(
      (text) =>
        window.CodeWorkbench.setValue('svg', text.replace(/stroke="[^"]+"/, 'stoke="#945a32"')),
      svg,
    );
    await page.waitForFunction(
      () => document.querySelector('.shape').getAttribute('stroke') === '#945a32',
    );
    assert.match(
      await page.evaluate(() => window.CodeWorkbench.getValue('svg')),
      /stroke="#945a32"/,
    );
    await page.uncheck('#autoRepair');
    const good = await page.evaluate(() => window.CodeWorkbench.getValue('svg'));
    await page.evaluate(
      (text) => window.CodeWorkbench.setValue('svg', text.replace(/Z\s*"/, 'C "')),
      good,
    );
    await page.waitForFunction(() => window.CodeWorkbench.getMarkers('svg').length > 0);
    assert.equal(await page.locator('.shape').getAttribute('stroke'), '#945a32');
    await page.evaluate((text) => window.CodeWorkbench.setValue('svg', text), good);
    await page.waitForFunction(() => window.CodeWorkbench.getMarkers('svg').length === 0);
    await page.click('[data-code-tab="html"]');
    await page.evaluate(() =>
      window.CodeWorkbench.setValue(
        'html',
        '<div class="card"><h2>Minha interface</h2><p>HTML editável</p>' +
          window.CodeWorkbench.getValue('svg') +
          '</div>',
      ),
    );
    await page.click('[data-code-tab="preview"]');
    await page.frameLocator('#htmlPreview').getByText('Minha interface').waitFor();
    assert.equal(await page.frameLocator('#htmlPreview').locator('script').count(), 0);
    const exported = await page.evaluate(() => window.CodeWorkbench.exportHTML());
    assert.match(exported, /Minha interface/);
    assert.match(exported, /<style>/);
    await page.click('[data-code-tab="svg"]');
    await page.screenshot({ path: 'tests/preview-ide.png' });
    await page.click('#close');
    await page.click('#background');
    assert.equal(
      await page.locator('.stage').evaluate((e) => getComputedStyle(e).backgroundColor),
      'rgb(17, 17, 23)',
    );
    await page.reload();
    await page.waitForFunction(() => !!window.CodeWorkbench);
    assert.equal(await page.locator('#editorTheme').inputValue(), 'quiet-paper');
    assert.match(
      await page.evaluate(() => window.CodeWorkbench.getValue('html')),
      /Minha interface/,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    console.log(
      'IDE: Monaco real, workers HTML/CSS offline, temas, autocomplete, correções, diagnóstico, prévia, sincronização CSS/SVG e persistência passaram.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
