const { chromium } = require('playwright');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  if (process.platform !== 'win32') throw Error('Este teste exige Windows/WebView2.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-native-test-'));
  const executable = path.resolve('src-tauri/target/release/svg-editor-generator.exe');
  const app = spawn(executable, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
    stdio: 'ignore',
  });
  let browser;
  try {
    for (let i = 0; i < 40; i++) {
      if (app.exitCode !== null)
        throw Error('O aplicativo terminou antes de carregar a interface.');
      try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1000 });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!browser) throw Error('Não foi possível conectar ao WebView2.');
    const context = browser.contexts()[0];
    if (!context) throw Error('Contexto WebView2 ausente.');
    let page;
    for (let i = 0; i < 20; i++) {
      page = context.pages().find((p) => /tauri\.localhost/.test(p.url()));
      if (page) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!page) throw Error('Página interna não carregou: possível tela preta.');
    await page.waitForSelector('.shape', { timeout: 15000 });
    await page.waitForFunction(() => !!window.CodeWorkbench, { timeout: 15000 });
    assert.equal(await page.title(), 'SVG Editor Generator');
    assert.equal(await page.locator('.handle').count(), 4);
    assert.equal(await page.evaluate(() => typeof window.__TAURI__?.core?.invoke), 'function');
    await page.fill('#shapeWidth', '620');
    await page.locator('#shapeWidth').dispatchEvent('change');
    assert.equal(await page.locator('#shapeWidth').inputValue(), '620');
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('svg-editor-project')).shapes.length,
      ),
      1,
    );
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/native-startup.png' });
    console.log(
      'WebView2 nativo: interface, Monaco, pontos, IPC, dimensões e autosave carregados.',
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (app.pid) spawnSync('taskkill', ['/pid', String(app.pid), '/t', '/f'], { stdio: 'ignore' });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
