const path = require('node:path');
let playwright;
try {
  playwright = require('playwright');
} catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
}
const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = (options) =>
  originalLaunch({
    ...options,
    ...(process.env.TEST_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.TEST_BROWSER_EXECUTABLE,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        }
      : {}),
  });
module.exports = {
  ...playwright,
  editorURL: process.env.TEST_EDITOR_URL || 'http://127.0.0.1:8080',
};
