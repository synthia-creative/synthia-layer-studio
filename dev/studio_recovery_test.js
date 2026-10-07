const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const J = { ui: { project: { title: 'old' } }, studioOn: () => true, layerText: (_, en) => en };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/11zz_zzzrecovery.js'), 'utf8'), { J, structuredClone, Date });
  J.studioRecoveryPending = false;
  return J;
}

test('a delayed older save cannot overwrite the newest editing snapshot', async () => {
  const J = setup(), waiting = [], stored = [];
  J.openStudioRecovery = () => new Promise(resolve => waiting.push(resolve));
  const db = { transaction() {
    const tx = { objectStore: () => ({ put(snapshot) { stored.push(snapshot.project.title); queueMicrotask(() => tx.oncomplete()); } }) };
    return tx;
  } };
  const older = J.saveStudioSnapshot();
  J.ui.project.title = 'new';
  const newer = J.saveStudioSnapshot();
  waiting[1](db);
  assert.equal(await newer, true);
  waiting[0](db);
  assert.equal(await older, false);
  assert.deepEqual(stored, ['new']);
});

test('snapshot reads resolve only after their IndexedDB transaction completes', async () => {
  const J = setup(), expected = { schema: 1 }, request = { result: expected };
  let tx, resolved = false, ready;
  const transactionReady = new Promise(resolve => { ready = resolve; });
  J.openStudioRecovery = async () => ({ transaction() { tx = { objectStore: () => ({ get: () => request }) }; ready(); return tx; } });
  const read = J.readStudioSnapshot().then(result => { resolved = true; return result; });
  await transactionReady;
  assert.equal(resolved, false);
  tx.oncomplete();
  assert.equal(await read, expected);
});
