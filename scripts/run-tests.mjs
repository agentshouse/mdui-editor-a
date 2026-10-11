import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import {suites, assertDiscovery, aggregate} from './test-runner-contract.mjs';
assert.equal(process.argv.length, 2, 'This complete gate does not accept test filters.');
const executable = 'node_modules/vitest/vitest.mjs';
const options = {timeout: 180_000, env: {...process.env, FORCE_COLOR: '0'}};
const listing = execFileSync(process.execPath, [executable, 'list', '--filesOnly'], {...options, encoding: 'utf8'});
assertDiscovery(stripVTControlCharacters(listing).trim().split('\n').filter(Boolean));
fs.mkdirSync('.build/test-results', {recursive: true});
const results = [];
for (const file of suites) {
  const output = path.resolve('.build/test-results', `${path.basename(file)}.json`);
  fs.rmSync(output, {force: true});
  // A fresh process per suite prevents state/resource accumulation. Vitest's
  // existing isolation, per-test timeouts and every assertion remain unchanged.
  execFileSync(process.execPath, [executable, 'run', '--maxWorkers=1', '--reporter=json', `--outputFile=${output}`, file], {...options, stdio: 'inherit'});
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.deepEqual(report.testResults.map(result => result.name), [path.resolve(file)], 'Unexpected suite in result file.');
  const result = {file, success: report.success, total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests};
  results.push(result);
  console.log(result);
}
console.log('Complete sequential Vitest gate:', aggregate(results));
