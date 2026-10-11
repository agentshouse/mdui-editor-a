import test from 'node:test';
import assert from 'node:assert/strict';
import {suites, assertDiscovery, aggregate} from '../scripts/test-runner-contract.mjs';
const passing = () => suites.map(file => ({file, success: true, total: 2, passed: 2, failed: 0, skipped: 0}));
test('discovery accepts every intended suite', () => assertDiscovery(suites));
test('discovery refuses an omitted or added suite', () => {
  assert.throws(() => assertDiscovery(suites.slice(1)));
  assert.throws(() => assertDiscovery([...suites, 'tests/support/upstream/example.test.js']));
});
test('discovery refuses duplicate suites', () => assert.throws(() => assertDiscovery([...suites.slice(1), suites[1]])));
test('aggregate reports every passed test', () => assert.deepEqual(aggregate(passing()), {suites: 7, tests: 14, passed: 14, failed: 0, skipped: 0}));
test('aggregate cannot hide missing, failed, skipped or incomplete results', () => {
  assert.throws(() => aggregate(passing().slice(1)));
  for (const changes of [{success:false},{failed:1},{skipped:1},{passed:1},{total:0}]) {
    const rows=passing();Object.assign(rows[0],changes);assert.throws(() => aggregate(rows));
  }
});
