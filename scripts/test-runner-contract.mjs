import assert from 'node:assert/strict';
export const suites = ['tests/csv.test.js','tests/document-templates.test.js','tests/draft-session.test.js','tests/editor.test.js','tests/model.test.js','tests/navigation.test.js','tests/storage.test.js','tests/ui.test.js'];
export function assertDiscovery(discovered) {
  assert.deepEqual([...discovered].sort(), suites, 'Test discovery changed: review coverage before updating the complete suite list.');
}
export function aggregate(results) {
  assertDiscovery(results.map(result => result.file));
  for (const result of results) {
    assert.equal(result.success, true, `${result.file} did not succeed`);
    assert(Number.isInteger(result.total) && result.total > 0, `Missing tests in ${result.file}`);
    assert.equal(result.failed, 0, `${result.file} has failures`);
    assert.equal(result.skipped, 0, `${result.file} has skipped tests`);
    assert.equal(result.passed, result.total, `${result.file} has incomplete results`);
  }
  return { suites: results.length, tests: results.reduce((count, result) => count + result.total, 0), passed: results.reduce((count, result) => count + result.passed, 0), failed: 0, skipped: 0 };
}
