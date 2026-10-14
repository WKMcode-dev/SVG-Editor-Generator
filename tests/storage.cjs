const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { ProjectStorage, PROJECT_STORAGE_KEY } = require('../.test-build/project-storage.cjs');
const G = require('../.test-build/geometry.cjs');
const shape = {
  id: 'A',
  name: 'A',
  type: 'rectangle',
  points: G.points('rectangle'),
  fill: '#222427',
  stroke: '#d99046',
  strokeWidth: 2,
  opacity: 100,
  join: 'miter',
  cut: 0,
};
function memory() {
  const map = new Map();
  return { map, getItem: (k) => map.get(k) || null, setItem: (k, v) => map.set(k, v) };
}
test('storage round trip preserves project and empty HTML/CSS', () => {
  const data = memory(),
    store = new ProjectStorage(data),
    project = {
      version: 1,
      shapes: [shape],
      workspace: { html: '', css: '', theme: 'vs', autoRepair: false },
    };
  store.save(project);
  assert.deepEqual(store.load(), project);
});
test('invalid JSON and invalid geometry are not loaded', () => {
  const data = memory(),
    store = new ProjectStorage(data);
  data.map.set(PROJECT_STORAGE_KEY, '{');
  assert.equal(store.load(), null);
  data.map.set(
    PROJECT_STORAGE_KEY,
    JSON.stringify({ version: 1, shapes: [{ ...shape, opacity: 500 }] }),
  );
  assert.equal(store.load(), null);
});
test('empty projects persist without being replaced by the default shape', () => {
  const store = new ProjectStorage(memory());
  store.save({ version: 1, shapes: [] });
  assert.deepEqual(store.load(), { version: 1, shapes: [] });
});
test('storage failures remain observable to the caller', () => {
  const store = new ProjectStorage({
    getItem: () => null,
    setItem() {
      throw Error('quota exceeded');
    },
  });
  assert.throws(() => store.save({ version: 1, shapes: [] }), /quota exceeded/);
});
