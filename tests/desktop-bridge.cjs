const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(
  require('node:path').join(__dirname, '../.test-build/desktop-bridge.vm.js'),
  'utf8',
);
function bridge(window, extras = {}) {
  const scope = { window, ...extras };
  vm.runInNewContext(source, scope);
  return scope.DesktopBridgeTest.desktopBridge;
}
test('Tauri saves via the native command and keeps cancellation distinct from success', async () => {
  let result = false;
  const calls = [];
  const api = bridge({
    __TAURI__: {
      core: {
        invoke: async (...args) => {
          calls.push(args);
          return result;
        },
      },
    },
  });
  assert.equal(await api.save('design', 'svg-design.svg', 'image/svg+xml'), false);
  result = true;
  assert.equal(await api.save('project', 'svg-projeto.json', 'application/json'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [
    'save_document',
    { name: 'svg-design.svg', content: 'design' },
  ]);
});
test('native write errors propagate to the editor', async () => {
  const api = bridge({
    __TAURI__: {
      core: {
        invoke: async () => {
          throw Error('disk full');
        },
      },
    },
  });
  await assert.rejects(api.save('data', 'svg-projeto.json', 'application/json'), /disk full/);
});
test('browser fallback downloads a blob and releases its URL', async () => {
  const link = {
    click() {
      this.clicked = true;
    },
  };
  let revoked;
  const api = bridge(
    {},
    {
      Blob,
      document: { createElement: () => link },
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: (url) => (revoked = url) },
      setTimeout: (fn) => fn(),
    },
  );
  assert.equal(await api.save('svg', 'svg-design.svg', 'image/svg+xml'), true);
  assert.equal(link.download, 'svg-design.svg');
  assert.equal(link.clicked, true);
  assert.equal(revoked, 'blob:test');
});
test('copy uses the clipboard API when available', async () => {
  let copied;
  const api = bridge(
    {},
    { navigator: { clipboard: { writeText: async (text) => (copied = text) } } },
  );
  await api.copy('<svg/>');
  assert.equal(copied, '<svg/>');
});
test('clipboard fallback copies text and restores focus', async () => {
  let removed = false,
    focused = false;
  const input = {
    style: {},
    select() {
      this.selected = true;
    },
    remove() {
      removed = true;
    },
  };
  const api = bridge(
    {},
    {
      navigator: {
        clipboard: {
          writeText: async () => {
            throw Error('denied');
          },
        },
      },
      document: {
        activeElement: {
          focus() {
            focused = true;
          },
        },
        body: { appendChild() {} },
        createElement: () => input,
        execCommand: (cmd) => cmd === 'copy',
      },
    },
  );
  await api.copy('código');
  assert.equal(input.value, 'código');
  assert.equal(input.selected, true);
  assert.equal(removed, true);
  assert.equal(focused, true);
});
test('clipboard failure reports failure and removes temporary input', async () => {
  let removed = false;
  const input = {
    style: {},
    select() {},
    remove() {
      removed = true;
    },
  };
  const api = bridge(
    {},
    {
      navigator: {},
      document: {
        body: { appendChild() {} },
        createElement: () => input,
        execCommand: () => false,
      },
    },
  );
  await assert.rejects(api.copy('text'), /Ctrl\+C/);
  assert.equal(removed, true);
});
