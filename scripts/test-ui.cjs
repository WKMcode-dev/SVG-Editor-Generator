const { spawnSync } = require('node:child_process');
const { createServer } = require('./serve.cjs');
const server = createServer();
server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  const { spawn } = require('node:child_process');
  let failed = false;
  for (const script of [
    'ui',
    'features',
    'selection',
    'radius',
    'corners-selection',
    'ide',
    'point-priority',
    'workspace',
    'figma-workspace',
    'live-workspace',
  ]) {
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [`tests/${script}.cjs`], {
        stdio: 'inherit',
        env: { ...process.env, TEST_EDITOR_URL: url },
      });
      child.on('error', () => resolve(1));
      child.on('exit', resolve);
    });
    if (code !== 0) {
      failed = true;
      break;
    }
  }
  server.close(() => {
    process.exitCode = failed ? 1 : 0;
  });
});
